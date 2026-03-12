-- ============================================================
-- 003 — Upgrade tabela meetings para lifecycle completo
-- Status: agendada → gravando → processando → transcrita → concluida → cancelada
-- ============================================================

-- 1. Remover constraint de status antigo e adicionar novos campos
ALTER TABLE meetings
  DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('agendada','gravando','processando','transcrita','concluida','cancelada'));

-- 2. Adicionar novos campos
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meet_link text DEFAULT '',
  ADD COLUMN IF NOT EXISTS resumo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS resumo_aprovado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resumo_historico jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transcricao jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acoes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gravacao_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gravacao_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS gravacao_fim timestamptz;

-- 3. Index para busca por status
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_data ON meetings(data);

-- 4. Atualizar reuniões existentes com dados de exemplo
UPDATE meetings
SET
  meet_link = 'https://meet.google.com/abc-defg-hij',
  status = 'concluida',
  resumo = 'Revisada a performance do SGQ no Q4/2025. Identificados 3 processos com indicadores abaixo da meta (logística interna, calibração, treinamento). Definido plano de ação para correção até março.',
  resumo_aprovado = true,
  transcricao = '[
    {"time":"00:00:15","speaker":"Carlos Silva","text":"Bom dia a todos. Vamos começar a análise crítica referente ao quarto trimestre."},
    {"time":"00:01:02","speaker":"João Ferreira","text":"No geral tivemos melhoria em 6 dos 9 indicadores. Os três que ficaram abaixo foram logística interna, calibração e taxa de treinamento."},
    {"time":"00:02:45","speaker":"Ana Costa","text":"Sobre a calibração, já identifiquei que o problema é com o laboratório externo. Sugiro que definamos um prazo de contingência."},
    {"time":"00:03:30","speaker":"Carlos Silva","text":"Concordo. João, você consegue providenciar a calibração dos 4 equipamentos até início de março?"},
    {"time":"00:04:10","speaker":"João Ferreira","text":"Consigo sim. Já tenho orçamento de um segundo laboratório credenciado."}
  ]'::jsonb,
  acoes = '[
    {"descricao":"Revisar indicadores de logística interna","responsavel":"Carlos Silva","prazo":"2026-02-28","concluida":false},
    {"descricao":"Atualizar manual da qualidade com processo de expedição","responsavel":"Ana Costa","prazo":"2026-03-10","concluida":false},
    {"descricao":"Agendar calibração pendente dos 4 equipamentos","responsavel":"João Ferreira","prazo":"2026-03-05","concluida":false},
    {"descricao":"Preparar material de treinamento para operadores","responsavel":"Carlos Silva","prazo":"2026-03-15","concluida":false}
  ]'::jsonb
WHERE titulo ILIKE '%análise%' OR titulo ILIKE '%critica%' OR id = (SELECT id FROM meetings ORDER BY created_at LIMIT 1);

-- Atualizar segunda reunião com dados de exemplo
UPDATE meetings
SET
  meet_link = 'https://meet.google.com/klm-nopq-rst',
  status = 'concluida',
  resumo = 'Apresentado escopo do projeto de certificação. Definidas etapas da metodologia Certifica (4 passos). Cliente alinhou equipe interna responsável.',
  resumo_aprovado = true,
  acoes = '[
    {"descricao":"Enviar checklist de diagnóstico","responsavel":"Pedro Souza","prazo":"2026-02-20","concluida":true},
    {"descricao":"Definir representante da direção","responsavel":"Fernanda Costa","prazo":"2026-02-21","concluida":false},
    {"descricao":"Agendar visita técnica para diagnóstico","responsavel":"Carlos Silva","prazo":"2026-02-22","concluida":false}
  ]'::jsonb
WHERE id = (SELECT id FROM meetings ORDER BY created_at OFFSET 1 LIMIT 1);

-- 5. Trigger de audit_log já existe (002_fundacao_completa.sql)
-- As alterações serão automaticamente logadas
