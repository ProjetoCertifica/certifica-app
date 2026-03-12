-- ============================================================
-- CERTIFICA - Schema: Clientes + Projetos + Entregáveis
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ── Clientes ──────────────────────────────────────────────
create table public.clientes (
  id uuid primary key default uuid_generate_v4(),
  cnpj text not null unique,
  razao_social text not null,
  nome_fantasia text not null default '',
  segmento text not null default 'Outros',
  porte text not null default 'ME' check (porte in ('MEI','ME','EPP','Medio','Grande')),
  status text not null default 'prospect' check (status in ('ativo','inativo','prospect')),
  contato_nome text not null default '',
  contato_cargo text not null default '',
  contato_email text not null default '',
  contato_telefone text not null default '',
  endereco text not null default '',
  cidade text not null default '',
  uf text not null default '',
  consultor_responsavel text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clientes_status on public.clientes(status);
create index idx_clientes_segmento on public.clientes(segmento);
create index idx_clientes_consultor on public.clientes(consultor_responsavel);

-- ── Projetos ──────────────────────────────────────────────
create table public.projetos (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,
  titulo text not null,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  norma text not null default '',
  fase integer not null default 0,
  fase_label text not null default 'Proposta',
  status text not null default 'proposta' check (status in ('proposta','em-andamento','concluido','pausado','cancelado')),
  prioridade text not null default 'media' check (prioridade in ('alta','media','baixa')),
  consultor text not null default '',
  equipe text[] not null default '{}',
  inicio text,
  previsao text,
  escopo text not null default '',
  valor text not null default 'R$ 0,00',
  condicoes_pagamento text not null default '',
  total_documentos integer not null default 0,
  total_auditorias integer not null default 0,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projetos_cliente on public.projetos(cliente_id);
create index idx_projetos_status on public.projetos(status);
create index idx_projetos_consultor on public.projetos(consultor);

-- ── Entregáveis ───────────────────────────────────────────
create table public.entregaveis (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  texto text not null,
  concluido boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_entregaveis_projeto on public.entregaveis(projeto_id);

-- ── Trigger para updated_at automático ────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_clientes_updated_at
  before update on public.clientes
  for each row execute function public.handle_updated_at();

create trigger set_projetos_updated_at
  before update on public.projetos
  for each row execute function public.handle_updated_at();

-- ── RLS (Row Level Security) ──────────────────────────────
-- Por enquanto, acesso público para desenvolvimento
-- Em produção, ativar policies por perfil

alter table public.clientes enable row level security;
alter table public.projetos enable row level security;
alter table public.entregaveis enable row level security;

create policy "Allow all for now" on public.clientes for all using (true) with check (true);
create policy "Allow all for now" on public.projetos for all using (true) with check (true);
create policy "Allow all for now" on public.entregaveis for all using (true) with check (true);

-- ── Seed: dados iniciais ──────────────────────────────────
insert into public.clientes (cnpj, razao_social, nome_fantasia, segmento, porte, status, contato_nome, contato_cargo, contato_email, contato_telefone, endereco, cidade, uf, consultor_responsavel) values
  ('12345678000190', 'Metalúrgica AçoForte Ltda', 'AçoForte', 'Metalurgia', 'Medio', 'ativo', 'Fernando Alves', 'Gerente Industrial', 'fernando@acoforte.com.br', '(41) 3344-5566', 'Av. Industrial, 1200', 'Pinhais', 'PR', 'Carlos Silva'),
  ('98765432000101', 'Grupo Energis S.A.', 'Energis', 'Energia', 'Grande', 'ativo', 'Marcos Oliveira', 'Diretor de Operações', 'marcos@energis.com.br', '(11) 2233-4455', 'Rua da Energia, 500', 'São Paulo', 'SP', 'Ana Costa'),
  ('11223344000155', 'AgroVale Alimentos S.A.', 'AgroVale', 'Alimentos', 'Grande', 'ativo', 'Cláudia Ribeiro', 'Coord. Qualidade', 'claudia@agrovale.com.br', '(43) 3322-1100', 'Rod. PR-445, km 22', 'Londrina', 'PR', 'Pedro Souza'),
  ('55443322000188', 'TransLog Operações Ltda', 'TransLog', 'Logística', 'Medio', 'ativo', 'Anderson Moura', 'Gerente SSO', 'anderson@translog.com.br', '(21) 4455-6677', 'Terminal Logístico, Galpão 8', 'Rio de Janeiro', 'RJ', 'Maria Santos'),
  ('66778899000122', 'Plastiform Industrial Ltda', 'Plastiform', 'Plásticos', 'EPP', 'ativo', 'Luciana Barros', 'Resp. Ambiental', 'luciana@plastiform.com.br', '(47) 3344-2211', 'Distrito Industrial, Lote 15', 'Joinville', 'SC', 'Roberto Lima'),
  ('77889900000133', 'Madeireira Floresta Viva', 'Floresta Viva', 'Madeireiro', 'ME', 'ativo', 'Jorge Pereira', 'Proprietário', 'jorge@florestaviva.com.br', '(66) 9988-7766', 'Estrada Rural, s/n', 'Sinop', 'MT', 'Carlos Silva'),
  ('88990011000144', 'Siderúrgica Paraná S.A.', 'Siderúrgica PR', 'Siderurgia', 'Grande', 'ativo', 'Patrícia Lopes', 'Gerente da Qualidade', 'patricia@siderpr.com.br', '(41) 3355-7788', 'Polo Industrial, Bloco C', 'Araucária', 'PR', 'Ana Costa'),
  ('99001122000155', 'Construtora Horizonte Ltda', 'Horizonte', 'Construção Civil', 'Medio', 'prospect', 'Ricardo Mendes', 'Engenheiro Civil', 'ricardo@horizonte.com.br', '(31) 2244-5566', 'Av. Brasil, 3200', 'Belo Horizonte', 'MG', 'Carlos Silva'),
  ('10203040000166', 'Têxtil Nova Era Ltda', 'Nova Era', 'Têxtil', 'EPP', 'inativo', 'Simone Cardoso', 'Diretora', 'simone@novaera.com.br', '(11) 3366-4488', 'Rua dos Tecelões, 88', 'Americana', 'SP', 'Roberto Lima');

-- Inserir projetos vinculados
do $$
declare
  v_acoforte uuid;
  v_energis uuid;
  v_agrovale uuid;
  v_translog uuid;
  v_plastiform uuid;
  v_floresta uuid;
  v_sider uuid;
  v_horizonte uuid;
  v_novaera uuid;
begin
  select id into v_acoforte from public.clientes where cnpj = '12345678000190';
  select id into v_energis from public.clientes where cnpj = '98765432000101';
  select id into v_agrovale from public.clientes where cnpj = '11223344000155';
  select id into v_translog from public.clientes where cnpj = '55443322000188';
  select id into v_plastiform from public.clientes where cnpj = '66778899000122';
  select id into v_floresta from public.clientes where cnpj = '77889900000133';
  select id into v_sider from public.clientes where cnpj = '88990011000144';
  select id into v_horizonte from public.clientes where cnpj = '99001122000155';
  select id into v_novaera from public.clientes where cnpj = '10203040000166';

  insert into public.projetos (codigo, titulo, cliente_id, norma, fase, fase_label, status, prioridade, consultor, equipe, inicio, previsao, escopo, valor, condicoes_pagamento, total_documentos, total_auditorias, observacoes) values
    ('PRJ-001', 'Certificação ISO 9001:2015', v_acoforte, 'ISO 9001:2015', 3, 'Verificação', 'em-andamento', 'alta', 'Carlos Silva', '{"Carlos Silva","Ana Costa"}', '01/06/2025', '15/03/2026', 'Implementação completa do SGQ com foco em processos industriais e cadeia de fornecimento.', 'R$ 48.000,00', '6x de R$ 8.000,00', 12, 2, 'Cliente prioridade — auditoria certificadora em março.'),
    ('PRJ-002', 'Implementação ISO 14001:2015', v_acoforte, 'ISO 14001:2015', 1, 'Planejamento', 'em-andamento', 'media', 'Roberto Lima', '{"Roberto Lima"}', '10/08/2025', '30/07/2026', 'SGA com levantamento de aspectos ambientais e controle operacional.', 'R$ 38.000,00', '4x de R$ 9.500,00', 5, 0, 'Integrar com SGQ existente.'),
    ('PRJ-003', 'Gestão Energética ISO 50001', v_energis, 'ISO 50001:2018', 2, 'Solução', 'em-andamento', 'alta', 'Ana Costa', '{"Ana Costa","Pedro Souza"}', '15/05/2025', '30/04/2026', 'Sistema de gestão de energia com revisão energética e IDEn.', 'R$ 62.000,00', '8x de R$ 7.750,00', 8, 1, 'Projeto estratégico — envolve diretoria de operações.'),
    ('PRJ-004', 'Segurança Alimentar ISO 22000', v_agrovale, 'ISO 22000:2018', 1, 'Planejamento', 'em-andamento', 'media', 'Pedro Souza', '{"Pedro Souza"}', '01/09/2025', '31/07/2026', 'SGSA com APPCC, PPR e rastreabilidade completa.', 'R$ 45.000,00', '5x de R$ 9.000,00', 4, 0, ''),
    ('PRJ-005', 'SSO — ISO 45001:2018', v_translog, 'ISO 45001:2018', 4, 'Validação', 'em-andamento', 'alta', 'Maria Santos', '{"Maria Santos","Carlos Silva"}', '01/03/2025', '28/02/2026', 'SGSSO com foco em operações logísticas de alto risco.', 'R$ 35.000,00', '4x de R$ 8.750,00', 10, 3, 'Auditoria certificadora iminente.'),
    ('PRJ-006', 'SGA — ISO 14001:2015', v_plastiform, 'ISO 14001:2015', 3, 'Verificação', 'em-andamento', 'media', 'Roberto Lima', '{"Roberto Lima"}', '01/07/2025', '15/03/2026', 'Gestão ambiental para indústria de plásticos.', 'R$ 32.000,00', '4x de R$ 8.000,00', 7, 1, ''),
    ('PRJ-007', 'FSC Cadeia de Custódia', v_floresta, 'FSC COC', 2, 'Solução', 'em-andamento', 'baixa', 'Carlos Silva', '{"Carlos Silva"}', '01/10/2025', '30/05/2026', 'Certificação FSC para cadeia de custódia de madeira.', 'R$ 22.000,00', '3x de R$ 7.333,33', 3, 0, ''),
    ('PRJ-008', 'Certificação ISO 9001:2015', v_sider, 'ISO 9001:2015', 2, 'Solução', 'em-andamento', 'media', 'Ana Costa', '{"Ana Costa","Roberto Lima"}', '15/05/2025', '30/04/2026', 'SGQ para siderúrgica com processos complexos.', 'R$ 55.000,00', '6x de R$ 9.166,67', 6, 0, ''),
    ('PRJ-009', 'Proposta — ISO 9001 + 14001 Integrado', v_horizonte, 'ISO 9001 + 14001', 0, 'Proposta', 'proposta', 'media', 'Carlos Silva', '{"Carlos Silva"}', null, null, 'Sistema integrado de gestão (qualidade + ambiental) para construtora.', 'R$ 72.000,00', 'A definir', 0, 0, 'Aguardando retorno do cliente.');

  -- Entregáveis para PRJ-001
  insert into public.entregaveis (projeto_id, texto, concluido, ordem) values
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Diagnóstico inicial do SGQ', true, 1),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Mapeamento de processos', true, 2),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Manual da Qualidade v1', true, 3),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Procedimentos operacionais', true, 4),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Auditoria interna', false, 5),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Ação corretiva NCs', false, 6),
    ((select id from public.projetos where codigo = 'PRJ-001'), 'Auditoria certificadora', false, 7);

  -- Entregáveis para PRJ-003
  insert into public.entregaveis (projeto_id, texto, concluido, ordem) values
    ((select id from public.projetos where codigo = 'PRJ-003'), 'Revisão energética inicial', true, 1),
    ((select id from public.projetos where codigo = 'PRJ-003'), 'Definição de IDEn e LBEn', true, 2),
    ((select id from public.projetos where codigo = 'PRJ-003'), 'Plano de ação energético', false, 3),
    ((select id from public.projetos where codigo = 'PRJ-003'), 'Monitoramento e medição', false, 4),
    ((select id from public.projetos where codigo = 'PRJ-003'), 'Análise crítica pela direção', false, 5);

  -- Entregáveis para PRJ-005
  insert into public.entregaveis (projeto_id, texto, concluido, ordem) values
    ((select id from public.projetos where codigo = 'PRJ-005'), 'Identificação de perigos e riscos', true, 1),
    ((select id from public.projetos where codigo = 'PRJ-005'), 'Política e objetivos SSO', true, 2),
    ((select id from public.projetos where codigo = 'PRJ-005'), 'Procedimentos de emergência', true, 3),
    ((select id from public.projetos where codigo = 'PRJ-005'), 'Auditoria interna SSO', true, 4),
    ((select id from public.projetos where codigo = 'PRJ-005'), 'Preparação para certificação', false, 5);
end $$;
