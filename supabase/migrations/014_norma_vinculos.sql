-- ============================================================
-- Migration 014: Vínculos de normas com clientes
-- Registra quais normas cada empresa está implementando
-- ============================================================

create table if not exists public.norma_vinculos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  norma_code text not null,           -- ex: "iso9001", "iso14001"
  status text not null default 'em-andamento'
    check (status in ('nao-iniciado','em-andamento','implementado','certificado')),
  consultor text not null default '',
  data_inicio date,
  data_meta date,
  progresso integer not null default 0 check (progresso >= 0 and progresso <= 100),
  observacoes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.norma_vinculos enable row level security;
create policy "Allow all for now" on public.norma_vinculos for all using (true);

-- Índices
create index if not exists idx_norma_vinculos_cliente on public.norma_vinculos(cliente_id);
create index if not exists idx_norma_vinculos_norma on public.norma_vinculos(norma_code);
create index if not exists idx_norma_vinculos_status on public.norma_vinculos(status);

-- Trigger updated_at
create trigger trg_norma_vinculos_updated_at
  before update on public.norma_vinculos
  for each row execute function handle_updated_at();
