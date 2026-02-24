const express = require('express');
const router = express.Router();
const {
  getMenuOptions,
  addMenuOption,
  updateMenuOption,
  deleteMenuOption,
  getConversations,
  getConversationById,
  getConversationByRemoteJid,
  getConversationMessages,
  updateConversationCategory,
  updateConversationName,
  setConversationAssistantEnabled,
  clearConversationWaitingForAttendant,
  getWaitingForAttendantCount,
  markConversationRead,
  deleteConversation,
  getCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  getConversationsByCategory,
  createScheduledMessage,
  getScheduledMessages,
  deleteScheduledMessage,
  getScheduledMessageById,
  getUserByUsername
} = require('./database');
const { authenticateToken, generateToken } = require('./middleware/auth');
const bcrypt = require('bcrypt');
const {
  isWhatsAppReady,
  sendMenu,
  getClient,
  getCurrentQRCode,
  initWhatsApp,
  disconnectWhatsApp,
  sendTextMessage
} = require('./whatsapp');

// ── Autenticação ────────────────────────────────────────────────

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateToken(user);
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proteger todas as rotas abaixo com JWT
router.use(authenticateToken);

// ── Menu ────────────────────────────────────────────────────────

// Obter todas as opções do menu
router.get('/menu-options', async (req, res) => {
  try {
    const options = await getMenuOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar nova opção
router.post('/menu-options', async (req, res) => {
  try {
    const { title, message, option_number } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }
    const option = await addMenuOption(title, message, option_number);
    res.json(option);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar opção
router.put('/menu-options/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, option_number } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }
    const option = await updateMenuOption(id, title, message, option_number);
    res.json(option);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar opção
router.delete('/menu-options/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMenuOption(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do WhatsApp
router.get('/whatsapp/status', (req, res) => {
  const qrCode = getCurrentQRCode();
  res.json({
    ready: isWhatsAppReady(),
    qrCode: qrCode
  });
});

// Conectar WhatsApp (iniciar client)
router.post('/whatsapp/connect', (req, res) => {
  try {
    initWhatsApp();
    res.json({ success: true, message: 'Inicializando WhatsApp...' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Desconectar WhatsApp
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem de teste
router.post('/whatsapp/send-test', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório' });
    }

    if (!isWhatsAppReady()) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    // Formatar número corretamente
    const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
    await sendMenu(formattedNumber);
    res.json({ success: true, message: 'Menu enviado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - listar
router.get('/conversations', async (req, res) => {
  try {
    const { category } = req.query;
    const conversations = await getConversations(category || null);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - contagem de espera por atendimento
router.get('/conversations/waiting-count', async (req, res) => {
  try {
    const count = await getWaitingForAttendantCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - mensagens de uma conversa
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const messages = await getConversationMessages(id);
    res.json({
      conversation,
      messages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - responder
router.post('/conversations/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (!isWhatsAppReady()) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    await sendTextMessage(conversation.remote_jid, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - atualizar categoria e/ou nome
router.patch('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name } = req.body;

    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const result = {};
    if (category !== undefined) {
      const cat = await updateConversationCategory(id, category || null);
      result.category = cat.category;
    }
    if (name !== undefined) {
      const nm = await updateConversationName(id, name || null);
      result.name = nm.name;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - excluir conversa
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    await deleteConversation(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - ligar/desligar assistente (handoff para humano)
router.post('/conversations/:id/assistant', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const result = await setConversationAssistantEnabled(id, !!enabled);
    if (!enabled) {
      await clearConversationWaitingForAttendant(id);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - marcar como atendido (limpar alerta de espera)
router.post('/conversations/:id/attended', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    await clearConversationWaitingForAttendant(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorias - listar
router.get('/categories', async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorias - criar
router.post('/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    const category = await addCategory(name.trim());
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorias - atualizar
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    const result = await updateCategory(id, name.trim());
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorias - excluir
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    await deleteCategory(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorias - contatos da categoria
router.get('/categories/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    const contacts = await getConversationsByCategory(category.name);
    res.json({ category, contacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversas - marcar como lida
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const result = await markConversationRead(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Agendamentos ────────────────────────────────────────────────

// Listar todos os agendamentos
router.get('/scheduled-messages', async (req, res) => {
  try {
    const messages = await getScheduledMessages();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar novo agendamento
router.post('/scheduled-messages', async (req, res) => {
  try {
    const { phones, message, scheduled_at } = req.body;
    if (!phones || !message || !scheduled_at) {
      return res.status(400).json({ error: 'phones, message e scheduled_at são obrigatórios' });
    }
    // phones pode vir como string separada por vírgula ou como array
    const phonesArr = Array.isArray(phones)
      ? phones.map(p => p.trim()).filter(Boolean)
      : phones.split(',').map(p => p.trim()).filter(Boolean);

    if (phonesArr.length === 0) {
      return res.status(400).json({ error: 'Pelo menos um número de telefone é obrigatório' });
    }
    const scheduled = await createScheduledMessage(phonesArr, message, scheduled_at);
    res.status(201).json(scheduled);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir/cancelar agendamento
router.delete('/scheduled-messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scheduled = await getScheduledMessageById(id);
    if (!scheduled) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    await deleteScheduledMessage(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
