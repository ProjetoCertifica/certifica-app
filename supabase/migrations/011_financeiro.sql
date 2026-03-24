-- ============================================================
-- Migration 011: Módulo Financeiro
-- Tabela de faturamento (NFs) vinculada a projetos/clientes
-- ============================================================

create table if not exists public.faturamento (
  id uuid default gen_random_uuid() primary key,
  projeto_id uuid references public.projetos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  consultor text not null default '',

  -- Dados da NF
  numero_nf text not null default '',
  descricao text not null default '',
  valor decimal(12,2) not null default 0,
  data_emissao date not null default current_date,
  data_vencimento date,
  data_pagamento date,

  -- Status: emitida, paga, vencida, cancelada
  status text not null default 'emitida',

  -- Tipo: servico, consultoria, auditoria, treinamento
  tipo text not null default 'servico',

  -- Mês de competência (para fechamento)
  mes_competencia text not null default '', -- formato: "2026-03"

  observacoes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.faturamento enable row level security;
create policy "Allow all for now" on public.faturamento for all using (true);

-- Índices
create index if not exists idx_faturamento_projeto on public.faturamento(projeto_id);
create index if not exists idx_faturamento_cliente on public.faturamento(cliente_id);
create index if not exists idx_faturamento_mes on public.faturamento(mes_competencia);
create index if not exists idx_faturamento_status on public.faturamento(status);
