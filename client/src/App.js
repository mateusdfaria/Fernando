import React, { useState, useEffect } from 'react';
import './App.css';
import MenuOptionsList from './components/MenuOptionsList';
import MenuOptionForm from './components/MenuOptionForm';
import WhatsAppStatus from './components/WhatsAppStatus';
import axios from 'axios';
import ConversationsPanel from './components/ConversationsPanel';
import CategoriesPanel from './components/CategoriesPanel';
import ScheduledMessagesPanel from './components/ScheduledMessagesPanel';
import LoginScreen from './components/LoginScreen';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function App() {
  const [menuOptions, setMenuOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingOption, setEditingOption] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(false);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'conversas' | 'categorias' | 'agendamentos'
  const [selectedConversationForTab, setSelectedConversationForTab] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);

  // Autenticação
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || null);

  useEffect(() => {
    // Configurar os interceptors do Axios para enviar o token JWT
    const requestInterceptor = axios.interceptors.request.use((config) => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Token inválido ou expirado, forçar logout
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    if (!token) return; // Só carrega se estiver logado

    loadMenuOptions();
    checkWhatsAppStatus();
    checkWaitingCount();

    // Verificar status do WhatsApp a cada 5 segundos
    const statusInterval = setInterval(checkWhatsAppStatus, 5000);
    // Verificar clientes na fila a cada 5 segundos
    const waitingInterval = setInterval(checkWaitingCount, 5000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(waitingInterval);
    };
  }, [token]);

  const loadMenuOptions = async () => {
    try {
      const response = await axios.get(`${API_URL}/menu-options`);
      setMenuOptions(response.data);
    } catch (error) {
      console.error('Erro ao carregar opções:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/whatsapp/status`);
      setWhatsappStatus(response.data.ready);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setWhatsappStatus(false);
    }
  };

  const checkWaitingCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/conversations/waiting-count`);
      setWaitingCount(response.data.count || 0);
    } catch (error) {
      console.error('Erro ao verificar fila de espera:', error);
    }
  };

  const handleAddOption = async (optionData) => {
    try {
      await axios.post(`${API_URL}/menu-options`, optionData);
      loadMenuOptions();
      setEditingOption(null);
    } catch (error) {
      alert('Erro ao adicionar opção: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateOption = async (id, optionData) => {
    try {
      await axios.put(`${API_URL}/menu-options/${id}`, optionData);
      loadMenuOptions();
      setEditingOption(null);
    } catch (error) {
      alert('Erro ao atualizar opção: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteOption = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta opção?')) {
      try {
        await axios.delete(`${API_URL}/menu-options/${id}`);
        loadMenuOptions();
      } catch (error) {
        alert('Erro ao excluir opção: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleEditOption = (option) => {
    setEditingOption(option);
  };

  const handleCancelEdit = () => {
    setEditingOption(null);
  };

  const handleLoginSuccess = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  if (!token) {
    return <LoginScreen apiUrl={API_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>🛍️ Sistema de Automação WhatsApp</h1>
              <p>Gerencie as respostas automatizadas da sua loja</p>
            </div>
            <div className="user-profile">
              <span style={{ marginRight: '10px', fontWeight: 'bold' }}>👤 {username}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="tabs">
          <button
            className={activeTab === 'menu' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('menu')}
          >
            Menu automatizado
          </button>
          <button
            className={activeTab === 'conversas' ? 'tab active tab-with-badge' : 'tab tab-with-badge'}
            onClick={() => setActiveTab('conversas')}
          >
            Atendimento / Conversas
            {waitingCount > 0 && (
              <span className="tab-badge">{waitingCount}</span>
            )}
          </button>
          <button
            className={activeTab === 'categorias' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('categorias')}
          >
            Categorias
          </button>
          <button
            className={activeTab === 'agendamentos' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('agendamentos')}
          >
            Agendamentos
          </button>
        </div>

        {waitingCount > 0 && activeTab !== 'conversas' && (
          <div className="global-waiting-alert">
            <div className="global-waiting-content">
              <span>⚠️</span>
              <strong>Atenção:</strong> Existem {waitingCount} cliente{waitingCount !== 1 ? 's' : ''} aguardando atendimento de um humano!
            </div>
            <button className="btn-go-to-chats" onClick={() => setActiveTab('conversas')}>
              Ver Conversas
            </button>
          </div>
        )}

        <WhatsAppStatus status={whatsappStatus} />

        {activeTab === 'menu' && (
          <div className="content">
            <div className="form-section">
              <h2>{editingOption ? 'Editar Opção' : 'Adicionar Nova Opção'}</h2>
              <MenuOptionForm
                option={editingOption}
                onSubmit={editingOption ? handleUpdateOption : handleAddOption}
                onCancel={editingOption ? handleCancelEdit : null}
              />
            </div>

            <div className="list-section">
              <h2>Opções do Menu</h2>
              {loading ? (
                <div className="loading">Carregando...</div>
              ) : (
                <MenuOptionsList
                  options={menuOptions}
                  onEdit={handleEditOption}
                  onDelete={handleDeleteOption}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'conversas' && (
          <div className="content-full">
            {whatsappStatus ? (
              <ConversationsPanel
                apiUrl={API_URL}
                initialConversation={selectedConversationForTab}
                onClearInitialConversation={() => setSelectedConversationForTab(null)}
              />
            ) : (
              <div className="form-section">
                <h2>Atendimento / Conversas</h2>
                <p style={{ marginBottom: '16px' }}>
                  Para visualizar e responder conversas, é necessário primeiro conectar um número de WhatsApp.
                </p>
                <p style={{ marginBottom: '8px' }}>
                  Use o painel acima para gerar o QR Code, escaneie com o WhatsApp e aguarde a confirmação de conexão.
                </p>
                <p style={{ color: '#666' }}>
                  Assim que o WhatsApp estiver conectado, as conversas começarão a aparecer automaticamente aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'categorias' && (
          <div className="content-full">
            <CategoriesPanel
              apiUrl={API_URL}
              onSelectConversation={(contact) => {
                setSelectedConversationForTab(contact);
                setActiveTab('conversas');
              }}
            />
          </div>
        )}

        {activeTab === 'agendamentos' && (
          <div className="content-full">
            <ScheduledMessagesPanel apiUrl={API_URL} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
