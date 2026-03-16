/**
 * Cloudflare Pages Function — Google Calendar OAuth Callback
 *
 * GET /api/google/callback?code=...
 *   → Troca o code por access_token + refresh_token
 *   → Redireciona para /calendario com os tokens codificados
 *
 * Variáveis necessárias no Cloudflare Pages:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI (opcional)
 *   APP_URL (ex: https://certifica.com.br)
 */

interface Env {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  APP_BASE_URL?: string;
}

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const appBase = env.APP_BASE_URL || "https://certifica.pages.dev";

  if (error || !code) {
    return Response.redirect(
      `${appBase}/calendario?google_error=${encodeURIComponent(error ?? "no_code")}`,
      302,
    );
  }

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.redirect(`${appBase}/calendario?google_error=server_config`, 302);
  }

  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${appBase}/api/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens: any = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      return Response.redirect(
        `${appBase}/calendario?google_error=${encodeURIComponent(tokens.error ?? "token_exchange_failed")}`,
        302,
      );
    }

    const payload = base64url(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      }),
    );

    return Response.redirect(`${appBase}/calendario?google_tokens=${payload}`, 302);
  } catch (err: any) {
    return Response.redirect(
      `${appBase}/calendario?google_error=${encodeURIComponent(err?.message ?? "unknown")}`,
      302,
    );
  }
};
