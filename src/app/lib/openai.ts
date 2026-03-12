// In dev: Vite proxies /api/openai → OpenAI (key added server-side in vite.config.ts, never in bundle)
// In prod: Vercel routes to api/openai.ts serverless function (uses OPENAI_API_KEY server env var)
const API_URL = "/api/openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function gptComplete(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
  maxTokens = 500
): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.4 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ── Helpers de domínio ──────────────────────────────────────────────────

export async function classifyMessageAI(texto: string): Promise<string> {
  const content = await gptComplete([
    {
      role: "system",
      content:
        "Você é um assistente de auditoria ISO. Classifique a mensagem do usuário em UMA das categorias: geral, duvida, evidencia, urgencia, bloqueio. Responda SOMENTE com a palavra da categoria, sem pontuação.",
    },
    { role: "user", content: texto },
  ], "gpt-4o-mini", 10);
  const valid = ["geral", "duvida", "evidencia", "urgencia", "bloqueio"];
  return valid.includes(content.toLowerCase()) ? content.toLowerCase() : "geral";
}

export async function aiSuggestionGPT(
  classificacao: string,
  mensagem: string
): Promise<string> {
  return gptComplete([
    {
      role: "system",
      content:
        "Você é Carlos Silva, consultor de auditoria ISO. Responda de forma profissional, direta e em português, em até 2 frases.",
    },
    {
      role: "user",
      content: `Mensagem do cliente (classificação: ${classificacao}): "${mensagem}"`,
    },
  ], "gpt-4o-mini", 120);
}

export async function generateMeetingSummary(
  titulo: string,
  participantes: string[],
  transcricao: string
): Promise<string> {
  return gptComplete([
    {
      role: "system",
      content:
        "Você é um assistente especializado em reuniões de consultoria ISO. Gere um resumo executivo claro e objetivo em português, destacando: decisões tomadas, próximos passos e pontos de atenção. Use bullets.",
    },
    {
      role: "user",
      content: `Reunião: ${titulo}\nParticipantes: ${participantes.join(", ")}\n\nTranscrição:\n${transcricao}`,
    },
  ], "gpt-4o-mini", 400);
}

export async function generateRAI(params: {
  auditoria: string;
  cliente: string;
  norma: string;
  auditor: string;
  dataInicio: string;
  dataFim: string;
  findings: { tipo: string; clausula: string; descricao: string }[];
}): Promise<string> {
  const findingsText = params.findings
    .map((f, i) => `${i + 1}. [${f.tipo.toUpperCase()}] Cláusula ${f.clausula}: ${f.descricao}`)
    .join("\n");

  return gptComplete([
    {
      role: "system",
      content:
        "Você é um auditor líder ISO certificado. Gere um Relatório de Auditoria Interna (RAI) profissional em português com: Sumário Executivo, Escopo, Metodologia, Constatações detalhadas e Conclusão. Use linguagem técnica e formal.",
    },
    {
      role: "user",
      content: `Auditoria: ${params.auditoria}
Cliente: ${params.cliente}
Norma: ${params.norma}
Auditor líder: ${params.auditor}
Período: ${params.dataInicio} a ${params.dataFim}

Constatações:
${findingsText}`,
    },
  ], "gpt-4o-mini", 1000);
}

export interface ActionPlan5W2H {
  oQue: string;
  porQue: string;
  quem: string;
  quando: string;
  onde: string;
  como: string;
  quantoCusta: string;
}

export async function generate5W2H(params: {
  descricao: string;
  evidencia?: string;
  clausula?: string;
  norma?: string;
  tipo?: string;
}): Promise<ActionPlan5W2H> {
  const context = [
    `Não conformidade: ${params.descricao}`,
    params.evidencia ? `Evidência: ${params.evidencia}` : "",
    params.clausula ? `Cláusula: ${params.clausula}` : "",
    params.norma ? `Norma: ${params.norma}` : "",
    params.tipo ? `Tipo: ${params.tipo}` : "",
  ].filter(Boolean).join("\n");

  const texto = await gptComplete([
    {
      role: "system",
      content:
        "Você é um especialista em sistemas de gestão ISO e planos de ação corretiva. " +
        "Com base na não conformidade fornecida, gere um plano de ação 5W2H COMPLETO e REALISTA. " +
        "Responda SOMENTE com um JSON válido (sem markdown, sem ```json) contendo exatamente as chaves: " +
        "oQue, porQue, quem, quando, onde, como, quantoCusta. " +
        "Seja específico, profissional e em português.",
    },
    { role: "user", content: context },
  ], "gpt-4o-mini", 600);

  try {
    const clean = texto.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      oQue: parsed.oQue ?? parsed["O quê"] ?? "",
      porQue: parsed.porQue ?? parsed["Por quê"] ?? "",
      quem: parsed.quem ?? parsed["Quem"] ?? "",
      quando: parsed.quando ?? parsed["Quando"] ?? "",
      onde: parsed.onde ?? parsed["Onde"] ?? "",
      como: parsed.como ?? parsed["Como"] ?? "",
      quantoCusta: parsed.quantoCusta ?? parsed["Quanto custa"] ?? "",
    };
  } catch {
    // Fallback: try to extract values with regex if JSON parse fails
    return {
      oQue: texto.match(/oQue["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      porQue: texto.match(/porQue["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      quem: texto.match(/quem["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      quando: texto.match(/quando["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      onde: texto.match(/onde["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      como: texto.match(/como["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
      quantoCusta: texto.match(/quantoCusta["\s:]+([^"}\n]+)/)?.[1]?.trim() ?? "",
    };
  }
}

// ── Fechamento de Auditoria (apresentação executiva) ─────────────────────

export interface AuditClosureData {
  pontosFortes: {
    categoria: string;
    titulo: string;
    itens: { titulo: string; descricao: string }[];
    conclusao: string;
  }[];
  ncsDetalhadas: {
    area: string;
    clausula: string;
    situacaoAtual: string;
    impactoPotencial: string[];
    recomendacoes: string[];
    responsavel: string;
  }[];
  oportunidades: {
    area: string;
    titulo: string;
    situacaoAtual: string;
    beneficiosEsperados: string[];
    recomendacoes: string[];
    responsavel: string;
    /** @deprecated backward compat with old data */
    descricao?: string;
  }[];
  cronograma: {
    prioridade: string;
    acao: string;
    responsavel: string;
    prazo: string;
  }[];
  sinteseExecutiva: {
    diagnostico: string;
    recomendacoes: { titulo: string; descricao: string }[];
    proximaAuditoria: string;
  };
}

export async function generateAuditClosure(params: {
  empresa: string;
  unidade?: string;
  norma: string;
  auditorLider: string;
  dataAuditoria: string;
  totalAvaliados: number;
  conformes: number;
  ncs: number;
  observacoes: number;
  oportunidades: number;
  pctConformidade: number;
  findings: { tipo: string; clausula: string; descricao: string; evidencia: string; responsavel?: string; acao_corretiva?: string }[];
}): Promise<AuditClosureData> {
  const findingsText = params.findings
    .map((f, i) => `${i + 1}. [${f.tipo.toUpperCase()}] Cláusula ${f.clausula} | ${f.descricao} | Evidência: ${f.evidencia}${f.responsavel ? ` | Resp: ${f.responsavel}` : ""}${f.acao_corretiva ? ` | Ação: ${f.acao_corretiva}` : ""}`)
    .join("\n");

  const prompt = `Você é um consultor sênior de auditoria ISO com experiência em fechamentos executivos.
Com base nos dados abaixo, gere um JSON para uma apresentação de fechamento de auditoria.

EMPRESA: ${params.empresa}${params.unidade ? ` (${params.unidade})` : ""}
NORMA: ${params.norma}
AUDITOR LÍDER: ${params.auditorLider}
DATA: ${params.dataAuditoria}
RESULTADOS: ${params.totalAvaliados} avaliados, ${params.conformes} conformes, ${params.ncs} NCs, ${params.observacoes} observações, ${params.oportunidades} oportunidades de melhoria
% CONFORMIDADE: ${params.pctConformidade}%

CONSTATAÇÕES:
${findingsText}

Gere SOMENTE um JSON válido (sem markdown, sem \`\`\`json) com a estrutura exata:
{
  "pontosFortes": [
    {
      "categoria": "nome do agrupamento (ex: Liderança e Estrutura, Recursos Humanos, Processos, Controle e Monitoramento)",
      "titulo": "frase de destaque",
      "itens": [{"titulo": "nome curto", "descricao": "1 frase explicativa"}],
      "conclusao": "1 frase de fechamento do grupo"
    }
  ],
  "ncsDetalhadas": [
    {
      "area": "área responsável",
      "clausula": "número da cláusula",
      "situacaoAtual": "descrição detalhada do problema encontrado",
      "impactoPotencial": ["impacto 1", "impacto 2", "impacto 3"],
      "recomendacoes": ["recomendação 1", "recomendação 2", "recomendação 3"],
      "responsavel": "área responsável"
    }
  ],
  "oportunidades": [
    {
      "area": "área",
      "titulo": "título curto da oportunidade",
      "situacaoAtual": "descrição detalhada da situação atual que pode ser melhorada",
      "beneficiosEsperados": ["benefício 1", "benefício 2", "benefício 3"],
      "recomendacoes": ["recomendação específica 1", "recomendação específica 2"],
      "responsavel": "área responsável"
    }
  ],
  "cronograma": [
    {"prioridade": "ALTA|MÉDIA|BAIXA", "acao": "descrição", "responsavel": "quem", "prazo": "X dias"}
  ],
  "sinteseExecutiva": {
    "diagnostico": "parágrafo analítico sobre o estado geral do sistema",
    "recomendacoes": [{"titulo": "título curto", "descricao": "1-2 frases"}],
    "proximaAuditoria": "recomendação de prazo para próxima auditoria"
  }
}

REGRAS:
- Agrupe os itens conformes em 2-4 categorias temáticas para pontosFortes
- Cada NC deve ter análise de impacto e recomendações ESPECÍFICAS e REALISTAS
- O cronograma deve ter priorização por urgência (NCs maiores primeiro)
- A síntese executiva deve ser analítica, não genérica — referencie dados concretos
- Adapte o tom ao resultado: se conformidade é alta, seja positivo; se é baixa, seja direto sobre riscos
- Cada oportunidade de melhoria deve ter análise detalhada com situação atual, benefícios esperados e recomendações específicas, similar ao nível de detalhe das NCs
- Use português brasileiro formal`;

  const texto = await gptComplete([
    { role: "system", content: "Você gera JSON estruturado para apresentações de fechamento de auditoria ISO. Responda SOMENTE com JSON válido." },
    { role: "user", content: prompt },
  ], "gpt-4o", 6000);

  try {
    const clean = texto.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    // Fallback: return minimal structure
    return {
      pontosFortes: [],
      ncsDetalhadas: [],
      oportunidades: [],
      cronograma: [],
      sinteseExecutiva: {
        diagnostico: texto,
        recomendacoes: [],
        proximaAuditoria: "90 dias",
      },
    };
  }
}

export async function generateDashboardInsights(data: {
  totalProjetos: number;
  projetosAtivos: number;
  totalAuditorias: number;
  ncsAbertas: number;
  taxaConformidade: number;
  clientes: number;
}): Promise<{ recomendacao: string; alertas: string[] }> {
  const texto = await gptComplete([
    {
      role: "system",
      content:
        "Você é um consultor sênior de sistemas de gestão ISO. Analise os indicadores e retorne um JSON com: recomendacao (string, 1 parágrafo de recomendação prioritária) e alertas (array de strings, até 3 alertas críticos). Responda SOMENTE com JSON válido.",
    },
    {
      role: "user",
      content: JSON.stringify(data),
    },
  ], "gpt-4o-mini", 300);

  try {
    const clean = texto.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      recomendacao: texto,
      alertas: [],
    };
  }
}
