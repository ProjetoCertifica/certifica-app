-- ============================================================
-- 004 — Integração Recall.ai no meetings
-- ============================================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recall_bot_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS recall_bot_status text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_meetings_recall_bot ON meetings(recall_bot_id) WHERE recall_bot_id != '';
