/**
 * Vercel Serverless — Recall.ai Calendar V1 — Criar Calendar Auth Token
 *
 * POST /api/recall/calendar-connect
 *   1. Chama POST /api/v1/calendar/authenticate/ no Recall.ai para obter o recall_calendar_auth_token
 *   2. Constrói a URL do OAuth do Google com o token no STATE
 *   3. Retorna { token, expires_at, oauth_url }
 *
 * Variáveis necessárias no Vercel:
 *   RECALL_API_TOKEN       = Token da API do Recall.ai
 *   GOOGLE_OAUTH_CLIENT_ID = Client ID do projeto Google Cloud (OAuth 2.0)
 *   RECALL_REGION          = us-west-2 (default, ajuste se sua conta for us-east-1)
 *
 * Pré-requisitos no Google Cloud:
 *   - API do Google Calendar ativada
 *   - Credencial OAuth 2.0 criada
 *   - URI de redirecionamento autorizada: https://RECALL_REGION.recall.ai/api/v1/calendar/google_oauth_callback/
 *
 * Pré-requisitos no Recall.ai:
 *   - Credenciais Google OAuth configuradas em Settings → Calendar
 */

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const recallToken = process.env.RECALL_API_TOKEN;
  if (!recallToken) {
    return res.status(503).json({
      error: "RECALL_API_TOKEN não configurado. Acesse Vercel → Settings → Environment Variables.",
    });
  }

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!googleClientId) {
    return res.status(503).json({
      error:
        "GOOGLE_OAUTH_CLIENT_ID não configurado. Crie credenciais OAuth no Google Cloud e adicione nas variáveis do Vercel.",
    });
  }

  const region = process.env.RECALL_REGION ?? "us-west-2";
  const recallBase = `https://${region}.recall.ai/api/v1`;

  // user_id identifica o usuário no Recall Calendar — pode vir do body ou usar um padrão
  const { user_id = "certifica-user" } = (req.body as Record<string, string>) ?? {};

  try {
    // 1. Criar Calendar Auth Token no Recall.ai
    const upstream = await fetch(`${recallBase}/calendar/authenticate/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${recallToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({
        error: `Recall.ai error ${upstream.status}: ${errText}`,
      });
    }

    const data = await upstream.json();

    // Recall retorna recall_calendar_auth_token (ou token em versões antigas)
    const calendarAuthToken: string =
      data.recall_calendar_auth_token ?? data.token ?? null;

    if (!calendarAuthToken) {
      return res.status(500).json({
        error: "Token não retornado pelo Recall.ai. Verifique as credenciais.",
      });
    }

    // 2. Construir URL do OAuth Google
    const recallCallbackUrl = `https://${region}.recall.ai/api/v1/calendar/google_oauth_callback/`;

    // URL base da app para redirecionar após OAuth
    const appBase = process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://certifica-seven.vercel.app";

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

    return res.status(200).json({
      token: calendarAuthToken,
      expires_at: data.expires_at ?? null,
      oauth_url: oauthUrl,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message ?? "Erro ao conectar com Recall.ai",
    });
  }
}
