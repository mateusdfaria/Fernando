# Sistema de Automação WhatsApp para Loja

Sistema web completo para gerenciar respostas automatizadas do WhatsApp da sua loja, permitindo que clientes escolham opções de um menu interativo.

## 🚀 Funcionalidades

- ✅ Menu interativo no WhatsApp
- ✅ Respostas automatizadas baseadas em escolhas do cliente
- ✅ Interface web para gerenciar opções do menu
- ✅ Adicionar, editar e excluir opções
- ✅ Status de conexão do WhatsApp em tempo real
- ✅ Banco de dados SQLite para armazenar configurações

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- WhatsApp Business ou WhatsApp pessoal (para conectar)

## 🛠️ Instalação

1. **Instalar dependências:**

```bash
npm run install-all
```

2. **Iniciar o servidor:**

```bash
npm run dev
```

Isso iniciará tanto o servidor backend (porta 5000) quanto o frontend React (porta 3000).

## 📱 Como Usar

### 1. Conectar WhatsApp

1. Ao iniciar o servidor, um QR Code aparecerá no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Configurações > Aparelhos conectados > Conectar um aparelho**
4. Escaneie o QR Code exibido no terminal
5. Aguarde a confirmação de conexão

### 2. Configurar Menu

1. Acesse `http://localhost:3000` no navegador
2. Use o formulário para adicionar novas opções ao menu
3. Edite ou exclua opções existentes conforme necessário

### 3. Como os Clientes Usam

Os clientes devem enviar uma das seguintes mensagens para iniciar o menu:
- `MENU`
- `menu`
- `Menu`

O sistema enviará automaticamente o menu com as opções configuradas. O cliente escolhe digitando o número da opção desejada.

## 📁 Estrutura do Projeto

```
fernando/
├── server/
│   ├── index.js          # Servidor Express
│   ├── whatsapp.js       # Lógica do WhatsApp
│   ├── database.js       # Gerenciamento do banco de dados
│   └── routes.js         # Rotas da API
├── client/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/   # Componentes React
│   │   └── ...
│   └── ...
├── package.json
└── README.md
```

## 🔧 Configuração

### Portas

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`

### Banco de Dados

O banco de dados SQLite é criado automaticamente em `server/database.sqlite`.

## 📝 API Endpoints

- `GET /api/menu-options` - Listar todas as opções
- `POST /api/menu-options` - Criar nova opção
- `PUT /api/menu-options/:id` - Atualizar opção
- `DELETE /api/menu-options/:id` - Excluir opção
- `GET /api/whatsapp/status` - Status da conexão WhatsApp
- `POST /api/whatsapp/send-test` - Enviar menu de teste

## ⚠️ Importante

- Mantenha o servidor rodando para que o WhatsApp continue conectado
- O QR Code expira após alguns minutos. Se expirar, reinicie o servidor
- A sessão do WhatsApp é salva localmente, então você não precisará escanear o QR Code toda vez

## 🐛 Solução de Problemas

**WhatsApp não conecta:**
- Verifique se o QR Code foi escaneado corretamente
- Reinicie o servidor e escaneie novamente
- Certifique-se de que não há outro dispositivo conectado

**Erro ao instalar dependências:**
- Certifique-se de ter Node.js instalado
- Tente limpar o cache: `npm cache clean --force`

## 📄 Licença

ISC
