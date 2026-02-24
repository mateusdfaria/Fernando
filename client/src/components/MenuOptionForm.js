import React, { useState, useEffect } from 'react';
import './MenuOptionForm.css';

function MenuOptionForm({ option, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [optionNumber, setOptionNumber] = useState('');

  useEffect(() => {
    if (option) {
      setTitle(option.title || '');
      setMessage(option.message || '');
      setOptionNumber(option.option_number || option.id || '');
    } else {
      setTitle('');
      setMessage('');
      setOptionNumber('');
    }
  }, [option]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const optionData = {
      title: title.trim(),
      message: message.trim(),
      option_number: optionNumber ? parseInt(optionNumber) : null
    };

    if (option) {
      onSubmit(option.id, optionData);
    } else {
      onSubmit(optionData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="menu-option-form">
      <div className="form-group">
        <label htmlFor="option-number">Número da Opção (opcional)</label>
        <input
          type="number"
          id="option-number"
          value={optionNumber}
          onChange={(e) => setOptionNumber(e.target.value)}
          placeholder="Deixe vazio para auto-numerar"
          min="1"
        />
      </div>

      <div className="form-group">
        <label htmlFor="title">Título da Opção *</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Horário de Funcionamento"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Mensagem de Resposta *</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite a mensagem que será enviada quando o cliente escolher esta opção..."
          rows="6"
          required
        />
        <small>Use \n para quebrar linhas na mensagem</small>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-cancel">
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-submit">
          {option ? 'Atualizar' : 'Adicionar'} Opção
        </button>
      </div>
    </form>
  );
}

export default MenuOptionForm;
