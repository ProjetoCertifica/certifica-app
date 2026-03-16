/**
 * Cloudflare Pages Function — Proxy para Z-API (WhatsApp)
 *
 * Rota: /api/zapi?action=<action>&...params
 *
 * Configure no Cloudflare Pages (Settings → Environment Variables):
 *   ZAPI_INSTANCE_ID  →  ID da instância Z-API (fallback: ZAPI_INSTANCE)
 *   ZAPI_TOKEN        →  Token da instância Z-API
 *   ZAPI_CLIENT_TOKEN →  (opcional) Client Token
 *
 * ── GET actions ──────────────────────────────────────────────
 *   status, qr-code, chats, contacts, profile-picture, messages
 *
 * ── POST actions ─────────────────────────────────────────────
 *   send-text, send-image, send-document, send-audio, modify-chat
 */

interface Env {
  ZAPI_INSTANCE_ID?: string;
  ZAPI_INSTANCE?: string;
  ZAPI_TOKEN?: string;
  ZAPI_CLIENT_TOKEN?: string;
}

const ZAPI_BASE = "https://api.z-api.io";

// ─── Helpers ────────────────────────────────────────────────

function getCredentials(env: Env) {
  const instance = env.ZAPI_INSTANCE_ID || env.ZAPI_INSTANCE || "";
  const token = env.ZAPI_TOKEN || "";
  const clientToken = env.ZAPI_CLIENT_TOKEN || "";
  return { instance, token, clientToken };
}

function buildUrl(instance: string, token: string, path: string): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `${ZAPI_BASE}/instances/${instance}/token/${token}/${clean}`;
}

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

async function proxyPost(
  url: string,
  clientToken: string,
  body: unknown,
): Promise<ProxyResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
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

function errorJson(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

// ─── Passthrough ────────────────────────────────────────────

async function handlePassthrough(
  request: Request,
  instance: string,
  token: string,
  clientToken: string,
): Promise<Response> {
  const reqUrl = new URL(request.url);
  // Remove /api/zapi prefix to get path segments
  const pathAfterZapi = reqUrl.pathname.replace(/^\/api\/zapi\/?/, "");

  const upstreamUrl = `${ZAPI_BASE}/instances/${instance}/token/${token}/${pathAfterZapi}${reqUrl.search}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) responseHeaders.set("Content-Type", ct);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar com Z-API";
    return Response.json({ error: msg }, { status: 502 });
  }
}

// ─── Handler ────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const { instance, token, clientToken } = getCredentials(env);

  if (!instance || !token) {
    return Response.json(
      {
        error: "Z-API não configurado.",
        hint: "Configure ZAPI_INSTANCE_ID e ZAPI_TOKEN em Cloudflare Pages → Settings → Environment Variables.",
        configured: false,
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";

  if (!action) {
    return handlePassthrough(request, instance, token, clientToken);
  }

  try {
    // ════════════════════════════════════════════════════════
    //  GET ACTIONS
    // ════════════════════════════════════════════════════════

    if (action === "status") {
      const zapiUrl = buildUrl(instance, token, "status");
      const result = await proxyGet(zapiUrl, clientToken);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data);
    }

    if (action === "qr-code") {
      const zapiUrl = buildUrl(instance, token, "qr-code/image");
      const result = await proxyGet(zapiUrl, clientToken);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      const d = result.data as Record<string, unknown> | string | null;
      return Response.json(
        typeof d === "object" && d && d.value != null ? d : { value: d },
      );
    }

    if (action === "chats") {
      const page = url.searchParams.get("page") || "1";
      const pageSize = url.searchParams.get("pageSize") || "30";
      const zapiUrl = buildUrl(
        instance,
        token,
        `chats?page=${page}&pageSize=${pageSize}`,
      );
      const result = await proxyGet(zapiUrl, clientToken);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(Array.isArray(result.data) ? result.data : []);
    }

    if (action === "contacts") {
      const page = url.searchParams.get("page") || "1";
      const pageSize = url.searchParams.get("pageSize") || "100";
      const zapiUrl = buildUrl(
        instance,
        token,
        `contacts?page=${page}&pageSize=${pageSize}`,
      );
      const result = await proxyGet(zapiUrl, clientToken);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(Array.isArray(result.data) ? result.data : []);
    }

    if (action === "profile-picture") {
      const phone = url.searchParams.get("phone");
      if (!phone) return errorJson(400, "Parâmetro phone é obrigatório.");
      const phoneNorm = normalizePhone(phone);
      const zapiUrl = buildUrl(
        instance,
        token,
        `profile-picture?phone=${phoneNorm}`,
      );
      const result = await proxyGet(zapiUrl, clientToken);
      if (!result.ok) {
        return Response.json({ link: null });
      }
      const data = result.data;
      if (Array.isArray(data) && data.length > 0) {
        return Response.json(data[0]);
      } else if (
        typeof data === "object" &&
        data &&
        (data as Record<string, unknown>).link
      ) {
        return Response.json(data);
      }
      return Response.json({ link: null });
    }

    if (action === "messages") {
      const phone = url.searchParams.get("phone");
      const amount = url.searchParams.get("amount") || "20";
      if (!phone) return errorJson(400, "Parâmetro phone é obrigatório.");
      const phoneNorm = normalizePhone(phone);
      if (!phoneNorm || phoneNorm.includes("@lid")) {
        return Response.json([]);
      }
      const endpoints = [
        `get-messages/${encodeURIComponent(phoneNorm)}?amount=${amount}`,
        `chat-messages/${encodeURIComponent(phoneNorm)}?amount=${amount}`,
      ];
      for (const ep of endpoints) {
        const zapiUrl = buildUrl(instance, token, ep);
        const result = await proxyGet(zapiUrl, clientToken);
        if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
          return Response.json(result.data);
        }
      }
      return Response.json([]);
    }

    // ════════════════════════════════════════════════════════
    //  POST ACTIONS
    // ════════════════════════════════════════════════════════

    if (action === "send-text") {
      if (request.method !== "POST")
        return errorJson(405, "Use POST para send-text.");
      const body: any = await request.json().catch(() => ({}));
      const { phone, message, messageId: replyMessageId } = body;
      if (!phone || message === undefined)
        return errorJson(400, "Envie phone e message no body.");
      const phoneNorm = normalizePhone(phone);
      const zapiUrl = buildUrl(instance, token, "send-text");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        message: String(message),
      };
      if (replyMessageId) payload.messageId = String(replyMessageId);
      const result = await proxyPost(zapiUrl, clientToken, payload);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data);
    }

    if (action === "send-image") {
      if (request.method !== "POST")
        return errorJson(405, "Use POST para send-image.");
      const body: any = await request.json().catch(() => ({}));
      const { phone, image, caption } = body;
      if (!phone || !image)
        return errorJson(400, "Envie phone e image (base64 ou URL) no body.");
      const phoneNorm = normalizePhone(phone);
      const zapiUrl = buildUrl(instance, token, "send-image");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        image: String(image),
      };
      if (caption) payload.caption = String(caption);
      const result = await proxyPost(zapiUrl, clientToken, payload);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data);
    }

    if (action === "send-document") {
      if (request.method !== "POST")
        return errorJson(405, "Use POST para send-document.");
      const body: any = await request.json().catch(() => ({}));
      const { phone, document: doc, fileName, caption } = body;
      if (!phone || !doc)
        return errorJson(
          400,
          "Envie phone e document (base64 ou URL) no body.",
        );
      const phoneNorm = normalizePhone(phone);
      const zapiUrl = buildUrl(instance, token, "send-document/pdf");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        document: String(doc),
      };
      if (fileName) payload.fileName = String(fileName);
      if (caption) payload.caption = String(caption);
      const result = await proxyPost(zapiUrl, clientToken, payload);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data);
    }

    if (action === "send-audio") {
      if (request.method !== "POST")
        return errorJson(405, "Use POST para send-audio.");
      const body: any = await request.json().catch(() => ({}));
      const { phone, audio } = body;
      if (!phone || !audio)
        return errorJson(400, "Envie phone e audio (base64 ou URL) no body.");
      const phoneNorm = normalizePhone(phone);
      const zapiUrl = buildUrl(instance, token, "send-audio");
      const payload: Record<string, unknown> = {
        phone: phoneNorm,
        audio: String(audio),
      };
      const result = await proxyPost(zapiUrl, clientToken, payload);
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data);
    }

    if (action === "modify-chat") {
      if (request.method !== "POST")
        return errorJson(405, "Use POST para modify-chat.");
      const body: any = await request.json().catch(() => ({}));
      const { phone, action: chatAction } = body;
      if (!phone || !chatAction)
        return errorJson(
          400,
          "Envie phone e action (read, unread ou clear) no body.",
        );
      const phoneNorm = normalizePhone(phone);
      if (phoneNorm.includes("@lid")) {
        return Response.json({ value: false });
      }
      const zapiUrl = buildUrl(instance, token, "modify-chat");
      const result = await proxyPost(zapiUrl, clientToken, {
        phone: phoneNorm,
        action: String(chatAction),
      });
      if (!result.ok) return errorJson(result.status || 500, result.error!);
      return Response.json(result.data || { value: true });
    }

    // ── Unknown action ──
    return errorJson(400, `Action desconhecida: ${action}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao chamar Z-API.";
    return errorJson(500, msg);
  }
};
