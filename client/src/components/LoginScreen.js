import React, { useState } from 'react';
import './LoginScreen.css';
import axios from 'axios';

function LoginScreen({ apiUrl, onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Por favor, preencha todos os campos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${apiUrl}/auth/login`, { username, password });
            onLoginSuccess(response.data.token, response.data.username);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                setError('Usuário ou senha inválidos.');
            } else {
                setError('Erro ao conectar com o servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>🛍️ Bonsai Shop</h1>
                    <p>Painel de Automação de WhatsApp</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Usuário</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Digite seu usuário..."
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Senha</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Digite sua senha..."
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? 'Acessando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default LoginScreen;
