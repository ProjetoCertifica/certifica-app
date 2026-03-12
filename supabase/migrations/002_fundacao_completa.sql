-- ============================================================
-- CERTIFICA — Migration 002: Fundação completa (13 tabelas novas)
-- Entidades: roles, profiles, pipeline_columns, pipeline_cards,
--   audits, audit_findings, rai_reports, meetings,
--   meeting_messages, documents, trainings, enrollments,
--   reports, settings, audit_logs, notifications
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- GRUPO 1 — Auth & RBAC
-- ════════════════════════════════════════════════════════════

create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  role_id uuid references public.roles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role_id);
create index idx_profiles_active on public.profiles(active);

-- ════════════════════════════════════════════════════════════
-- GRUPO 2 — Pipeline / Kanban
-- ════════════════════════════════════════════════════════════

create table public.pipeline_columns (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  position integer not null default 0,
  wip_limit integer not null default 0,
  color text not null default '#274C77',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipeline_cards (
  id uuid primary key default uuid_generate_v4(),
  column_id uuid not null references public.pipeline_columns(id) on delete cascade,
  projeto_id uuid references public.projetos(id) on delete set null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  assigned_to text not null default '',
  due_date date,
  tags text[] not null default '{}',
  sla_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pipeline_cards_column on public.pipeline_cards(column_id);
create index idx_pipeline_cards_projeto on public.pipeline_cards(projeto_id);

-- ════════════════════════════════════════════════════════════
-- GRUPO 3 — Auditorias
-- ════════════════════════════════════════════════════════════

create table public.audits (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,
  tipo text not null default 'interna'
    check (tipo in ('interna','externa','certificacao')),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  projeto_id uuid references public.projetos(id) on delete set null,
  auditor text not null default '',
  data_inicio date,
  data_fim date,
  status text not null default 'planejada'
    check (status in ('planejada','em-andamento','concluida','cancelada')),
  escopo text not null default '',
  norma text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audits_cliente on public.audits(cliente_id);
create index idx_audits_projeto on public.audits(projeto_id);
create index idx_audits_status on public.audits(status);

create table public.audit_findings (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  tipo text not null default 'observacao'
    check (tipo in ('nc-maior','nc-menor','observacao','oportunidade','conformidade')),
  clausula text not null default '',
  descricao text not null default '',
  evidencia text not null default '',
  acao_corretiva text not null default '',
  responsavel text not null default '',
  prazo date,
  status text not null default 'aberta'
    check (status in ('aberta','em-tratamento','verificada','fechada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audit_findings_audit on public.audit_findings(audit_id);
create index idx_audit_findings_status on public.audit_findings(status);

create table public.rai_reports (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  codigo text not null unique,
  titulo text not null,
  conteudo jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho','revisao','aprovado','publicado')),
  elaborado_por text not null default '',
  revisado_por text not null default '',
  aprovado_por text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rai_reports_audit on public.rai_reports(audit_id);
create index idx_rai_reports_status on public.rai_reports(status);

-- ════════════════════════════════════════════════════════════
-- GRUPO 4 — Reuniões
-- ════════════════════════════════════════════════════════════

create table public.meetings (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  tipo text not null default 'acompanhamento'
    check (tipo in ('kickoff','acompanhamento','auditoria','analise-critica')),
  projeto_id uuid references public.projetos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  data timestamptz,
  duracao_min integer not null default 60,
  local text not null default '',
  pauta text not null default '',
  participantes text[] not null default '{}',
  status text not null default 'agendada'
    check (status in ('agendada','realizada','cancelada')),
  ata text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meetings_projeto on public.meetings(projeto_id);
create index idx_meetings_cliente on public.meetings(cliente_id);
create index idx_meetings_status on public.meetings(status);

create table public.meeting_messages (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  author text not null default '',
  content text not null default '',
  type text not null default 'mensagem'
    check (type in ('mensagem','acao','decisao')),
  created_at timestamptz not null default now()
);

create index idx_meeting_messages_meeting on public.meeting_messages(meeting_id);

-- ════════════════════════════════════════════════════════════
-- GRUPO 5 — Documentos
-- ════════════════════════════════════════════════════════════

create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null default '',
  titulo text not null,
  tipo text not null default 'registro'
    check (tipo in ('manual','procedimento','instrucao','formulario','registro','evidencia')),
  norma text not null default '',
  projeto_id uuid references public.projetos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  versao integer not null default 1,
  status text not null default 'rascunho'
    check (status in ('rascunho','em-revisao','aprovado','obsoleto')),
  arquivo_url text,
  arquivo_nome text not null default '',
  tamanho_bytes bigint not null default 0,
  uploaded_by text not null default '',
  aprovado_por text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_projeto on public.documents(projeto_id);
create index idx_documents_cliente on public.documents(cliente_id);
create index idx_documents_status on public.documents(status);
create index idx_documents_tipo on public.documents(tipo);

-- ════════════════════════════════════════════════════════════
-- GRUPO 6 — Treinamentos
-- ════════════════════════════════════════════════════════════

create table public.trainings (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  descricao text not null default '',
  norma text not null default '',
  carga_horaria integer not null default 0,
  instrutor text not null default '',
  tipo text not null default 'presencial'
    check (tipo in ('presencial','ead','hibrido')),
  status text not null default 'planejado'
    check (status in ('planejado','em-andamento','concluido')),
  data_inicio date,
  data_fim date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_trainings_status on public.trainings(status);

create table public.enrollments (
  id uuid primary key default uuid_generate_v4(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  participante_nome text not null default '',
  participante_email text not null default '',
  status text not null default 'inscrito'
    check (status in ('inscrito','presente','ausente','aprovado','reprovado')),
  nota numeric(5,2),
  certificado_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_enrollments_training on public.enrollments(training_id);
create index idx_enrollments_status on public.enrollments(status);

-- ════════════════════════════════════════════════════════════
-- GRUPO 7 — Relatórios & Configurações
-- ════════════════════════════════════════════════════════════

create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  template_id text not null default '',
  filtros jsonb not null default '{}'::jsonb,
  dados_snapshot jsonb not null default '{}'::jsonb,
  gerado_por text not null default '',
  formato text not null default 'pdf'
    check (formato in ('pdf','xlsx','html')),
  arquivo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default uuid_generate_v4(),
  chave text not null unique,
  valor jsonb not null default '{}'::jsonb,
  categoria text not null default 'geral'
    check (categoria in ('geral','notificacoes','rbac','integracao')),
  descricao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- GRUPO 8 — Audit Log & Notificações
-- ════════════════════════════════════════════════════════════

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  ip text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_tabela on public.audit_logs(tabela);
create index idx_audit_logs_registro on public.audit_logs(registro_id);
create index idx_audit_logs_created on public.audit_logs(created_at desc);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  titulo text not null default '',
  mensagem text not null default '',
  tipo text not null default 'info'
    check (tipo in ('info','alerta','urgente','sucesso')),
  lida boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_lida on public.notifications(lida);

-- ════════════════════════════════════════════════════════════
-- TRIGGERS — updated_at automático
-- ════════════════════════════════════════════════════════════
-- Reutiliza a função handle_updated_at() criada na migration 001

create trigger set_roles_updated_at
  before update on public.roles
  for each row execute function public.handle_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_pipeline_columns_updated_at
  before update on public.pipeline_columns
  for each row execute function public.handle_updated_at();

create trigger set_pipeline_cards_updated_at
  before update on public.pipeline_cards
  for each row execute function public.handle_updated_at();

create trigger set_audits_updated_at
  before update on public.audits
  for each row execute function public.handle_updated_at();

create trigger set_audit_findings_updated_at
  before update on public.audit_findings
  for each row execute function public.handle_updated_at();

create trigger set_rai_reports_updated_at
  before update on public.rai_reports
  for each row execute function public.handle_updated_at();

create trigger set_meetings_updated_at
  before update on public.meetings
  for each row execute function public.handle_updated_at();

create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

create trigger set_trainings_updated_at
  before update on public.trainings
  for each row execute function public.handle_updated_at();

create trigger set_enrollments_updated_at
  before update on public.enrollments
  for each row execute function public.handle_updated_at();

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.handle_updated_at();

create trigger set_settings_updated_at
  before update on public.settings
  for each row execute function public.handle_updated_at();

-- ════════════════════════════════════════════════════════════
-- TRIGGER — Audit log genérico
-- Captura INSERT/UPDATE/DELETE em todas as tabelas de negócio
-- ════════════════════════════════════════════════════════════

create or replace function public.log_change()
returns trigger as $$
begin
  if (TG_OP = 'DELETE') then
    insert into public.audit_logs (tabela, registro_id, acao, dados_antes, usuario_id)
    values (TG_TABLE_NAME, old.id::text, 'DELETE', to_jsonb(old),
      coalesce(auth.uid(), null));
    return old;
  elsif (TG_OP = 'UPDATE') then
    insert into public.audit_logs (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id)
    values (TG_TABLE_NAME, new.id::text, 'UPDATE', to_jsonb(old), to_jsonb(new),
      coalesce(auth.uid(), null));
    return new;
  elsif (TG_OP = 'INSERT') then
    insert into public.audit_logs (tabela, registro_id, acao, dados_depois, usuario_id)
    values (TG_TABLE_NAME, new.id::text, 'INSERT', to_jsonb(new),
      coalesce(auth.uid(), null));
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Aplicar audit log nas tabelas de negócio (exclui audit_logs e notifications)
create trigger audit_clientes after insert or update or delete on public.clientes
  for each row execute function public.log_change();
create trigger audit_projetos after insert or update or delete on public.projetos
  for each row execute function public.log_change();
create trigger audit_entregaveis after insert or update or delete on public.entregaveis
  for each row execute function public.log_change();
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function public.log_change();
create trigger audit_pipeline_columns after insert or update or delete on public.pipeline_columns
  for each row execute function public.log_change();
create trigger audit_pipeline_cards after insert or update or delete on public.pipeline_cards
  for each row execute function public.log_change();
create trigger audit_audits after insert or update or delete on public.audits
  for each row execute function public.log_change();
create trigger audit_audit_findings after insert or update or delete on public.audit_findings
  for each row execute function public.log_change();
create trigger audit_rai_reports after insert or update or delete on public.rai_reports
  for each row execute function public.log_change();
create trigger audit_meetings after insert or update or delete on public.meetings
  for each row execute function public.log_change();
create trigger audit_meeting_messages after insert or update or delete on public.meeting_messages
  for each row execute function public.log_change();
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function public.log_change();
create trigger audit_trainings after insert or update or delete on public.trainings
  for each row execute function public.log_change();
create trigger audit_enrollments after insert or update or delete on public.enrollments
  for each row execute function public.log_change();
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function public.log_change();
create trigger audit_settings after insert or update or delete on public.settings
  for each row execute function public.log_change();

-- ════════════════════════════════════════════════════════════
-- RLS — Row Level Security (dev: allow all)
-- ════════════════════════════════════════════════════════════

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.pipeline_columns enable row level security;
alter table public.pipeline_cards enable row level security;
alter table public.audits enable row level security;
alter table public.audit_findings enable row level security;
alter table public.rai_reports enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_messages enable row level security;
alter table public.documents enable row level security;
alter table public.trainings enable row level security;
alter table public.enrollments enable row level security;
alter table public.reports enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

create policy "Dev allow all" on public.roles for all using (true) with check (true);
create policy "Dev allow all" on public.profiles for all using (true) with check (true);
create policy "Dev allow all" on public.pipeline_columns for all using (true) with check (true);
create policy "Dev allow all" on public.pipeline_cards for all using (true) with check (true);
create policy "Dev allow all" on public.audits for all using (true) with check (true);
create policy "Dev allow all" on public.audit_findings for all using (true) with check (true);
create policy "Dev allow all" on public.rai_reports for all using (true) with check (true);
create policy "Dev allow all" on public.meetings for all using (true) with check (true);
create policy "Dev allow all" on public.meeting_messages for all using (true) with check (true);
create policy "Dev allow all" on public.documents for all using (true) with check (true);
create policy "Dev allow all" on public.trainings for all using (true) with check (true);
create policy "Dev allow all" on public.enrollments for all using (true) with check (true);
create policy "Dev allow all" on public.reports for all using (true) with check (true);
create policy "Dev allow all" on public.settings for all using (true) with check (true);
create policy "Dev allow all" on public.audit_logs for all using (true) with check (true);
create policy "Dev allow all" on public.notifications for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════
-- SEEDS — Dados iniciais
-- ════════════════════════════════════════════════════════════

-- Roles (5 perfis)
insert into public.roles (name, description, permissions) values
  ('admin', 'Administrador do sistema — acesso total', '["*"]'::jsonb),
  ('gestor', 'Gestor de projetos — visualiza tudo, edita projetos e clientes', '["clients:read","clients:write","projects:read","projects:write","audits:read","audits:write","documents:read","documents:write","reports:read","reports:write","meetings:read","meetings:write","trainings:read","pipeline:read","pipeline:write","settings:read"]'::jsonb),
  ('consultor', 'Consultor — acesso aos projetos atribuidos', '["clients:read","projects:read","projects:write","audits:read","audits:write","documents:read","documents:write","meetings:read","meetings:write","trainings:read","pipeline:read","pipeline:write"]'::jsonb),
  ('auditor', 'Auditor — acesso a auditorias e RAIs', '["clients:read","projects:read","audits:read","audits:write","documents:read","reports:read"]'::jsonb),
  ('viewer', 'Visualizador — somente leitura', '["clients:read","projects:read","audits:read","documents:read","reports:read","meetings:read","trainings:read","pipeline:read"]'::jsonb);

-- Pipeline columns (5 colunas padrão)
insert into public.pipeline_columns (title, position, wip_limit, color) values
  ('Prospecção', 0, 0, '#6B7280'),
  ('Proposta Enviada', 1, 5, '#274C77'),
  ('Em Negociação', 2, 3, '#2F5E8E'),
  ('Contrato Fechado', 3, 0, '#1F5E3B'),
  ('Em Execução', 4, 10, '#0E2A47');

-- Settings (configurações base)
insert into public.settings (chave, valor, categoria, descricao) values
  ('empresa_nome', '"Certifica Consultoria"'::jsonb, 'geral', 'Nome da empresa'),
  ('empresa_cnpj', '"00.000.000/0001-00"'::jsonb, 'geral', 'CNPJ da empresa'),
  ('notificacao_email_ativo', 'true'::jsonb, 'notificacoes', 'Enviar notificações por e-mail'),
  ('notificacao_prazo_dias', '7'::jsonb, 'notificacoes', 'Dias de antecedência para alertas de prazo'),
  ('sla_padrao_dias', '30'::jsonb, 'geral', 'SLA padrão em dias para cards do pipeline'),
  ('moeda', '"BRL"'::jsonb, 'geral', 'Moeda padrão'),
  ('fuso_horario', '"America/Sao_Paulo"'::jsonb, 'geral', 'Fuso horário padrão');

-- Seed: algumas auditorias vinculadas a projetos existentes
do $$
declare
  v_acoforte_id uuid;
  v_prj001_id uuid;
  v_prj005_id uuid;
  v_translog_id uuid;
  v_aud1_id uuid;
begin
  select id into v_acoforte_id from public.clientes where cnpj = '12345678000190';
  select id into v_translog_id from public.clientes where cnpj = '55443322000188';
  select id into v_prj001_id from public.projetos where codigo = 'PRJ-001';
  select id into v_prj005_id from public.projetos where codigo = 'PRJ-005';

  if v_acoforte_id is not null and v_prj001_id is not null then
    insert into public.audits (codigo, tipo, cliente_id, projeto_id, auditor, data_inicio, data_fim, status, escopo, norma, observacoes)
    values ('AUD-001', 'interna', v_acoforte_id, v_prj001_id, 'Carlos Silva', '2025-11-10', '2025-11-12', 'concluida', 'Auditoria interna do SGQ — processos produtivos', 'ISO 9001:2015', 'Auditoria concluída com 2 NCs menores.')
    returning id into v_aud1_id;

    insert into public.audit_findings (audit_id, tipo, clausula, descricao, evidencia, acao_corretiva, responsavel, prazo, status) values
      (v_aud1_id, 'nc-menor', '7.1.5', 'Calibração de instrumentos fora do prazo', 'Certificados de calibração vencidos em 3 instrumentos', 'Recalibrar instrumentos e revisar plano de calibração', 'Fernando Alves', '2025-12-15', 'em-tratamento'),
      (v_aud1_id, 'nc-menor', '8.5.1', 'Registro de produção incompleto no turno noturno', 'Folhas de verificação sem assinatura do supervisor', 'Implementar check digital obrigatório no sistema', 'Fernando Alves', '2025-12-30', 'aberta'),
      (v_aud1_id, 'observacao', '9.1.3', 'Análise de dados poderia incluir tendências trimestrais', 'Relatórios mensais sem gráficos de tendência', '', '', null, 'aberta'),
      (v_aud1_id, 'conformidade', '4.1', 'Contexto da organização bem definido e documentado', 'Manual da Qualidade v3.2', '', '', null, 'fechada');

    insert into public.rai_reports (audit_id, codigo, titulo, conteudo, status, elaborado_por) values
      (v_aud1_id, 'RAI-001', 'Relatório de Auditoria Interna — SGQ AçoForte', '{"resumo_executivo":"Auditoria interna realizada em Nov/2025 com escopo nos processos produtivos.","escopo":"Processos de produção, controle de qualidade e calibração.","metodologia":"Amostragem por processo conforme ISO 19011:2018.","constatacoes":["NC menor 7.1.5 — calibração","NC menor 8.5.1 — registros","Observação 9.1.3 — análise de dados"],"conclusao":"SGQ maduro, com oportunidades pontuais de melhoria.","recomendacoes":["Digitalizar registros de produção","Implantar dashboard de indicadores"]}'::jsonb, 'aprovado', 'Carlos Silva');
  end if;

  if v_translog_id is not null and v_prj005_id is not null then
    insert into public.audits (codigo, tipo, cliente_id, projeto_id, auditor, data_inicio, status, escopo, norma)
    values ('AUD-002', 'certificacao', v_translog_id, v_prj005_id, 'Maria Santos', '2026-02-25', 'planejada', 'Auditoria de certificação ISO 45001 — operações logísticas', 'ISO 45001:2018');
  end if;
end $$;

-- Seed: reuniões
do $$
declare
  v_prj001_id uuid;
  v_prj003_id uuid;
  v_acoforte_id uuid;
  v_energis_id uuid;
  v_mtg1_id uuid;
begin
  select id into v_prj001_id from public.projetos where codigo = 'PRJ-001';
  select id into v_prj003_id from public.projetos where codigo = 'PRJ-003';
  select id into v_acoforte_id from public.clientes where cnpj = '12345678000190';
  select id into v_energis_id from public.clientes where cnpj = '98765432000101';

  if v_prj001_id is not null then
    insert into public.meetings (titulo, tipo, projeto_id, cliente_id, data, duracao_min, local, pauta, participantes, status, ata)
    values ('Análise Crítica SGQ — AçoForte', 'analise-critica', v_prj001_id, v_acoforte_id, '2026-01-20 14:00:00-03', 90, 'Sala de reuniões — matriz Pinhais', 'Revisão dos indicadores do SGQ, análise de NCs abertas, plano para auditoria certificadora.', '{"Carlos Silva","Fernando Alves","Ana Costa"}', 'realizada', 'Reunião produtiva. Definido plano de ação para tratamento das 2 NCs antes da certificadora. Próxima reunião em 15/02.')
    returning id into v_mtg1_id;

    if v_mtg1_id is not null then
      insert into public.meeting_messages (meeting_id, author, content, type) values
        (v_mtg1_id, 'Carlos Silva', 'Apresentei indicadores de eficácia do SGQ — todos dentro da meta exceto lead time de ação corretiva.', 'mensagem'),
        (v_mtg1_id, 'Fernando Alves', 'Recalibração dos instrumentos será feita até 10/02.', 'acao'),
        (v_mtg1_id, 'Ana Costa', 'Aprovada contratação de consultoria para digitalização de registros.', 'decisao');
    end if;
  end if;

  if v_prj003_id is not null then
    insert into public.meetings (titulo, tipo, projeto_id, cliente_id, data, duracao_min, local, pauta, participantes, status)
    values ('Kickoff — ISO 50001 Energis', 'kickoff', v_prj003_id, v_energis_id, '2025-05-20 10:00:00-03', 120, 'Videoconferência (Teams)', 'Alinhamento de escopo, cronograma, equipe e responsabilidades.', '{"Ana Costa","Pedro Souza","Marcos Oliveira"}', 'realizada');
  end if;
end $$;

-- Seed: documentos
do $$
declare
  v_prj001_id uuid;
  v_acoforte_id uuid;
begin
  select id into v_prj001_id from public.projetos where codigo = 'PRJ-001';
  select id into v_acoforte_id from public.clientes where cnpj = '12345678000190';

  if v_prj001_id is not null then
    insert into public.documents (codigo, titulo, tipo, norma, projeto_id, cliente_id, versao, status, arquivo_nome, uploaded_by, tags) values
      ('MQ-001', 'Manual da Qualidade', 'manual', 'ISO 9001:2015', v_prj001_id, v_acoforte_id, 3, 'aprovado', 'MQ-001_v3.pdf', 'Carlos Silva', '{"sgq","manual","9001"}'),
      ('PO-001', 'Procedimento de Controle de Documentos', 'procedimento', 'ISO 9001:2015', v_prj001_id, v_acoforte_id, 2, 'aprovado', 'PO-001_v2.pdf', 'Carlos Silva', '{"sgq","documentos"}'),
      ('PO-002', 'Procedimento de Auditoria Interna', 'procedimento', 'ISO 9001:2015', v_prj001_id, v_acoforte_id, 1, 'aprovado', 'PO-002_v1.pdf', 'Carlos Silva', '{"sgq","auditoria"}'),
      ('FRM-001', 'Formulário de Não Conformidade', 'formulario', 'ISO 9001:2015', v_prj001_id, v_acoforte_id, 2, 'aprovado', 'FRM-001_v2.xlsx', 'Carlos Silva', '{"sgq","nc","formulario"}'),
      ('REG-001', 'Relatório de Análise Crítica pela Direção', 'registro', 'ISO 9001:2015', v_prj001_id, v_acoforte_id, 1, 'rascunho', 'REG-001_rascunho.docx', 'Ana Costa', '{"sgq","analise-critica"}');
  end if;
end $$;

-- Seed: treinamentos e inscrições
insert into public.trainings (titulo, descricao, norma, carga_horaria, instrutor, tipo, status, data_inicio, data_fim) values
  ('Formação de Auditores Internos ISO 9001', 'Curso de formação de auditores internos conforme ISO 19011:2018, com foco em técnicas de auditoria e elaboração de relatórios.', 'ISO 9001:2015', 16, 'Carlos Silva', 'presencial', 'planejado', '2026-03-10', '2026-03-11'),
  ('Conscientização ISO 14001', 'Treinamento de conscientização ambiental para colaboradores operacionais.', 'ISO 14001:2015', 4, 'Roberto Lima', 'ead', 'concluido', '2025-09-15', '2025-09-15'),
  ('APPCC — Análise de Perigos', 'Treinamento técnico sobre análise de perigos e pontos críticos de controle.', 'ISO 22000:2018', 8, 'Pedro Souza', 'hibrido', 'em-andamento', '2026-02-01', '2026-02-28');

do $$
declare
  v_tr1_id uuid;
  v_tr2_id uuid;
begin
  select id into v_tr1_id from public.trainings where titulo = 'Formação de Auditores Internos ISO 9001';
  select id into v_tr2_id from public.trainings where titulo = 'Conscientização ISO 14001';

  if v_tr1_id is not null then
    insert into public.enrollments (training_id, participante_nome, participante_email, status) values
      (v_tr1_id, 'Fernando Alves', 'fernando@acoforte.com.br', 'inscrito'),
      (v_tr1_id, 'Luciana Barros', 'luciana@plastiform.com.br', 'inscrito'),
      (v_tr1_id, 'Patrícia Lopes', 'patricia@siderpr.com.br', 'inscrito');
  end if;

  if v_tr2_id is not null then
    insert into public.enrollments (training_id, participante_nome, participante_email, status, nota) values
      (v_tr2_id, 'Jorge Pereira', 'jorge@florestaviva.com.br', 'aprovado', 8.5),
      (v_tr2_id, 'Luciana Barros', 'luciana@plastiform.com.br', 'aprovado', 9.0),
      (v_tr2_id, 'Anderson Moura', 'anderson@translog.com.br', 'ausente', null);
  end if;
end $$;
