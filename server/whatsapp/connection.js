// Bypass Node.js strict TLS for self-signed certificates (Fixes connection in corporate networks)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const {
    upsertConversation,
    upsertConversationForOutgoing,
    insertMessage,
    getConversationByRemoteJid,
    setConversationIsNewClient
} = require('../database');

let sock = null;
let currentQRCode = null;
let isReady = false;
let connectedAt = null; // timestamp (ms) da última conexão bem-sucedida

// Logger configuration
const logger = pino({ level: 'info' });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`Usando Baileys v${version.join('.')}`);

    sock = makeWASocket({
        version,
        logger,
        auth: state,
        browser: ['Bonsai Shop', 'Chrome', '1.0.0'],
        // Habilitar sincronização de mais histórico (ainda assim, limitado pelo WhatsApp)
        syncFullHistory: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Novo QR Code gerado');
            try {
                currentQRCode = await QRCode.toDataURL(qr);
            } catch (err) {
                console.error('Erro ao gerar QR Code imagem:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada devido a ', lastDisconnect.error, ', reconectando ', shouldReconnect);
            isReady = false;
            currentQRCode = null;
            connectedAt = null;

            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                // Session is invalid (Logged Out / 401)
                console.log('⚠ Sessão inválida ou desconectada pelo celular. Limpando credenciais e gerando novo QR Code...');

                // Clear state
                isReady = false;
                currentQRCode = null;
                sock = null;

                // Nuke the auth folder to force fresh login
                try {
                    fs.rmSync('baileys_auth_info', { recursive: true, force: true });
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
            currentQRCode = null;
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

            if (body && remoteJid && !msg.key.fromMe && !remoteJid.includes('@g.us')) {
                try {
                    const existing = await getConversationByRemoteJid(remoteJid);
                    const isHistory = connectedAt && tsMs && tsMs < connectedAt;

                    const conversation = await upsertConversation(remoteJid, body, tsMs || Date.now(), msg.pushName);

                    // Se a conversa foi criada a partir de histórico (antes da conexão),
                    // marcamos como não sendo cliente novo (para o assistente não automatizar).
                    if (!existing && isHistory) {
                        await setConversationIsNewClient(conversation.id, false);
                    }

                    await insertMessage(conversation.id, {
                        direction: 'in',
                        body,
                        timestampMs: tsMs || Date.now(),
                        fromMe: false
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
        currentQRCode = null;
        connectedAt = null;
        console.log('Desconectado manualmente.');
    }
}

module.exports = {
    connectToWhatsApp,
    getSocket,
    getQRCode,
    isConnected,
    disconnect
};
