/**
 * usePdfExport — Geração de PDF no browser
 *
 * Usa a API nativa window.print() com uma janela formatada para impressão.
 * Não requer dependências externas — funciona 100% offline e no Vercel.
 *
 * Para uso futuro com jsPDF (mais controle), basta instalar:
 *   npm install jspdf jspdf-autotable
 * e trocar a implementação abaixo.
 */

export interface PdfSection {
  title?: string;
  content: string | Record<string, string | number>[];
  type?: "text" | "table";
  columns?: string[];
  keys?: string[];
}

export interface PdfDocument {
  title: string;
  subtitle?: string;
  date?: string;
  sections: PdfSection[];
  footer?: string;
}

const CERTIFICA_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #0E2A47; background: #fff; }
  .page { padding: 32px 40px; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 2px solid #2B8EAD; padding-bottom: 12px; margin-bottom: 20px; }
  .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .logo { display: flex; align-items: center; gap: 8px; }
  .logo img { height: 32px; width: auto; }
  .logo-text { font-size: 18px; font-weight: 700; color: #2B8EAD; letter-spacing: -0.5px; }
  .logo-text span { color: #0E2A47; }
  .header-title { font-size: 15px; font-weight: 600; color: #0E2A47; margin-bottom: 2px; }
  .header-subtitle { font-size: 11px; color: #6B7280; }
  .header-date { font-size: 10px; color: #6B7280; text-align: right; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 12px; font-weight: 600; color: #2B8EAD; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #E5E7EB; }
  .text-block { font-size: 11px; line-height: 1.6; color: #374151; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #0E2A47; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 5px 8px; border-bottom: 1px solid #E5E7EB; color: #374151; }
  tr:nth-child(even) td { background: #F9FAFB; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field-item { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 3px; padding: 8px 10px; }
  .field-label { font-size: 9px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .field-value { font-size: 11px; font-weight: 500; color: #0E2A47; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 2px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  .badge-green { background: #D1FAE5; color: #065F46; }
  .badge-red { background: #FEE2E2; color: #991B1B; }
  .badge-yellow { background: #FEF3C7; color: #92400E; }
  .badge-blue { background: #DBEAFE; color: #1E40AF; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 9px; color: #9CA3AF; }
  .footer-right { font-size: 9px; color: #9CA3AF; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
  }
`;

function buildHtml(doc: PdfDocument): string {
  const dateStr = doc.date ?? new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const sectionsHtml = doc.sections.map((section) => {
    let contentHtml = "";

    if (section.type === "table" && Array.isArray(section.content)) {
      const rows = section.content as Record<string, string | number>[];
      const cols = section.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
      const keys = section.keys ?? cols;
      contentHtml = `
        <table>
          <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${keys.map((k) => `<td>${row[k] ?? "—"}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      `;
    } else if (Array.isArray(section.content)) {
      // Key-value pairs as field grid
      const pairs = section.content as Record<string, string | number>[];
      contentHtml = `<div class="field-grid">${pairs.map((pair) => {
        const [label, value] = Object.entries(pair)[0] ?? ["", ""];
        return `<div class="field-item"><div class="field-label">${label}</div><div class="field-value">${value}</div></div>`;
      }).join("")}</div>`;
    } else {
      contentHtml = `<div class="text-block">${String(section.content).replace(/\n/g, "<br/>")}</div>`;
    }

    return `
      <div class="section">
        ${section.title ? `<div class="section-title">${section.title}</div>` : ""}
        ${contentHtml}
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>${CERTIFICA_STYLE}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div class="logo"><img src="${window.location.origin}/logo-certifica-oficial.png" alt="Certifica" /></div>
        <div class="header-date">Gerado em: ${dateStr}</div>
      </div>
      <div class="header-title">${doc.title}</div>
      ${doc.subtitle ? `<div class="header-subtitle">${doc.subtitle}</div>` : ""}
    </div>
    ${sectionsHtml}
    <div class="footer">
      <div class="footer-left">${doc.footer ?? "CERTIFICA — Plataforma de Gestão de Compliance e Auditorias ISO"}</div>
      <div class="footer-right">Confidencial · Uso interno</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Abre uma janela de impressão com o conteúdo formatado.
 * O usuário pode salvar como PDF usando "Salvar como PDF" na caixa de diálogo de impressão.
 */
export function exportPdf(doc: PdfDocument): void {
  const html = buildHtml(doc);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    console.warn("Pop-up bloqueado. Habilite pop-ups para exportar PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  // Slight delay to ensure fonts load
  setTimeout(() => {
    win.print();
  }, 500);
}

/**
 * Converte RAI report em PdfDocument (modo simples — evidência única)
 */
export function buildRaiPdf(rai: {
  codigo: string;
  cliente: string;
  norma: string;
  auditor: string;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  evidencia?: string;
  requisito?: string;
  classificacao?: string;
  recomendacao?: string;
  status?: string;
  observacoes?: string;
}): PdfDocument {
  return {
    title: `Relatório de Auditoria Interna (RAI) — ${rai.codigo}`,
    subtitle: `${rai.cliente} · ${rai.norma}`,
    sections: [
      {
        title: "Dados da Auditoria",
        type: "table",
        content: [
          { "Código": rai.codigo, "Cliente": rai.cliente, "Norma": rai.norma, "Auditor": rai.auditor, "Período": `${rai.dataInicio ?? "—"} a ${rai.dataFim ?? "—"}`, "Status": rai.status ?? "—" },
        ],
        columns: ["Código", "Cliente", "Norma", "Auditor", "Período", "Status"],
        keys: ["Código", "Cliente", "Norma", "Auditor", "Período", "Status"],
      },
      {
        title: "1. Descrição",
        type: "text",
        content: rai.descricao ?? "Não informado.",
      },
      {
        title: "2. Evidência Objetiva",
        type: "text",
        content: rai.evidencia ?? "Não informado.",
      },
      {
        title: "3. Requisito Técnico",
        type: "text",
        content: rai.requisito ?? rai.norma,
      },
      {
        title: "4. Classificação",
        type: "text",
        content: rai.classificacao ?? "Não classificado.",
      },
      {
        title: "5. Recomendação / Ação Corretiva",
        type: "text",
        content: rai.recomendacao ?? "Não informado.",
      },
      ...(rai.observacoes ? [{
        title: "6. Observações",
        type: "text" as const,
        content: rai.observacoes,
      }] : []),
    ],
  };
}

/* ================================================================
 * RELATÓRIO COMPLETO DE AUDITORIA — Modelo Corporativo Certifica
 * ================================================================
 * Baseado no modelo Schott Flat Glass, com aprimoramentos:
 *
 *  1.  Capa + Dados da Auditoria
 *  2.  Resumo Executivo Analítico (farol + distribuição + interpretação)
 *  3.  Mapa de Criticidade por Cláusula
 *  4.  Pontos Fortes do Sistema (conformes com narrativa)
 *  5.  Não Conformidades (narrativa completa: req → evidência → desvio → risco)
 *  6.  Observações
 *  7.  Oportunidades de Melhoria
 *  8.  Plano de Ação Corretiva (5W2H)
 *  9.  Recomendações à Direção (30/60/90 dias)
 * 10.  Conclusão da Auditoria (dinâmica, coerente com resultados)
 * 11.  Assinaturas + LGPD
 * ================================================================ */

export interface AuditFindingForReport {
  tipo: string;
  clausula: string;
  descricao: string;
  evidencia: string;
  acao_corretiva?: string;
  responsavel?: string;
  prazo?: string;
  status?: string;
}

export interface FullAuditReportData {
  codigo: string;
  empresa: string;
  unidade?: string;
  dataAuditoria: string;
  auditorLider: string;
  tipo: string;
  norma: string;
  escopo?: string;
  findings: AuditFindingForReport[];
  elaboradoPor?: string;
  revisadoPor?: string;
  aprovadoPor?: string;
  conclusao?: {
    planoCumprido?: boolean;
    acoesAuditadas?: boolean;
    analiseCriticaAuditada?: boolean;
    documentacaoAtende?: boolean;
    obstaculoEncontrado?: boolean;
    objetivosAtendidos?: boolean;
    sistemaEstabelecido?: boolean;
  };
  parecerFinal?: string;
  /* ── Campos FORM 9.2-01 ── */
  numeroAuditoria?: string;
  revisaoForm?: string;
  endereco?: string;
  municipioUf?: string;
  telefone?: string;
  email?: string;
  filiais?: string;
  numFuncionarios?: string;
  turnosTrabalho?: string;
  contato?: string;
  equipeAuditora?: string[];
  especialistaObservador?: string;
  certificacoesExistentes?: string;
  principaisClientes?: string;
  principaisFornecedores?: string;
  principaisProdutosServicos?: string;
  historicoAuditorias?: { tipo: string; auditorData: string; ocorrencias: string }[];
  listaAuditados?: { nome: string; areaProcesso: string; data: string }[];
  qualificacaoAuditor?: string;
}

const FULL_REPORT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 10.5px; color: #0E2A47; background: #fff; line-height: 1.55; }
  .page { padding: 28px 36px; max-width: 900px; margin: 0 auto; }

  /* Header */
  .report-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #2B8EAD; padding-bottom: 14px; margin-bottom: 24px; }
  .report-header-left { display: flex; align-items: center; gap: 14px; }
  .logo-mark { height: 42px; width: auto; object-fit: contain; }
  .report-title { font-size: 18px; font-weight: 700; color: #0E2A47; }
  .report-subtitle { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .report-date { font-size: 10px; color: #6B7280; text-align: right; line-height: 1.6; }

  /* Dados da Auditoria */
  .audit-data { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #D1D5DB; border-radius: 4px; overflow: hidden; margin-bottom: 24px; }
  .audit-data-item { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
  .audit-data-item:nth-child(odd) { border-right: 1px solid #E5E7EB; }
  .audit-data-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; margin-bottom: 1px; }
  .audit-data-value { font-size: 11px; font-weight: 500; color: #0E2A47; }

  /* Resumo Executivo */
  .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; border: 1px solid #D1D5DB; border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
  .summary-cell { padding: 10px 8px; text-align: center; border-right: 1px solid #E5E7EB; }
  .summary-cell:last-child { border-right: none; }
  .summary-cell-head { background: #0E2A47; color: #fff; font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 7px 8px; }
  .summary-cell-value { font-size: 20px; font-weight: 700; color: #0E2A47; }

  /* Farol */
  .traffic-light-container { display: flex; gap: 20px; align-items: stretch; margin-bottom: 16px; }
  .traffic-light { flex: 1; border: 1px solid #D1D5DB; border-radius: 4px; padding: 16px; text-align: center; }
  .traffic-light-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; margin-bottom: 10px; }
  .traffic-value { font-size: 36px; font-weight: 800; line-height: 1; }
  .traffic-label { font-size: 10px; font-weight: 600; margin-top: 6px; }
  .traffic-desc { font-size: 9px; color: #6B7280; margin-top: 4px; }
  .traffic-critical { color: #DC2626; }
  .traffic-acceptable { color: #F59E0B; }
  .traffic-adequate { color: #10B981; }
  .traffic-legend { display: flex; gap: 12px; justify-content: center; margin-top: 12px; }
  .traffic-legend-item { display: flex; align-items: center; gap: 4px; font-size: 8.5px; color: #6B7280; }
  .traffic-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-green { background: #10B981; }
  .dot-yellow { background: #F59E0B; }
  .dot-red { background: #DC2626; }

  .dist-chart { flex: 1; border: 1px solid #D1D5DB; border-radius: 4px; padding: 16px; }
  .dist-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; margin-bottom: 12px; }
  .dist-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .dist-label { font-size: 10px; width: 120px; color: #374151; }
  .dist-bar-bg { flex: 1; height: 16px; background: #F3F4F6; border-radius: 2px; overflow: hidden; }
  .dist-bar { height: 100%; border-radius: 2px; }
  .dist-count { font-size: 10px; font-weight: 600; width: 24px; text-align: right; color: #0E2A47; }
  .bar-green { background: #10B981; }
  .bar-red { background: #EF4444; }
  .bar-orange { background: #F59E0B; }
  .bar-blue { background: #3B82F6; }

  /* Análise textual */
  .analysis-box { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; padding: 12px 16px; font-size: 10.5px; line-height: 1.7; color: #374151; margin-bottom: 16px; }
  .analysis-box strong { color: #0E2A47; }
  .analysis-box .highlight-red { color: #DC2626; font-weight: 600; }
  .analysis-box .highlight-green { color: #10B981; font-weight: 600; }
  .analysis-box .highlight-amber { color: #D97706; font-weight: 600; }

  /* Mapa de criticidade */
  .crit-map { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .crit-card { border: 1px solid #E5E7EB; border-radius: 4px; padding: 8px 10px; display: flex; align-items: center; gap: 8px; }
  .crit-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .crit-dot-red { background: #EF4444; }
  .crit-dot-orange { background: #F59E0B; }
  .crit-dot-blue { background: #3B82F6; }
  .crit-dot-green { background: #10B981; }
  .crit-info { flex: 1; }
  .crit-clause { font-size: 11px; font-weight: 600; color: #0E2A47; }
  .crit-type { font-size: 8.5px; color: #6B7280; text-transform: uppercase; }

  /* Seções */
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; color: #0E2A47; padding: 8px 12px; background: #F0F7FA; border-left: 4px solid #2B8EAD; border-radius: 0 4px 4px 0; margin-bottom: 12px; }

  /* Tabelas */
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 4px; }
  thead th { background: #0E2A47; color: #fff; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #E5E7EB; color: #374151; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F9FAFB; }
  .col-item { width: 50px; font-weight: 600; color: #0E2A47; }
  .col-norma { width: 45px; text-align: center; }
  .col-status { width: 70px; text-align: center; }
  .col-classif { width: 65px; text-align: center; }
  .col-resp { width: 80px; }
  .col-data { width: 75px; text-align: center; }

  /* Finding card — narrativa detalhada */
  .finding-card { border: 1px solid #E5E7EB; border-radius: 4px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
  .finding-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
  .finding-header-left { display: flex; align-items: center; gap: 8px; }
  .finding-clause { font-size: 12px; font-weight: 700; color: #0E2A47; }
  .finding-body { padding: 10px 14px; }
  .finding-row { margin-bottom: 8px; }
  .finding-label { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #2B8EAD; margin-bottom: 2px; }
  .finding-text { font-size: 10.5px; color: #374151; line-height: 1.65; }
  .finding-meta { display: flex; gap: 16px; padding: 8px 14px; background: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 9.5px; color: #6B7280; }
  .finding-meta strong { color: #0E2A47; }
  .finding-risk { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 8.5px; font-weight: 600; text-transform: uppercase; }
  .risk-high { background: #FEE2E2; color: #991B1B; }
  .risk-medium { background: #FEF3C7; color: #92400E; }
  .risk-low { background: #DBEAFE; color: #1E40AF; }

  /* Badges inline */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .badge-conforme { background: #D1FAE5; color: #065F46; }
  .badge-nc-maior { background: #FEE2E2; color: #991B1B; }
  .badge-nc-menor { background: #FECACA; color: #B91C1C; }
  .badge-observacao { background: #FEF3C7; color: #92400E; }
  .badge-oportunidade { background: #DBEAFE; color: #1E40AF; }

  /* Plano de ação 5W2H */
  .action-card { border: 1px solid #E5E7EB; border-radius: 4px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
  .action-header { padding: 8px 12px; background: #FEF2F2; border-bottom: 1px solid #FECACA; display: flex; align-items: center; justify-content: space-between; }
  .action-clause { font-size: 11px; font-weight: 700; color: #991B1B; }
  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .action-cell { padding: 7px 12px; border-bottom: 1px solid #F3F4F6; border-right: 1px solid #F3F4F6; }
  .action-cell:nth-child(even) { border-right: none; }
  .action-cell-full { grid-column: 1 / -1; padding: 7px 12px; border-bottom: 1px solid #F3F4F6; }
  .action-cell-label { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; margin-bottom: 1px; }
  .action-cell-value { font-size: 10px; color: #0E2A47; }

  /* Recomendações à direção */
  .rec-timeline { position: relative; padding-left: 24px; margin-bottom: 16px; }
  .rec-timeline::before { content: ''; position: absolute; left: 7px; top: 4px; bottom: 4px; width: 2px; background: #D1D5DB; }
  .rec-item { position: relative; margin-bottom: 14px; }
  .rec-dot { position: absolute; left: -20px; top: 3px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
  .rec-dot-30 { background: #EF4444; }
  .rec-dot-60 { background: #F59E0B; }
  .rec-dot-90 { background: #3B82F6; }
  .rec-period { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
  .rec-period-30 { color: #DC2626; }
  .rec-period-60 { color: #D97706; }
  .rec-period-90 { color: #2563EB; }
  .rec-text { font-size: 10.5px; color: #374151; line-height: 1.6; }

  /* Conclusão */
  .conclusion-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 20px; }
  .conclusion-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #E5E7EB; border-radius: 4px; font-size: 11px; }
  .conclusion-number { background: #0E2A47; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .check-yes { color: #10B981; font-weight: 700; }
  .check-no { color: #EF4444; font-weight: 700; }
  .conclusion-text { flex: 1; color: #374151; }
  .conclusion-checks { display: flex; gap: 12px; flex-shrink: 0; }

  /* Parecer e assinatura */
  .parecer { background: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 4px; padding: 14px 16px; font-size: 11px; line-height: 1.7; color: #374151; margin-bottom: 20px; }
  .parecer p { margin-bottom: 8px; }
  .signature-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; padding-top: 20px; }
  .signature-block { text-align: center; }
  .signature-line { width: 200px; border-bottom: 1px solid #374151; margin-bottom: 4px; }
  .signature-name { font-size: 11px; font-weight: 600; color: #0E2A47; }
  .signature-role { font-size: 9px; color: #6B7280; }
  .signature-date { font-size: 10px; color: #6B7280; margin-top: 2px; }

  /* Footer */
  .report-footer { margin-top: 24px; padding-top: 10px; border-top: 2px solid #2B8EAD; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 9px; color: #2B8EAD; font-weight: 600; }
  .footer-conf { font-size: 8px; color: #9CA3AF; }
  .lgpd-notice { font-size: 9px; color: #6B7280; font-style: italic; margin-top: 8px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 16px 20px; }
    .section { page-break-inside: avoid; }
    .finding-card { page-break-inside: avoid; }
    .action-card { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
`;

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

function tipoBadgeClass(tipo: string): string {
  const map: Record<string, string> = {
    "nc-maior": "badge-nc-maior",
    "nc-menor": "badge-nc-menor",
    "observacao": "badge-observacao",
    "oportunidade": "badge-oportunidade",
    "conformidade": "badge-conforme",
  };
  return map[tipo] ?? "";
}

function tipoBadgeLabel(tipo: string): string {
  const map: Record<string, string> = {
    "nc-maior": "NC Maior",
    "nc-menor": "NC Menor",
    "observacao": "Observação",
    "oportunidade": "Oport. Melhoria",
    "conformidade": "Conforme",
  };
  return map[tipo] ?? tipo;
}

function auditTipoLabel(tipo: string): string {
  return ({ interna: "Interna", externa: "Externa", certificacao: "Certificação" } as Record<string, string>)[tipo] ?? tipo;
}

function critDotClass(tipo: string): string {
  if (tipo === "nc-maior" || tipo === "nc-menor") return "crit-dot-red";
  if (tipo === "observacao") return "crit-dot-orange";
  if (tipo === "oportunidade") return "crit-dot-blue";
  return "crit-dot-green";
}

function riskClass(tipo: string): string {
  if (tipo === "nc-maior") return "risk-high";
  if (tipo === "nc-menor") return "risk-medium";
  return "risk-low";
}

function riskLabel(tipo: string): string {
  if (tipo === "nc-maior") return "Risco Alto";
  if (tipo === "nc-menor") return "Risco Médio";
  if (tipo === "observacao") return "Atenção";
  return "Baixo";
}

/** Gera análise interpretativa automática baseada nos números */
function buildExecutiveAnalysis(
  empresa: string,
  norma: string,
  total: number,
  conformes: number,
  ncs: number,
  ncsMaiores: number,
  obs: number,
  oport: number,
  pct: number,
): string {
  const lines: string[] = [];

  // Cobertura
  if (total < 10) {
    lines.push(`A auditoria avaliou <strong>${total} requisitos</strong> da norma ${escHtml(norma)}. A cobertura é <span class="highlight-amber">limitada</span> e pode não representar a totalidade do sistema de gestão. Recomenda-se ampliar o escopo nas próximas auditorias para garantir visão sistêmica.`);
  } else if (total < 20) {
    lines.push(`Foram avaliados <strong>${total} requisitos</strong> da norma ${escHtml(norma)}, oferecendo uma amostra representativa do sistema de gestão de ${escHtml(empresa)}.`);
  } else {
    lines.push(`A auditoria avaliou <strong>${total} requisitos</strong> da norma ${escHtml(norma)}, proporcionando uma <span class="highlight-green">cobertura ampla e robusta</span> do Sistema de Gestão de ${escHtml(empresa)}.`);
  }

  // Conformidade
  if (pct >= 95) {
    lines.push(`O índice de conformidade de <span class="highlight-green">${pct}%</span> demonstra alto grau de maturidade e aderência normativa. O sistema apresenta consistência e controle adequados.`);
  } else if (pct >= 85) {
    lines.push(`O índice de conformidade de <span class="highlight-amber">${pct}%</span> situa-se em faixa aceitável, porém indica oportunidades relevantes de melhoria para atingir excelência operacional.`);
  } else if (pct >= 50) {
    lines.push(`O índice de conformidade de <span class="highlight-red">${pct}%</span> situa-se em nível crítico, indicando <strong>fragilidades significativas</strong> no sistema de gestão que demandam atenção prioritária da direção.`);
  } else {
    lines.push(`O índice de conformidade de <span class="highlight-red">${pct}%</span> é <strong>muito abaixo do esperado</strong>, sinalizando lacunas estruturais graves no sistema de gestão. Ações imediatas são necessárias para garantir a sustentabilidade do SGQ.`);
  }

  // NCs
  if (ncs > 0) {
    const ncText = ncsMaiores > 0
      ? `Foram identificadas <span class="highlight-red">${ncs} não conformidade(s)</span>, sendo ${ncsMaiores} de classificação Maior, o que requer tratamento imediato com análise de causa-raiz, contenção e verificação de eficácia.`
      : `Foram identificadas <span class="highlight-red">${ncs} não conformidade(s)</span> de classificação Menor. Embora não representem risco sistêmico imediato, exigem plano de ação corretiva com prazo e responsável definidos.`;
    lines.push(ncText);
  } else {
    lines.push(`<span class="highlight-green">Nenhuma não conformidade foi identificada</span> neste ciclo de auditoria, o que é indicador positivo de maturidade do sistema.`);
  }

  // Observações e oportunidades
  if (obs > 0 || oport > 0) {
    const parts: string[] = [];
    if (obs > 0) parts.push(`${obs} observação(ões)`);
    if (oport > 0) parts.push(`${oport} oportunidade(s) de melhoria`);
    lines.push(`Adicionalmente, foram registradas ${parts.join(" e ")}, demonstrando que a auditoria buscou leitura ampla do sistema para além das conformidades e desvios, contribuindo para a evolução contínua.`);
  }

  return lines.map((l) => `<p style="margin-bottom:6px;">${l}</p>`).join("");
}

/** Gera parecer final dinâmico e coerente com os resultados */
function buildSmartParecer(
  empresa: string,
  pct: number,
  ncs: number,
  ncsMaiores: number,
  obs: number,
  total: number,
): string {
  const paras: string[] = [];

  if (pct >= 95 && ncs === 0) {
    paras.push(`Para objetivo da auditoria, considera-se que o Sistema de Gestão de ${escHtml(empresa)} encontra-se <strong>implementado, mantido e demonstrando alto nível de maturidade</strong>. Os controles avaliados apresentam consistência e rastreabilidade adequadas aos requisitos normativos.`);
    if (obs > 0) {
      paras.push(`As ${obs} observação(ões) registrada(s) representam oportunidades de aprimoramento que, se implementadas, podem consolidar ainda mais a robustez do sistema.`);
    }
  } else if (pct >= 85) {
    paras.push(`Para objetivo da auditoria, considera-se que o Sistema de Gestão de ${escHtml(empresa)} encontra-se <strong>implementado e em fase de consolidação</strong>. O índice de conformidade de ${pct}% demonstra aderência aceitável, porém as constatações indicam pontos que necessitam de tratamento para atingir excelência.`);
    if (ncs > 0) {
      paras.push(`As ${ncs} não conformidade(s) identificada(s) requerem plano de ação corretiva com análise de causa-raiz, definição de responsáveis e prazos. Recomenda-se verificação de eficácia em até 90 dias.`);
    }
  } else {
    paras.push(`Para objetivo da auditoria, considera-se que o Sistema de Gestão de ${escHtml(empresa)} encontra-se <strong>parcialmente implementado, com fragilidades que comprometem a eficácia do sistema</strong>. O índice de conformidade de ${pct}% está abaixo do patamar mínimo aceitável e demanda ações prioritárias.`);
    if (ncsMaiores > 0) {
      paras.push(`As ${ncsMaiores} não conformidade(s) Maior(es) representam risco significativo ao sistema e devem ser tratadas com máxima prioridade, incluindo contenção imediata, análise de causa-raiz estruturada e verificação de eficácia.`);
    }
    if (ncs > ncsMaiores) {
      paras.push(`As demais ${ncs - ncsMaiores} não conformidade(s) Menor(es) também devem ser endereçadas com plano de ação corretiva formal.`);
    }
    if (total < 10) {
      paras.push(`Observa-se que a cobertura desta auditoria foi limitada a ${total} requisitos. Recomenda-se fortemente ampliar o escopo na próxima auditoria para obter visão sistêmica mais completa.`);
    }
  }

  return paras.map((p) => `<p>${p}</p>`).join("");
}

/** Gera recomendações 30/60/90 dias com base nos findings */
function buildRecommendations(
  ncs: AuditFindingForReport[],
  ncsMaiores: AuditFindingForReport[],
  obs: AuditFindingForReport[],
  oport: AuditFindingForReport[],
  total: number,
): { period30: string[]; period60: string[]; period90: string[] } {
  const p30: string[] = [];
  const p60: string[] = [];
  const p90: string[] = [];

  // 30 dias — urgência
  if (ncsMaiores.length > 0) {
    p30.push(`Tratar imediatamente as ${ncsMaiores.length} NC(s) Maior(es) com contenção, análise de causa-raiz (Ishikawa/5 Porquês) e plano de ação corretiva.`);
    ncsMaiores.forEach((nc) => {
      p30.push(`Cláusula ${escHtml(nc.clausula)}: ${escHtml(nc.descricao.substring(0, 120))}${nc.descricao.length > 120 ? "..." : ""}`);
    });
  }
  const ncsMinor = ncs.filter((n) => n.tipo === "nc-menor");
  if (ncsMinor.length > 0) {
    p30.push(`Abrir plano de ação para as ${ncsMinor.length} NC(s) Menor(es), definindo responsável e prazo.`);
  }

  // 60 dias — consolidação
  if (ncs.length > 0) {
    p60.push("Realizar verificação de eficácia das ações corretivas implementadas nas NCs.");
  }
  if (obs.length > 0) {
    p60.push(`Endereçar as ${obs.length} observação(ões) com ações preventivas e monitoramento.`);
  }
  if (total < 15) {
    p60.push("Planejar ampliação do escopo de auditoria para o próximo ciclo, assegurando cobertura sistêmica mínima de 15 requisitos.");
  }

  // 90 dias — estratégico
  if (oport.length > 0) {
    p90.push(`Avaliar e priorizar as ${oport.length} oportunidade(s) de melhoria identificadas, com plano de implementação e indicadores de resultado.`);
  }
  p90.push("Realizar análise crítica dos resultados desta auditoria com a Alta Direção, incluindo definição de metas de conformidade para o próximo ciclo.");
  if (ncs.length > 0) {
    p90.push("Confirmar fechamento de todas as NCs com evidência de eficácia documentada.");
  }

  return { period30: p30, period60: p60, period90: p90 };
}

export function buildFullAuditReportHtml(data: FullAuditReportData): string {
  const { findings } = data;

  const conformes = findings.filter((f) => f.tipo === "conformidade");
  const ncs = findings.filter((f) => f.tipo === "nc-maior" || f.tipo === "nc-menor");
  const ncsMaiores = findings.filter((f) => f.tipo === "nc-maior");
  const observacoes = findings.filter((f) => f.tipo === "observacao");
  const oportunidades = findings.filter((f) => f.tipo === "oportunidade");

  const totalAvaliados = findings.length;
  const pctConformidade = totalAvaliados > 0 ? Math.round((conformes.length / totalAvaliados) * 100 * 10) / 10 : 0;

  let trafficClass = "traffic-critical";
  let trafficNivel = "Crítico";
  let trafficDesc = "< 85% de conformidade";
  if (pctConformidade >= 95) { trafficClass = "traffic-adequate"; trafficNivel = "Adequado"; trafficDesc = "≥ 95% de conformidade"; }
  else if (pctConformidade >= 85) { trafficClass = "traffic-acceptable"; trafficNivel = "Aceitável"; trafficDesc = "85% — 94% de conformidade"; }

  const dateGenStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const concl = data.conclusao ?? {};
  const normShort = data.norma.replace(/ISO\s*/i, "");

  function checkbox(val?: boolean): string {
    if (val === true) return '<span class="check-yes">[X] SIM</span>&nbsp;&nbsp;<span style="color:#9CA3AF">[ ] NÃO</span>';
    if (val === false) return '<span style="color:#9CA3AF">[ ] SIM</span>&nbsp;&nbsp;<span class="check-no">[X] NÃO</span>';
    return '<span style="color:#9CA3AF">[ ] SIM</span>&nbsp;&nbsp;<span style="color:#9CA3AF">[ ] NÃO</span>';
  }

  const maxCount = Math.max(conformes.length, ncs.length, observacoes.length, oportunidades.length, 1);

  // ── Mapa de criticidade ──
  const nonConformFindings = findings.filter((f) => f.tipo !== "conformidade");
  const critMapHtml = nonConformFindings.length > 0 ? nonConformFindings.map((f) => `
    <div class="crit-card">
      <div class="crit-dot ${critDotClass(f.tipo)}"></div>
      <div class="crit-info">
        <div class="crit-clause">${escHtml(f.clausula)}</div>
        <div class="crit-type">${tipoBadgeLabel(f.tipo)}</div>
      </div>
    </div>
  `).join("") : "";

  // ── Conformes — narrativa com tabela ──
  const conformesTableRows = conformes.map((f) => `
    <tr>
      <td class="col-item">${escHtml(f.clausula)}</td>
      <td class="col-norma">${escHtml(normShort)}</td>
      <td>${escHtml(f.descricao)}</td>
      <td>${escHtml(f.evidencia || "Evidência verificada em campo — sem desvio identificado.")}</td>
      <td class="col-status"><span class="badge badge-conforme">Conforme</span></td>
    </tr>
  `).join("");

  // ── NCs — cards narrativos ──
  const ncCardsHtml = ncs.map((f, i) => `
    <div class="finding-card">
      <div class="finding-header">
        <div class="finding-header-left">
          <span class="finding-clause">NC-${String(i + 1).padStart(2, "0")} — Cláusula ${escHtml(f.clausula)}</span>
          <span class="badge ${tipoBadgeClass(f.tipo)}">${f.tipo === "nc-maior" ? "Maior" : "Menor"}</span>
        </div>
        <span class="finding-risk ${riskClass(f.tipo)}">${riskLabel(f.tipo)}</span>
      </div>
      <div class="finding-body">
        <div class="finding-row">
          <div class="finding-label">Descrição da Constatação</div>
          <div class="finding-text">${escHtml(f.descricao)}</div>
        </div>
        <div class="finding-row">
          <div class="finding-label">Evidência Objetiva</div>
          <div class="finding-text">${escHtml(f.evidencia || "Evidência a ser complementada pelo auditor.")}</div>
        </div>
        ${f.acao_corretiva ? `
        <div class="finding-row">
          <div class="finding-label">Ação Corretiva Proposta</div>
          <div class="finding-text">${escHtml(f.acao_corretiva)}</div>
        </div>` : ""}
      </div>
      <div class="finding-meta">
        <div><strong>Responsável:</strong> ${escHtml(f.responsavel || "A definir")}</div>
        <div><strong>Prazo:</strong> ${formatDate(f.prazo)}</div>
        <div><strong>Status:</strong> ${escHtml(f.status || "Aberta")}</div>
      </div>
    </div>
  `).join("");

  // ── Observações — cards narrativos ──
  const obsCardsHtml = observacoes.map((f, i) => `
    <div class="finding-card">
      <div class="finding-header">
        <div class="finding-header-left">
          <span class="finding-clause">OBS-${String(i + 1).padStart(2, "0")} — Cláusula ${escHtml(f.clausula)}</span>
          <span class="badge badge-observacao">Observação</span>
        </div>
      </div>
      <div class="finding-body">
        <div class="finding-row">
          <div class="finding-label">Descrição</div>
          <div class="finding-text">${escHtml(f.descricao)}</div>
        </div>
        <div class="finding-row">
          <div class="finding-label">Evidência Avaliada</div>
          <div class="finding-text">${escHtml(f.evidencia || "Verificação em campo sem achados formais, porém com ponto de atenção registrado.")}</div>
        </div>
      </div>
      <div class="finding-meta">
        <div><strong>Responsável:</strong> ${escHtml(f.responsavel || "A definir")}</div>
        <div><strong>Prazo sugerido:</strong> ${formatDate(f.prazo)}</div>
      </div>
    </div>
  `).join("");

  // ── Oportunidades — cards narrativos ──
  const oportCardsHtml = oportunidades.map((f, i) => `
    <div class="finding-card">
      <div class="finding-header">
        <div class="finding-header-left">
          <span class="finding-clause">OM-${String(i + 1).padStart(2, "0")} — Cláusula ${escHtml(f.clausula)}</span>
          <span class="badge badge-oportunidade">Oport. Melhoria</span>
        </div>
      </div>
      <div class="finding-body">
        <div class="finding-row">
          <div class="finding-label">Descrição</div>
          <div class="finding-text">${escHtml(f.descricao)}</div>
        </div>
        <div class="finding-row">
          <div class="finding-label">Evidência Avaliada</div>
          <div class="finding-text">${escHtml(f.evidencia || "Análise de campo identificou potencial de melhoria no processo avaliado.")}</div>
        </div>
      </div>
      <div class="finding-meta">
        <div><strong>Responsável:</strong> ${escHtml(f.responsavel || "A definir")}</div>
      </div>
    </div>
  `).join("");

  // ── Plano de ação 5W2H ──
  const actionCardsHtml = ncs.map((f, i) => `
    <div class="action-card">
      <div class="action-header">
        <div class="action-clause">NC-${String(i + 1).padStart(2, "0")} — Cláusula ${escHtml(f.clausula)}</div>
        <span class="badge ${tipoBadgeClass(f.tipo)}">${f.tipo === "nc-maior" ? "Maior" : "Menor"}</span>
      </div>
      <div class="action-cell-full">
        <div class="action-cell-label">O quê (What) — Descrição da NC</div>
        <div class="action-cell-value">${escHtml(f.descricao)}</div>
      </div>
      <div class="action-grid">
        <div class="action-cell">
          <div class="action-cell-label">Por quê (Why) — Causa / Impacto</div>
          <div class="action-cell-value">${escHtml(f.acao_corretiva || "Análise de causa-raiz a ser realizada pelo responsável.")}</div>
        </div>
        <div class="action-cell">
          <div class="action-cell-label">Quem (Who) — Responsável</div>
          <div class="action-cell-value">${escHtml(f.responsavel || "A definir pela gestão")}</div>
        </div>
        <div class="action-cell">
          <div class="action-cell-label">Quando (When) — Prazo</div>
          <div class="action-cell-value">${formatDate(f.prazo)}</div>
        </div>
        <div class="action-cell">
          <div class="action-cell-label">Onde (Where) — Processo / Área</div>
          <div class="action-cell-value">Processo vinculado à cláusula ${escHtml(f.clausula)}</div>
        </div>
        <div class="action-cell">
          <div class="action-cell-label">Como (How) — Método</div>
          <div class="action-cell-value">${f.acao_corretiva ? escHtml(f.acao_corretiva) : "Definir ação corretiva, contenção imediata e verificação de eficácia."}</div>
        </div>
        <div class="action-cell">
          <div class="action-cell-label">Quanto custa (How much) — Recursos</div>
          <div class="action-cell-value">A ser estimado pelo responsável</div>
        </div>
      </div>
    </div>
  `).join("");

  // ── Recomendações 30/60/90 ──
  const recs = buildRecommendations(ncs, ncsMaiores, observacoes, oportunidades, totalAvaliados);

  const recsHtml = `
    <div class="rec-timeline">
      ${recs.period30.length > 0 ? `
      <div class="rec-item">
        <div class="rec-dot rec-dot-30"></div>
        <div class="rec-period rec-period-30">Primeiros 30 dias — Ações Imediatas</div>
        ${recs.period30.map((t) => `<div class="rec-text">• ${t}</div>`).join("")}
      </div>` : ""}
      ${recs.period60.length > 0 ? `
      <div class="rec-item">
        <div class="rec-dot rec-dot-60"></div>
        <div class="rec-period rec-period-60">30 a 60 dias — Consolidação</div>
        ${recs.period60.map((t) => `<div class="rec-text">• ${t}</div>`).join("")}
      </div>` : ""}
      ${recs.period90.length > 0 ? `
      <div class="rec-item">
        <div class="rec-dot rec-dot-90"></div>
        <div class="rec-period rec-period-90">60 a 90 dias — Estratégico</div>
        ${recs.period90.map((t) => `<div class="rec-text">• ${t}</div>`).join("")}
      </div>` : ""}
    </div>
  `;

  // ── Análise executiva ──
  const execAnalysis = buildExecutiveAnalysis(
    data.empresa, data.norma, totalAvaliados,
    conformes.length, ncs.length, ncsMaiores.length,
    observacoes.length, oportunidades.length, pctConformidade,
  );

  // ── Parecer final inteligente ──
  const parecerHtml = data.parecerFinal
    ? `<div class="parecer">${escHtml(data.parecerFinal).replace(/\n/g, "<br/>")}</div>`
    : `<div class="parecer">${buildSmartParecer(data.empresa, pctConformidade, ncs.length, ncsMaiores.length, observacoes.length, totalAvaliados)}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Auditoria — ${escHtml(data.empresa)}</title>
  <style>${FULL_REPORT_STYLE}</style>
</head>
<body>
  <div class="page">

    <!-- CABEÇALHO FORM 9.2-01 -->
    <div class="report-header">
      <div class="report-header-left">
        <img class="logo-mark" src="${window.location.origin}/logo-certifica-oficial.png" alt="Certifica" />
        <div>
          <div class="report-title">Relatório de Auditoria Interna (RAI)</div>
          <div class="report-subtitle">${data.numeroAuditoria ? `Auditoria Interna: Nº ${escHtml(data.numeroAuditoria)}` : escHtml(data.codigo)}${data.unidade ? ` | ${escHtml(data.unidade)}` : ""}</div>
        </div>
      </div>
      <div class="report-date">
        ${data.revisaoForm ? `FORM 9.2-01 Revisão ${escHtml(data.revisaoForm)}<br/>` : ""}
        Gerado em: ${dateGenStr}<br/>
        Código: ${escHtml(data.codigo)}
      </div>
    </div>

    <!-- DADOS DA ORGANIZAÇÃO -->
    <div class="section">
      <div class="section-title">Dados da Organização</div>
      <div class="audit-data">
        <div class="audit-data-item"><div class="audit-data-label">Nome da Organização</div><div class="audit-data-value">${escHtml(data.empresa)}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Grupo / Filiais</div><div class="audit-data-value">${escHtml(data.filiais ?? data.unidade ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Endereço</div><div class="audit-data-value">${escHtml(data.endereco ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Município / Estado</div><div class="audit-data-value">${escHtml(data.municipioUf ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Telefone</div><div class="audit-data-value">${escHtml(data.telefone ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">E-mail</div><div class="audit-data-value">${escHtml(data.email ?? "—")}</div></div>
      </div>
    </div>

    <!-- INFORMAÇÕES DA AUDITORIA -->
    <div class="section">
      <div class="section-title">Informações da Auditoria</div>
      <div class="audit-data">
        <div class="audit-data-item" style="grid-column:1/-1;border-right:none"><div class="audit-data-label">Descrição do Escopo</div><div class="audit-data-value">${escHtml(data.escopo ?? "Todo o site")}</div></div>
        <div class="audit-data-item" style="grid-column:1/-1;border-right:none"><div class="audit-data-label">Norma de Referência</div><div class="audit-data-value">${escHtml(data.norma)}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Auditor Líder</div><div class="audit-data-value">${escHtml(data.auditorLider)}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Auditor (equipe)</div><div class="audit-data-value">${data.equipeAuditora && data.equipeAuditora.length > 0 ? data.equipeAuditora.map(escHtml).join(", ") : "N/A"}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Especialista / Observador</div><div class="audit-data-value">${escHtml(data.especialistaObservador ?? "N/A")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Turnos de Trabalho</div><div class="audit-data-value">${escHtml(data.turnosTrabalho ?? "Administrativo")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Nº de Funcionários</div><div class="audit-data-value">${escHtml(data.numFuncionarios ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Contato</div><div class="audit-data-value">${escHtml(data.contato ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Tipo</div><div class="audit-data-value">${auditTipoLabel(data.tipo)}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Data da Auditoria</div><div class="audit-data-value">${formatDate(data.dataAuditoria)}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Certificações Existentes</div><div class="audit-data-value">${escHtml(data.certificacoesExistentes ?? "—")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Aplicabilidade (exclusões)</div><div class="audit-data-value">N/A</div></div>
      </div>
    </div>

    <!-- INFORMAÇÕES DA ORGANIZAÇÃO -->
    <div class="section">
      <div class="section-title">Informações da Organização</div>
      <div class="audit-data">
        <div class="audit-data-item"><div class="audit-data-label">Principais Clientes</div><div class="audit-data-value">${escHtml(data.principaisClientes ?? "Diversos")}</div></div>
        <div class="audit-data-item"><div class="audit-data-label">Principais Fornecedores</div><div class="audit-data-value">${escHtml(data.principaisFornecedores ?? "Diversos")}</div></div>
        <div class="audit-data-item" style="grid-column:1/-1;border-right:none"><div class="audit-data-label">Principais Produtos / Serviços</div><div class="audit-data-value">${escHtml(data.principaisProdutosServicos ?? "—")}</div></div>
      </div>
    </div>

    <!-- HISTÓRICO DE AUDITORIAS -->
    ${data.historicoAuditorias && data.historicoAuditorias.length > 0 ? `
    <div class="section">
      <div class="section-title">1. Histórico de Auditorias</div>
      <table>
        <thead><tr><th>Tipo</th><th>Auditor / Data</th><th>Ocorrências</th></tr></thead>
        <tbody>${data.historicoAuditorias.map((h) => `
          <tr><td>${escHtml(h.tipo)}</td><td>${escHtml(h.auditorData)}</td><td>${escHtml(h.ocorrencias)}</td></tr>
        `).join("")}</tbody>
      </table>
    </div>` : ""}

    <!-- LISTA DE AUDITADOS -->
    ${data.listaAuditados && data.listaAuditados.length > 0 ? `
    <div class="section">
      <div class="section-title">2. Lista de Auditados</div>
      <table>
        <thead><tr><th>Nome</th><th>Área / Processo</th><th>Data</th></tr></thead>
        <tbody>${data.listaAuditados.map((a) => `
          <tr><td>${escHtml(a.nome)}</td><td>${escHtml(a.areaProcesso)}</td><td>${escHtml(a.data)}</td></tr>
        `).join("")}</tbody>
      </table>
    </div>` : ""}

    <!-- DETALHE DAS OCORRÊNCIAS (formato FORM 9.2-01) -->
    ${findings.length > 0 ? `
    <div class="section">
      <div class="section-title">3. Detalhe das Ocorrências</div>
      <table>
        <thead><tr><th>Processo</th><th>Descrição</th><th>Requisito</th><th>Tipo</th></tr></thead>
        <tbody>${findings.filter((f) => f.tipo !== "conformidade").map((f) => {
          const symbol = f.tipo === "nc-maior" || f.tipo === "nc-menor" ? "&#x232B; NC" : f.tipo === "observacao" ? "&#x270D; OBS" : "&#x261C; OM";
          return `<tr><td>${escHtml(f.clausula)}</td><td>${escHtml(f.descricao.substring(0, 150))}${f.descricao.length > 150 ? "..." : ""}</td><td>${escHtml(f.clausula)}</td><td>${symbol}</td></tr>`;
        }).join("")}</tbody>
      </table>
      <div style="font-size:9px;color:#6B7280;margin-top:6px">Classificação: &#x232B; — Não Conformidade; &#x270D; — Observação; &#x261C; — Oportunidade de melhoria.</div>
    </div>` : ""}

    <!-- RESUMO EXECUTIVO -->
    <div class="section">
      <div class="section-title">Resumo Executivo</div>
      <div class="summary-grid">
        <div class="summary-cell summary-cell-head">Total Avaliados</div>
        <div class="summary-cell summary-cell-head">Conformes</div>
        <div class="summary-cell summary-cell-head">Não Conformidades</div>
        <div class="summary-cell summary-cell-head">Observações</div>
        <div class="summary-cell summary-cell-head">Melhorias</div>
        <div class="summary-cell summary-cell-head">% Conformidade</div>
        <div class="summary-cell"><div class="summary-cell-value">${totalAvaliados}</div></div>
        <div class="summary-cell"><div class="summary-cell-value" style="color:#10B981">${conformes.length}</div></div>
        <div class="summary-cell"><div class="summary-cell-value" style="color:#EF4444">${ncs.length}</div></div>
        <div class="summary-cell"><div class="summary-cell-value" style="color:#F59E0B">${observacoes.length}</div></div>
        <div class="summary-cell"><div class="summary-cell-value" style="color:#3B82F6">${oportunidades.length}</div></div>
        <div class="summary-cell"><div class="summary-cell-value">${pctConformidade}%</div></div>
      </div>

      <div class="traffic-light-container">
        <div class="traffic-light">
          <div class="traffic-light-title">Farol de Conformidade</div>
          <div class="traffic-value ${trafficClass}">${pctConformidade}%</div>
          <div class="traffic-label ${trafficClass}">${trafficNivel}</div>
          <div class="traffic-desc">${trafficDesc}</div>
          <div class="traffic-legend">
            <div class="traffic-legend-item"><div class="traffic-legend-dot dot-green"></div>≥ 95% Adequado</div>
            <div class="traffic-legend-item"><div class="traffic-legend-dot dot-yellow"></div>85%-94% Aceitável</div>
            <div class="traffic-legend-item"><div class="traffic-legend-dot dot-red"></div>&lt; 85% Crítico</div>
          </div>
        </div>
        <div class="dist-chart">
          <div class="dist-title">Distribuição por Status</div>
          <div class="dist-row"><div class="dist-label">Conforme</div><div class="dist-bar-bg"><div class="dist-bar bar-green" style="width:${Math.round((conformes.length / maxCount) * 100)}%"></div></div><div class="dist-count">${conformes.length}</div></div>
          <div class="dist-row"><div class="dist-label">Não Conformidade</div><div class="dist-bar-bg"><div class="dist-bar bar-red" style="width:${Math.round((ncs.length / maxCount) * 100)}%"></div></div><div class="dist-count">${ncs.length}</div></div>
          <div class="dist-row"><div class="dist-label">Observação</div><div class="dist-bar-bg"><div class="dist-bar bar-orange" style="width:${Math.round((observacoes.length / maxCount) * 100)}%"></div></div><div class="dist-count">${observacoes.length}</div></div>
          <div class="dist-row"><div class="dist-label">Oport. Melhoria</div><div class="dist-bar-bg"><div class="dist-bar bar-blue" style="width:${Math.round((oportunidades.length / maxCount) * 100)}%"></div></div><div class="dist-count">${oportunidades.length}</div></div>
        </div>
      </div>

      <!-- Análise interpretativa -->
      <div class="analysis-box">${execAnalysis}</div>
    </div>

    <!-- MAPA DE CRITICIDADE -->
    ${nonConformFindings.length > 0 ? `
    <div class="section">
      <div class="section-title">Mapa de Criticidade por Cláusula</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Visão consolidada dos requisitos que apresentaram desvios, observações ou oportunidades de melhoria. Itens em <strong style="color:#EF4444">vermelho</strong> representam não conformidades, em <strong style="color:#F59E0B">laranja</strong> observações e em <strong style="color:#3B82F6">azul</strong> oportunidades de melhoria.</p>
      </div>
      <div class="crit-map">${critMapHtml}</div>
    </div>` : ""}

    <!-- PONTOS FORTES / ITENS CONFORMES -->
    ${conformes.length > 0 ? `
    <div class="section">
      <div class="section-title">Pontos Fortes — Itens Conformes (${conformes.length})</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Os itens abaixo demonstram aderência ao requisito normativo avaliado. A manutenção desses controles é fundamental para a sustentabilidade do sistema de gestão.</p>
      </div>
      <table>
        <thead><tr><th>Item</th><th>Norma</th><th>Requisito / Descrição</th><th>Evidência Avaliada</th><th>Status</th></tr></thead>
        <tbody>${conformesTableRows}</tbody>
      </table>
    </div>` : ""}

    <!-- NÃO CONFORMIDADES — Narrativa completa -->
    ${ncs.length > 0 ? `
    <div class="section">
      <div class="section-title">Não Conformidades (${ncs.length})</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>As não conformidades abaixo apresentam o encadeamento completo: <strong>requisito auditado → evidência objetiva → desvio constatado → classificação de risco</strong>. Cada constatação deve ser tratada com plano de ação corretiva formal.</p>
      </div>
      ${ncCardsHtml}
    </div>` : ""}

    <!-- OBSERVAÇÕES -->
    ${observacoes.length > 0 ? `
    <div class="section">
      <div class="section-title">Observações (${observacoes.length})</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Observações representam pontos de atenção que, embora não configurem não conformidade formal, indicam tendências ou fragilidades que podem evoluir para desvios se não monitoradas. Recomenda-se ação preventiva.</p>
      </div>
      ${obsCardsHtml}
    </div>` : ""}

    <!-- OPORTUNIDADES DE MELHORIA -->
    ${oportunidades.length > 0 ? `
    <div class="section">
      <div class="section-title">Oportunidades de Melhoria (${oportunidades.length})</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Oportunidades de melhoria identificadas durante a auditoria que podem contribuir para a evolução do sistema de gestão, ganho de eficiência operacional e fortalecimento da conformidade.</p>
      </div>
      ${oportCardsHtml}
    </div>` : ""}

    <!-- PLANO DE AÇÃO 5W2H -->
    ${ncs.length > 0 ? `
    <div class="section">
      <div class="section-title">Plano de Ação Corretiva — Método 5W2H</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Cada não conformidade deve ser tratada com o método 5W2H (O quê, Por quê, Quem, Quando, Onde, Como, Quanto custa), garantindo rastreabilidade e verificação de eficácia. Campos marcados como "A definir" devem ser preenchidos pelo responsável em até <strong>15 dias</strong> após o recebimento deste relatório.</p>
      </div>
      ${actionCardsHtml}
    </div>` : ""}

    <!-- RECOMENDAÇÕES À DIREÇÃO -->
    <div class="section">
      <div class="section-title">Recomendações à Direção — Priorização 30 / 60 / 90 Dias</div>
      <div class="analysis-box" style="margin-bottom:12px">
        <p>Com base nas constatações desta auditoria, seguem as recomendações priorizadas para atuação da liderança, organizadas por horizonte temporal de implementação.</p>
      </div>
      ${recsHtml}
    </div>

    <!-- CONCLUSÃO DA AUDITORIA -->
    <div class="section">
      <div class="section-title">Conclusão da Auditoria</div>
      <div class="conclusion-grid">
        <div class="conclusion-item"><div class="conclusion-number">1</div><div class="conclusion-text">Plano de auditoria foi cumprido?</div><div class="conclusion-checks">${checkbox(concl.planoCumprido)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">2</div><div class="conclusion-text">Ações corretivas e preventivas foram auditadas?</div><div class="conclusion-checks">${checkbox(concl.acoesAuditadas)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">3</div><div class="conclusion-text">Análise Crítica pela Alta Direção foi auditada?</div><div class="conclusion-checks">${checkbox(concl.analiseCriticaAuditada)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">4</div><div class="conclusion-text">Documentação atende à norma de referência?</div><div class="conclusion-checks">${checkbox(concl.documentacaoAtende)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">5</div><div class="conclusion-text">Houve algum obstáculo encontrado durante a auditoria?</div><div class="conclusion-checks">${checkbox(concl.obstaculoEncontrado)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">6</div><div class="conclusion-text">Os objetivos da auditoria foram atendidos dentro do escopo estabelecido?</div><div class="conclusion-checks">${checkbox(concl.objetivosAtendidos)}</div></div>
        <div class="conclusion-item"><div class="conclusion-number">7</div><div class="conclusion-text">As constatações confirmam que o sistema de gestão está estabelecido, implementado e mantido?</div><div class="conclusion-checks">${checkbox(concl.sistemaEstabelecido)}</div></div>
      </div>

      ${parecerHtml}

      <div class="lgpd-notice">Relatório em conformidade com a LGPD — Lei Geral de Proteção de Dados.</div>

      <div class="signature-area">
        <div class="signature-block"><div class="signature-line"></div><div class="signature-name">${escHtml(data.auditorLider)}</div><div class="signature-role">Auditor Líder</div></div>
        ${data.elaboradoPor ? `<div class="signature-block"><div class="signature-line"></div><div class="signature-name">${escHtml(data.elaboradoPor)}</div><div class="signature-role">Elaborado por</div></div>` : ""}
        ${data.aprovadoPor ? `<div class="signature-block"><div class="signature-line"></div><div class="signature-name">${escHtml(data.aprovadoPor)}</div><div class="signature-role">Aprovado por</div></div>` : ""}
      </div>
      <div style="text-align:center; margin-top:16px;"><div class="signature-date">${escHtml(data.unidade ?? data.empresa)}, ${formatDate(data.dataAuditoria)}</div></div>
    </div>

    <!-- QUALIFICAÇÃO DO AUDITOR -->
    ${data.qualificacaoAuditor ? `
    <div class="section">
      <div class="section-title">Qualificação do Auditor</div>
      <div class="analysis-box">${escHtml(data.qualificacaoAuditor).replace(/\n/g, "<br/>")}</div>
    </div>` : ""}

    <!-- RODAPÉ -->
    <div class="report-footer">
      <div class="footer-brand">CERTIFICA — Plataforma de Gestão de Compliance e Auditorias ISO</div>
      <div class="footer-conf">FORM 9.2-01${data.revisaoForm ? ` Rev. ${escHtml(data.revisaoForm)}` : ""} — Relatório de Auditoria Interna — Documento Confidencial</div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Exporta relatório completo de auditoria — modelo corporativo
 */
export function exportFullAuditReport(data: FullAuditReportData): void {
  const html = buildFullAuditReportHtml(data);
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) {
    console.warn("Pop-up bloqueado. Habilite pop-ups para exportar o relatório.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

/**
 * Converte transcrição de reunião em PdfDocument
 */
export function buildMeetingPdf(meeting: {
  titulo: string;
  data?: string;
  participantes?: string[];
  transcript: { time: string; speaker: string; text: string }[];
  acoes?: string[];
  resumo?: string;
}): PdfDocument {
  const transcriptText = meeting.transcript
    .map((t) => `[${t.time}] ${t.speaker}: ${t.text}`)
    .join("\n");

  return {
    title: `Transcrição de Reunião — ${meeting.titulo}`,
    subtitle: meeting.data ? `Data: ${meeting.data}` : undefined,
    sections: [
      {
        title: "Informações",
        content: [
          { "Título": meeting.titulo },
          { "Data": meeting.data ?? "—" },
          { "Participantes": (meeting.participantes ?? []).join(", ") || "—" },
        ],
      },
      ...(meeting.resumo ? [{
        title: "Resumo Executivo",
        type: "text" as const,
        content: meeting.resumo,
      }] : []),
      {
        title: "Transcrição Completa",
        type: "text" as const,
        content: transcriptText || "Transcrição não disponível.",
      },
      ...(meeting.acoes && meeting.acoes.length > 0 ? [{
        title: "Ações Identificadas",
        type: "text" as const,
        content: meeting.acoes.map((a, i) => `${i + 1}. ${a}`).join("\n"),
      }] : []),
    ],
  };
}

/**
 * Converte dados de relatório em PdfDocument
 */
export function buildReportPdf(report: {
  template: string;
  periodo: string;
  kpis: Record<string, string | number>;
  tableData?: Record<string, string | number>[];
  tableColumns?: string[];
  tableKeys?: string[];
  summary?: string;
}): PdfDocument {
  return {
    title: `Relatório — ${report.template}`,
    subtitle: `Período: ${report.periodo}`,
    sections: [
      {
        title: "KPIs",
        content: Object.entries(report.kpis).map(([k, v]) => ({ [k]: v })),
      },
      ...(report.tableData && report.tableData.length > 0 ? [{
        title: "Consolidado",
        type: "table" as const,
        content: report.tableData,
        columns: report.tableColumns ?? Object.keys(report.tableData[0] ?? {}),
        keys: report.tableKeys ?? Object.keys(report.tableData[0] ?? {}),
      }] : []),
      ...(report.summary ? [{
        title: "Análise",
        type: "text" as const,
        content: report.summary,
      }] : []),
    ],
  };
}
