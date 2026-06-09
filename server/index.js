const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initWhatsApp } = require('./whatsapp');
const { initDatabase } = require('./database');
const { initScheduler } = require('./scheduler');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5001; // Porta do servidor (temporariamente 5001)

// Origens permitidas (adicione aqui se precisar de mais domínios)
const allowedOrigins = [
  'https://www.bonsailife.shop',
  'https://bonsailife.shop',
  'http://localhost:3000',
  'http://localhost:3001',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, curl) e origens da lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado para origem: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

// Middleware CORS — deve vir ANTES de qualquer rota
app.use(cors(corsOptions));

// Responder preflight OPTIONS explicitamente para todas as rotas
app.options('*', cors(corsOptions));

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
