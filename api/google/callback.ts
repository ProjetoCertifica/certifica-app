/**
 * Vercel Serverless — Google Calendar OAuth Callback
 *
 * GET /api/google/callback?code=...
 *   → Troca o code por access_token + refresh_token
 *   → Redireciona para /calendario com os tokens codificados
 */

export default async function handler(req: any, res: any) {
  const { code, error } = req.query as Record<string, string>;

  const appBase = "https://certifica-seven.vercel.app";

  if (error || !code) {
    return res.redirect(`${appBase}/calendario?google_error=${encodeURIComponent(error ?? "no_code")}`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(`${appBase}/calendario?google_error=server_config`);
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "https://certifica-seven.vercel.app/api/google/callback";

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

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      return res.redirect(
        `${appBase}/calendario?google_error=${encodeURIComponent(tokens.error ?? "token_exchange_failed")}`
      );
    }

    // Codifica tokens em base64url e passa para o frontend via URL
    const payload = Buffer.from(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      })
    ).toString("base64url");

    return res.redirect(`${appBase}/calendario?google_tokens=${payload}`);
  } catch (err: any) {
    return res.redirect(
      `${appBase}/calendario?google_error=${encodeURIComponent(err?.message ?? "unknown")}`
    );
  }
}
