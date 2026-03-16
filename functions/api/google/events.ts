/**
 * Cloudflare Pages Function — Google Calendar Events
 *
 * POST /api/google/events
 * Body: { access_token, refresh_token, from, to }
 *   → Busca eventos do Google Calendar primary
 *   → Se access_token expirar (401), usa refresh_token para renovar
 *   → Retorna { meetings, new_tokens? }
 */

interface Env {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function extractMeetingUrl(item: any): string | null {
  if (item.hangoutLink) return item.hangoutLink;

  const entryPoints: any[] = item.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find((e: any) => e.entryPointType === "video");
  if (video?.uri) return video.uri;

  const desc = item.description ?? "";
  const match = desc.match(
    /https?:\/\/(zoom\.us|teams\.microsoft\.com|meet\.google\.com|whereby\.com)[^\s<"']*/,
  );
  if (match) return match[0];

  const loc = item.location ?? "";
  if (loc.startsWith("https://")) return loc;

  return null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const body: any = await request.json().catch(() => ({}));
  const { access_token, refresh_token, from, to } = body;

  if (!access_token && !refresh_token) {
    return Response.json({ error: "Token não fornecido" }, { status: 401, headers: corsHeaders });
  }

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

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

  let token = access_token;
  let eventsRes = await fetch(buildUrl(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  let newTokens: { access_token: string; refresh_token: string | null; expiry: number } | null = null;

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
      return Response.json(
        { error: "Sessão expirada. Reconecte o Google Calendar." },
        { status: 401, headers: corsHeaders },
      );
    }

    const refreshed: any = await refreshRes.json();
    token = refreshed.access_token;
    newTokens = {
      access_token: token,
      refresh_token: refreshed.refresh_token ?? refresh_token,
      expiry: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };

    eventsRes = await fetch(buildUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!eventsRes.ok) {
    const err: any = await eventsRes.json().catch(() => ({}));
    return Response.json(
      { error: err?.error?.message ?? `Erro ${eventsRes.status} ao buscar eventos` },
      { status: eventsRes.status, headers: corsHeaders },
    );
  }

  const data: any = await eventsRes.json();

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

  return Response.json(
    { meetings, ...(newTokens ? { new_tokens: newTokens } : {}) },
    { headers: corsHeaders },
  );
};
