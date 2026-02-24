/**
 * Scheduler — verifica mensagens agendadas a cada 30 segundos e as envia.
 */
const {
    getPendingScheduledMessages,
    updateScheduledMessageStatus,
    upsertConversationForOutgoing,
    insertMessage
} = require('./database');
const { getClient } = require('./whatsapp');

const INTERVAL_MS = 30 * 1000; // 30 segundos

async function processPendingMessages() {
    let pending;
    try {
        pending = await getPendingScheduledMessages();
    } catch (err) {
        console.error('[Scheduler] Erro ao buscar mensagens pendentes:', err);
        return;
    }

    if (!pending || pending.length === 0) return;

    const sock = getClient();

    for (const scheduled of pending) {
        const phones = scheduled.phones; // array de strings
        const message = scheduled.message;
        const id = scheduled.id;

        if (!sock) {
            await updateScheduledMessageStatus(id, 'error', 'WhatsApp não está conectado');
            console.warn(`[Scheduler] Mensagem #${id} não enviada: WhatsApp desconectado`);
            continue;
        }

        let allOk = true;
        const errors = [];

        for (const phone of phones) {
            const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            try {
                await sock.sendMessage(remoteJid, { text: message });

                // Registrar no banco de conversas
                try {
                    const now = Date.now();
                    const conv = await upsertConversationForOutgoing(remoteJid, message, now);
                    await insertMessage(conv.id, {
                        direction: 'out',
                        body: message,
                        timestampMs: now,
                        fromMe: true
                    });
                } catch (dbErr) {
                    console.error(`[Scheduler] Erro ao registrar mensagem #${id} no banco:`, dbErr);
                }

                console.log(`[Scheduler] ✅ Mensagem #${id} enviada para ${phone}`);
            } catch (sendErr) {
                allOk = false;
                errors.push(`${phone}: ${sendErr.message}`);
                console.error(`[Scheduler] ❌ Falha ao enviar mensagem #${id} para ${phone}:`, sendErr.message);
            }
        }

        const finalStatus = allOk ? 'sent' : 'error';
        const errorInfo = errors.length > 0 ? errors.join('; ') : null;
        await updateScheduledMessageStatus(id, finalStatus, errorInfo);
    }
}

function initScheduler() {
    console.log(`[Scheduler] Iniciado — verificando agendamentos a cada ${INTERVAL_MS / 1000}s`);
    // Primeira execução após 10s para garantir que o WhatsApp já iniciou
    setTimeout(() => {
        processPendingMessages();
        setInterval(processPendingMessages, INTERVAL_MS);
    }, 10000);
}

module.exports = { initScheduler };
