/**
 * Cloudflare Pages Function — Google Calendar OAuth
 *
 * GET /api/google/auth
 *   → Retorna a URL de OAuth do Google para o usuário autorizar acesso ao Calendar
 *
 * Variáveis necessárias no Cloudflare Pages:
 *   GOOGLE_OAUTH_CLIENT_ID     = Client ID do Google Cloud
 *   GOOGLE_REDIRECT_URI        = (opcional) URI de callback
 *   APP_URL                    = URL base da aplicação (ex: https://certifica.com.br)
 */

interface Env {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_REDIRECT_URI?: string;
  APP_BASE_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "GOOGLE_OAUTH_CLIENT_ID não configurado." }, { status: 503 });
  }

  const appBase = env.APP_BASE_URL || "https://certifica.pages.dev";
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${appBase}/api/google/callback`;

  const scopes = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
  });

  return Response.json({
    auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
};
