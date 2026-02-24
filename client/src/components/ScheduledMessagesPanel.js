import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ScheduledMessagesPanel.css';

const ScheduledMessagesPanel = ({ apiUrl }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        phones: '',
        message: '',
        scheduled_at: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadMessages = async () => {
        try {
            const response = await axios.get(`${apiUrl}/scheduled-messages`);
            setMessages(response.data);
        } catch (error) {
            console.error('Erro ao carregar mensagens agendadas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(`${apiUrl}/scheduled-messages`, formData);
            setFormData({ phones: '', message: '', scheduled_at: '' });
            loadMessages();
            alert('Mensagem agendada com sucesso!');
        } catch (error) {
            alert('Erro ao agendar mensagem: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
            try {
                await axios.delete(`${apiUrl}/scheduled-messages/${id}`);
                loadMessages();
            } catch (error) {
                alert('Erro ao cancelar agendamento: ' + (error.response?.data?.error || error.message));
            }
        }
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="status-badge pending">Pendente</span>;
            case 'sent': return <span className="status-badge sent">Enviado</span>;
            case 'error': return <span className="status-badge error">Erro</span>;
            default: return <span className="status-badge">{status}</span>;
        }
    };

    return (
        <div className="scheduled-messages-container">
            <div className="form-section">
                <h2>Nova Mensagem Agendada</h2>
                <form onSubmit={handleSubmit} className="schedule-form">
                    <div className="form-group">
                        <label>Telefones (separados por vírgula):</label>
                        <input
                            type="text"
                            name="phones"
                            value={formData.phones}
                            onChange={handleInputChange}
                            placeholder="Ex: 5511999999999, 5511888888888"
                            required
                        />
                        <small>Formato com DDI e DDD, apenas números.</small>
                    </div>
                    <div className="form-group">
                        <label>Mensagem:</label>
                        <textarea
                            name="message"
                            value={formData.message}
                            onChange={handleInputChange}
                            rows="4"
                            placeholder="Digite a mensagem que será enviada..."
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Data e Hora do Envio:</label>
                        <input
                            type="datetime-local"
                            name="scheduled_at"
                            value={formData.scheduled_at}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-actions">
                        <button type="submit" disabled={submitting} className="btn-save">
                            {submitting ? 'Agendando...' : 'Agendar Mensagem'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="list-section">
                <h2>Mensagens Agendadas</h2>
                <button onClick={loadMessages} className="btn-refresh">🔄 Atualizar Lista</button>
                {loading ? (
                    <div className="loading">Carregando agendamentos...</div>
                ) : messages.length === 0 ? (
                    <div className="empty-state">Nenhuma mensagem agendada encontrada.</div>
                ) : (
                    <div className="messages-table-container">
                        <table className="messages-table">
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Telefones</th>
                                    <th>Mensagem</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map((msg) => (
                                    <tr key={msg.id}>
                                        <td>{formatDateTime(msg.scheduled_at)}</td>
                                        <td>
                                            <div className="phones-list">
                                                {Array.isArray(msg.phones) ? msg.phones.join(', ') : msg.phones}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="message-preview" title={msg.message}>
                                                {msg.message.length > 50 ? msg.message.substring(0, 50) + '...' : msg.message}
                                            </div>
                                        </td>
                                        <td>{getStatusBadge(msg.status)}
                                            {msg.error_info && <div className="error-info" title={msg.error_info}>⚠️ Ver erro</div>}
                                        </td>
                                        <td>
                                            <button
                                                className="btn-delete-small"
                                                onClick={() => handleDelete(msg.id)}
                                                title="Cancelar / Excluir"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScheduledMessagesPanel;
