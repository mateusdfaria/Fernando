import React, { useEffect, useState } from 'react';
import axios from 'axios';

function CategoriesPanel({ apiUrl, onSelectConversation }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingName, setEditingName] = useState('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiUrl}/categories`);
      setCategories(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (category) => {
    if (!category) return;
    try {
      setLoadingContacts(true);
      const res = await axios.get(`${apiUrl}/categories/${category.id}/contacts`);
      setSelectedCategory(res.data.category);
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    loadContacts(cat);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await axios.post(`${apiUrl}/categories`, { name: newCategoryName.trim() });
      setNewCategoryName('');
      loadCategories();
    } catch (err) {
      alert('Erro ao criar categoria: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleStartEdit = (cat) => {
    setEditingCategory(cat);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingName.trim()) return;
    try {
      await axios.put(`${apiUrl}/categories/${editingCategory.id}`, { name: editingName.trim() });
      setEditingCategory(null);
      setEditingName('');
      loadCategories();
      if (selectedCategory && selectedCategory.id === editingCategory.id) {
        loadContacts({ ...selectedCategory, name: editingName.trim() });
      }
    } catch (err) {
      alert('Erro ao atualizar categoria: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Excluir a categoria "${cat.name}"? Os contatos ficarão sem categoria.`)) return;
    try {
      await axios.delete(`${apiUrl}/categories/${cat.id}`);
      if (selectedCategory && selectedCategory.id === cat.id) {
        setSelectedCategory(null);
        setContacts([]);
      }
      loadCategories();
    } catch (err) {
      alert('Erro ao excluir categoria: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContactClick = (contact) => {
    if (onSelectConversation) {
      onSelectConversation(contact);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <div className="categories-panel">
      <div className="categories-sidebar">
        <h2>Categorias</h2>
        <form onSubmit={handleAddCategory} className="category-add-form">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nova categoria..."
          />
          <button type="submit">Criar</button>
        </form>

        {loading ? (
          <div className="loading">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="empty">Nenhuma categoria. Crie uma acima.</div>
        ) : (
          <ul className="categories-list">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className={`category-item ${selectedCategory && selectedCategory.id === cat.id ? 'active' : ''}`}
                onClick={() => handleSelectCategory(cat)}
              >
                {editingCategory && editingCategory.id === cat.id ? (
                  <div className="category-edit-inline" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                    />
                    <button onClick={handleSaveEdit}>Salvar</button>
                    <button onClick={() => setEditingCategory(null)}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{cat.name}</span>
                    <div className="category-actions">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(cat); }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="categories-contacts">
        {selectedCategory ? (
          <>
            <h2>Contatos em "{selectedCategory.name}"</h2>
            {loadingContacts ? (
              <div className="loading">Carregando contatos...</div>
            ) : contacts.length === 0 ? (
              <div className="empty">Nenhum contato nesta categoria.</div>
            ) : (
              <ul className="contacts-list">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="contact-item"
                    onClick={() => handleContactClick(c)}
                  >
                    <div className="contact-name">
                      {c.name ? `${c.name} — ${c.phone || c.remote_jid}` : (c.phone || c.remote_jid)}
                    </div>
                    <div className="contact-preview">{c.last_message || ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="empty">Selecione uma categoria para ver os contatos.</div>
        )}
      </div>
    </div>
  );
}

export default CategoriesPanel;
