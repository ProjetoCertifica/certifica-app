/**
 * Vercel Serverless — Google Calendar OAuth
 *
 * GET /api/google/auth
 *   → Retorna a URL de OAuth do Google para o usuário autorizar acesso ao Calendar
 *
 * Variáveis necessárias no Vercel:
 *   GOOGLE_OAUTH_CLIENT_ID     = Client ID do Google Cloud
 *   GOOGLE_OAUTH_CLIENT_SECRET = Client Secret do Google Cloud
 */

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: "GOOGLE_OAUTH_CLIENT_ID não configurado." });
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "https://certifica-seven.vercel.app/api/google/callback";

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

  return res.status(200).json({
    auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}
