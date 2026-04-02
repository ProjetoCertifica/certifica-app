import React, { useRef, useCallback } from "react";
import { X, Printer } from "lucide-react";
import { DSButton } from "../ds/DSButton";

export interface PropostaData {
  numero: string;
  data: string;
  validade: string;
  /* cliente */
  clienteNome: string;
  clienteRazaoSocial: string;
  clienteCnpj: string;
  clienteEndereco: string;
  clienteCidade: string;
  clienteUf: string;
  clienteContato: string;
  clienteContatoCargo: string;
  clienteContatoEmail: string;
  clienteContatoTelefone: string;
  /* proposta */
  titulo: string;
  norma: string;
  escopo: string;
  diasEstimados: number;
  etapas: string[];
  /* financeiro */
  valorTotal: number;
  parcelas: number;
  valorParcela: number;
  condicoes: string;
  /* consultor */
  consultor: string;
  observacoes: string;
}

function currency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

interface Props {
  data: PropostaData;
  onClose: () => void;
}

export default function PropostaPreview({ data, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = useCallback(() => {
    frameRef.current?.contentWindow?.print();
  }, []);

  const html = buildHtml(data);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-certifica-dark/60">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-certifica-200 shadow-sm">
        <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
          Proposta {data.numero} — Preview
        </span>
        <div className="flex items-center gap-2">
          <DSButton variant="primary" size="sm" icon={<Printer className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={handlePrint}>
            Imprimir / Salvar PDF
          </DSButton>
          <button onClick={onClose} className="p-1.5 text-certifica-500 hover:text-certifica-700 cursor-pointer">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {/* preview */}
      <div className="flex-1 overflow-auto flex justify-center py-6 bg-certifica-100">
        <iframe
          ref={frameRef}
          srcDoc={html}
          className="bg-white shadow-lg rounded-[4px]"
          style={{ width: "210mm", minHeight: "297mm", border: "none" }}
          title="Proposta Preview"
        />
      </div>
    </div>
  );
}

/** Escape HTML entities to prevent XSS */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(d: PropostaData): string {
  const etapasHtml = d.etapas
    .filter(Boolean)
    .map((e, i) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;width:40px;text-align:center;">${i + 1}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">${esc(e)}</td></tr>`)
    .join("");

  const parcelasHtml = d.parcelas > 1
    ? `<p style="font-size:13px;color:#374151;margin:4px 0;">
        ${d.parcelas}x de <strong>${currency(d.valorParcela)}</strong>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Proposta ${d.numero}</title>
<style>
  @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; color:#1f2937; line-height:1.5; }
  .page { padding: 20mm 18mm; }
  @media print { .page { padding: 0; } }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:16px; border-bottom:3px solid #0E2A47; }
  .brand { font-size:22px; font-weight:700; color:#0E2A47; letter-spacing:-0.02em; }
  .brand-sub { font-size:11px; color:#6b7280; margin-top:2px; }
  .doc-info { text-align:right; font-size:11px; color:#6b7280; }
  .doc-info strong { color:#0E2A47; font-size:13px; }
  .section { margin-bottom:20px; }
  .section-title { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#0E2A47; font-weight:700; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; font-size:13px; }
  .info-label { color:#6b7280; font-size:11px; }
  .info-value { color:#1f2937; font-weight:500; }
  .scope-text { font-size:13px; color:#374151; white-space:pre-wrap; }
  .price-box { background:#f0f7fa; border:1px solid #b8dde9; border-radius:6px; padding:16px 20px; text-align:center; }
  .price-big { font-size:28px; font-weight:700; color:#0E2A47; }
  .price-label { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.06em; }
  .conditions { font-size:12px; color:#374151; background:#fafafa; border:1px solid #e5e7eb; border-radius:4px; padding:10px 14px; margin-top:8px; }
  .obs { font-size:12px; color:#6b7280; font-style:italic; }
  .footer { margin-top:40px; padding-top:16px; border-top:2px solid #0E2A47; display:flex; justify-content:space-between; }
  .sig-block { text-align:center; width:45%; }
  .sig-line { border-top:1px solid #1f2937; margin-top:50px; padding-top:6px; font-size:12px; color:#374151; }
  .sig-role { font-size:10px; color:#6b7280; }
  .validity { text-align:center; font-size:11px; color:#6b7280; margin-top:20px; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">CERTIFICA</div>
      <div class="brand-sub">Gestao de Sistemas e Certificacoes</div>
    </div>
    <div class="doc-info">
      <strong>PROPOSTA COMERCIAL</strong><br>
      N. ${esc(d.numero)}<br>
      ${formatDate(d.data)}
    </div>
  </div>

  <!-- Cliente -->
  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="info-grid">
      <div><span class="info-label">Razao Social</span><br><span class="info-value">${esc(d.clienteRazaoSocial || d.clienteNome)}</span></div>
      <div><span class="info-label">CNPJ</span><br><span class="info-value">${esc(d.clienteCnpj) || "—"}</span></div>
      <div><span class="info-label">Endereco</span><br><span class="info-value">${esc([d.clienteEndereco, d.clienteCidade, d.clienteUf].filter(Boolean).join(", ")) || "—"}</span></div>
      <div><span class="info-label">Contato</span><br><span class="info-value">${esc(d.clienteContato) || "—"}${d.clienteContatoCargo ? " (" + esc(d.clienteContatoCargo) + ")" : ""}</span></div>
    </div>
  </div>

  <!-- Objeto -->
  <div class="section">
    <div class="section-title">Objeto da Proposta</div>
    <div class="info-grid" style="margin-bottom:8px;">
      <div><span class="info-label">Projeto</span><br><span class="info-value">${esc(d.titulo)}</span></div>
      <div><span class="info-label">Norma / Referencia</span><br><span class="info-value">${esc(d.norma) || "—"}</span></div>
      <div><span class="info-label">Prazo Estimado</span><br><span class="info-value">${d.diasEstimados} dias</span></div>
      <div><span class="info-label">Consultor Responsavel</span><br><span class="info-value">${esc(d.consultor)}</span></div>
    </div>
  </div>

  <!-- Escopo -->
  <div class="section">
    <div class="section-title">Escopo dos Servicos</div>
    <div class="scope-text">${esc(d.escopo) || "A definir em reuniao de kickoff."}</div>
  </div>

  ${etapasHtml ? `
  <!-- Etapas -->
  <div class="section">
    <div class="section-title">Etapas de Execucao</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:4px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">#</th><th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Etapa</th></tr></thead>
      <tbody>${etapasHtml}</tbody>
    </table>
  </div>` : ""}

  <!-- Investimento -->
  <div class="section">
    <div class="section-title">Investimento</div>
    <div class="price-box">
      <div class="price-label">Valor Total</div>
      <div class="price-big">${currency(d.valorTotal)}</div>
      ${parcelasHtml}
    </div>
    ${d.condicoes ? `<div class="conditions"><strong>Condições:</strong> ${esc(d.condicoes)}</div>` : ""}
  </div>

  ${d.observacoes ? `
  <!-- Observações -->
  <div class="section">
    <div class="section-title">Observacoes</div>
    <div class="obs">${esc(d.observacoes)}</div>
  </div>` : ""}

  <!-- Assinaturas -->
  <div class="footer">
    <div class="sig-block">
      <div class="sig-line">${esc(d.consultor)}</div>
      <div class="sig-role">Certifica Gestao de Sistemas</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">${esc(d.clienteContato || d.clienteNome)}</div>
      <div class="sig-role">${esc(d.clienteRazaoSocial || d.clienteNome)}</div>
    </div>
  </div>

  <div class="validity">
    Esta proposta tem validade ate <strong>${d.validade ? formatDate(d.validade) : "15 dias apos a emissao"}</strong>.
  </div>
</div>
</body>
</html>`;
}
