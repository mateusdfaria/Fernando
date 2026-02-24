import React from 'react';
import './MenuOptionsList.css';

function MenuOptionsList({ options, onEdit, onDelete }) {
  if (options.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhuma opção cadastrada ainda.</p>
        <p>Adicione uma nova opção usando o formulário ao lado.</p>
      </div>
    );
  }

  return (
    <div className="menu-options-list">
      {options.map((option) => (
        <div key={option.id} className="menu-option-card">
          <div className="option-header">
            <span className="option-number">{option.option_number || option.id}</span>
            <h3 className="option-title">{option.title}</h3>
          </div>
          <div className="option-message">
            <p>{option.message}</p>
          </div>
          <div className="option-actions">
            <button
              onClick={() => onEdit(option)}
              className="btn-action btn-edit"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => onDelete(option.id)}
              className="btn-action btn-delete"
            >
              🗑️ Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default MenuOptionsList;
