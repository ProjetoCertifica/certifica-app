/**
 * Cloudflare Pages Function — Proxy para OpenAI API
 *
 * Routes POST /api/openai → https://api.openai.com/v1/chat/completions
 * Uses server-side OPENAI_API_KEY (never exposed to client bundle).
 *
 * Setup in Cloudflare Pages → Settings → Environment Variables:
 *   OPENAI_API_KEY = sk-proj-...
 */

interface Env {
  OPENAI_API_KEY?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: {
          message: "OPENAI_API_KEY not configured on the server. Add it in Cloudflare Pages → Settings → Environment Variables.",
          type: "server_config_error",
        },
      },
      { status: 503, headers: corsHeaders },
    );
  }

  try {
    const body = await request.text();
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status, headers: corsHeaders });
  } catch (err: any) {
    return Response.json(
      {
        error: {
          message: err?.message ?? "Proxy error connecting to OpenAI",
          type: "proxy_error",
        },
      },
      { status: 500, headers: corsHeaders },
    );
  }
};
