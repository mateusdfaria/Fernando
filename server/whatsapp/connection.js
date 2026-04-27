// Bypass Node.js strict TLS for self-signed certificates (Fixes connection in corporate networks)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const {
    default: makeWASocket,
    Browsers,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Caminho absoluto para a pasta de autenticação (evita problemas de cwd)
const AUTH_FOLDER = path.join(__dirname, '..', '..', 'baileys_auth_info');
const {
    upsertConversation,
    upsertConversationForOutgoing,
    insertMessage,
    getConversationByRemoteJid,
    setConversationIsNewClient
} = require('../database');

// Pasta onde os arquivos de mídia serão salvos
const MEDIA_DIR = path.join(__dirname, '..', 'uploads', 'media');
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Detecta tipo de mídia e extensão da mensagem
function getMediaInfo(msg) {
    if (msg.message?.imageMessage) return { type: 'image', ext: 'jpg' };
    if (msg.message?.audioMessage) return { type: 'audio', ext: 'ogg' };
    if (msg.message?.videoMessage) return { type: 'video', ext: 'mp4' };
    return null;
}

// Baixa mídia e salva em disco, retorna o nome do arquivo
async function saveMediaToDisk(msg, type, ext) {
    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (!buffer || buffer.length === 0) return null;
        const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
        fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
        return filename;
    } catch (err) {
        console.error(`Erro ao baixar mídia (${type}):`, err.message);
        return null;
    }
}

let sock = null;
let currentQRCode = null;
let isReady = false;
let isConnecting = false;
let connectedAt = null; // timestamp (ms) da última conexão bem-sucedida
let connectionState = 'idle'; // idle | connecting | qr | open | close | reconnecting | error
let lastError = null;
let lastDisconnectCode = null;
let qrGeneratedAt = null;
let lastConnectionUpdateAt = null;

// Logger configuration
const logger = pino({ level: 'info' });

async function connectToWhatsApp() {
    // Evita conexões concorrentes que podem invalidar o QR/pairing
    if (sock || isConnecting) {
        return sock;
    }

    isConnecting = true;
    connectionState = 'connecting';
    lastError = null;
    lastDisconnectCode = null;
    lastConnectionUpdateAt = Date.now();

    let state;
    let saveCreds;
    let version;
    try {
        if (!fs.existsSync(AUTH_FOLDER)) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        }
        const authState = await useMultiFileAuthState(AUTH_FOLDER);
        state = authState.state;
        saveCreds = authState.saveCreds;
    } catch (err) {
        isConnecting = false;
        connectionState = 'error';
        lastError = err?.message || 'Erro ao inicializar autenticação do WhatsApp';
        lastConnectionUpdateAt = Date.now();
        throw err;
    }

    // Tenta buscar a versão mais recente do Baileys; usa fallback se falhar
    try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
        console.log(`Usando Baileys v${version.join('.')} (online)`);
    } catch (err) {
        version = [2, 3000, 1015901307]; // Versão estável conhecida
        console.warn('Não foi possível buscar versão do Baileys online. Usando fallback:', version.join('.'));
    }


    sock = makeWASocket({
        version,
        logger,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: true,
        // Habilitar sincronização de mais histórico (ainda assim, limitado pelo WhatsApp)
        syncFullHistory: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        lastConnectionUpdateAt = Date.now();

        if (qr) {
            console.log('Novo QR Code gerado');
            connectionState = 'qr';
            qrGeneratedAt = Date.now();
            try {
                currentQRCode = await QRCode.toDataURL(qr);
            } catch (err) {
                console.error('Erro ao gerar QR Code imagem:', err);
                connectionState = 'error';
                lastError = err?.message || 'Erro ao gerar QR Code';
            }
        }

        if (connection === 'close') {
            const disconnectCode = (lastDisconnect?.error)?.output?.statusCode || null;
            const disconnectMessage = (lastDisconnect?.error)?.message || 'Conexão fechada';
            const shouldReconnect = disconnectCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada devido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect);
            isReady = false;
            isConnecting = false;
            connectionState = shouldReconnect ? 'reconnecting' : 'close';
            lastDisconnectCode = disconnectCode;
            lastError = disconnectMessage;
            currentQRCode = null;
            qrGeneratedAt = null;
            connectedAt = null;
            sock = null;

            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                // Session is invalid (Logged Out / 401)
                console.log('⚠ Sessão inválida ou desconectada pelo celular. Limpando credenciais e gerando novo QR Code...');

                // Clear state
                isReady = false;
                isConnecting = false;
                connectionState = 'connecting';
                currentQRCode = null;
                qrGeneratedAt = null;
                sock = null;

                // Nuke the auth folder to force fresh login
                try {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                    console.log('✅ Pasta de credenciais limpa.');
                } catch (err) {
                    console.error('Erro ao limpar pasta de credenciais:', err);
                }

                // Restart connection logic to show new QR
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Conectado ao WhatsApp com sucesso!');
            isReady = true;
            isConnecting = false;
            connectionState = 'open';
            lastError = null;
            lastDisconnectCode = null;
            currentQRCode = null;
            qrGeneratedAt = null;
            connectedAt = Date.now();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Setup message listener
    const { handleMessage } = require('./handlers/messageHandler');
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages && m.messages[0];
            if (!msg) return;

            const tsSeconds = msg.messageTimestamp || msg.message?.messageTimestamp;
            const tsMs = tsSeconds ? tsSeconds * 1000 : null;
            const remoteJid = msg.key.remoteJid;

            // Registrar mensagem no banco (entrada), inclusive histórico,
            // mas apenas para conversas individuais e não enviadas por nós.
            const body =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                '';
            const mediaInfo = getMediaInfo(msg);
            const hasContent = !!(body || mediaInfo);

            if (hasContent && remoteJid && !remoteJid.includes('@g.us')) {
                try {
                    const isFromMe = !!msg.key.fromMe;
                    const existing = await getConversationByRemoteJid(remoteJid);
                    const isHistory = connectedAt && tsMs && tsMs < connectedAt;

                    // Baixar mídia se for mensagem de mídia
                    let mediaFilename = null;
                    if (mediaInfo) {
                        mediaFilename = await saveMediaToDisk(msg, mediaInfo.type, mediaInfo.ext);
                    }

                    const lastMsgPreview = body || (mediaInfo ? `[ ${mediaInfo.type} ]` : '');

                    const conversation = isFromMe
                        ? await upsertConversationForOutgoing(remoteJid, lastMsgPreview, tsMs || Date.now())
                        : await upsertConversation(remoteJid, lastMsgPreview, tsMs || Date.now(), msg.pushName);

                    if (!existing && isHistory) {
                        await setConversationIsNewClient(conversation.id, false);
                    }

                    await insertMessage(conversation.id, {
                        direction: isFromMe ? 'out' : 'in',
                        body,
                        timestampMs: tsMs || Date.now(),
                        fromMe: isFromMe,
                        mediaType: mediaInfo ? mediaInfo.type : null,
                        mediaFilename
                    });
                } catch (dbErr) {
                    console.error('Erro ao registrar mensagem no banco:', dbErr);
                }
            }

            // Só deixar o assistente processar mensagens novas (após a conexão),
            // para não responder automaticamente conversas antigas.
            if (connectedAt && tsMs && tsMs < connectedAt) {
                return;
            }

            const sendTextAndLog = async (text) => {
                await sock.sendMessage(remoteJid, { text });
                try {
                    const now = Date.now();
                    const conv = await upsertConversationForOutgoing(remoteJid, text, now);
                    await insertMessage(conv.id, {
                        direction: 'out',
                        body: text,
                        timestampMs: now,
                        fromMe: true
                    });
                } catch (dbErr) {
                    console.error('Erro ao registrar mensagem do assistente no banco:', dbErr);
                }
            };

            await handleMessage(sock, m, sendTextAndLog);
        } catch (error) {
            console.error('Erro no processamento de mensagens:', error);
        }
    });

    return sock;
}

function getSocket() {
    return sock;
}

function getQRCode() {
    return currentQRCode;
}

function isConnected() {
    return isReady;
}

function getConnectionStatus() {
    return {
        ready: isReady,
        connecting: isConnecting,
        state: connectionState,
        hasQRCode: !!currentQRCode,
        qrGeneratedAt,
        connectedAt,
        lastDisconnectCode,
        lastError,
        updatedAt: lastConnectionUpdateAt
    };
}

async function disconnect() {
    if (sock) {
        try {
            await sock.logout();
        } catch (err) {
            // Ignore errors during logout if already closed
        }
        sock.end(undefined);
        sock = null;
        isReady = false;
        isConnecting = false;
        connectionState = 'idle';
        lastError = null;
        lastDisconnectCode = null;
        currentQRCode = null;
        qrGeneratedAt = null;
        connectedAt = null;
        lastConnectionUpdateAt = Date.now();
        console.log('Desconectado manualmente.');
    }
}

module.exports = {
    connectToWhatsApp,
    getSocket,
    getQRCode,
    isConnected,
    getConnectionStatus,
    disconnect
};
