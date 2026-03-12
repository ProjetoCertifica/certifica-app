/**
 * Z-API WhatsApp Client
 *
 * Todas as chamadas passam pelo proxy seguro em /api/zapi/[...path]
 * Assim o token e instanceId ficam no servidor (variáveis de ambiente Vercel).
 *
 * Quando o usuário contratar o Z-API, basta configurar:
 *   ZAPI_INSTANCE_ID  →  ex: "3A5F8C2D1E4B7A9F"
 *   ZAPI_TOKEN        →  ex: "F1A2B3C4D5E6..."
 * No painel do Vercel → Settings → Environment Variables.
 */

const ZAPI_BASE = "/api/zapi";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZApiStatus {
  connected: boolean;
  phone?: string;
  name?: string;
  battery?: number;
  plugged?: boolean;
  session?: string;
}

export interface ZApiMessage {
  phone: string;       // número com DDI, ex: "5511999999999"
  message: string;
}

export interface ZApiImageMessage {
  phone: string;
  image: string;       // URL pública da imagem
  caption?: string;
}

export interface ZApiDocumentMessage {
  phone: string;
  document: string;    // URL pública do documento
  fileName: string;
  caption?: string;
}

export interface ZApiAudioMessage {
  phone: string;
  audio: string;       // URL pública do áudio (mp3 ou ogg)
}

export interface ZApiSendResult {
  zaapId: string;
  messageId: string;
  id: string;
}

// ── Internal helper ──────────────────────────────────────────────────────────

async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${ZAPI_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Friendly error for unconfigured instance
    if (res.status === 503 || text.includes("ZAPI_INSTANCE_ID")) {
      throw new ZApiNotConfiguredError();
    }
    throw new Error(`Z-API erro (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Custom error ─────────────────────────────────────────────────────────────

export class ZApiNotConfiguredError extends Error {
  constructor() {
    super("Z-API não configurado. Adicione ZAPI_INSTANCE_ID e ZAPI_TOKEN nas variáveis de ambiente do Vercel.");
    this.name = "ZApiNotConfiguredError";
  }
}

// ── API functions ────────────────────────────────────────────────────────────

/** Verifica status da conexão WhatsApp */
export async function getZApiStatus(): Promise<ZApiStatus> {
  return request<ZApiStatus>("?action=status");
}

/** Envia mensagem de texto */
export async function sendText(phone: string, message: string): Promise<ZApiSendResult> {
  const normalized = normalizePhone(phone);
  return request<ZApiSendResult>("?action=send-text", { phone: normalized, message });
}

/** Envia imagem com legenda opcional */
export async function sendImage(phone: string, imageUrl: string, caption?: string): Promise<ZApiSendResult> {
  const normalized = normalizePhone(phone);
  return request<ZApiSendResult>("?action=send-image", { phone: normalized, image: imageUrl, caption });
}

/** Envia documento (PDF, DOCX, etc.) */
export async function sendDocument(
  phone: string,
  documentUrl: string,
  fileName: string,
  caption?: string
): Promise<ZApiSendResult> {
  const normalized = normalizePhone(phone);
  return request<ZApiSendResult>("?action=send-document", {
    phone: normalized,
    document: documentUrl,
    fileName,
    caption,
  });
}

/** Envia áudio */
export async function sendAudio(phone: string, audioUrl: string): Promise<ZApiSendResult> {
  const normalized = normalizePhone(phone);
  return request<ZApiSendResult>("?action=send-audio", { phone: normalized, audio: audioUrl });
}

// ── Chat / Contact API functions ────────────────────────────────────────────

export interface ZApiChat {
  phone: string;
  lid?: string;
  name?: string;
  unread?: string | number;
  messagesUnread?: number;
  lastMessageTime?: number | string;
  isGroup?: boolean;
  profileThumbnail?: string;
}

/** Lista conversas do WhatsApp */
export async function getChats(page = 1, pageSize = 30): Promise<ZApiChat[]> {
  return request<ZApiChat[]>(`?action=chats&page=${page}&pageSize=${pageSize}`);
}

/** Foto de perfil de um contato */
export async function getProfilePicture(phone: string): Promise<string | null> {
  const data = await request<{ link?: string | null }>(`?action=profile-picture&phone=${normalizePhone(phone)}`);
  return data?.link ?? null;
}

/** Marca conversa como lida/não lida */
export async function modifyChat(phone: string, action: 'read' | 'unread' | 'clear'): Promise<void> {
  await request<unknown>(`?action=modify-chat`, { phone: normalizePhone(phone), action });
}

/** Busca histórico de mensagens via Z-API */
export async function getChatMessages(phone: string, amount = 20): Promise<unknown[]> {
  return request<unknown[]>(`?action=messages&phone=${normalizePhone(phone)}&amount=${amount}`);
}

// ── Utility message builders ────────────────────────────────────────────────

/** Formata mensagem padrão para envio de relatório */
export function buildReportMessage(clienteName: string, reportType: string, link?: string): string {
  const greeting = `Olá *${clienteName}*! 👋`;
  const body = `Segue o *${reportType}* gerado pela plataforma CERTIFICA.`;
  const footer = link
    ? `\n\n🔗 Acesse: ${link}`
    : `\n\nEm caso de dúvidas, entre em contato com seu consultor.`;
  return `${greeting}\n\n${body}${footer}`;
}

/** Formata mensagem de alerta de NC */
export function buildNcAlertMessage(clienteName: string, ncCount: number, norma: string): string {
  return (
    `⚠️ *CERTIFICA — Alerta de Não Conformidade*\n\n` +
    `Olá *${clienteName}*,\n\n` +
    `Identificamos *${ncCount} não conformidade(s)* na auditoria de *${norma}* que requerem atenção.\n\n` +
    `Por favor, acesse a plataforma para visualizar o plano de ação.`
  );
}

/** Normaliza número para formato internacional sem + */
export function normalizePhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, "");
  // Se já tem 13 dígitos (55 + 11 + número), retorna como está
  if (digits.length >= 12) return digits;
  // Assume Brasil (55) + DDD (2 dígitos) faltando
  return `55${digits}`;
}
