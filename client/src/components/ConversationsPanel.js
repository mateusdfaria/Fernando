import React, { useEffect, useState } from 'react';
import axios from 'axios';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

function formatWaitingTime(since) {
  if (!since) return '0s';
  const start = new Date(since).getTime();
  const diff = Math.floor((Date.now() - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ${diff % 60}s`;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m} min`;
}

function ConversationsPanel({ apiUrl, initialConversation, onClearInitialConversation }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // mobile: false=lista, true=detalhe

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryEdit, setCategoryEdit] = useState('');
  const [nameEdit, setNameEdit] = useState('');
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [categoriesList, setCategoriesList] = useState([]);
  const [, setNow] = useState(Date.now());

  const loadCategories = async () => {
    try {
      const res = await axios.get(`${apiUrl}/categories`);
      setCategoriesList(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  };

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const params = {};
      if (categoryFilter) {
        params.category = categoryFilter;
      }
      const res = await axios.get(`${apiUrl}/conversations`, { params });
      setConversations(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversationMessagesSilent = async (conversationId) => {
    try {
      const res = await axios.get(`${apiUrl}/conversations/${conversationId}/messages`);
      setMessages(res.data.messages || []);
      // Atualizar count como lida também de forma silenciosa e a lista nas conversas
      await axios.post(`${apiUrl}/conversations/${conversationId}/read`);
    } catch (err) {
      console.error('Erro ao recarregar mensagens da conversa silentmente:', err);
    }
  };

  const loadConversationMessages = async (conversation) => {
    try {
      setLoadingMessages(true);
      const res = await axios.get(`${apiUrl}/conversations/${conversation.id}/messages`);
      setSelectedConversation(res.data.conversation);
      setMessages(res.data.messages || []);
      setCategoryEdit(res.data.conversation.category || '');
      setNameEdit(res.data.conversation.name || '');
      setAssistantEnabled(res.data.conversation.assistant_enabled !== 0);
      setShowDetail(true); // mobile: navegar para o detalhe

      // Marcar como lida
      await axios.post(`${apiUrl}/conversations/${conversation.id}/read`);
      // Atualizar lista de conversas (para zerar unread_count)
      loadConversationsSilent();
    } catch (err) {
      console.error('Erro ao carregar mensagens da conversa:', err);
    } finally {
      setLoadingMessages(false);
    }
  };


  const loadConversationsSilent = async () => {
    try {
      const params = {};
      if (categoryFilter) {
        params.category = categoryFilter;
      }
      const res = await axios.get(`${apiUrl}/conversations`, { params });
      setConversations(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar conversas via silent poll:', err);
    }
  };

  const handleSelectConversation = (conv) => {
    loadConversationMessages(conv);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedConversation) return;

    // Se há arquivo de mídia, enviar como mídia
    if (mediaFile) {
      setSendingMedia(true);
      try {
        const formData = new FormData();
        formData.append('media', mediaFile);
        if (replyText.trim()) formData.append('caption', replyText.trim());
        await axios.post(`${apiUrl}/conversations/${selectedConversation.id}/reply-media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setReplyText('');
        setMediaFile(null);
        setMediaPreview(null);
        loadConversationMessages(selectedConversation);
      } catch (err) {
        console.error('Erro ao enviar mídia:', err);
        alert('Erro ao enviar mídia: ' + (err.response?.data?.error || err.message));
      } finally {
        setSendingMedia(false);
      }
      return;
    }

    // Envio de texto normal
    if (!replyText.trim()) return;
    try {
      await axios.post(`${apiUrl}/conversations/${selectedConversation.id}/reply`, {
        message: replyText.trim()
      });
      setReplyText('');
      // Recarregar mensagens
      loadConversationMessages(selectedConversation);
    } catch (err) {
      console.error('Erro ao enviar resposta:', err);
      alert('Erro ao enviar resposta: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedConversation) return;
    try {
      await axios.patch(`${apiUrl}/conversations/${selectedConversation.id}`, {
        category: categoryEdit || null
      });
      // Atualizar conversa selecionada e lista
      setSelectedConversation({
        ...selectedConversation,
        category: categoryEdit || null
      });
      loadConversations();
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
      alert('Erro ao atualizar categoria: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateName = async () => {
    if (!selectedConversation) return;
    try {
      await axios.patch(`${apiUrl}/conversations/${selectedConversation.id}`, {
        name: nameEdit.trim() || null
      });
      setSelectedConversation({
        ...selectedConversation,
        name: nameEdit.trim() || null
      });
      loadConversations();
    } catch (err) {
      console.error('Erro ao atualizar nome:', err);
      alert('Erro ao atualizar nome: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    if (!window.confirm('Tem certeza que deseja apagar esta conversa? As mensagens serão removidas.')) return;
    try {
      await axios.delete(`${apiUrl}/conversations/${selectedConversation.id}`);
      setSelectedConversation(null);
      setMessages([]);
      loadConversations();
    } catch (err) {
      console.error('Erro ao apagar conversa:', err);
      alert('Erro ao apagar conversa: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleMarkAsAttended = async () => {
    if (!selectedConversation) return;
    try {
      await axios.post(`${apiUrl}/conversations/${selectedConversation.id}/attended`);
      setSelectedConversation({
        ...selectedConversation,
        waiting_for_attendant: 0,
        waiting_since: null
      });
      loadConversations();
    } catch (err) {
      console.error('Erro ao marcar como atendido:', err);
      alert('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleAssistant = async () => {
    if (!selectedConversation) return;
    try {
      const nextEnabled = !assistantEnabled;
      await axios.post(`${apiUrl}/conversations/${selectedConversation.id}/assistant`, {
        enabled: nextEnabled
      });
      setAssistantEnabled(nextEnabled);
      setSelectedConversation({
        ...selectedConversation,
        assistant_enabled: nextEnabled ? 1 : 0
      });
      loadConversations();
    } catch (err) {
      console.error('Erro ao alternar assistente:', err);
      alert('Erro ao alternar assistente: ' + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations();
    // Auto-refresh a cada 5 segundos da lista de conversas de forma silenciosa
    const interval = setInterval(loadConversationsSilent, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  useEffect(() => {
    let interval;
    if (selectedConversation) {
      interval = setInterval(() => {
        loadConversationMessagesSilent(selectedConversation.id);
      }, 5000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (initialConversation && onClearInitialConversation) {
      loadConversationMessages(initialConversation);
      onClearInitialConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversation?.waiting_for_attendant) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [selectedConversation?.waiting_for_attendant]);

  const categoriesPreset = ['', ...(categoriesList.map((c) => c.name))];
  const filteredConversations = conversations.filter((c) => {
    const target = `${c.name || ''} ${c.phone || ''} ${c.remote_jid || ''}`.toLowerCase();
    return target.includes(searchTerm.trim().toLowerCase());
  });

  return (
    <div className={`conversations-panel${showDetail ? ' mobile-show-detail' : ''}`}>
      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Conversas</h2>
          <div className="filters">
            <label>
              Busca:
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome ou número..."
              />
            </label>
            <label>
              Categoria:
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {categoriesPreset
                  .filter((c) => c)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
            <button onClick={loadConversations}>Atualizar</button>
          </div>
        </div>
        {loadingConversations ? (
          <div className="loading">Carregando conversas...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="empty">Nenhuma conversa registrada ainda.</div>
        ) : (
          <ul className="conversations-items">
            {filteredConversations.map((conv) => (
              <li
                key={conv.id}
                className={
                  selectedConversation && selectedConversation.id === conv.id
                    ? 'conversation-item active'
                    : 'conversation-item'
                }
                onClick={() => handleSelectConversation(conv)}
              >
                <div className="conversation-main">
                  <div className="conversation-title">
                    {conv.name ? `${conv.name} — ${conv.phone || conv.remote_jid}` : (conv.phone || conv.remote_jid)}
                  </div>
                  <div className="conversation-meta">
                    <span className="conversation-time">
                      {formatTime(conv.last_message_at)}
                    </span>
                    {conv.category && (
                      <span className="conversation-category">{conv.category}</span>
                    )}
                    {conv.waiting_for_attendant && (
                      <span className="conversation-waiting" title="Esperando atendente">⏱️</span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="conversation-unread">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
                <div className="conversation-last-message">
                  {conv.last_message || ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="conversation-detail">
        {selectedConversation ? (
          <>
            <div className="conversation-detail-header">
              {/* Botão Voltar para mobile */}
              <button
                className="btn-back-mobile"
                onClick={() => setShowDetail(false)}
                type="button"
                title="Voltar para lista"
              >
                ← Voltar
              </button>
              <div>
                <h2>
                  {selectedConversation.name
                    ? `${selectedConversation.name} — ${selectedConversation.phone || selectedConversation.remote_jid}`
                    : (selectedConversation.phone || selectedConversation.remote_jid)}
                </h2>
                <div className="conversation-detail-meta">
                  <span>ID: {selectedConversation.id}</span>
                  {selectedConversation.category && (
                    <span className="conversation-category">
                      Categoria atual: {selectedConversation.category}
                    </span>
                  )}
                  <span className={assistantEnabled ? 'assistant-pill on' : 'assistant-pill off'}>
                    Assistente: {assistantEnabled ? 'Ligado' : 'Desligado'}
                  </span>
                </div>
              </div>
              <div className="conversation-actions">
                <div className="conversation-name-edit">
                  <label>
                    Nome do contato:
                    <input
                      type="text"
                      value={nameEdit}
                      onChange={(e) => setNameEdit(e.target.value)}
                      placeholder="Ex: João Silva"
                    />
                  </label>
                  <button onClick={handleUpdateName}>Salvar nome</button>
                </div>
                <button
                  className={assistantEnabled ? 'btn-assistant btn-assistant-off' : 'btn-assistant btn-assistant-on'}
                  onClick={handleToggleAssistant}
                  type="button"
                  title={assistantEnabled ? 'Assumir conversa (desativa automação)' : 'Reativar automação do assistente'}
                >
                  {assistantEnabled ? 'Assumir conversa' : 'Reativar assistente'}
                </button>
                <div className="conversation-category-edit">
                  <label>
                    Categoria:
                    <select
                      value={categoryEdit}
                      onChange={(e) => setCategoryEdit(e.target.value)}
                    >
                      {categoriesPreset.map((c) => (
                        <option key={c} value={c}>
                          {c === '' ? '(sem categoria)' : c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button onClick={handleUpdateCategory}>Salvar</button>
                </div>
                <button
                  className="btn-delete-conversation"
                  onClick={handleDeleteConversation}
                  type="button"
                  title="Apagar esta conversa"
                >
                  🗑️ Apagar conversa
                </button>
              </div>
            </div>

            {selectedConversation.waiting_for_attendant && (
              <div className="waiting-attendant-alert">
                <span className="waiting-attendant-icon">⏱️</span>
                <span className="waiting-attendant-text">
                  <strong>Cliente solicitou atendente</strong> — esperando há{' '}
                  <strong>{formatWaitingTime(selectedConversation.waiting_since)}</strong>
                </span>
                <button
                  className="btn-mark-attended"
                  onClick={handleMarkAsAttended}
                  type="button"
                  title="Marcar como atendido"
                >
                  Marcar como atendido
                </button>
              </div>
            )}

            <div className="conversation-messages">
              {loadingMessages ? (
                <div className="loading">Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className="empty">Nenhuma mensagem nesta conversa.</div>
              ) : (
                <div className="messages-list">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        msg.direction === 'out' ? 'message message-out' : 'message message-in'
                      }
                    >
                      <div className="message-body">
                        {/* Exibir mídia se houver */}
                        {msg.media_type === 'image' && msg.media_filename && (
                          <a href={`${apiUrl}/media/${msg.media_filename}`} target="_blank" rel="noreferrer">
                            <img
                              src={`${apiUrl}/media/${msg.media_filename}`}
                              alt="imagem"
                              style={{ maxWidth: '240px', maxHeight: '300px', borderRadius: '8px', display: 'block', marginBottom: msg.body ? '6px' : 0 }}
                            />
                          </a>
                        )}
                        {msg.media_type === 'audio' && msg.media_filename && (
                          <audio controls style={{ width: '100%', maxWidth: '280px' }}>
                            <source src={`${apiUrl}/media/${msg.media_filename}`} />
                          </audio>
                        )}
                        {msg.media_type === 'video' && msg.media_filename && (
                          <video controls style={{ maxWidth: '240px', borderRadius: '8px' }}>
                            <source src={`${apiUrl}/media/${msg.media_filename}`} />
                          </video>
                        )}
                        {/* Texto / legenda */}
                        {msg.body && <span>{msg.body}</span>}
                      </div>
                      <div className="message-meta">
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.direction === 'out' && <span>Enviado por você</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form className="conversation-reply" onSubmit={handleSendReply}>
              {/* Preview da imagem selecionada */}
              {mediaPreview && (
                <div style={{ marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
                  <img src={mediaPreview} alt="preview" style={{ maxHeight: '120px', borderRadius: '8px', border: '2px solid #25d366' }} />
                  <button
                    type="button"
                    onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', lineHeight: '20px', textAlign: 'center' }}
                  >×</button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                {/* Botão de anexar arquivo */}
                <label
                  title="Enviar imagem ou vídeo"
                  style={{ cursor: 'pointer', fontSize: '20px', lineHeight: '1', padding: '8px', color: '#25d366', flexShrink: 0 }}
                >
                  📎
                  <input
                    type="file"
                    accept="image/*,video/mp4"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setMediaFile(file);
                      setMediaPreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }}
                  />
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={mediaFile ? 'Legenda (opcional)...' : 'Digite sua resposta...'}
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={(!replyText.trim() && !mediaFile) || sendingMedia} style={{ flexShrink: 0 }}>
                  {sendingMedia ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty">Selecione uma conversa para visualizar as mensagens.</div>
        )}
      </div>
    </div>
  );
}

export default ConversationsPanel;

