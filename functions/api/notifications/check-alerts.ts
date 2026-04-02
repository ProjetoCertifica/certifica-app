/**
 * Cloudflare Pages Function — Verificar alertas e enviar notificações WhatsApp
 *
 * Rota: POST /api/notifications/check-alerts
 *
 * Verifica projetos atrasados e auditorias próximas no Supabase,
 * e envia alertas via Z-API (WhatsApp) para os consultores.
 *
 * Env vars necessárias:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
 *   ALERT_PHONE (telefone admin para receber alertas)
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  ZAPI_INSTANCE_ID?: string;
  ZAPI_INSTANCE?: string;
  ZAPI_TOKEN?: string;
  ZAPI_CLIENT_TOKEN?: string;
  ALERT_PHONE?: string;
}

const ZAPI_BASE = "https://api.z-api.io";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}

async function sendWhatsApp(
  instance: string,
  token: string,
  clientToken: string,
  phone: string,
  message: string,
): Promise<boolean> {
  const url = `${ZAPI_BASE}/instances/${instance}/token/${token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const instance = env.ZAPI_INSTANCE_ID || env.ZAPI_INSTANCE || "";
  const token = env.ZAPI_TOKEN || "";
  const clientToken = env.ZAPI_CLIENT_TOKEN || "";
  const alertPhone = env.ALERT_PHONE || "";

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Supabase não configurado" }, { status: 503 });
  }

  if (!instance || !token) {
    return Response.json({ error: "Z-API não configurado" }, { status: 503 });
  }

  if (!alertPhone) {
    return Response.json({ error: "ALERT_PHONE não configurado" }, { status: 503 });
  }

  try {
    // Fetch projetos atrasados
    const projRes = await fetch(`${supabaseUrl}/rest/v1/projetos?select=id,codigo,titulo,consultor,previsao,status,clientes(nome_fantasia)&status=in.(em-andamento,proposta)`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    const projetos: any[] = projRes.ok ? await projRes.json() : [];

    // Fetch auditorias próximas (7 dias)
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 86400_000).toISOString();
    const auditRes = await fetch(`${supabaseUrl}/rest/v1/audits?select=id,codigo,auditor,norma,data_inicio,status,clientes(nome_fantasia)&status=in.(planejada,em-andamento)&data_inicio=lte.${in7days}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    const auditorias: any[] = auditRes.ok ? await auditRes.json() : [];

    const alerts: string[] = [];

    // Check atrasos
    const atrasados = projetos.filter((p) => {
      if (!p.previsao) return false;
      return new Date(p.previsao) < now;
    });

    if (atrasados.length > 0) {
      alerts.push(`⚠️ *${atrasados.length} PROJETO(S) EM ATRASO:*`);
      for (const p of atrasados.slice(0, 5)) {
        const dias = Math.ceil((now.getTime() - new Date(p.previsao).getTime()) / 86400_000);
        alerts.push(`  • ${p.codigo} — ${p.titulo} (${p.clientes?.nome_fantasia ?? "—"}) · ${dias} dia(s) de atraso · Consultor: ${p.consultor}`);
      }
      if (atrasados.length > 5) alerts.push(`  ... e mais ${atrasados.length - 5}`);
      alerts.push("");
    }

    // Check auditorias próximas
    const proximas = auditorias.filter((a) => {
      if (!a.data_inicio) return false;
      const d = new Date(a.data_inicio);
      return d >= now && d <= new Date(in7days);
    });

    if (proximas.length > 0) {
      alerts.push(`📋 *${proximas.length} AUDITORIA(S) NOS PRÓXIMOS 7 DIAS:*`);
      for (const a of proximas) {
        const dataFmt = new Date(a.data_inicio).toLocaleDateString("pt-BR");
        alerts.push(`  • ${a.codigo} — ${a.clientes?.nome_fantasia ?? "—"} · ${a.norma} · ${dataFmt} · Auditor: ${a.auditor}`);
      }
      alerts.push("");
    }

    // Check projetos com prazo em < 15 dias
    const emRisco = projetos.filter((p) => {
      if (!p.previsao) return false;
      const daysLeft = (new Date(p.previsao).getTime() - now.getTime()) / 86400_000;
      return daysLeft > 0 && daysLeft <= 15;
    });

    if (emRisco.length > 0) {
      alerts.push(`🔴 *${emRisco.length} PROJETO(S) COM PRAZO PRÓXIMO (< 15 DIAS):*`);
      for (const p of emRisco.slice(0, 5)) {
        const dias = Math.ceil((new Date(p.previsao).getTime() - now.getTime()) / 86400_000);
        alerts.push(`  • ${p.codigo} — ${p.titulo} · ${dias} dia(s) restantes · ${p.consultor}`);
      }
      alerts.push("");
    }

    if (alerts.length === 0) {
      return Response.json({ sent: false, message: "Nenhum alerta para enviar", alerts: 0 });
    }

    // Build final message
    const header = `🔔 *CERTIFICA — Alertas do Dia*\n📅 ${now.toLocaleDateString("pt-BR")}\n\n`;
    const footer = `\n—\n_Enviado automaticamente pelo Certifica_`;
    const fullMessage = header + alerts.join("\n") + footer;

    // Send via WhatsApp
    const sent = await sendWhatsApp(instance, token, clientToken, alertPhone, fullMessage);

    return Response.json({
      sent,
      message: sent ? "Alertas enviados com sucesso" : "Erro ao enviar via WhatsApp",
      alerts: atrasados.length + proximas.length + emRisco.length,
      details: {
        atrasados: atrasados.length,
        auditorias_proximas: proximas.length,
        prazo_proximo: emRisco.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return Response.json({ error: msg }, { status: 500 });
  }
};
