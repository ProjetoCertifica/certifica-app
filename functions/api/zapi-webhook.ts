/**
 * Cloudflare Pages Function — Webhook receptor para Z-API (WhatsApp)
 *
 * Salva mensagens recebidas/enviadas na tabela `whatsapp_messages` (Supabase).
 * Auto-reply com agente IA (OpenAI) quando configurado.
 *
 * Rota: POST /api/zapi-webhook
 *
 * Env vars necessárias (Cloudflare Pages → Settings → Environment Variables):
 *   ZAPI_INSTANCE_ID | ZAPI_INSTANCE
 *   ZAPI_TOKEN
 *   ZAPI_CLIENT_TOKEN       (opcional)
 *   OPENAI_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  ZAPI_INSTANCE_ID?: string;
  ZAPI_INSTANCE?: string;
  ZAPI_TOKEN?: string;
  ZAPI_CLIENT_TOKEN?: string;
  OPENAI_API_KEY?: string;
  VITE_OPENAI_API_KEY?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const ZAPI_BASE = "https://api.z-api.io";
const SUPABASE_URL_FALLBACK = "https://iylcsmicjhjtwxyxlfyi.supabase.co";

// ─── Helpers ───────────────────────────────────────────────────────────────

function envVal(env: Env, name: keyof Env, fallback = ""): string {
  return (env[name] as string) ?? fallback;
}

function getSupabase(env: Env): SupabaseClient | null {
  const url = envVal(env, "SUPABASE_URL") || envVal(env, "VITE_SUPABASE_URL");
  const key =
    envVal(env, "SUPABASE_SERVICE_ROLE_KEY") ||
    envVal(env, "SUPABASE_ANON_KEY") ||
    envVal(env, "VITE_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function uploadMediaToStorage(supabase: SupabaseClient, mediaUrl: string, messageId: string, fileType: string): Promise<void> {
  if (!mediaUrl?.startsWith("http")) return;
  try {
    const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return;
    const blob = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "application/octet-stream";
    const extMap: Record<string, string> = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "application/pdf": "pdf" };
    let ext = extMap[ct] || mediaUrl.split(".").pop()?.split("?")[0]?.slice(0, 5) || "bin";
    if (ext.length > 5) ext = "bin";
    const path = `${fileType}/${messageId}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: ct, upsert: true });
    if (error) { console.error("[upload] Storage error:", error.message); return; }
    const permanentUrl = `${SUPABASE_URL_FALLBACK}/storage/v1/object/public/media/${path}`;
    // Update message body with permanent URL
    const { data: msg } = await supabase.from("whatsapp_messages").select("body").eq("message_id", messageId).maybeSingle();
    if (msg?.body) {
      const newBody = msg.body.replace(mediaUrl, permanentUrl);
      await supabase.from("whatsapp_messages").update({ body: newBody }).eq("message_id", messageId);
    }
    console.log(`[upload] Media saved: ${path}`);
  } catch (e: any) { console.error("[upload] Error:", e?.message); }
}

function normalizePhone(phone: string): string {
  const s = String(phone ?? "").trim();
  if (!s) return "";
  if (s.includes("@lid")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}

function extractBody(payload: any): string {
  if (payload.text?.message) return payload.text.message;
  if (payload.image) {
    const url = payload.image.imageUrl || payload.image.url || "";
    const caption = payload.image.caption || "";
    return url ? (caption ? `${url}\n${caption}` : url) : (caption || "[Imagem]");
  }
  if (payload.video) {
    const url = payload.video.videoUrl || payload.video.url || "";
    const caption = payload.video.caption || "";
    return url ? (caption ? `${url}\n${caption}` : url) : (caption || "[Vídeo]");
  }
  if (payload.document) {
    const url = payload.document.documentUrl || payload.document.url || "";
    const fileName = payload.document.fileName || "documento";
    return url || `[Arquivo] ${fileName}`;
  }
  if (payload.audio) {
    const url = payload.audio.audioUrl || payload.audio.url || "";
    return url || "[Áudio]";
  }
  if (payload.sticker) {
    const url = payload.sticker.stickerUrl || payload.sticker.url || "";
    return url || "[Sticker]";
  }
  if (payload.contact?.displayName) {
    const contactPhone = payload.contact.vcard?.match(/TEL[^:]*:([^\n]+)/)?.[1]?.trim() || "";
    return JSON.stringify({ contactName: payload.contact.displayName, contactPhone });
  }
  if (payload.location?.name) return `[Localização] ${payload.location.name}`;
  if (payload.location) return "[Localização]";
  if (payload.reaction?.value) return `[Reação] ${payload.reaction.value}`;
  return "";
}

function detectType(payload: any): string {
  if (payload.text) return "text";
  if (payload.image) return "image";
  if (payload.audio) return "audio";
  if (payload.video) return "video";
  if (payload.document) return "document";
  if (payload.sticker) return "sticker";
  if (payload.contact) return "contact";
  if (payload.location) return "location";
  if (payload.reaction) return "reaction";
  return "other";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Status update ─────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  SENT: 1,
  DELIVERED: 2,
  RECEIVED: 2,
  READ: 3,
  PLAYED: 3,
};

async function handleStatusUpdate(supabase: SupabaseClient, payload: any) {
  const status: string = payload.status;
  const rank = STATUS_RANK[status] ?? 0;
  const ids: string[] = Array.isArray(payload.ids)
    ? payload.ids
    : payload.id
      ? [payload.id]
      : [];
  if (!status || !ids.length || rank <= 0) return;

  for (const id of ids) {
    try {
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("status")
        .eq("message_id", String(id))
        .maybeSingle();
      const curRank = STATUS_RANK[existing?.status] ?? 0;
      if (rank > curRank) {
        await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("message_id", String(id));
      }
    } catch (e: any) {
      console.error("[webhook] Erro ao atualizar status:", e?.message);
    }
  }
}

// ─── AI Settings & Agent ───────────────────────────────────────────────────

async function getAiSettings(supabase: SupabaseClient) {
  try {
    const { data } = await supabase
      .from("whatsapp_ai_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch (e: any) {
    console.error("[webhook] Erro ao buscar AI settings:", e?.message);
    return null;
  }
}

async function isAgentPaused(
  supabase: SupabaseClient,
  phone: string,
): Promise<boolean> {
  const p = normalizePhone(phone);
  if (!p || p.length < 10) return false;
  const variants = [p];
  if (p.startsWith("55") && p.length >= 12) variants.push(p.slice(2));
  try {
    const { data } = await supabase
      .from("agent_pauses")
      .select("paused_until")
      .in("phone", variants);
    const row = data?.[0];
    if (!row) return false;
    return new Date(row.paused_until) > new Date();
  } catch (e: any) {
    console.error("[webhook] Erro ao verificar pausa do agente:", e?.message);
    return false;
  }
}

function isWithinBusinessHours(settings: any): boolean {
  if (!settings?.business_hours_only) return true;
  // Horário de Brasília (America/Sao_Paulo)
  const now = new Date();
  const brParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const hour = brParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = brParts.find((p) => p.type === "minute")?.value ?? "00";
  const weekday = brParts.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? now.getDay();

  if (settings.business_days?.length && !settings.business_days.includes(day))
    return false;
  const hhmm = `${hour}:${minute}`;
  if (settings.business_hours_start && hhmm < settings.business_hours_start)
    return false;
  if (settings.business_hours_end && hhmm > settings.business_hours_end)
    return false;
  return true;
}

function calcHumanDelay(text: string, settings: any): number {
  if (!settings?.humanize_delay)
    return settings?.min_delay_between_messages ?? 2;
  const base = settings?.min_delay_between_messages ?? 3;
  const jitter = Math.random() * 2;
  return Math.min(
    15,
    Math.max(base, Math.round((text?.length ?? 0) / 30) + jitter),
  );
}

// ─── Chat history ──────────────────────────────────────────────────────────

async function getChatHistory(
  supabase: SupabaseClient,
  phone: string,
  limit = 15,
) {
  try {
    const p = normalizePhone(phone);
    const orParts = [`phone.eq.${p}`];
    if (p.startsWith("55") && p.length >= 12)
      orParts.push(`phone.eq.${p.slice(2)}`);

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("body, from_me, timestamp, message_type")
      .or(orParts.join(","))
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (!data) return [];
    return data
      .reverse()
      .map((m: any) => {
        let content = String(m.body ?? "");
        if (!content && m.message_type === "image") content = "[Imagem enviada]";
        if (!content && m.message_type === "audio") content = "[Áudio enviado]";
        return { role: m.from_me ? "assistant" : "user", content };
      })
      .filter((m: any) => m.content.trim());
  } catch (e: any) {
    console.error("[webhook] Erro ao buscar histórico:", e?.message);
    return [];
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────

async function countAiReplies(
  supabase: SupabaseClient,
  phone: string,
  sinceTsMs: number,
): Promise<number> {
  try {
    const p = normalizePhone(phone);
    const orParts = [`phone.eq.${p}`];
    if (p.startsWith("55") && p.length >= 12) orParts.push(`phone.eq.${p.slice(2)}`);

    const { count } = await supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("from_me", true)
      .gte("timestamp", sinceTsMs)
      .or(orParts.join(","))
      .like("message_id", "ai-reply-%");
    return count ?? 0;
  } catch (e: any) {
    console.error("[webhook] Erro ao contar replies:", e?.message);
    return 0;
  }
}

async function isRateLimited(
  supabase: SupabaseClient,
  phone: string,
  settings: any,
): Promise<boolean> {
  const maxPerChat = settings?.max_messages_per_chat;
  const dailyLimit = settings?.daily_message_limit;
  if (!maxPerChat && !dailyLimit) return false;

  const now = Date.now();
  const startOfDayMs = new Date().setHours(0, 0, 0, 0);

  if (maxPerChat && maxPerChat > 0) {
    const chatCount = await countAiReplies(supabase, phone, startOfDayMs);
    if (chatCount >= maxPerChat) {
      console.log(`[webhook] Rate limit por chat atingido para ${phone}: ${chatCount}/${maxPerChat}`);
      return true;
    }
  }

  if (dailyLimit && dailyLimit > 0) {
    try {
      const { count } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("from_me", true)
        .gte("timestamp", startOfDayMs)
        .like("message_id", "ai-reply-%");
      if ((count ?? 0) >= dailyLimit) {
        console.log(`[webhook] Rate limit diário atingido: ${count}/${dailyLimit}`);
        return true;
      }
    } catch (e: any) {
      console.error("[webhook] Erro ao verificar rate limit diário:", e?.message);
    }
  }

  return false;
}

// ─── Timeout check ────────────────────────────────────────────────────────

async function isConversationTimedOut(
  supabase: SupabaseClient,
  phone: string,
  timeoutMinutes: number,
): Promise<boolean> {
  if (!timeoutMinutes || timeoutMinutes <= 0) return false;
  try {
    const p = normalizePhone(phone);
    const orParts = [`phone.eq.${p}`];
    if (p.startsWith("55") && p.length >= 12) orParts.push(`phone.eq.${p.slice(2)}`);

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("timestamp")
      .eq("from_me", false)
      .or(orParts.join(","))
      .order("timestamp", { ascending: false })
      .limit(1);

    if (!data?.length) return false;
    const lastMsgTs = Number(data[0].timestamp) || 0;
    const diffMinutes = (Date.now() - lastMsgTs) / 60_000;
    if (diffMinutes > timeoutMinutes) {
      console.log(`[webhook] Conversa com ${phone} expirou: ${Math.round(diffMinutes)}min > ${timeoutMinutes}min`);
      return true;
    }
    return false;
  } catch (e: any) {
    console.error("[webhook] Erro ao verificar timeout:", e?.message);
    return false;
  }
}

// ─── Keywords filter ──────────────────────────────────────────────────────

function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true; // sem filtro = responde tudo
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase().trim()));
}

// ─── OpenAI call ───────────────────────────────────────────────────────────

async function callOpenAI(
  env: Env,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  model = "gpt-4o-mini",
  temperature = 0.5,
  maxTokens = 2048,
): Promise<string | null> {
  const apiKey =
    envVal(env, "OPENAI_API_KEY") || envVal(env, "VITE_OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[webhook] OPENAI_API_KEY não configurada");
    return null;
  }

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-15),
    { role: "user", content: userMessage },
  ];

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    if (!resp.ok) {
      console.error(
        `[webhook] OpenAI erro ${resp.status}: ${await resp.text().catch(() => "")}`,
      );
      return null;
    }
    const data: any = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e: any) {
    console.error("[webhook] Erro chamando OpenAI:", e?.message);
    return null;
  }
}

// ─── OpenAI Whisper (audio transcription) ─────────────────────────────────

async function transcribeAudio(
  env: Env,
  audioUrl: string,
): Promise<string | null> {
  const apiKey =
    envVal(env, "OPENAI_API_KEY") || envVal(env, "VITE_OPENAI_API_KEY");
  if (!apiKey) return null;

  try {
    // Download the audio file
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      console.error(`[webhook] Erro ao baixar áudio: ${audioResp.status}`);
      return null;
    }
    const audioBlob = await audioResp.blob();

    // Build multipart form data
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!resp.ok) {
      console.error(`[webhook] Whisper erro ${resp.status}: ${await resp.text().catch(() => "")}`);
      return null;
    }

    const data: any = await resp.json();
    return data.text?.trim() || null;
  } catch (e: any) {
    console.error("[webhook] Erro no Whisper:", e?.message);
    return null;
  }
}

// ─── Extract media URL from payload ───────────────────────────────────────

function extractMediaUrl(payload: any): string | null {
  if (payload.image?.imageUrl) return payload.image.imageUrl;
  if (payload.image?.thumbnailUrl) return payload.image.thumbnailUrl;
  if (payload.audio?.audioUrl) return payload.audio.audioUrl;
  return null;
}

// ─── Z-API send text ───────────────────────────────────────────────────────

async function sendZApiText(
  env: Env,
  phone: string,
  message: string,
  delayTyping = 0,
) {
  const instance = envVal(env, "ZAPI_INSTANCE_ID") || envVal(env, "ZAPI_INSTANCE");
  const token = envVal(env, "ZAPI_TOKEN");
  const clientToken = envVal(env, "ZAPI_CLIENT_TOKEN");
  if (!instance || !token) {
    console.error("[webhook] Credenciais Z-API ausentes");
    return null;
  }

  const url = `${ZAPI_BASE}/instances/${instance}/token/${token}/send-text`;
  const payload: any = { phone: normalizePhone(phone), message };
  if (delayTyping > 0)
    payload.delayTyping = Math.min(15, Math.max(1, Math.round(delayTyping)));

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error(
        `[webhook] Z-API send-text erro ${resp.status}:`,
        JSON.stringify(data),
      );
      return null;
    }
    console.log(
      `[webhook] Z-API send-text OK: zaapId=${data.zaapId ?? data.messageId ?? ""}`,
    );
    return data;
  } catch (e: any) {
    console.error("[webhook] Erro enviando Z-API:", e?.message);
    return null;
  }
}

// ─── Save AI reply ─────────────────────────────────────────────────────────

async function saveAiReply(
  supabase: SupabaseClient,
  phone: string,
  body: string,
  zaapId?: string,
) {
  try {
    await supabase.from("whatsapp_messages").upsert(
      {
        message_id:
          zaapId ||
          `ai-reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        phone: normalizePhone(phone),
        from_me: true,
        timestamp: Date.now(),
        status: "SENT",
        body,
        message_type: "text",
        raw: { _aiReply: true },
      },
      { onConflict: "message_id" },
    );
  } catch (e: any) {
    console.error("[webhook] Erro ao salvar resposta IA:", e?.message);
  }
}

// ─── Split message helper ─────────────────────────────────────────────────

function splitMessage(text: string, maxLen = 1500): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    // Try to split at paragraph break
    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    // Fallback to sentence end
    if (splitIdx < maxLen * 0.3) splitIdx = remaining.lastIndexOf(". ", maxLen);
    // Fallback to line break
    if (splitIdx < maxLen * 0.3) splitIdx = remaining.lastIndexOf("\n", maxLen);
    // Hard cut
    if (splitIdx < maxLen * 0.3) splitIdx = maxLen;
    parts.push(remaining.slice(0, splitIdx + 1).trim());
    remaining = remaining.slice(splitIdx + 1).trim();
  }
  return parts.filter((p) => p.length > 0);
}

// ─── AI Auto-Reply ─────────────────────────────────────────────────────────

async function handleAiAutoReply(
  env: Env,
  supabase: SupabaseClient,
  phoneKey: string,
  messageBody: string,
  messageType: string,
  rawPayload?: any,
) {
  // Determine supported types
  const supportedTypes = ["text"];

  const aiSettings = await getAiSettings(supabase);
  if (!aiSettings?.agent_enabled || !aiSettings?.auto_reply) {
    console.log("[webhook] Auto-reply desabilitado nas configurações");
    return;
  }

  if (aiSettings.understand_audio) supportedTypes.push("audio");
  if (aiSettings.analyze_images) supportedTypes.push("image");

  // Check message type is supported
  if (!supportedTypes.includes(messageType)) {
    console.log(`[webhook] Tipo ${messageType} não suportado para auto-reply`);
    return;
  }

  // For text, need body; for audio/image, need media URL
  if (messageType === "text" && !messageBody) return;

  if (await isAgentPaused(supabase, phoneKey)) {
    console.log(`[webhook] Agente pausado para ${phoneKey}, pulando auto-reply`);
    return;
  }

  if (!isWithinBusinessHours(aiSettings)) {
    if (aiSettings.outside_hours_message) {
      const delay = calcHumanDelay(aiSettings.outside_hours_message, aiSettings);
      await sendZApiText(env, phoneKey, aiSettings.outside_hours_message, delay);
    }
    console.log(`[webhook] Fora do horário comercial para ${phoneKey}`);
    return;
  }

  if (Array.isArray(aiSettings.blacklist_phones)) {
    const norm = normalizePhone(phoneKey);
    if (aiSettings.blacklist_phones.some((b: string) => normalizePhone(b) === norm)) {
      console.log(`[webhook] Telefone ${phoneKey} está na blacklist`);
      return;
    }
  }

  // ── Timeout check ──
  const timeoutMin = typeof aiSettings.timeout_minutes === "number" ? aiSettings.timeout_minutes : 0;
  if (timeoutMin > 0 && await isConversationTimedOut(supabase, phoneKey, timeoutMin)) {
    console.log(`[webhook] Conversa com ${phoneKey} expirou (timeout ${timeoutMin}min)`);
    return;
  }

  // ── Rate limiting ──
  if (await isRateLimited(supabase, phoneKey, aiSettings)) {
    console.log(`[webhook] Rate limit atingido para ${phoneKey}`);
    return;
  }

  // ── Keywords filter (only for text messages) ──
  if (
    messageType === "text" &&
    Array.isArray(aiSettings.keywords) &&
    aiSettings.keywords.length > 0 &&
    !matchesKeywords(messageBody, aiSettings.keywords)
  ) {
    console.log(`[webhook] Mensagem de ${phoneKey} não contém keywords configuradas, ignorando`);
    return;
  }

  // ── Resolve the user message content for OpenAI ──
  let userContent: string | any[] = messageBody;

  // Handle audio: transcribe with Whisper
  if (messageType === "audio" && aiSettings.understand_audio && rawPayload) {
    const audioUrl = extractMediaUrl(rawPayload);
    if (!audioUrl) {
      console.log("[webhook] Áudio sem URL, ignorando");
      return;
    }
    console.log(`[webhook] Transcrevendo áudio de ${phoneKey}...`);
    const transcription = await transcribeAudio(env, audioUrl);
    if (!transcription) {
      console.log("[webhook] Falha ao transcrever áudio");
      return;
    }
    console.log(`[webhook] Transcrição: "${transcription.slice(0, 80)}..."`);
    userContent = `[Áudio transcrito]: ${transcription}`;
  }

  // Handle image: send to GPT-4 Vision
  if (messageType === "image" && aiSettings.analyze_images && rawPayload) {
    const imageUrl = extractMediaUrl(rawPayload);
    if (!imageUrl) {
      console.log("[webhook] Imagem sem URL, ignorando");
      return;
    }
    console.log(`[webhook] Analisando imagem de ${phoneKey}...`);
    const caption = messageBody || "";
    userContent = [
      { type: "text", text: caption ? `O usuário enviou uma imagem com a legenda: "${caption}". Descreva e responda.` : "O usuário enviou esta imagem. Descreva o que vê e responda." },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
  }

  const systemPrompt = aiSettings.agent_instructions || buildDefaultSystemPrompt();
  const history = await getChatHistory(supabase, phoneKey, 15);

  // For vision, use gpt-4o (supports images); for audio transcription, use configured model
  let model = aiSettings.model || "gpt-4o-mini";
  if (messageType === "image" && aiSettings.analyze_images) {
    model = "gpt-4o";
  }
  const temperature =
    typeof aiSettings.temperature === "number" ? aiSettings.temperature : 0.5;
  const maxTokens =
    typeof aiSettings.max_tokens === "number" ? aiSettings.max_tokens : 2048;

  const reply = await callOpenAI(
    env,
    systemPrompt,
    history,
    userContent,
    model,
    temperature,
    maxTokens,
  );
  if (!reply) return;

  const charLimit = aiSettings.response_char_limit ?? 1500;

  // ── Split messages or truncate ──
  let messagesToSend: string[];
  if (aiSettings.split_messages && reply.length > charLimit) {
    messagesToSend = splitMessage(reply, charLimit);
    console.log(`[webhook] Resposta dividida em ${messagesToSend.length} partes`);
  } else {
    const finalReply =
      reply.length > charLimit
        ? reply.slice(0, reply.lastIndexOf(".", charLimit * 0.8) + 1 || charLimit) + "..."
        : reply;
    messagesToSend = [finalReply];
  }

  // ── Send each part ──
  for (let i = 0; i < messagesToSend.length; i++) {
    const part = messagesToSend[i];

    const delaySec = calcHumanDelay(part, aiSettings);
    if (delaySec > 0) {
      console.log(`[webhook] Aguardando ${delaySec}s antes de enviar parte ${i + 1}`);
      await sleep(delaySec * 1000);
    }

    // Re-check pause before each send
    if (await isAgentPaused(supabase, phoneKey)) {
      console.log(`[webhook] Agente pausado para ${phoneKey} antes do envio, cancelando`);
      return;
    }

    const sendResult = await sendZApiText(
      env,
      phoneKey,
      part,
      calcHumanDelay(part, aiSettings),
    );
    await saveAiReply(
      supabase,
      phoneKey,
      part,
      sendResult?.zaapId ?? sendResult?.messageId,
    );
  }

  console.log(
    `[webhook] Resposta IA enviada para ${phoneKey} (${messagesToSend.length} parte(s)): "${messagesToSend[0].slice(0, 80)}..."`,
  );
}

function buildDefaultSystemPrompt(): string {
  const now = new Date();
  const dataAtual = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Você é um assistente virtual da Certifica, uma consultoria especializada em certificação ISO e compliance.

Hoje é ${dataAtual}.

=== SUA IDENTIDADE ===
- Você é educado, profissional e objetivo.
- Responda sempre em português (pt-BR).
- Seu objetivo é ajudar clientes e prospects com dúvidas sobre certificações ISO, processos de auditoria e compliance.

=== REGRAS ===
- Seja claro e conciso.
- Não invente informações sobre prazos ou valores — diga que vai verificar com a equipe.
- Se a pergunta for muito técnica ou envolver propostas comerciais, ofereça encaminhar para um consultor.
- Nunca envie links ou URLs.
- Mantenha respostas com no máximo 1500 caracteres.`;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // GET → webhook verification (Z-API ping)
  if (request.method === "GET") {
    return Response.json({ status: "ok", webhook: "certifica-zapi" });
  }

  // Only accept POST — always return 200 to Z-API
  if (request.method !== "POST") {
    return Response.json({ ok: true });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch (e: any) {
    console.error("[webhook] Erro ao parsear payload:", e?.message);
    return Response.json({ ok: true });
  }

  const supabase = getSupabase(env);

  // Skip irrelevant callback types
  const skipTypes = [
    "PresenceChatCallback",
    "DeliveryCallback",
    "ConnectedCallback",
    "DisconnectedCallback",
  ];
  if (skipTypes.includes(payload.type)) {
    return Response.json({ ok: true });
  }

  // ── Status update ──
  if (payload.type === "MessageStatusCallback") {
    if (supabase) await handleStatusUpdate(supabase, payload);
    return Response.json({ ok: true });
  }

  // ── Message callback ──
  const messageId = payload.messageId ?? payload.zaapId ?? payload.id;
  const phoneRaw = payload.phone;
  const senderLid = payload.senderLid ?? payload.chatLid;
  const lidDigits = senderLid
    ? String(senderLid).replace(/@.*$/, "").replace(/\D/g, "")
    : null;
  const phoneDigits = phoneRaw
    ? String(phoneRaw).replace(/\D/g, "")
    : "";
  const phoneKey = phoneDigits || lidDigits || "";

  if (messageId && phoneKey && supabase) {
    try {
      const ts =
        payload.momment ?? payload.moment ?? payload.timestamp ?? Date.now();
      const body = extractBody(payload);
      const msgType = detectType(payload);

      const normalizedPhone = normalizePhone(phoneKey);
      const replyToId = payload.quotedMsg?.messageId || null;

      // Check if message already exists to avoid overwriting reply_to_id
      const { data: existingMsg } = await supabase.from("whatsapp_messages")
        .select("id, reply_to_id").eq("message_id", String(messageId)).maybeSingle();

      if (existingMsg) {
        const update: any = {
          phone: normalizedPhone, from_me: payload.fromMe === true,
          timestamp: Number(ts) || Date.now(), status: payload.status ?? null,
          sender_name: payload.senderName ?? payload.chatName ?? "",
          chat_name: payload.chatName ?? "", body, message_type: msgType, raw: payload,
        };
        if (replyToId && !existingMsg.reply_to_id) update.reply_to_id = replyToId;
        await supabase.from("whatsapp_messages").update(update).eq("message_id", String(messageId));
      } else {
        await supabase.from("whatsapp_messages").insert({
          message_id: String(messageId), phone: normalizedPhone,
          from_me: payload.fromMe === true, timestamp: Number(ts) || Date.now(),
          status: payload.status ?? null, sender_name: payload.senderName ?? payload.chatName ?? "",
          chat_name: payload.chatName ?? "", body, message_type: msgType, raw: payload,
          ...(replyToId ? { reply_to_id: replyToId } : {}),
        });
      }

      // Auto-pause IA when human operator sends a message
      if (payload.fromMe === true && body && !/^\[ai-reply\]|^\*Assistente/i.test(body)) {
        const pausedUntil = new Date(Date.now() + 30 * 60_000).toISOString();
        try {
          await supabase.from("agent_pauses").upsert(
            { phone: normalizedPhone, paused_until: pausedUntil, pause_minutes: 30 },
            { onConflict: "phone" }
          );
        } catch {}
      }

      // Upload media to permanent storage (async, fire-and-forget)
      if (payload.fromMe !== true && body?.startsWith("http") && ["image", "audio", "video", "document"].includes(msgType)) {
        uploadMediaToStorage(supabase, body.split("\n")[0], String(messageId), msgType).catch(() => {});
      }

      // Auto-reply: only for incoming messages (not fromMe)
      if (
        payload.fromMe !== true &&
        phoneKey &&
        (body || msgType === "audio" || msgType === "image")
      ) {
        try {
          const { error: triggerError } = await supabase
            .from("ai_reply_triggers")
            .insert({ incoming_message_id: String(messageId) });

          if (
            triggerError &&
            (triggerError.code === "23505" ||
              (triggerError as any).code === 23505)
          ) {
            console.log(
              `[webhook] Mensagem ${messageId} já processada, ignorando duplicata`,
            );
          } else if (triggerError) {
            console.error(
              "[webhook] Erro ao registrar trigger IA:",
              triggerError.message,
            );
          } else {
            try {
              await handleAiAutoReply(env, supabase, phoneKey, body, msgType, payload);
            } catch (replyErr: any) {
              console.error(
                "[webhook] Erro no handleAiAutoReply:",
                replyErr?.message,
              );
              try {
                await supabase
                  .from("ai_reply_triggers")
                  .delete()
                  .eq("incoming_message_id", String(messageId));
              } catch (cleanupErr: any) {
                console.error("[webhook] Erro ao limpar trigger:", cleanupErr?.message);
              }
            }
          }
        } catch (e: any) {
          console.error("[webhook] Erro no auto-reply:", e?.message);
        }
      }
    } catch (e: any) {
      console.error("[webhook] Erro ao salvar mensagem:", e?.message);
    }
  }

  // Always return 200 to prevent Z-API retries
  return Response.json({ ok: true });
};
