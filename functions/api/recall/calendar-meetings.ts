/**
 * Cloudflare Pages Function — Recall.ai Calendar V1 — Listar Reuniões
 *
 * GET /api/recall/calendar-meetings?token=<calendar_auth_token>&days=7
 *   → Busca reuniões futuras do Google Calendar via Recall.ai
 *
 * Variável necessária no Cloudflare Pages:
 *   RECALL_API_TOKEN
 */

interface Env {
  RECALL_API_TOKEN?: string;
}

const RECALL_BASE = "https://us-west-2.recall.ai/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Calendar-Token",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const recallToken = env.RECALL_API_TOKEN;
  if (!recallToken) {
    return Response.json(
      { error: "RECALL_API_TOKEN não configurado." },
      { status: 503, headers: corsHeaders },
    );
  }

  const url = new URL(request.url);
  const calendarToken =
    url.searchParams.get("token") ||
    request.headers.get("x-calendar-token") ||
    "";

  if (!calendarToken) {
    return Response.json(
      { error: "Parâmetro 'token' obrigatório. Conecte o Google Calendar primeiro." },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let startTimeGte: string;
    let startTimeLte: string;

    if (fromParam && toParam) {
      startTimeGte = fromParam;
      startTimeLte = toParam;
    } else {
      const days = Math.min(Number(url.searchParams.get("days") ?? 7), 90);
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      startTimeGte = now.toISOString();
      startTimeLte = future.toISOString();
    }

    const params = new URLSearchParams({
      start_time_gte: startTimeGte,
      start_time_lte: startTimeLte,
    });

    const upstream = await fetch(
      `${RECALL_BASE}/calendar/meetings/?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${recallToken}`,
          "X-Recall-Calendar-Auth-Token": calendarToken,
          "Content-Type": "application/json",
        },
      },
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      if (upstream.status === 401) {
        return Response.json(
          { error: "Token de calendário inválido ou expirado. Reconecte o Google Calendar." },
          { status: 401, headers: corsHeaders },
        );
      }
      return Response.json(
        { error: `Recall.ai error ${upstream.status}: ${errText}` },
        { status: upstream.status, headers: corsHeaders },
      );
    }

    const data = await upstream.json();
    return Response.json(data, { headers: corsHeaders });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Erro ao buscar reuniões do calendário" },
      { status: 500, headers: corsHeaders },
    );
  }
};
