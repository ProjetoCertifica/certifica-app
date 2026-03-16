-- ============================================================
-- Migration 010: Pipelines customizáveis
-- ============================================================

-- Tabela de pipelines (agrupa colunas e cards)
CREATE TABLE IF NOT EXISTS pipelines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon        text NOT NULL DEFAULT 'kanban',
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipelines_user ON pipelines(user_id);

-- Adicionar pipeline_id nas colunas existentes
ALTER TABLE pipeline_columns
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE;

CREATE INDEX idx_pipeline_columns_pipeline ON pipeline_columns(pipeline_id);

-- Criar pipeline default e vincular colunas existentes
DO $$
DECLARE
  default_id uuid;
BEGIN
  -- Só cria se existem colunas órfãs
  IF EXISTS (SELECT 1 FROM pipeline_columns WHERE pipeline_id IS NULL) THEN
    INSERT INTO pipelines (name, description, icon, is_default)
    VALUES ('Pipeline Principal', 'Pipeline padrão do sistema', 'kanban', true)
    RETURNING id INTO default_id;

    UPDATE pipeline_columns
    SET pipeline_id = default_id
    WHERE pipeline_id IS NULL;
  END IF;
END $$;

-- RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipelines_all" ON pipelines FOR ALL USING (true) WITH CHECK (true);
