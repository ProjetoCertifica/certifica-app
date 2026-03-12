/**
 * Vercel Serverless — Recall.ai Calendar V1 — Listar Reuniões do Calendário
 *
 * GET /api/recall/calendar-meetings?token=<calendar_auth_token>&days=7
 *   → Busca reuniões futuras do Google Calendar do usuário via Recall.ai
 *   → Usa o token de calendário como header X-Recall-Calendar-Auth-Token
 *
 * Variável necessária no Vercel:
 *   RECALL_API_TOKEN = Token ...
 */

const RECALL_BASE = "https://us-west-2.recall.ai/api/v1";

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Calendar-Token");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const recallToken = process.env.RECALL_API_TOKEN;
  if (!recallToken) {
    return res.status(503).json({
      error: "RECALL_API_TOKEN não configurado.",
    });
  }

  // Obtém o calendar auth token da query string ou do header
  const calendarToken =
    (req.query.token as string) ||
    (req.headers["x-calendar-token"] as string) ||
    "";

  if (!calendarToken) {
    return res.status(400).json({
      error: "Parâmetro 'token' obrigatório. Conecte o Google Calendar primeiro.",
    });
  }

  try {
    // Suporte a from/to explícitos (para visão mensal) ou days a partir de agora
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;

    let startTimeGte: string;
    let startTimeLte: string;

    if (fromParam && toParam) {
      startTimeGte = fromParam;
      startTimeLte = toParam;
    } else {
      const days = Math.min(Number(req.query.days ?? 7), 90);
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
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      // 401 = token expirado ou inválido
      if (upstream.status === 401) {
        return res.status(401).json({
          error: "Token de calendário inválido ou expirado. Reconecte o Google Calendar.",
        });
      }
      return res.status(upstream.status).json({
        error: `Recall.ai error ${upstream.status}: ${errText}`,
      });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message ?? "Erro ao buscar reuniões do calendário",
    });
  }
}
