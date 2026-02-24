const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initWhatsApp } = require('./whatsapp');
const { initDatabase } = require('./database');
const { initScheduler } = require('./scheduler');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5001; // Porta do servidor (temporariamente 5001)

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rotas
app.use('/api', routes);

// Inicializar banco de dados
initDatabase();

// Inicializar scheduler de mensagens agendadas
initScheduler();

// Inicializar WhatsApp
initWhatsApp();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
