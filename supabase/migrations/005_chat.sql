-- ============================================================
-- CERTIFICA — Migration 005: Chat entre consultores e clientes
-- ============================================================

create table public.chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null default '',
  cliente_id uuid references public.clientes(id) on delete set null,
  projeto_id uuid references public.projetos(id) on delete set null,
  participantes text[] not null default '{}',
  status text not null default 'ativo'
    check (status in ('ativo', 'arquivado')),
  ultima_mensagem text not null default '',
  ultima_mensagem_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_conversations_cliente on public.chat_conversations(cliente_id);
create index idx_chat_conversations_projeto on public.chat_conversations(projeto_id);
create index idx_chat_conversations_status on public.chat_conversations(status);

create table public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  autor text not null default '',
  conteudo text not null default '',
  tipo text not null default 'mensagem'
    check (tipo in ('mensagem', 'evidencia', 'urgente', 'bloqueio', 'duvida')),
  classificacao text not null default 'geral'
    check (classificacao in ('geral', 'duvida', 'evidencia', 'urgencia', 'bloqueio')),
  arquivo_url text,
  arquivo_nome text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_conversation on public.chat_messages(conversation_id);
create index idx_chat_messages_created on public.chat_messages(created_at desc);

-- Trigger updated_at para conversations
create trigger set_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.handle_updated_at();

-- RLS (dev: allow all)
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy "Dev allow all" on public.chat_conversations for all using (true) with check (true);
create policy "Dev allow all" on public.chat_messages for all using (true) with check (true);

-- Seed: conversas iniciais
do $$
declare
  v_acoforte_id uuid;
  v_prj001_id uuid;
  v_conv1_id uuid;
begin
  select id into v_acoforte_id from public.clientes where cnpj = '12345678000190';
  select id into v_prj001_id from public.projetos where codigo = 'PRJ-001';

  if v_acoforte_id is not null then
    insert into public.chat_conversations (titulo, cliente_id, projeto_id, participantes, ultima_mensagem, ultima_mensagem_at)
    values ('AçoForte · ISO 9001', v_acoforte_id, v_prj001_id, '{"Fernando Alves","Carlos Silva"}',
            'Segue o certificado de calibração atualizado.', now() - interval '2 hours')
    returning id into v_conv1_id;

    if v_conv1_id is not null then
      insert into public.chat_messages (conversation_id, autor, conteudo, tipo, classificacao, lida) values
        (v_conv1_id, 'Fernando Alves', 'Bom dia Carlos, tenho uma dúvida sobre o prazo da NC-041.', 'mensagem', 'duvida', true),
        (v_conv1_id, 'Carlos Silva', 'Bom dia Fernando! O prazo é 15/03. Você consegue encaminhar o certificado de calibração?', 'mensagem', 'geral', true),
        (v_conv1_id, 'Fernando Alves', 'Segue o certificado de calibração atualizado.', 'evidencia', 'evidencia', false);
    end if;
  end if;
end $$;
