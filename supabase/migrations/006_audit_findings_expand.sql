-- Migration 006: Expand audit_findings with detailed columns
-- Card 1: Identificação
-- Card 2: Evidência e Análise
-- Card 3: Tratamento
-- Card 4: Fechamento

ALTER TABLE public.audit_findings

  -- Card 1: Identificação
  ADD COLUMN IF NOT EXISTS norma text default '',
  ADD COLUMN IF NOT EXISTS subclausula text default '',
  ADD COLUMN IF NOT EXISTS titulo_clausula text default '',
  ADD COLUMN IF NOT EXISTS area_auditada text default '',
  ADD COLUMN IF NOT EXISTS processo_auditado text default '',
  ADD COLUMN IF NOT EXISTS setor text default '',
  ADD COLUMN IF NOT EXISTS local_evidencia text default '',
  ADD COLUMN IF NOT EXISTS severidade text default 'media',
  ADD COLUMN IF NOT EXISTS prioridade text default 'media',

  -- Card 2: Evidência e Análise
  ADD COLUMN IF NOT EXISTS criterio_requisito text default '',
  ADD COLUMN IF NOT EXISTS tipo_evidencia text default '',
  ADD COLUMN IF NOT EXISTS documento_avaliado text default '',
  ADD COLUMN IF NOT EXISTS codigo_documento text default '',
  ADD COLUMN IF NOT EXISTS revisao_documento text default '',
  ADD COLUMN IF NOT EXISTS registro_analisado text default '',
  ADD COLUMN IF NOT EXISTS amostra_qtd text default '',
  ADD COLUMN IF NOT EXISTS criterio_amostragem text default '',
  ADD COLUMN IF NOT EXISTS entrevistados text default '',
  ADD COLUMN IF NOT EXISTS condicao_encontrada text default '',
  ADD COLUMN IF NOT EXISTS desvio_identificado text default '',
  ADD COLUMN IF NOT EXISTS impacto_potencial text default '',
  ADD COLUMN IF NOT EXISTS risco_associado text default '',
  ADD COLUMN IF NOT EXISTS abrangencia text default '',
  ADD COLUMN IF NOT EXISTS qtd_itens_afetados text default '',
  ADD COLUMN IF NOT EXISTS periodo_afetado text default '',
  ADD COLUMN IF NOT EXISTS recorrencia boolean default false,

  -- Card 3: Tratamento
  ADD COLUMN IF NOT EXISTS contencao_imediata text default '',
  ADD COLUMN IF NOT EXISTS data_contencao date,
  ADD COLUMN IF NOT EXISTS responsavel_contencao text default '',
  ADD COLUMN IF NOT EXISTS causa_imediata text default '',
  ADD COLUMN IF NOT EXISTS causa_raiz text default '',
  ADD COLUMN IF NOT EXISTS metodo_analise text default '',
  ADD COLUMN IF NOT EXISTS correcao_imediata text default '',
  ADD COLUMN IF NOT EXISTS acao_preventiva text default '',
  ADD COLUMN IF NOT EXISTS recomendacao_auditor text default '',
  ADD COLUMN IF NOT EXISTS custo_estimado text default '',

  -- Card 4: Fechamento
  ADD COLUMN IF NOT EXISTS verificacao_eficacia text default '',
  ADD COLUMN IF NOT EXISTS responsavel_verificacao text default '',
  ADD COLUMN IF NOT EXISTS data_verificacao date,
  ADD COLUMN IF NOT EXISTS status_eficacia text default 'pendente',
  ADD COLUMN IF NOT EXISTS observacao_anexo text default '';
