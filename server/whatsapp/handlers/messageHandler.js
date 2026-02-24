const { getResponseByOption, getConversationByRemoteJid, setConversationWaitingForAttendant } = require('../../database');
const { getMenuService } = require('../services/menuService');

// In-memory conversation state
const conversationState = {};

async function handleMessage(sock, m, sendTextAndLog) {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;

    // Ignore groups
    if (remoteJid.includes('@g.us')) return;

    // Extract text body
    const body = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

    if (!body) return;

    console.log(`\n📨 Mensagem de ${remoteJid}: ${body}`);

    // Regras de automação:
    // - Se o responsável assumiu a conversa (assistant_enabled = 0), não responder automaticamente.
    // - Se não for cliente novo (is_new_client = 0), também não responder automaticamente.
    try {
        const conv = await getConversationByRemoteJid(remoteJid);
        if (conv && (conv.assistant_enabled === 0 || conv.is_new_client === 0)) {
            return;
        }
    } catch (err) {
        // Se falhar, não bloqueia o atendimento automático (fallback)
    }

    // Get current state
    const phoneNumber = remoteJid.split('@')[0];
    const currentState = conversationState[phoneNumber] || { step: 'menu' };

    const sendText = sendTextAndLog || (async (text) => {
        await sock.sendMessage(remoteJid, { text });
    });

    // Helper to send menu
    const sendMenu = async () => {
        const service = getMenuService();
        const menuText = await service.generateMenuText();
        await sendText(menuText);
        conversationState[phoneNumber] = { step: 'waiting_option', lastMessage: Date.now() };
    };

    try {
        const bodyLower = body.trim().toLowerCase();

        // Reset loop
        if (bodyLower === 'menu' || bodyLower === 'oi' || bodyLower === 'olá') {
            await sendMenu();
            return;
        }

        // Process logic based on state
        if (currentState.step === 'waiting_option') {
            const option = parseInt(body);
            if (!isNaN(option)) {
                const response = await getResponseByOption(option);
                if (response) {
                    await sendText(response.message);

                    const isAttendantOption = response.title && /atendente/i.test(response.title);
                    if (isAttendantOption) {
                        try {
                            await setConversationWaitingForAttendant(remoteJid, true, Date.now());
                        } catch (err) {
                            console.error('Erro ao marcar espera por atendente:', err);
                        }
                    }

                    if (response.hasSubmenu) {
                        conversationState[phoneNumber] = { step: 'submenu', parentOption: option, lastMessage: Date.now() };
                    } else {
                        // Reset to menu state but don't resend menu immediately unless configured
                        conversationState[phoneNumber] = { step: 'menu', lastMessage: Date.now() };
                    }
                } else {
                    await sendText('❌ Opção inválida. Digite o número da opção desejada.');
                    await sendMenu();
                }
            } else {
                await sendText('❌ Por favor, digite o NÚMERO da opção.');
                await sendMenu();
            }
        } else {
            // Default entry point
            await sendMenu();
        }

        // Cleanup old states
        const oneHour = 60 * 60 * 1000;
        if (currentState.lastMessage && (Date.now() - currentState.lastMessage > oneHour)) {
            delete conversationState[phoneNumber];
        }

    } catch (error) {
        console.error('Erro no handler:', error);
    }
}

module.exports = { handleMessage };
