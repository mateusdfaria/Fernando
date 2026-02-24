const {
    connectToWhatsApp,
    getSocket,
    getQRCode,
    isConnected,
    disconnect
} = require('./connection');
const { getMenuService } = require('./services/menuService');
const {
    upsertConversationForOutgoing,
    insertMessage
} = require('../database');

// Adapter functions to match existing routes.js expectations
const initWhatsApp = connectToWhatsApp;
const isWhatsAppReady = isConnected;
const getCurrentQRCode = getQRCode;
const disconnectWhatsApp = disconnect;
const getClient = getSocket;

function formatJid(to) {
    if (!to.includes('@')) {
        return `${to}@s.whatsapp.net`;
    }
    return to;
}

async function sendTextMessage(to, text) {
    const sock = getSocket();
    if (!sock) {
        throw new Error('WhatsApp não está conectado');
    }

    const jid = formatJid(to);

    await sock.sendMessage(jid, { text });

    // Registrar mensagem de saída no banco (não incrementa unread)
    try {
        const now = Date.now();
        const conversation = await upsertConversationForOutgoing(jid, text, now);
        await insertMessage(conversation.id, {
            direction: 'out',
            body: text,
            timestampMs: now,
            fromMe: true
        });
    } catch (err) {
        console.error('Erro ao registrar mensagem de saída no banco:', err);
    }
}

async function sendMenu(to) {
    const service = getMenuService();
    const menuText = await service.generateMenuText();
    await sendTextMessage(to, menuText);
}

module.exports = {
  initWhatsApp,
  isWhatsAppReady,
  getCurrentQRCode,
  disconnectWhatsApp,
  getClient,
  sendMenu,
  sendTextMessage
};
