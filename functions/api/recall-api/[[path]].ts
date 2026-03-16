/**
 * Cloudflare Pages Function — Proxy para Recall.ai (catch-all)
 *
 * Rota:  /api/recall-api/*  →  https://us-west-2.recall.ai/api/v1/*
 *
 * O token RECALL_API_TOKEN fica no servidor (seguro).
 *
 * Configure a variável de ambiente no Cloudflare Pages:
 *   Settings → Environment Variables → RECALL_API_TOKEN
 */

interface Env {
  RECALL_API_TOKEN?: string;
}

const RECALL_BASE = "https://us-west-2.recall.ai/api/v1";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  const token = env.RECALL_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "RECALL_API_TOKEN não configurado. Acesse Cloudflare Pages → Settings → Environment Variables." },
      { status: 500 },
    );
  }

  // params.path é string | string[] no catch-all [[path]]
  const pathSegments = params.path;
  const pathStr = Array.isArray(pathSegments) ? pathSegments.join("/") : (pathSegments ?? "");

  // Preserve query string
  const url = new URL(request.url);
  const qs = url.search;

  const upstreamUrl = `${RECALL_BASE}/${pathStr}${qs}`;

  const headers: Record<string, string> = {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) responseHeaders.set("Content-Type", ct);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar com Recall.ai";
    return Response.json({ error: msg }, { status: 502 });
  }
};
