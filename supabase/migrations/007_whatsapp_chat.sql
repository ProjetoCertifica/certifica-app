-- ============================================================
-- 007 · WhatsApp Chat Integration (Z-API + AI Agent)
-- ============================================================

-- 1. whatsapp_messages
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  message_id text UNIQUE,
  phone text NOT NULL,
  from_me boolean DEFAULT false,
  timestamp bigint,
  status text DEFAULT 'SENT',
  sender_name text DEFAULT '',
  chat_name text DEFAULT '',
  body text DEFAULT '',
  message_type text DEFAULT 'text',
  raw jsonb DEFAULT '{}'
);

CREATE INDEX idx_wm_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_wm_phone_ts ON public.whatsapp_messages(phone, timestamp);
CREATE INDEX idx_wm_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX idx_wm_created ON public.whatsapp_messages(created_at);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_messages_all" ON public.whatsapp_messages FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- 2. whatsapp_ai_settings (single-row config)
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  agent_name text DEFAULT 'Assistente Certifica',
  agent_instructions text DEFAULT 'Você é um assistente de consultoria ISO da Certifica. Responda profissionalmente em português.',
  agent_enabled boolean DEFAULT false,
  auto_reply boolean DEFAULT false,
  model text DEFAULT 'gpt-4o-mini',
  temperature real DEFAULT 0.7,
  max_tokens integer DEFAULT 1024,
  keywords text[] DEFAULT '{}',
  timeout_minutes integer DEFAULT 5,
  business_hours_only boolean DEFAULT false,
  business_hours_start text DEFAULT '08:00',
  business_hours_end text DEFAULT '18:00',
  business_days integer[] DEFAULT '{1,2,3,4,5}',
  outside_hours_message text DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  max_messages_per_chat integer DEFAULT 100,
  daily_message_limit integer DEFAULT 200,
  blacklist_phones text[] DEFAULT '{}',
  split_messages boolean DEFAULT false,
  humanize_delay boolean DEFAULT true,
  understand_audio boolean DEFAULT false,
  analyze_images boolean DEFAULT false
);

ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wai_settings_all" ON public.whatsapp_ai_settings FOR ALL USING (true);

-- 3. ai_reply_triggers (idempotency guard)
CREATE TABLE IF NOT EXISTS public.ai_reply_triggers (
  incoming_message_id text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_reply_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_triggers_all" ON public.ai_reply_triggers FOR ALL USING (true);

-- 4. agent_pauses
CREATE TABLE IF NOT EXISTS public.agent_pauses (
  phone text PRIMARY KEY,
  paused_until timestamptz NOT NULL,
  pause_minutes integer DEFAULT 30,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ap_until ON public.agent_pauses(paused_until);

ALTER TABLE public.agent_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_pauses_all" ON public.agent_pauses FOR ALL USING (true);

-- 5. deleted_chats
CREATE TABLE IF NOT EXISTS public.deleted_chats (
  phone text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.deleted_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deleted_chats_all" ON public.deleted_chats FOR ALL USING (true);

-- 6. Seed default AI settings
INSERT INTO public.whatsapp_ai_settings (agent_name, agent_instructions)
VALUES (
  'Assistente Certifica',
  'Você é um assistente virtual da Certifica, especialista em consultoria ISO e sistemas de gestão da qualidade. Responda sempre em português brasileiro, de forma profissional e objetiva. Ajude com dúvidas sobre ISO 9001, ISO 14001, ISO 45001, auditorias, não conformidades, planos de ação e cronogramas. Se não souber a resposta, oriente o cliente a entrar em contato com o consultor responsável.'
)
ON CONFLICT DO NOTHING;
