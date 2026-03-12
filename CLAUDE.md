# Certifica - Contexto do Projeto

## O que e
Plataforma de gestao de certificacao ISO e compliance para consultorias brasileiras.

## Stack
- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind CSS 4
- **UI:** Radix UI / shadcn + Design System proprio (componentes DS*)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deploy:** Vercel (serverless functions em /api)
- **Integracoes:** OpenAI, Recall.ai, Google Calendar, WhatsApp (Zapi)

## Estrutura principal
- `src/app/pages/` - Paginas da aplicacao
- `src/app/components/ui/` - Componentes UI (Radix wrappers)
- `src/app/components/ds/` - Design System customizado
- `src/app/lib/` - Hooks customizados (useClientes, useProjetos, useDocuments, etc.) e utilitarios
- `api/` - Serverless functions Vercel (proxy seguro para APIs externas)
- `supabase/migrations/` - Migracoes do banco de dados

## Modulos principais
- Dashboard (KPIs, semaforo de risco)
- Clientes (CNPJ, contatos, visao 360)
- Projetos (fases, entregaveis)
- Auditorias (planejamento, 5W2H, RAI, encerramento)
- Documentos GED (upload Supabase Storage, versionamento)
- Chat (classificacao IA via OpenAI)
- Reunioes (Google Calendar + Recall.ai)
- Normas ISO, Treinamentos, Relatorios, Configuracoes

## Padroes do projeto
- Hooks customizados `useX` para toda logica de dados com Supabase
- Componentes DS* wrappam Radix UI para design consistente
- API keys protegidas via serverless functions (nunca expostas no client)
- Supabase realtime para atualizacoes ao vivo
- Toda interface em portugues (pt-BR)
- TypeScript com tipos auto-gerados do Supabase (`database.types.ts`)

## Regras para o Claude
- Ao final de cada conversa significativa, salvar um resumo do que foi feito no Obsidian em `C:\Users\fluxi\Documents\Claude\claude-memory\projects\certifica-log.md`
- Sempre ler o arquivo do Obsidian acima no inicio da conversa para retomar contexto
- Manter respostas em portugues (pt-BR)
- Seguir os padroes existentes do projeto (hooks, componentes DS*, etc.)

## Obsidian Vault
Caminho: `C:\Users\fluxi\Documents\Claude\claude-memory`
Pasta de logs do projeto: `projects/certifica-log.md`

## Comandos uteis
```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de producao
npm run preview  # Preview do build
```
