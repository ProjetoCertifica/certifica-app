/**
 * Vercel Serverless Function — Proxy para Recall.ai
 *
 * Rota:  /api/recall-api/*  →  https://us-west-2.recall.ai/api/v1/*
 *
 * O token RECALL_API_TOKEN fica no servidor (seguro),
 * nunca é exposto no bundle do frontend.
 *
 * Configure a variável de ambiente no painel do Vercel:
 *   Settings → Environment Variables → RECALL_API_TOKEN
 */

const RECALL_BASE = "https://us-west-2.recall.ai/api/v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // Extrai os segmentos do path dinâmico  [...path]
  const { path: pathSegments, ...queryRest } = req.query as Record<string, string | string[]>;
  const pathStr = Array.isArray(pathSegments)
    ? pathSegments.join("/")
    : (pathSegments ?? "");

  // Reconstrói query string (sem o parâmetro 'path' do catch-all)
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(queryRest).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
    )
  ).toString();

  const upstreamUrl = `${RECALL_BASE}/${pathStr}${qs ? `?${qs}` : ""}`;

  // Token vive apenas no servidor — nunca exposto ao cliente
  const token = process.env.RECALL_API_TOKEN;
  if (!token) {
    res.status(500).json({
      error: "RECALL_API_TOKEN não configurado. Acesse Vercel → Settings → Environment Variables.",
    });
    return;
  }

  const init: RequestInit = {
    method: req.method ?? "GET",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
  };

  // Encaminha o body para POST/PATCH etc.
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const text = await upstream.text();

    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar com Recall.ai";
    res.status(502).json({ error: msg });
  }
}
