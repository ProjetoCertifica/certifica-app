/**
 * Vercel Serverless Function — Proxy para Z-API (WhatsApp)
 *
 * Rota: /api/zapi?action=<action>&...params
 *
 * Configure no painel do Vercel (Settings → Environment Variables):
 *   ZAPI_INSTANCE_ID  →  ID da instância Z-API (fallback: ZAPI_INSTANCE)
 *   ZAPI_TOKEN        →  Token da instância Z-API
 *
 * Quando ainda não configurado, retorna status 503 com mensagem explicativa.
 *
 * ── GET actions ──────────────────────────────────────────────
 *   status            → WhatsApp connection status
 *   qr-code           → QR code para login
 *   chats             → Lista conversas (?page=&pageSize=)
 *   contacts          → Lista contatos (?page=&pageSize=)
 *   profile-picture   → Foto do contato (?phone=)
 *   messages          → Histórico de mensagens (?phone=&amount=)
 *
 * ── POST actions ─────────────────────────────────────────────
 *   send-text         → Enviar texto (phone, message, messageId?)
 *   send-image        → Enviar imagem (phone, image, caption?)
 *   send-document     → Enviar documento (phone, document, fileName?, caption?)
 *   send-audio        → Enviar áudio (phone, audio)
 *   modify-chat       → Marcar lido/não lido (phone, action)
 *
 * Também suporta passthrough: qualquer caminho não-action é encaminhado direto.
 */

const ZAPI_BASE = "https://api.z-api.io";

// ─── Helpers ────────────────────────────────────────────────

function getCredentials() {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE || "";
  const token = process.env.ZAPI_TOKEN || "";
  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  return { instance, token, clientToken };
}

function buildUrl(instance: string, token: string, path: string): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `${ZAPI_BASE}/instances/${instance}/token/${token}/${clean}`;
}

/**
 * Normaliza phone para Z-API: formato DDI+DDD+NUM (ex: 5515996699328).
 * Preserva @lid para contatos LID. Adiciona prefixo 55 se ausente.
 */
function normalizePhone(phone: string | undefined | null): string {
  const s = String(phone || "").trim();
  if (!s) return "";
  if (s.includes("@lid")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}

// ─── Proxy helpers ──────────────────────────────────────────

interface ProxyResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

async function proxyGet(url: string, clientToken: string): Promise<ProxyResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err =
      typeof data === "object" && data && (data as Record<string, unknown>).error
        ? String((data as Record<string, unknown>).error)
        : String(data || res.statusText);
    return { ok: false, status: res.status, error: err };
  }
  return { ok: true, data };
}

async function proxyPost(url: string, clientToken: string, body: unknown): Promise<ProxyResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err =
      typeof data === "object" && data && (data as Record<string, unknown>).error
        ? String((data as Record<string, unknown>).error)
        : String(data || res.statusText);
    return { ok: false, status: res.status, error: err };
  }
  return { ok: true, data };
}

function parseBody(req: { body?: unknown }): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}

function errorJson(res: Res, status: number, message: string) {
  res.status(status).json({ error: message });
}

// ─── Types for Vercel handler ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Req = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = any;

// ─── Handler ────────────────────────────────────────────────

export default async function handler(req: Req, res: Res) {
  res.setHeader("Content-Type", "application/json");

  const { instance, token, clientToken } = getCredentials();

  // ── Env check ──
  if (!instance || !token) {
    res.status(503).json({
      error: "Z-API não configurado.",
      hint: "Configure ZAPI_INSTANCE_ID (ou ZAPI_INSTANCE) e ZAPI_TOKEN em Vercel → Settings → Environment Variables.",
      configured: false,
    });
    return;
  }

  // ── Resolve action (query param ou path segments) ──
  const urlObj = req.url ? new URL(req.url, "http://localhost") : null;
  const searchParams = urlObj ? urlObj.searchParams : new URLSearchParams();
  const action =
    (req.query && req.query.action) || searchParams.get("action") || "";

  const query: Record<string, string> = req.query
    ? { ...req.query }
    : urlObj
      ? Object.fromEntries(searchParams)
      : {};

  // Se não houver action, faz passthrough (compatibilidade retroativa)
  if (!action) {
    return handlePassthrough(req, res, instance, token, clientToken, query);
  }

  try {
    // ════════════════════════════════════════════════════════
    //  GET ACTIONS
    // ════════════════════════════════════════════════════════

    if (action === "status") {
      const url = buildUrl(instance, token, "status");
      const result = await proxyGet(url, clientToken);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data);
      return;
    }

    if (action === "qr-code") {
      const url = buildUrl(instance, token, "qr-code/image");
      const result = await proxyGet(url, clientToken);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      const d = result.data as Record<string, unknown> | string | null;
      res.status(200).json(
        typeof d === "object" && d && d.value != null ? d : { value: d }
      );
      return;
    }

    if (action === "chats") {
      const page = query.page || "1";
      const pageSize = query.pageSize || "30";
      const url = buildUrl(instance, token, `chats?page=${page}&pageSize=${pageSize}`);
      const result = await proxyGet(url, clientToken);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(Array.isArray(result.data) ? result.data : []);
      return;
    }

    if (action === "contacts") {
      const page = query.page || "1";
      const pageSize = query.pageSize || "100";
      const url = buildUrl(instance, token, `contacts?page=${page}&pageSize=${pageSize}`);
      const result = await proxyGet(url, clientToken);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(Array.isArray(result.data) ? result.data : []);
      return;
    }

    if (action === "profile-picture") {
      const phone = query.phone;
      if (!phone) return errorJson(res, 400, "Parâmetro phone é obrigatório.");
      const phoneNorm = normalizePhone(phone);
      const url = buildUrl(instance, token, `profile-picture?phone=${phoneNorm}`);
      const result = await proxyGet(url, clientToken);
      if (!result.ok) {
        res.status(200).json({ link: null });
        return;
      }
      const data = result.data;
      if (Array.isArray(data) && data.length > 0) {
        res.status(200).json(data[0]);
      } else if (typeof data === "object" && data && (data as Record<string, unknown>).link) {
        res.status(200).json(data);
      } else {
        res.status(200).json({ link: null });
      }
      return;
    }

    if (action === "messages") {
      const phone = query.phone;
      const amount = query.amount || "20";
      if (!phone) return errorJson(res, 400, "Parâmetro phone é obrigatório.");
      const phoneNorm = normalizePhone(phone);
      if (!phoneNorm || phoneNorm.includes("@lid")) {
        res.status(200).json([]);
        return;
      }
      // Try multiple Z-API endpoints for message history
      const endpoints = [
        `get-messages/${encodeURIComponent(phoneNorm)}?amount=${amount}`,
        `chat-messages/${encodeURIComponent(phoneNorm)}?amount=${amount}`,
      ];
      for (const ep of endpoints) {
        const url = buildUrl(instance, token, ep);
        const result = await proxyGet(url, clientToken);
        if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
          res.status(200).json(result.data);
          return;
        }
      }
      res.status(200).json([]);
      return;
    }

    // ════════════════════════════════════════════════════════
    //  POST ACTIONS
    // ════════════════════════════════════════════════════════

    if (action === "send-text") {
      if (req.method !== "POST") return errorJson(res, 405, "Use POST para send-text.");
      const body = parseBody(req);
      const { phone, message, messageId: replyMessageId } = body as {
        phone?: string;
        message?: string;
        messageId?: string;
      };
      if (!phone || message === undefined)
        return errorJson(res, 400, "Envie phone e message no body.");
      const phoneNorm = normalizePhone(phone);
      const url = buildUrl(instance, token, "send-text");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        message: String(message),
      };
      if (replyMessageId) payload.messageId = String(replyMessageId);
      const result = await proxyPost(url, clientToken, payload);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data);
      return;
    }

    if (action === "send-image") {
      if (req.method !== "POST") return errorJson(res, 405, "Use POST para send-image.");
      const body = parseBody(req);
      const { phone, image, caption } = body as {
        phone?: string;
        image?: string;
        caption?: string;
      };
      if (!phone || !image)
        return errorJson(res, 400, "Envie phone e image (base64 ou URL) no body.");
      const phoneNorm = normalizePhone(phone);
      const url = buildUrl(instance, token, "send-image");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        image: String(image),
      };
      if (caption) payload.caption = String(caption);
      const result = await proxyPost(url, clientToken, payload);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data);
      return;
    }

    if (action === "send-document") {
      if (req.method !== "POST") return errorJson(res, 405, "Use POST para send-document.");
      const body = parseBody(req);
      const { phone, document: doc, fileName, caption } = body as {
        phone?: string;
        document?: string;
        fileName?: string;
        caption?: string;
      };
      if (!phone || !doc)
        return errorJson(res, 400, "Envie phone e document (base64 ou URL) no body.");
      const phoneNorm = normalizePhone(phone);
      const url = buildUrl(instance, token, "send-document/pdf");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        document: String(doc),
      };
      if (fileName) payload.fileName = String(fileName);
      if (caption) payload.caption = String(caption);
      const result = await proxyPost(url, clientToken, payload);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data);
      return;
    }

    if (action === "send-audio") {
      if (req.method !== "POST") return errorJson(res, 405, "Use POST para send-audio.");
      const body = parseBody(req);
      const { phone, audio } = body as {
        phone?: string;
        audio?: string;
      };
      if (!phone || !audio)
        return errorJson(res, 400, "Envie phone e audio (base64 ou URL) no body.");
      const phoneNorm = normalizePhone(phone);
      const url = buildUrl(instance, token, "send-audio");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        audio: String(audio),
      };
      const result = await proxyPost(url, clientToken, payload);
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data);
      return;
    }

    if (action === "modify-chat") {
      if (req.method !== "POST") return errorJson(res, 405, "Use POST para modify-chat.");
      const body = parseBody(req);
      const { phone, action: chatAction } = body as {
        phone?: string;
        action?: string;
      };
      if (!phone || !chatAction)
        return errorJson(res, 400, "Envie phone e action (read, unread ou clear) no body.");
      const phoneNorm = normalizePhone(phone);
      if (phoneNorm.includes("@lid")) {
        res.status(200).json({ value: false });
        return;
      }
      const url = buildUrl(instance, token, "modify-chat");
      const result = await proxyPost(url, clientToken, {
        phone: phoneNorm,
        action: String(chatAction),
      });
      if (!result.ok) return errorJson(res, result.status || 500, result.error!);
      res.status(200).json(result.data || { value: true });
      return;
    }

    // ── Unknown action ──
    errorJson(res, 400, `Action desconhecida: ${action}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao chamar Z-API.";
    errorJson(res, 500, msg);
  }
}

// ─── Passthrough (backward compat for direct path calls) ────

async function handlePassthrough(
  req: Req,
  res: Res,
  instance: string,
  token: string,
  clientToken: string,
  query: Record<string, string>
) {
  const { path: pathSegments, action: _a, ...queryRest } = query;
  const pathStr = Array.isArray(pathSegments)
    ? pathSegments.join("/")
    : pathSegments ?? "";

  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(queryRest).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
    )
  ).toString();

  const upstreamUrl = `${ZAPI_BASE}/instances/${instance}/token/${token}/${pathStr}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const init: RequestInit = {
    method: req.method ?? "GET",
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar com Z-API";
    res.status(502).json({ error: msg });
  }
}
