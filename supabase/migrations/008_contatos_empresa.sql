-- ─── Contatos vinculados a empresas ─────────────────────────────────────────
-- Cada empresa (clientes) pode ter múltiplos contatos com nome, cargo, telefone, email.
-- O telefone normalizado permite vincular um contato do WhatsApp a uma empresa.

CREATE TABLE IF NOT EXISTS contatos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL DEFAULT '',
  cargo       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  telefone    TEXT NOT NULL DEFAULT '',
  whatsapp    TEXT NOT NULL DEFAULT '',  -- telefone normalizado (só dígitos, com DDI)
  principal   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index para busca por telefone/whatsapp (vincular ao chat)
CREATE INDEX IF NOT EXISTS idx_contatos_whatsapp ON contatos(whatsapp);
CREATE INDEX IF NOT EXISTS idx_contatos_empresa ON contatos(empresa_id);

-- RLS
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contatos_all ON contatos FOR ALL USING (true) WITH CHECK (true);

-- Migrar contato principal existente de cada empresa para a nova tabela
INSERT INTO contatos (empresa_id, nome, cargo, email, telefone, whatsapp, principal)
SELECT
  id,
  contato_nome,
  contato_cargo,
  contato_email,
  contato_telefone,
  REGEXP_REPLACE(contato_telefone, '\D', '', 'g'),
  true
FROM clientes
WHERE contato_nome IS NOT NULL AND contato_nome != ''
ON CONFLICT DO NOTHING;
