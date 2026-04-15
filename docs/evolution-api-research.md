# Evolution API v2 — Guia Prático de Deploy & Integração

## Resumo Executivo

Evolution API é uma WhatsApp API open-source baseada em Baileys/Whatsmeow. Permite enviar/receber mensagens, monitorar conexão, e configurar webhooks sem depender da Cloud API do Meta.

**Template Railway pronto**: [https://railway.com/deploy/evolution-api-whatsapp-automation](https://railway.com/deploy/evolution-api-whatsapp-automation)

Deploy em < 2 minutos com PostgreSQL 17 + Redis 8.2.1 pré-configurados.

---

## 1. Deploy no Railway (Um Clique)

### URL do Template
```
https://railway.com/new/template/evolution-api-whatsapp-automation
```

### O que é Deploy Automaticamente
- **Docker Image**: `evoapicloud/evolution-api:latest`
- **Banco de Dados**: PostgreSQL 17 (privado, dentro da Railway)
- **Cache**: Redis 8.2.1
- **Networking**: Privado (Evolution → DB via `${{RAILWAY_PRIVATE_DOMAIN}}`)
- **SSL**: Automático via `${{RAILWAY_PUBLIC_DOMAIN}}`

### Passos Rápidos
1. Clique no link do template acima
2. Clique em "Deploy Now"
3. Railway cria automaticamente: Evolution API + PostgreSQL + Redis
4. Variáveis de ambiente são populadas automaticamente
5. Em ~60s, seu app está em produção

---

## 2. Variáveis de Ambiente (Obrigatórias & Opcionais)

### Obrigatórias para Funcionar

| Variável | Tipo | Padrão | Descrição |
|----------|------|--------|-----------|
| `AUTHENTICATION_API_KEY` | string | `mude-me` | **MUDE ISSO** — Chave de autenticação para chamar a API. Gere algo seguro: `openssl rand -hex 32` |
| `SERVER_URL` | URL | `http://localhost:3333` | URL pública da Evolution (Railway auto-popula com `https://${{RAILWAY_PUBLIC_DOMAIN}}`) |
| `DATABASE_CONNECTION_URI` | string | - | **CRÍTICO**: Use `${{DATABASE_PRIVATE_URL}}` (não public). Formato: `postgresql://user:pass@host:5432/evolution?schema=public` |
| `DATABASE_ENABLED` | boolean | `true` | Salvar instâncias, mensagens, contatos em BD |
| `DATABASE_PROVIDER` | string | `postgresql` | Tipo de BD (sempre `postgresql` para Railway) |

### Opcionais Comuns

| Variável | Descrição |
|----------|-----------|
| `REDIS_ENABLED` | `true` = usar Redis para cache (recomendado) |
| `REDIS_URI` | Connection string Redis (auto-populada no template) |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` — padrão: `info` |
| `PORT` | Porta da API (padrão: `3333`) |

### Campos da Database (armazenados automaticamente)
- `DATABASE_SAVE_DATA_INSTANCE` = `true` — salvar config da instância
- `DATABASE_SAVE_DATA_NEW_MESSAGE` = `true` — salvar mensagens recebidas
- `DATABASE_SAVE_MESSAGE_UPDATE` = `true` — salvar atualizações (lido, entregue, etc)
- `DATABASE_SAVE_DATA_CONTACTS` = `true` — salvar contatos
- `DATABASE_SAVE_DATA_CHATS` = `true` — salvar conversas

---

## 3. Endpoints Principais (API REST)

### Base URL
```
https://{RAILWAY_PUBLIC_DOMAIN}
```

### Headers Obrigatórios
```json
{
  "Content-Type": "application/json",
  "apikey": "{AUTHENTICATION_API_KEY}"
}
```

---

### 3.1 Criar Instância WhatsApp

```
POST /instance/create
```

**Payload Mínimo:**
```json
{
  "instanceName": "minha-loja",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true
}
```

**Campos Opcionais Úteis:**
```json
{
  "instanceName": "minha-loja",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true,
  "number": "5511987654321",
  "rejectCall": true,
  "msgCall": "Não aceitamos chamadas",
  "alwaysOnline": true,
  "readMessages": true,
  "readStatus": true,
  "webhook": {
    "url": "https://seu-app.com/webhook",
    "webhook_by_events": false,
    "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
  }
}
```

**Resposta (201 Created):**
```json
{
  "instance": {
    "instanceName": "minha-loja",
    "instanceId": "abc123xyz",
    "status": "disconnected",
    "webhook_wa_business": null,
    "access_token_wa_business": null
  },
  "hash": {
    "apikey": "{AUTHENTICATION_API_KEY}"
  },
  "settings": {
    "rejectCall": true,
    "msgCall": "Não aceitamos chamadas",
    "alwaysOnline": true
  }
}
```

---

### 3.2 Gerar QR Code (conectar WhatsApp)

```
GET /instance/connect/{instanceName}
```

**Resposta:**
```json
{
  "qrcode": "data:image/png;base64,iVBORw0KGg..."
}
```

**UI Integration:**
- Exibir QR code (imagem base64) em um `<img src={qrcode}>`
- Usuário aponta câmera do WhatsApp → "Dispositivos Vinculados" → escaneia
- Webhook dispara `QRCODE_UPDATED` quando um novo QR é gerado
- Webhook dispara `CONNECTION_UPDATE` quando conectado com sucesso

---

### 3.3 Verificar Status da Conexão

```
GET /instance/connectionState/{instanceName}
```

**Resposta:**
```json
{
  "instance": "minha-loja",
  "state": "open",  // "open" | "connecting" | "closed" | "loading"
  "statusConnection": "CONNECTED"
}
```

---

### 3.4 Enviar Mensagem de Texto

```
POST /message/sendText/{instanceName}
```

**Payload:**
```json
{
  "number": "5511987654321",
  "text": "Olá! Seu pedido foi confirmado.",
  "delay": 1000,
  "linkPreview": false
}
```

**Resposta:**
```json
{
  "remoteJid": "5511987654321@s.whatsapp.net",
  "fromMe": true,
  "messageId": "msg_abc123",
  "messageTimestamp": 1681234567,
  "status": "PENDING"
}
```

---

### 3.5 Enviar Imagem

```
POST /message/sendMedia/{instanceName}
```

**Payload (form-data ou JSON):**
```json
{
  "number": "5511987654321",
  "mediatype": "image",
  "mimetype": "image/jpeg",
  "caption": "Foto do produto",
  "media": "https://example.com/foto.jpg"  // URL, caminho local, base64, ou data-URI
}
```

---

### 3.6 Enviar Documento

```
POST /message/sendMedia/{instanceName}
```

**Payload:**
```json
{
  "number": "5511987654321",
  "mediatype": "document",
  "mimetype": "application/pdf",
  "fileName": "proposta.pdf",
  "media": "https://example.com/proposta.pdf",
  "caption": "Sua proposta comercial"
}
```

---

### 3.7 Configurar Webhooks

```
POST /webhook/instance/{instanceName}
```

**Payload:**
```json
{
  "enabled": true,
  "url": "https://seu-app.com/webhook",
  "webhook_by_events": false,
  "events": [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
    "PRESENCE_UPDATE"
  ],
  "headers": {
    "x-custom-header": "valor"
  }
}
```

---

## 4. Webhook Events (Receber Mensagens)

### Setup
Configure o endpoint acima apontando para `https://seu-app.com/webhook`.

### Eventos Disponíveis

#### MESSAGES_UPSERT (mensagem recebida)
```json
{
  "event": "MESSAGES_UPSERT",
  "instance": "minha-loja",
  "data": {
    "instanceId": "abc123xyz",
    "messages": [
      {
        "key": {
          "remoteJid": "5511987654321@s.whatsapp.net",
          "fromMe": false,
          "id": "msg_xyz"
        },
        "message": {
          "conversation": "Oi, quanto custa o produto X?"
        },
        "messageTimestamp": 1681234567
      }
    ]
  }
}
```

#### CONNECTION_UPDATE (conexão mudou)
```json
{
  "event": "CONNECTION_UPDATE",
  "instance": "minha-loja",
  "data": {
    "connection": "open",  // "open" | "close"
    "lastDisconnect": {
      "error": null
    },
    "isNewLogin": false,
    "qr": null
  }
}
```

#### QRCODE_UPDATED (novo QR code)
```json
{
  "event": "QRCODE_UPDATED",
  "instance": "minha-loja",
  "data": {
    "qrcode": "data:image/png;base64,iVBOR..."
  }
}
```

#### SEND_MESSAGE (mensagem enviada com sucesso)
```json
{
  "event": "SEND_MESSAGE",
  "instance": "minha-loja",
  "data": {
    "messageId": "msg_abc123",
    "status": "SENT"
  }
}
```

---

## 5. Integração no App Certifica

### Aba de Configuração WhatsApp

```typescript
// components/WhatsAppConfig.tsx

import { useState, useEffect } from 'react'

export function WhatsAppConfig() {
  const [instance, setInstance] = useState<string>('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [apiKey, setApiKey] = useState<string>('')

  // Criar instância
  const handleCreateInstance = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_EVOLUTION_API}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        instanceName: instance || 'certifica-default',
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/whatsapp`,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setInstance(data.instance.instanceName)
      // Agora buscar QR code
      fetchQRCode(data.instance.instanceName)
    }
  }

  // Buscar QR code
  const fetchQRCode = async (instanceName: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_EVOLUTION_API}/instance/connect/${instanceName}`,
      {
        headers: { 'apikey': apiKey },
      }
    )
    const data = await res.json()
    setQrCode(data.qrcode)
  }

  // Verificar status de conexão
  const checkStatus = async () => {
    if (!instance) return
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_EVOLUTION_API}/instance/connectionState/${instance}`,
      {
        headers: { 'apikey': apiKey },
      }
    )
    const data = await res.json()
    setStatus(data.state === 'open' ? 'connected' : 'disconnected')
  }

  useEffect(() => {
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [instance])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">API Key Evolution</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Cole sua AUTHENTICATION_API_KEY"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <button
        onClick={handleCreateInstance}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Criar Instância WhatsApp
      </button>

      {qrCode && (
        <div className="border-2 border-dashed p-4">
          <p className="text-sm text-gray-600 mb-2">Escaneie com seu celular:</p>
          <img
            src={qrCode}
            alt="QR Code WhatsApp"
            className="w-48 h-48"
          />
          <p className="text-xs text-gray-500 mt-2">
            Status: <span className={status === 'connected' ? 'text-green-600 font-bold' : 'text-yellow-600'}>
              {status === 'connected' ? '✓ Conectado' : '⏳ Aguardando...'}
            </span>
          </p>
        </div>
      )}

      <div className="bg-blue-50 p-3 rounded text-sm">
        <p><strong>Instância:</strong> {instance || 'Não criada'}</p>
        <p><strong>Status:</strong> {status}</p>
      </div>
    </div>
  )
}
```

### API Route para Receber Webhook

```typescript
// app/api/webhook/whatsapp/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { event, instance, data } = body

  console.log(`[WhatsApp] ${event} na instância ${instance}`)

  switch (event) {
    case 'MESSAGES_UPSERT':
      // Nova mensagem recebida
      const messages = data.messages || []
      for (const msg of messages) {
        const sender = msg.key.remoteJid
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Mídia]'
        console.log(`De ${sender}: ${text}`)
        // TODO: Salvar em BD, dispara notificação, responder automaticamente, etc.
      }
      break

    case 'CONNECTION_UPDATE':
      // Conexão aberta/fechada
      console.log(`Conexão: ${data.connection}`)
      if (data.connection === 'close') {
        // Notificar admin que desconectou
      }
      break

    case 'QRCODE_UPDATED':
      // Novo QR code gerado (instância reconectando)
      console.log('Novo QR code disponível')
      break

    case 'SEND_MESSAGE':
      // Mensagem enviada com sucesso
      console.log(`Mensagem ${data.messageId} enviada (status: ${data.status})`)
      break
  }

  return NextResponse.json({ success: true })
}
```

---

## 6. Checklist de Deploy no Railway

- [ ] Clicar em [https://railway.com/deploy/evolution-api-whatsapp-automation](https://railway.com/deploy/evolution-api-whatsapp-automation)
- [ ] Aguardar deploy automático (~60s)
- [ ] Copiar `RAILWAY_PUBLIC_DOMAIN` → é sua URL base
- [ ] Gerar nova `AUTHENTICATION_API_KEY` → substituir "mude-me"
- [ ] Verificar `DATABASE_PRIVATE_URL` está preenchida (Railway auto-faz)
- [ ] Testar endpoint: `GET https://{RAILWAY_PUBLIC_DOMAIN}/instance/status` com `apikey` header
- [ ] Criar primeira instância via POST `/instance/create`
- [ ] Configurar webhook no Certifica: `process.env.NEXT_PUBLIC_EVOLUTION_API`
- [ ] Testar recebimento de mensagem (webhook POST)

---

## 7. Troubleshooting Comum

| Erro | Causa | Solução |
|------|-------|---------|
| `401 Unauthorized` | API key inválida/errada | Verificar `AUTHENTICATION_API_KEY` env var |
| `Connection refused` | Evolution não rodando | Checar se Railway deployment completou (tomar ~60s) |
| `500 Database error` | DATABASE_CONNECTION_URI errada | Usar `${{DATABASE_PRIVATE_URL}}` (não public) |
| `QR code não aparece` | Webhook não configurado | Chamar `POST /webhook/instance/{instance}` |
| `Mensagens não chegam` | Número errado ou banco de dados desativado | Testar com número do celular (`55`+DDD+número) |
| `Redis connection refused` | REDIS_URI inválida | Usar `${{REDIS_PRIVATE_URL}}` no Railway |

---

## 8. Segurança (IMPORTANTE)

1. **Nunca exponha AUTHENTICATION_API_KEY** no cliente — use Server Actions do Next.js ou API Routes
2. **DATABASE_PRIVATE_URL** deve ser usada APENAS no servidor (não exponha)
3. **Rate limit** webhooks internamente (Evolution dispara muitos)
4. **Validar** todo input de webhook (pode ser falsificado)
5. **HTTPS obrigatório** — Railway auto-configura

---

## 9. Referências

- [Evolution API Docs Oficial](https://doc.evolution-api.com/v2/en)
- [Webhooks Docs](https://doc.evolution-api.com/v2/pt/configuration/webhooks)
- [Create Instance Endpoint](https://doc.evolution-api.com/v2/api-reference/instance-controller/create-instance-basic)
- [Send Text Endpoint](https://doc.evolution-api.com/v2/api-reference/message-controller/send-text)
- [Send Media Endpoint](https://doc.evolution-api.com/v2/api-reference/message-controller/send-media)
- [Railway Deploy Template](https://railway.com/deploy/evolution-api-whatsapp-automation)
- [GitHub Evolution API](https://github.com/EvolutionAPI/evolution-api)

---

## 10. Próximos Passos (Certifica)

1. **Integração UI**: Criar aba de settings com componente `WhatsAppConfig`
2. **Storage**: Salvar `instanceName` + `API_KEY` em `.env` ou Supabase
3. **Automação**: Ao criar proposta, enviar via WhatsApp (botão "Enviar por WhatsApp")
4. **Responder Mensagens**: Setup chatbot simples (responder que será processado em breve)
5. **Notificações**: Notificar admin quando receber mensagem (webhook → `api/webhook/whatsapp`)

