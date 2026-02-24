# Instalação no Windows

## Passo a Passo

### 1. Instalar Dependências do Servidor

Abra o PowerShell na pasta do projeto e execute:

```powershell
$env:PUPPETEER_SKIP_DOWNLOAD="true"; npm install
```

### 2. Instalar Dependências do Cliente

```powershell
cd client
npm install
cd ..
```

### 3. Iniciar o Sistema

```powershell
npm run dev
```

Isso iniciará:
- Servidor backend na porta 5000
- Frontend React na porta 3000

## Solução de Problemas

### Erro com Puppeteer/Chrome

O sistema tenta usar o Chrome instalado no seu computador primeiro. Se você tiver o Google Chrome instalado, deve funcionar automaticamente.

Se não tiver Chrome instalado ou se der erro:

**Opção 1: Instalar Google Chrome (Recomendado)**
1. Baixe e instale o Google Chrome: https://www.google.com/chrome/
2. Reinicie o servidor

**Opção 2: Instalar Chrome do Puppeteer (se tiver problemas de certificado)**
```powershell
# Configure para ignorar certificados SSL (apenas se necessário)
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npx puppeteer browsers install chrome
```

**Opção 3: Usar Chrome existente**
O sistema detecta automaticamente o Chrome instalado nos locais padrão do Windows.

### Erro com "concurrently"

Certifique-se de que todas as dependências foram instaladas:

```powershell
npm install
```

### Portas em Uso

Se as portas 3000 ou 5000 estiverem em uso, você pode:

1. Fechar outros aplicativos que usam essas portas
2. Ou alterar as portas nos arquivos de configuração

## Próximos Passos

1. Após iniciar, um QR Code aparecerá no terminal
2. Escaneie com seu WhatsApp
3. Acesse `http://localhost:3000` para gerenciar o menu
