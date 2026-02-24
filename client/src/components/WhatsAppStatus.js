import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WhatsAppStatus.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function WhatsAppStatus({ status }) {
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verificar QR Code a cada 2 segundos quando desconectado
    if (!status) {
      const interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/whatsapp/status`);
          if (response.data.qrCode) {
            setQrCode(response.data.qrCode);
          } else {
            setQrCode(null);
          }
        } catch (error) {
          console.error('Erro ao buscar QR Code:', error);
        }
      }, 2000);

      // Buscar imediatamente
      axios.get(`${API_URL}/whatsapp/status`)
        .then(response => {
          if (response.data.qrCode) {
            setQrCode(response.data.qrCode);
          }
        })
        .catch(error => console.error('Erro ao buscar QR Code:', error));

      return () => clearInterval(interval);
    } else {
      setQrCode(null);
    }
  }, [status]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/whatsapp/connect`);
      // O status será atualizado automaticamente pelo polling do App.js
    } catch (error) {
      console.error('Erro ao conectar:', error);
      alert('Erro ao tentar conectar. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar?')) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/whatsapp/disconnect`);
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      alert('Erro ao tentar desconectar. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`whatsapp-status ${status ? 'connected' : 'disconnected'}`}>
      <div className="status-header">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span className="status-text">
            {status ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
          </span>
        </div>
        <div className="status-actions">
          {!status && (
            <button
              className="btn-connect"
              onClick={handleConnect}
              disabled={loading || qrCode}
            >
              {loading ? 'Iniciando...' : 'Gerar Novo QR Code'}
            </button>
          )}
          {status && (
            <button
              className="btn-disconnect"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading ? 'Desconectando...' : 'Desconectar'}
            </button>
          )}
        </div>
      </div>

      {!status && (
        <div className="qr-code-section">
          {qrCode ? (
            <>
              <p className="status-message">
                Escaneie o QR Code abaixo com seu WhatsApp:
              </p>
              <div className="qr-code-container">
                <img src={qrCode} alt="QR Code WhatsApp" className="qr-code-image" />
              </div>
              <p className="qr-instructions">
                1. Abra o WhatsApp no seu celular<br />
                2. Vá em <strong>Configurações</strong> → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong><br />
                3. Escaneie o QR Code acima
              </p>
            </>
          ) : (
            <p className="status-message">
              {loading ? 'Inicializando cliente WhatsApp...' : 'Aguardando QR Code... Clique em "Gerar Novo QR Code" se necessário.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default WhatsAppStatus;
