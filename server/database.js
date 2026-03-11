const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database.sqlite');
let db = null;

function initDatabase() {
  // Criar diretório se não existir
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err);
    } else {
      console.log('Banco de dados conectado!');
      createTables();
    }
  });
}

function createTables() {
  db.serialize(() => {
    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Inserir administrador padrão se a tabela estiver vazia
    db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('123456', salt);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash], (err) => {
          if (!err) console.log('✅ Usuário admin criado. Senha padrão: 123456');
        });
      }
    });

    // Tabela de opções do menu
    db.run(`CREATE TABLE IF NOT EXISTS menu_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_number INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Inserir opções padrão se não existirem
    // Inserir opções padrão se não existirem ou se for a versão antiga
    db.get('SELECT COUNT(*) as count FROM menu_options', (err, row) => {
      if (err) {
        console.error('Erro ao verificar opções:', err);
        return;
      }

      // Se estiver vazio ou tiver as 4 opções antigas (reset forçado para migração)
      if (row.count === 0 || row.count === 4) {
        // Limpar tabela antiga se existir
        if (row.count > 0) {
          db.run('DELETE FROM menu_options');
        }

        const defaultOptions = [
          { number: 1, title: 'Bonsai', message: '🌳 *BONSAI*\n\nConheça nossa seleção de Bonsais prontos.\nDe 5 a 60 anos!\n\nAcesse: https://bonsailife.com.br/bonsai/' },
          { number: 2, title: 'Pré-Bonsai', message: '🌱 *PRÉ-BONSAI*\n\nMudas iniciadas para você criar sua arte.\n\nAcesse: https://bonsailife.com.br/pre-bonsai/' },
          { number: 3, title: 'Vasos', message: '🏺 *VASOS*\n\nVasos de cerâmica e plástico para todos os estilos.\n\nAcesse: https://bonsailife.com.br/vasos/' },
          { number: 4, title: 'Acessórios', message: '✂️ *ACESSÓRIOS*\n\nFerramentas, arames, substratos e adubos.\n\nAcesse: https://bonsailife.com.br/assessorios/' },
          { number: 5, title: 'Plantas Premium', message: '✨ *PLANTAS PREMIUM*\n\nExemplares únicos e de alto padrão.\n\nAcesse: https://bonsailife.com.br/premium2/' },
          { number: 6, title: 'Falar com Atendente', message: '👤 *ATENDIMENTO*\n\nUm de nossos especialistas vai te atender em instantes. Aguarde um momento!' }
        ];

        const stmt = db.prepare('INSERT INTO menu_options (option_number, title, message) VALUES (?, ?, ?)');
        defaultOptions.forEach(option => {
          stmt.run(option.number, option.title, option.message);
        });
        stmt.finalize();
        console.log('Opções da Bonsai Life criadas com sucesso!');
      }
    });

    // Tabela de conversas (conversations)
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_jid TEXT UNIQUE NOT NULL,
      phone TEXT,
      name TEXT,
      category TEXT,
      is_new_client INTEGER DEFAULT 1,
      assistant_enabled INTEGER DEFAULT 1,
      last_message TEXT,
      last_message_at DATETIME,
      unread_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de mensagens (messages)
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      direction TEXT NOT NULL, -- 'in' ou 'out'
      body TEXT,
      timestamp DATETIME,
      from_me INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`);

    // Tabela de categorias (para organizar contatos)
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Inserir categorias padrão se não existirem
    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
      if (err) return;
      if ((row || {}).count === 0) {
        const defaults = ['Lead', 'Cliente', 'Suporte', 'Outros'];
        const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
        defaults.forEach((n) => stmt.run(n));
        stmt.finalize();
      }
    });

    // Tabela de mensagens agendadas
    db.run(`CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phones TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      error_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Tabela scheduled_messages OK.');

    // Migração leve: adicionar colunas caso o banco já exista
    db.all(`PRAGMA table_info(conversations)`, (err, rows) => {
      if (err) return;
      const cols = rows || [];
      const hasAssistantEnabled = cols.some((r) => r.name === 'assistant_enabled');
      const hasIsNewClient = cols.some((r) => r.name === 'is_new_client');
      const hasWaitingForAttendant = cols.some((r) => r.name === 'waiting_for_attendant');
      const hasWaitingSince = cols.some((r) => r.name === 'waiting_since');
      if (!hasAssistantEnabled) {
        db.run(`ALTER TABLE conversations ADD COLUMN assistant_enabled INTEGER DEFAULT 1`);
      }
      if (!hasIsNewClient) {
        db.run(`ALTER TABLE conversations ADD COLUMN is_new_client INTEGER DEFAULT 1`);
      }
      if (!hasWaitingForAttendant) {
        db.run(`ALTER TABLE conversations ADD COLUMN waiting_for_attendant INTEGER DEFAULT 0`);
      }
      if (!hasWaitingSince) {
        db.run(`ALTER TABLE conversations ADD COLUMN waiting_since DATETIME`);
      }
    });
  });
}

function upsertConversation(remoteJid, lastMessage, timestampMs, pushName = null) {
  return new Promise((resolve, reject) => {
    const phone = remoteJid.split('@')[0];
    const lastMessageAt = timestampMs ? new Date(timestampMs).toISOString() : null;

    db.run(
      `
      INSERT INTO conversations (remote_jid, phone, name, last_message, last_message_at, unread_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(remote_jid) DO UPDATE SET
        last_message = excluded.last_message,
        last_message_at = excluded.last_message_at,
        name = COALESCE(conversations.name, excluded.name),
        unread_count = conversations.unread_count + 1,
        updated_at = CURRENT_TIMESTAMP
      `,
      [remoteJid, phone, pushName, lastMessage, lastMessageAt],
      function (err) {
        if (err) {
          reject(err);
        } else {
          db.get(
            'SELECT * FROM conversations WHERE remote_jid = ?',
            [remoteJid],
            (err2, row) => {
              if (err2) {
                reject(err2);
              } else {
                resolve(row);
              }
            }
          );
        }
      }
    );
  });
}

function upsertConversationForOutgoing(remoteJid, lastMessage, timestampMs) {
  return new Promise((resolve, reject) => {
    const phone = remoteJid.split('@')[0];
    const lastMessageAt = timestampMs ? new Date(timestampMs).toISOString() : null;

    db.run(
      `
      INSERT INTO conversations (remote_jid, phone, last_message, last_message_at, unread_count)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(remote_jid) DO UPDATE SET
        last_message = excluded.last_message,
        last_message_at = excluded.last_message_at,
        updated_at = CURRENT_TIMESTAMP
      `,
      [remoteJid, phone, lastMessage, lastMessageAt],
      function (err) {
        if (err) {
          reject(err);
        } else {
          // Recuperar o registro atualizado
          db.get(
            'SELECT * FROM conversations WHERE remote_jid = ?',
            [remoteJid],
            (err2, row) => {
              if (err2) {
                reject(err2);
              } else {
                resolve(row);
              }
            }
          );
        }
      }
    );
  });
}

function insertMessage(conversationId, { direction, body, timestampMs, fromMe }) {
  return new Promise((resolve, reject) => {
    const ts = timestampMs ? new Date(timestampMs).toISOString() : null;
    db.run(
      `
      INSERT INTO messages (conversation_id, direction, body, timestamp, from_me)
      VALUES (?, ?, ?, ?, ?)
      `,
      [conversationId, direction, body, ts, fromMe ? 1 : 0],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      }
    );
  });
}

function getCategories() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name FROM categories ORDER BY name', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getCategoryById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM categories WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function addCategory(name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO categories (name) VALUES (?)', [name], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, name });
    });
  });
}

function updateCategory(id, name) {
  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM categories WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Categoria não encontrada'));
      const oldName = row.name;
      db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id], function (err) {
        if (err) return reject(err);
        db.run('UPDATE conversations SET category = ? WHERE category = ?', [name, oldName], (err2) => {
          if (err2) return reject(err2);
          resolve({ id, name });
        });
      });
    });
  });
}

function deleteCategory(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM categories WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Categoria não encontrada'));
      const catName = row.name;
      db.run('DELETE FROM categories WHERE id = ?', [id], (err2) => {
        if (err2) return reject(err2);
        db.run('UPDATE conversations SET category = NULL WHERE category = ?', [catName], () => {
          resolve({ id, success: true });
        });
      });
    });
  });
}

function getConversationsByCategory(categoryName) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, remote_jid, phone, name, category, last_message, last_message_at, unread_count
       FROM conversations WHERE category = ? ORDER BY last_message_at DESC NULLS LAST`,
      [categoryName],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function setConversationWaitingForAttendant(remoteJid, waiting, sinceMs) {
  return new Promise((resolve, reject) => {
    const since = sinceMs ? new Date(sinceMs).toISOString() : null;
    db.run(
      `UPDATE conversations SET waiting_for_attendant = ?, waiting_since = ?, updated_at = CURRENT_TIMESTAMP WHERE remote_jid = ?`,
      [waiting ? 1 : 0, since, remoteJid],
      function (err) {
        if (err) reject(err);
        else resolve({ waiting: !!waiting, waiting_since: since });
      }
    );
  });
}

function clearConversationWaitingForAttendant(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE conversations SET waiting_for_attendant = 0, waiting_since = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

// ── Auth / Users ──────────────────────────────────────────────────────────────

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function getWaitingForAttendantCount() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM conversations WHERE waiting_for_attendant = 1`,
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      }
    );
  });
}

function getConversations(category = null) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT id, remote_jid, phone, name, category, is_new_client, assistant_enabled, waiting_for_attendant, waiting_since, last_message, last_message_at, unread_count
      FROM conversations
      ORDER BY last_message_at DESC NULLS LAST, id DESC
    `;
    const params = [];

    if (category) {
      sql = `
        SELECT id, remote_jid, phone, name, category, is_new_client, assistant_enabled, waiting_for_attendant, waiting_since, last_message, last_message_at, unread_count
        FROM conversations
        WHERE category = ?
        ORDER BY last_message_at DESC NULLS LAST, id DESC
      `;
      params.push(category);
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getConversationById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM conversations WHERE id = ?',
      [id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

function getConversationByRemoteJid(remoteJid) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM conversations WHERE remote_jid = ?',
      [remoteJid],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

function getConversationMessages(conversationId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT id, direction, body, timestamp, from_me
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC, id ASC
      `,
      [conversationId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function updateConversationCategory(id, category) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE conversations
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [category, id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, category });
        }
      }
    );
  });
}

function setConversationAssistantEnabled(id, enabled) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE conversations
      SET assistant_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [enabled ? 1 : 0, id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, assistant_enabled: enabled ? 1 : 0 });
        }
      }
    );
  });
}

function setConversationIsNewClient(id, isNew) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE conversations
      SET is_new_client = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [isNew ? 1 : 0, id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, is_new_client: isNew ? 1 : 0 });
        }
      }
    );
  });
}

function markConversationRead(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE conversations
      SET unread_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id });
        }
      }
    );
  });
}

function updateConversationName(id, name) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE conversations
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [name || null, id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, name: name || null });
        }
      }
    );
  });
}

function deleteConversation(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM conversations WHERE id = ?', [id], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, success: true });
      }
    });
  });
}

function getMenuOptions() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, option_number, title, message FROM menu_options ORDER BY option_number', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getResponseByOption(optionNumber, parentOption = null) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM menu_options WHERE option_number = ?', [optionNumber], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        resolve({
          message: row.message,
          title: row.title,
          hasSubmenu: false // Pode ser expandido no futuro
        });
      } else {
        resolve(null);
      }
    });
  });
}

function addMenuOption(title, message, optionNumber = null) {
  return new Promise((resolve, reject) => {
    if (optionNumber === null) {
      // Pegar o próximo número disponível
      db.get('SELECT MAX(option_number) as max FROM menu_options', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        optionNumber = (row.max || 0) + 1;
        insertOption(optionNumber, title, message, resolve, reject);
      });
    } else {
      insertOption(optionNumber, title, message, resolve, reject);
    }
  });
}

function insertOption(optionNumber, title, message, resolve, reject) {
  db.run(
    'INSERT INTO menu_options (option_number, title, message) VALUES (?, ?, ?)',
    [optionNumber, title, message],
    function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, option_number: optionNumber, title, message });
      }
    }
  );
}

function updateMenuOption(id, title, message, optionNumber) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE menu_options SET title = ?, message = ?, option_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, message, optionNumber, id],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, option_number: optionNumber, title, message });
        }
      }
    );
  });
}

function deleteMenuOption(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM menu_options WHERE id = ?', [id], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true });
      }
    });
  });
}

function getDatabase() {
  return db;
}

// ── Agendamentos ──────────────────────────────────────────────────────────────

function createScheduledMessage(phones, message, scheduledAt) {
  return new Promise((resolve, reject) => {
    const phonesJson = JSON.stringify(Array.isArray(phones) ? phones : [phones]);

    // Normalize date to SQLite format: YYYY-MM-DD HH:MM:SS (UTC)
    const d = new Date(scheduledAt);
    const formattedDate = !isNaN(d.getTime())
      ? d.toISOString().replace('T', ' ').substring(0, 19)
      : scheduledAt;

    db.run(
      `INSERT INTO scheduled_messages (phones, message, scheduled_at) VALUES (?, ?, ?)`,
      [phonesJson, message, formattedDate],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, phones: JSON.parse(phonesJson), message, scheduled_at: formattedDate, status: 'pending' });
      }
    );
  });
}

function getScheduledMessages() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM scheduled_messages ORDER BY scheduled_at ASC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map(r => ({ ...r, phones: JSON.parse(r.phones || '[]') })));
      }
    );
  });
}

function getPendingScheduledMessages() {
  return new Promise((resolve, reject) => {
    // Fetch all pending and filter by time in JS to avoid timezone issues
    db.all(
      `SELECT * FROM scheduled_messages WHERE status = 'pending'`,
      (err, rows) => {
        if (err) { reject(err); return; }
        const nowMs = Date.now();
        const due = (rows || []).filter(r => {
          // scheduled_at is stored as ISO string (e.g. '2026-03-11 17:20:00')
          // Make it parseable by JS: replace space with T and append Z (UTC)
          let dtStr = (r.scheduled_at || '').trim();
          if (!dtStr.includes('T')) dtStr = dtStr.replace(' ', 'T');
          if (!dtStr.endsWith('Z')) dtStr += 'Z';
          const scheduledMs = new Date(dtStr).getTime();
          console.log(`[Scheduler] Msg #${r.id} scheduled_at='${r.scheduled_at}' scheduledMs=${scheduledMs} nowMs=${nowMs} due=${scheduledMs <= nowMs}`);
          return scheduledMs <= nowMs;
        });
        resolve(due.map(r => ({ ...r, phones: JSON.parse(r.phones || '[]') })));
      }
    );
  });
}

function updateScheduledMessageStatus(id, status, errorInfo = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE scheduled_messages SET status = ?, error_info = ? WHERE id = ?`,
      [status, errorInfo, id],
      function (err) {
        if (err) reject(err);
        else resolve({ id, status, error_info: errorInfo });
      }
    );
  });
}

function deleteScheduledMessage(id) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM scheduled_messages WHERE id = ?`, [id], function (err) {
      if (err) reject(err);
      else resolve({ id, success: true });
    });
  });
}

function getScheduledMessageById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM scheduled_messages WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? { ...row, phones: JSON.parse(row.phones || '[]') } : null);
    });
  });
}

module.exports = {
  initDatabase,
  getMenuOptions,
  getResponseByOption,
  addMenuOption,
  updateMenuOption,
  deleteMenuOption,
  getDatabase,
  upsertConversation,
  upsertConversationForOutgoing,
  insertMessage,
  getConversations,
  getConversationsByCategory,
  getConversationById,
  getConversationByRemoteJid,
  getConversationMessages,
  updateConversationCategory,
  updateConversationName,
  setConversationAssistantEnabled,
  setConversationIsNewClient,
  setConversationWaitingForAttendant,
  clearConversationWaitingForAttendant,
  getWaitingForAttendantCount,
  markConversationRead,
  deleteConversation,
  getCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  createScheduledMessage,
  getScheduledMessages,
  getPendingScheduledMessages,
  updateScheduledMessageStatus,
  deleteScheduledMessage,
  getScheduledMessageById,
  getUserByUsername
};
