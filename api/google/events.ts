/**
 * Vercel Serverless — Google Calendar Events
 *
 * POST /api/google/events
 * Body: { access_token, refresh_token, from, to }
 *   → Busca eventos do Google Calendar primary
 *   → Se access_token expirar (401), usa refresh_token para renovar
 *   → Retorna { meetings, new_tokens? }
 */

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { access_token, refresh_token, from, to } = req.body ?? {};

  if (!access_token && !refresh_token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  const timeMin = from ?? new Date().toISOString();
  const timeMax = to ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const buildUrl = () => {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });
    return `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
  };

  // Tenta buscar eventos com o access_token atual
  let token = access_token;
  let eventsRes = await fetch(buildUrl(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  let newTokens: { access_token: string; refresh_token: string | null; expiry: number } | null = null;

  // Se 401 e temos refresh_token, renova
  if (eventsRes.status === 401 && refresh_token && clientId && clientSecret) {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshRes.ok) {
      return res.status(401).json({ error: "Sessão expirada. Reconecte o Google Calendar." });
    }

    const refreshed = await refreshRes.json();
    token = refreshed.access_token;
    newTokens = {
      access_token: token,
      refresh_token: refreshed.refresh_token ?? refresh_token,
      expiry: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };

    // Retry com novo token
    eventsRes = await fetch(buildUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!eventsRes.ok) {
    const err = await eventsRes.json().catch(() => ({}));
    return res.status(eventsRes.status).json({
      error: err?.error?.message ?? `Erro ${eventsRes.status} ao buscar eventos`,
    });
  }

  const data = await eventsRes.json();

  const meetings = (data.items ?? [])
    .filter((item: any) => item.status !== "cancelled")
    .map((item: any) => ({
      id: item.id,
      title: item.summary ?? "Sem título",
      start_time: item.start?.dateTime ?? item.start?.date,
      end_time: item.end?.dateTime ?? item.end?.date,
      meeting_url: extractMeetingUrl(item),
      attendees: (item.attendees ?? []).map((a: any) => ({
        name: a.displayName ?? a.email,
        email: a.email,
      })),
      bot_id: null,
      status: null,
    }));

  return res.status(200).json({
    meetings,
    ...(newTokens ? { new_tokens: newTokens } : {}),
  });
}

function extractMeetingUrl(item: any): string | null {
  if (item.hangoutLink) return item.hangoutLink;

  const entryPoints: any[] = item.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find((e) => e.entryPointType === "video");
  if (video?.uri) return video.uri;

  const desc = item.description ?? "";
  const match = desc.match(
    /https?:\/\/(zoom\.us|teams\.microsoft\.com|meet\.google\.com|whereby\.com)[^\s<"']*/
  );
  if (match) return match[0];

  const loc = item.location ?? "";
  if (loc.startsWith("https://")) return loc;

  return null;
}
