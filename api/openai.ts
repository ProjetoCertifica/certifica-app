import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Proxy — OpenAI API
 *
 * Routes POST /api/openai → https://api.openai.com/v1/chat/completions
 * Uses server-side OPENAI_API_KEY (never exposed to client bundle).
 *
 * Setup in Vercel dashboard:
 *   OPENAI_API_KEY = sk-proj-...
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS — allow same origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: {
        message:
          "OPENAI_API_KEY not configured on the server. " +
          "Add it in Vercel → Settings → Environment Variables.",
        type: "server_config_error",
      },
    });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res.status(500).json({
      error: {
        message: err?.message ?? "Proxy error connecting to OpenAI",
        type: "proxy_error",
      },
    });
  }
}
