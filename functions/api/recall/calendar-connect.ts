/**
 * Cloudflare Pages Function — Recall.ai Calendar V1 — Criar Calendar Auth Token
 *
 * POST /api/recall/calendar-connect
 *   1. Chama POST /api/v1/calendar/authenticate/ no Recall.ai
 *   2. Constrói a URL do OAuth do Google com o token no STATE
 *   3. Retorna { token, expires_at, oauth_url }
 *
 * Variáveis necessárias no Cloudflare Pages:
 *   RECALL_API_TOKEN
 *   GOOGLE_OAUTH_CLIENT_ID
 *   RECALL_REGION (opcional, default: us-west-2)
 *   APP_URL (ex: https://certifica.com.br)
 */

interface Env {
  RECALL_API_TOKEN?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  RECALL_REGION?: string;
  APP_BASE_URL?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const recallToken = env.RECALL_API_TOKEN;
  if (!recallToken) {
    return Response.json(
      { error: "RECALL_API_TOKEN não configurado. Acesse Cloudflare Pages → Settings → Environment Variables." },
      { status: 503, headers: corsHeaders },
    );
  }

  const googleClientId = env.GOOGLE_OAUTH_CLIENT_ID;
  if (!googleClientId) {
    return Response.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID não configurado." },
      { status: 503, headers: corsHeaders },
    );
  }

  const region = env.RECALL_REGION ?? "us-west-2";
  const recallBase = `https://${region}.recall.ai/api/v1`;

  const body: any = await request.json().catch(() => ({}));
  const userId = body.user_id || "certifica-user";

  try {
    const upstream = await fetch(`${recallBase}/calendar/authenticate/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${recallToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return Response.json(
        { error: `Recall.ai error ${upstream.status}: ${errText}` },
        { status: upstream.status, headers: corsHeaders },
      );
    }

    const data: any = await upstream.json();

    const calendarAuthToken: string =
      data.recall_calendar_auth_token ?? data.token ?? null;

    if (!calendarAuthToken) {
      return Response.json(
        { error: "Token não retornado pelo Recall.ai. Verifique as credenciais." },
        { status: 500, headers: corsHeaders },
      );
    }

    const recallCallbackUrl = `https://${region}.recall.ai/api/v1/calendar/google_oauth_callback/`;
    const appBase = env.APP_BASE_URL || "https://certifica.pages.dev";

    const state = JSON.stringify({
      recall_calendar_auth_token: calendarAuthToken,
      google_oauth_redirect_url: recallCallbackUrl,
      success_url: `${appBase}/calendario`,
      error_url: `${appBase}/calendario?error=oauth`,
    });

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const oauthParams = new URLSearchParams({
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      response_type: "code",
      state,
      redirect_uri: recallCallbackUrl,
      client_id: googleClientId,
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;

    return Response.json(
      { token: calendarAuthToken, expires_at: data.expires_at ?? null, oauth_url: oauthUrl },
      { headers: corsHeaders },
    );
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Erro ao conectar com Recall.ai" },
      { status: 500, headers: corsHeaders },
    );
  }
};
