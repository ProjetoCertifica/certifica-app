/**
 * Evolution API v2 Client
 *
 * Conecta com a Evolution API hospedada no Railway.
 * Config armazenada no Supabase (tabela app_settings):
 *   EVOLUTION_API_URL  →  ex: "https://evolution-api-production-xxxx.up.railway.app"
 *   EVOLUTION_API_KEY  →  ex: "sua-api-key-aqui"
 *   EVOLUTION_INSTANCE →  ex: "certifica" (nome da instancia)
 */

import { supabase } from "./supabase";

// ── Config cache ────────────────────────────────────────────────────────────

let _config: { url: string; apiKey: string; instance: string } | null = null;

export async function getEvolutionConfig() {
  if (_config) return _config;
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"]);

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  _config = {
    url: (map.EVOLUTION_API_URL || "").replace(/\/$/, ""),
    apiKey: map.EVOLUTION_API_KEY || "",
    instance: map.EVOLUTION_INSTANCE || "certifica",
  };
  return _config;
}

export function clearConfigCache() {
  _config = null;
}

export class EvolutionNotConfiguredError extends Error {
  constructor() {
    super("Evolution API não configurada. Preencha a URL e API Key.");
    this.name = "EvolutionNotConfiguredError";
  }
}

// ── Internal helper ─────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const cfg = await getEvolutionConfig();
  if (!cfg.url || !cfg.apiKey) throw new EvolutionNotConfiguredError();

  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Evolution API erro (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface EvolutionInstance {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
}

export interface EvolutionConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "close" | "connecting";
  };
}

export interface EvolutionQrCode {
  pairingCode: string | null;
  code: string;         // raw QR string
  base64: string;       // data:image/png;base64,...
  count: number;
}

export interface EvolutionSendResult {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

// ── Instance management ─────────────────────────────────────────────────────

/** Cria instancia no Evolution API */
export async function createInstance(instanceName?: string): Promise<EvolutionInstance> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  return request<EvolutionInstance>("/instance/create", "POST", {
    instanceName: name,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  });
}

/** Busca QR code pra conectar WhatsApp */
export async function getQrCode(instanceName?: string): Promise<EvolutionQrCode> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  return request<EvolutionQrCode>(`/instance/connect/${name}`);
}

/** Status da conexao */
export async function getConnectionState(instanceName?: string): Promise<EvolutionConnectionState> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  return request<EvolutionConnectionState>(`/instance/connectionState/${name}`);
}

/** Desconecta instancia (logout) */
export async function logoutInstance(instanceName?: string): Promise<void> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  await request(`/instance/logout/${name}`, "DELETE");
}

/** Deleta instancia */
export async function deleteInstance(instanceName?: string): Promise<void> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  await request(`/instance/delete/${name}`, "DELETE");
}

/** Lista instancias */
export async function listInstances(): Promise<any[]> {
  return request<any[]>("/instance/fetchInstances");
}

// ── Messaging ───────────────────────────────────────────────────────────────

/** Envia texto */
export async function sendText(
  phone: string,
  message: string,
  quotedMessageId?: string,
  instanceName?: string
): Promise<EvolutionSendResult> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  const payload: Record<string, unknown> = {
    number: normalizePhone(phone),
    text: message,
  };
  if (quotedMessageId) {
    payload.quoted = { key: { id: quotedMessageId } };
  }
  return request<EvolutionSendResult>(`/message/sendText/${name}`, "POST", payload);
}

/** Envia imagem/video/documento */
export async function sendMedia(
  phone: string,
  mediaUrl: string,
  mediatype: "image" | "video" | "document" | "audio",
  caption?: string,
  fileName?: string,
  instanceName?: string
): Promise<EvolutionSendResult> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;

  // Strip data URI prefix if present — Evolution API wants pure base64 or URL
  const media = mediaUrl.startsWith("data:")
    ? mediaUrl.replace(/^data:[^;]+;base64,/, "")
    : mediaUrl;

  // Infer mimetype from data URI if available
  let mimetype: string | undefined;
  if (mediaUrl.startsWith("data:")) {
    const m = mediaUrl.match(/^data:([^;]+);base64,/);
    if (m) mimetype = m[1];
  }

  // Default fileName per mediatype when missing
  const defaultFileName = fileName || (
    mediatype === "image" ? "image.jpg" :
    mediatype === "video" ? "video.mp4" :
    mediatype === "audio" ? "audio.ogg" :
    "document.pdf"
  );

  return request<EvolutionSendResult>(`/message/sendMedia/${name}`, "POST", {
    number: normalizePhone(phone),
    mediatype,
    media,
    caption,
    fileName: defaultFileName,
    ...(mimetype ? { mimetype } : {}),
  });
}

// ── Webhook config ──────────────────────────────────────────────────────────

/** Configura webhook pra receber mensagens */
export async function setWebhook(
  webhookUrl: string,
  events: string[] = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  instanceName?: string
): Promise<void> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  await request(`/webhook/set/${name}`, "POST", {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: true,
      events,
    },
  });
}

// ── Chat (for ChatPage) ────────────────────────────────────────────────────

/** Status simplificado pra UI */
export interface EvolutionStatus {
  connected: boolean;
  phone?: string;
  name?: string;
}

/** Chat item compativel com UI existente */
export interface EvolutionChatItem {
  phone: string;
  lid?: string;
  name?: string;
  unread?: number;
  lastMessageTime?: number;
  isGroup?: boolean;
  profileThumbnail?: string;
  lastMessagePreview?: string;
  lastMessageFromMe?: boolean;
  lastMessageStatus?: string;
}

/** Verifica status da conexao (formato simples) */
export async function getStatus(): Promise<EvolutionStatus> {
  try {
    const state = await getConnectionState();
    return { connected: state.instance.state === "open" };
  } catch {
    return { connected: false };
  }
}

/** Extrai texto de uma mensagem Evolution API */
function extractMessageText(msg: any): string {
  if (!msg) return "";
  const m = msg.message || {};
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage) return m.imageMessage.caption || "📷 Imagem";
  if (m.videoMessage) return m.videoMessage.caption || "🎥 Video";
  if (m.audioMessage) return "🎤 Audio";
  if (m.documentMessage) return `📄 ${m.documentMessage.fileName || "Documento"}`;
  if (m.stickerMessage) return "Sticker";
  return "";
}

/**
 * Extrai o phone real (@s.whatsapp.net) de um chat, usando remoteJidAlt quando disponivel.
 * Evolution v2 pode retornar remoteJid como @lid (Linked Device); o phone real fica em remoteJidAlt.
 */
function getCanonicalPhone(chat: any): { phone: string; isGroup: boolean; jid: string } {
  const mainJid = chat.remoteJid || chat.id || "";
  const altJid = chat.lastMessage?.key?.remoteJidAlt || "";

  // Prefer @s.whatsapp.net (real phone). If main is @lid, use alt if it's @s.whatsapp.net
  let canonicalJid = mainJid;
  if (mainJid.includes("@lid") && altJid.includes("@s.whatsapp.net")) {
    canonicalJid = altJid;
  }

  const phone = canonicalJid.replace(/@.*/, "");
  return {
    phone,
    isGroup: canonicalJid.includes("@g.us"),
    jid: canonicalJid,
  };
}

/** Lista chats/conversas (dedup por phone real) */
export async function findChats(instanceName?: string): Promise<EvolutionChatItem[]> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  const data = await request<any[]>(`/chat/findChats/${name}`, "POST");

  // Group chats by canonical phone — merge @lid and @s.whatsapp.net duplicates
  const byPhone = new Map<string, any[]>();

  for (const c of data || []) {
    const jid = c.remoteJid || c.id || "";
    if (!jid || jid.includes("@broadcast")) continue;

    const { phone } = getCanonicalPhone(c);
    if (!phone) continue;

    const existing = byPhone.get(phone) || [];
    existing.push(c);
    byPhone.set(phone, existing);
  }

  const result: EvolutionChatItem[] = [];

  for (const [phone, chats] of byPhone) {
    // Merge strategy: prefer chat with non-"Você" pushName, use most recent lastMessage
    let mergedName = "";
    let mergedPic: string | null = null;
    let mergedUnread = 0;
    let bestLastMsg: any = null;
    let bestLastTs = 0;
    let isGroup = false;

    for (const c of chats) {
      const { isGroup: g } = getCanonicalPhone(c);
      if (g) isGroup = true;

      // Name: prefer pushName that is NOT "Você" and NOT fromMe-based
      const lastMsgFromMe = c.lastMessage?.key?.fromMe === true;
      const candidatePushName = c.pushName || (!lastMsgFromMe ? c.lastMessage?.pushName : "") || "";
      if (candidatePushName && candidatePushName !== "Você" && !mergedName) {
        mergedName = candidatePushName;
      } else if (c.name && !mergedName) {
        mergedName = c.name;
      }

      // Profile pic
      const pic = c.profilePicUrl || c.profilePictureUrl;
      if (pic && !mergedPic) mergedPic = pic;

      // Unread
      mergedUnread += c.unreadCount || 0;

      // Last message: pick the most recent
      const ts = c.lastMessage?.messageTimestamp
        ? Number(c.lastMessage.messageTimestamp) * 1000
        : c.updatedAt
          ? new Date(c.updatedAt).getTime()
          : 0;
      if (ts > bestLastTs) {
        bestLastTs = ts;
        bestLastMsg = c.lastMessage;
      }
    }

    result.push({
      phone,
      name: mergedName || "",
      unread: mergedUnread,
      lastMessageTime: bestLastTs,
      isGroup,
      profileThumbnail: mergedPic,
      lastMessagePreview: extractMessageText(bestLastMsg),
      lastMessageFromMe: bestLastMsg?.key?.fromMe || false,
      lastMessageStatus: bestLastMsg?.status || null,
    });
  }

  return result.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
}

/** Busca mensagens de um chat (junta todas variantes de JID via remoteJid + remoteJidAlt) */
export async function findMessages(
  phone: string,
  limit = 50,
  instanceName?: string
): Promise<any[]> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  const jid = normalizePhone(phone) + "@s.whatsapp.net";

  const fetchMessages = async (where: any) => {
    try {
      const res = await request<any>(`/chat/findMessages/${name}`, "POST", { where, limit });
      if (Array.isArray(res)) return res;
      return res?.messages?.records || [];
    } catch { return []; }
  };

  // Fetch in parallel: messages stored under @s.whatsapp.net (outgoing) + messages with this phone as remoteJidAlt (incoming @lid)
  const [byJid, byAlt] = await Promise.all([
    fetchMessages({ key: { remoteJid: jid } }),
    fetchMessages({ key: { remoteJidAlt: jid } }),
  ]);

  // Dedupe by message id
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const m of [...byJid, ...byAlt]) {
    const id = m?.key?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(m);
  }

  // Sort chronologically (oldest → newest)
  return merged.sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0));
}

/** Busca foto de perfil */
export async function fetchProfilePictureUrl(
  phone: string,
  instanceName?: string
): Promise<string | null> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  try {
    const data = await request<{ profilePictureUrl?: string }>(
      `/chat/fetchProfilePictureUrl/${name}`,
      "POST",
      { number: normalizePhone(phone) }
    );
    return data?.profilePictureUrl || null;
  } catch {
    return null;
  }
}

/** Apaga mensagem no WhatsApp (delete for everyone) */
export async function deleteMessageForEveryone(
  remoteJid: string,
  messageId: string,
  fromMe: boolean,
  instanceName?: string
): Promise<void> {
  const cfg = await getEvolutionConfig();
  const name = instanceName || cfg.instance;
  await request<unknown>(`/chat/deleteMessageForEveryone/${name}`, "DELETE", {
    id: messageId,
    remoteJid: remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`,
    fromMe,
    participant: "",
  });
}

/** Envia audio */
export async function sendAudio(
  phone: string,
  audioData: string,
  instanceName?: string
): Promise<EvolutionSendResult> {
  return sendMedia(phone, audioData, "audio", undefined, undefined, instanceName);
}

// ── Utility ─────────────────────────────────────────────────────────────────

/** Normaliza telefone pra formato internacional sem + */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12) return digits;
  return `55${digits}`;
}
