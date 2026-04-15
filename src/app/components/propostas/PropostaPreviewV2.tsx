import React, { useRef, useCallback, useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { DSButton } from "../ds/DSButton";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import type { PropostaData } from "./PropostaPreview";

/* ═══════════════════════════════════════════════════════════════════════════════
   PROPOSTA V2 — REDESIGN
   Dark navy + azul Certifica, inspirado no DNA das 4 refs (dark, big type,
   pills, huge numbers, timeline), mantendo logo Certifica + foto signatarios +
   selos ISO + cases. Gera o PDF do zero com pdf-lib.
═══════════════════════════════════════════════════════════════════════════════ */

/* ── helpers ── */
function currency(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function ascii(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}
function valorExtenso(v: number): string {
  if (!v || isNaN(v)) return "";
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);
  const unidades = ["", "Um", "Dois", "Tres", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove",
    "Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove"];
  const dezenas = ["", "", "Vinte", "Trinta", "Quarenta", "Cinquenta", "Sessenta", "Setenta", "Oitenta", "Noventa"];
  const centenas = ["", "Cento", "Duzentos", "Trezentos", "Quatrocentos", "Quinhentos", "Seiscentos", "Setecentos", "Oitocentos", "Novecentos"];
  function grupo(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "Cem";
    const c = Math.floor(n / 100), resto = n % 100, dd = Math.floor(resto / 10), u = resto % 10;
    const p: string[] = [];
    if (c > 0) p.push(centenas[c]);
    if (resto > 0 && resto < 20) p.push(unidades[resto]);
    else { if (dd > 0) p.push(dezenas[dd]); if (u > 0) p.push(unidades[u]); }
    return p.join(" e ");
  }
  function inteiroPorExtenso(n: number): string {
    if (n === 0) return "";
    const mil = Math.floor(n / 1000), resto = n % 1000;
    const p: string[] = [];
    if (mil > 0) p.push(mil === 1 ? "Mil" : `${grupo(mil)} Mil`);
    if (resto > 0) p.push(grupo(resto));
    return p.join(" e ");
  }
  let r = "";
  if (inteiro > 0) r = inteiroPorExtenso(inteiro) + (inteiro === 1 ? " Real" : " Reais");
  if (centavos > 0) { if (inteiro > 0) r += " e "; r += grupo(centavos) + (centavos === 1 ? " Centavo" : " Centavos"); }
  return r;
}

/* ── DESIGN TOKENS ── */
const W = 960;
const H = 540;
const bg = rgb(0.043, 0.086, 0.145);        // #0B1625 navy quase preto
const bgAlt = rgb(0.071, 0.133, 0.212);     // #122236 card bg
const accent = rgb(0.12, 0.435, 0.659);     // #1F6FA8 azul Certifica
const accentLight = rgb(0.267, 0.596, 0.827); // #4498D3 brighter
const white = rgb(1, 1, 1);
const gray = rgb(0.686, 0.729, 0.812);      // #AFBACF texto secundario
const grayDark = rgb(0.361, 0.408, 0.494);  // #5B687E divisorias

/* ── path helpers ── */
const roundedRect = (page: PDFPage, x: number, y: number, w: number, h: number, r: number, fill?: any, stroke?: any, strokeWidth = 1) => {
  // pdf-lib doesn't have native rounded rect — draw manually via path
  // Simplest: use drawRectangle with no borders + circles for corners is ugly.
  // Best: use drawSvgPath.
  const path = `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  page.drawSvgPath(path, {
    x: 0, y: H,
    color: fill,
    borderColor: stroke,
    borderWidth: stroke ? strokeWidth : 0,
  });
};

const pill = (page: PDFPage, x: number, y: number, text: string, font: PDFFont, size: number, padX = 12, padY = 6, fill = accent, textColor = white) => {
  const tw = font.widthOfTextAtSize(text, size);
  const w = tw + padX * 2;
  const h = size + padY * 2;
  roundedRect(page, x, y, w, h, h / 2, fill);
  page.drawText(text, { x: x + padX, y: y + padY + 1, size, font, color: textColor });
  return w;
};

/* ── text helpers ── */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const cand = current ? current + " " + w : w;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth || !current) current = cand;
    else { lines.push(current); current = w; }
  }
  if (current) lines.push(current);
  return lines;
}
function fitOneLine(font: PDFFont, text: string, startSize: number, maxWidth: number): number {
  let s = startSize;
  while (s > 8 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

/* ── assets loader ── */
async function loadImage(pdf: PDFDocument, url: string): Promise<PDFImage> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}`);
  const bytes = await resp.arrayBuffer();
  return await pdf.embedJpg(bytes);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BUILD PDF
═══════════════════════════════════════════════════════════════════════════════ */
async function buildPdf(d: PropostaData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Load assets
  const [matteoPaulo, seloDfmea, casesGrid] = await Promise.all([
    loadImage(pdf, "/propostas/assets/matteo-paulo.jpg"),
    loadImage(pdf, "/propostas/assets/selo-dfmea.jpg"),
    loadImage(pdf, "/propostas/assets/cases-grid-1.jpg"),
  ]);

  const numero = ascii(d.numero);
  const empresa = ascii(d.clienteNome);
  const contato = ascii(d.clienteContato);
  const escopo = ascii(d.titulo);
  const cidade = ascii(d.clienteCidade);
  const dataFmt = ascii(formatDate(d.data));
  const dias = d.diasEstimados;
  const modalidade = ascii((d.modalidade || "PRESENCIAL").toUpperCase());
  const premissa = ascii(d.premissa);
  const restricao = ascii(d.restricao);
  const totalFmt = ascii(currency(d.valorTotal));
  const diarioFmt = ascii(currency(d.valorDiario));
  const extenso = ascii(valorExtenso(d.valorTotal));
  const consultor = ascii(d.consultor);
  const descProjeto = ascii(d.descricaoProjeto || "");
  const etapas = (d.etapas || []).map(ascii).filter(Boolean);

  /* ─────────────────────────────────────── PAGE 1 — CAPA ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    // Background navy
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    // Decorative huge "CERTIFICA" on background (outlined feel via very dark fill)
    p.drawText("CERTIFICA", {
      x: 40, y: 60, size: 140, font: bold,
      color: rgb(0.067, 0.118, 0.188), // slightly lighter than bg — like watermark
    });

    // Accent vertical stripe on right
    p.drawRectangle({ x: W - 160, y: 0, width: 160, height: H, color: bgAlt });

    // Photo Matteo+Paulo on right (cropped)
    const phW = 260, phH = 220;
    const phX = W - 290, phY = H - 280;
    // crop clip via clipping path — pdf-lib v1 doesn't support clip easily, draw as rectangle
    p.drawImage(matteoPaulo, { x: phX, y: phY, width: phW, height: phH });
    // overlay gradient-ish darkening (simulate with semi-transparent rect at bottom)
    p.drawRectangle({ x: phX, y: phY, width: phW, height: 60, color: bg, opacity: 0.6 });

    // Pill top-left: "PROPOSTA COMERCIAL"
    pill(p, 56, H - 60, "PROPOSTA COMERCIAL", bold, 9, 14, 7, accent, white);

    // Huge outlined "PROPOSTA" (fake outlined: draw text in bg color? no, draw in very subtle)
    // Actually draw filled white then draw number below in accent
    p.drawText("Proposta", {
      x: 52, y: H - 170, size: 62, font: bold, color: white,
    });
    // Big number in accent
    p.drawText(numero, {
      x: 52, y: H - 250, size: 68, font: bold, color: accentLight,
    });

    // Client card — pill-style
    const clienteLabel = "CLIENTE";
    p.drawText(clienteLabel, { x: 56, y: H - 310, size: 8, font: bold, color: gray });
    const empresaSize = fitOneLine(bold, empresa, 22, 500);
    p.drawText(empresa, { x: 56, y: H - 340, size: empresaSize, font: bold, color: white });
    p.drawText(contato, { x: 56, y: H - 362, size: 12, font: helv, color: gray });

    // Escopo em blockquote-ish
    p.drawRectangle({ x: 56, y: H - 420, width: 3, height: 40, color: accentLight });
    const escopoLines = wrapText(helv, escopo, 11, 480).slice(0, 3);
    escopoLines.forEach((ln, i) => {
      p.drawText(ln, { x: 68, y: H - 395 - i * 14, size: 11, font: helv, color: gray });
    });

    // Footer: date pill + consultor
    pill(p, 56, 40, `${cidade}, ${dataFmt}`, helv, 9, 12, 6, bgAlt, gray);
    p.drawText("CERTIFICA GESTAO DE SISTEMAS", { x: 56, y: 22, size: 7, font: bold, color: accentLight });
  }

  /* ─────────────────────────────────────── PAGE 2 — SOBRE / CASES ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    // Header pill
    pill(p, 56, H - 60, "#01 SOBRE NOS", bold, 9, 14, 7, accent, white);

    // Big title
    p.drawText("Um pouco sobre a", { x: 52, y: H - 110, size: 18, font: helv, color: gray });
    p.drawText("Certifica.", { x: 52, y: H - 150, size: 42, font: bold, color: white });

    // Body
    const body1 = "A Certifica possui em seu quadro de colaboradores, profissionais com mais de 20 anos de experiencia. Atuamos em todas as areas da gestao: qualidade, meio ambiente, saude e seguranca, eficiencia energetica, qualidade automotiva, ESG, etc.";
    const body2 = "Mais de 735 empresas auditadas e certificadas em todo o mundo. Atraves desse know-how diferenciado, levamos as empresas a capacidade de implementar sistemas de gestao com muita eficiencia e eficacia.";

    wrapText(helv, body1, 10, 420).forEach((ln, i) =>
      p.drawText(ln, { x: 52, y: H - 185 - i * 14, size: 10, font: helv, color: gray }));
    wrapText(helv, body2, 10, 420).slice(0, 4).forEach((ln, i) =>
      p.drawText(ln, { x: 52, y: H - 270 - i * 14, size: 10, font: helv, color: gray }));

    // Big number stats
    p.drawText("735+", { x: 52, y: 100, size: 52, font: bold, color: accentLight });
    p.drawText("EMPRESAS CERTIFICADAS", { x: 52, y: 78, size: 8, font: bold, color: gray });
    p.drawText("20+", { x: 220, y: 100, size: 52, font: bold, color: accentLight });
    p.drawText("ANOS DE EXPERIENCIA", { x: 220, y: 78, size: 8, font: bold, color: gray });

    // Cases grid at right
    const cgW = 360, cgH = 360 * (634 / 1700);
    p.drawImage(casesGrid, { x: W - 420, y: H - 310, width: cgW, height: cgH });
    p.drawText("QUEM JA CONFIA", { x: W - 420, y: H - 325, size: 8, font: bold, color: accentLight });

    drawFooter(p, helv, bold);
  }

  /* ─────────────────────────────────────── PAGE 3 — ESCOPO / PROJETO ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    pill(p, 56, H - 60, "#02 PROJETO", bold, 9, 14, 7, accent, white);
    p.drawText("Escopo &", { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText("Objetivos", { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });

    // Description block
    const descBox = { x: 52, y: H - 280, w: 550, h: 90 };
    roundedRect(p, descBox.x, descBox.y, descBox.w, descBox.h, 8, bgAlt);
    p.drawText("DESCRICAO DO PROJETO", { x: descBox.x + 16, y: descBox.y + descBox.h - 20, size: 8, font: bold, color: accentLight });
    const descLines = wrapText(helv, descProjeto, 10, descBox.w - 32).slice(0, 4);
    descLines.forEach((ln, i) =>
      p.drawText(ln, { x: descBox.x + 16, y: descBox.y + descBox.h - 38 - i * 13, size: 10, font: helv, color: gray }));

    // Modalidade + Dias pills on right
    pill(p, W - 340, H - 120, `MODALIDADE: ${modalidade}`, bold, 9, 14, 7, bgAlt, white);
    pill(p, W - 340, H - 150, `CARGA HORARIA: ${dias} DIAS`, bold, 9, 14, 7, accent, white);

    // Selo DFMEA at right bottom
    p.drawImage(seloDfmea, { x: W - 180, y: 60, width: 130, height: 130 * (486 / 515) });

    // Premissa / Restricao cards
    const cardY = 80, cardH = 110, cardW = 250;
    roundedRect(p, 52, cardY, cardW, cardH, 8, bgAlt);
    p.drawText("PREMISSAS", { x: 68, y: cardY + cardH - 20, size: 8, font: bold, color: accentLight });
    wrapText(helv, premissa, 9, cardW - 32).slice(0, 4).forEach((ln, i) =>
      p.drawText(ln, { x: 68, y: cardY + cardH - 38 - i * 12, size: 9, font: helv, color: gray }));

    roundedRect(p, 320, cardY, cardW, cardH, 8, bgAlt);
    p.drawText("RESTRICOES", { x: 336, y: cardY + cardH - 20, size: 8, font: bold, color: accentLight });
    wrapText(helv, restricao, 9, cardW - 32).slice(0, 4).forEach((ln, i) =>
      p.drawText(ln, { x: 336, y: cardY + cardH - 38 - i * 12, size: 9, font: helv, color: gray }));

    drawFooter(p, helv, bold);
  }

  /* ─────────────────────────────────────── PAGE 4 — ETAPAS / TIMELINE ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    pill(p, 56, H - 60, "#03 METODOLOGIA", bold, 9, 14, 7, accent, white);
    p.drawText("Etapas do", { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText("Projeto.", { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });

    // Timeline of steps
    const startY = H - 210;
    const lineH = 38;
    etapas.slice(0, 8).forEach((e, i) => {
      const y = startY - i * lineH;
      // circle with number
      const cx = 70, cy = y + 12, r = 14;
      p.drawCircle({ x: cx, y: cy, size: r, color: accent });
      const num = String(i + 1).padStart(2, "0");
      const numW = bold.widthOfTextAtSize(num, 11);
      p.drawText(num, { x: cx - numW / 2, y: cy - 4, size: 11, font: bold, color: white });
      // line connecting (except last)
      if (i < Math.min(etapas.length, 8) - 1) {
        p.drawLine({
          start: { x: cx, y: cy - r }, end: { x: cx, y: cy - lineH + r },
          thickness: 1.5, color: grayDark,
        });
      }
      // text
      const line = wrapText(helv, e, 11, 720)[0] || "";
      p.drawText(line, { x: 100, y: cy - 4, size: 11, font: helv, color: white });
    });

    drawFooter(p, helv, bold);
  }

  /* ─────────────────────────────────────── PAGE 5 — INVESTIMENTO ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    pill(p, 56, H - 60, "#04 INVESTIMENTO", bold, 9, 14, 7, accent, white);
    p.drawText("Condicoes", { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText("Comerciais.", { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });

    // Huge price block
    const priceBoxX = 52, priceBoxY = 100, priceBoxW = 560, priceBoxH = 220;
    roundedRect(p, priceBoxX, priceBoxY, priceBoxW, priceBoxH, 12, bgAlt);

    p.drawText("INVESTIMENTO TOTAL", { x: priceBoxX + 28, y: priceBoxY + priceBoxH - 32, size: 9, font: bold, color: accentLight });

    // Main price — huge
    const priceSize = fitOneLine(bold, totalFmt, 92, priceBoxW - 56);
    p.drawText(totalFmt, {
      x: priceBoxX + 28, y: priceBoxY + priceBoxH - 130,
      size: priceSize, font: bold, color: white,
    });

    // Extenso
    const extensoLines = wrapText(helv, `(${extenso})`, 11, priceBoxW - 56).slice(0, 2);
    extensoLines.forEach((ln, i) =>
      p.drawText(ln, { x: priceBoxX + 28, y: priceBoxY + 58 - i * 14, size: 11, font: oblique, color: gray }));

    // Breakdown
    p.drawText(`MO: ${diarioFmt} x ${dias} dias`, { x: priceBoxX + 28, y: priceBoxY + 28, size: 10, font: helv, color: gray });

    // Side info cards
    const sideX = W - 330, sideW = 280;
    const si1Y = H - 220, si2Y = si1Y - 80, si3Y = si2Y - 80;
    [
      { y: si1Y, label: "PRAZO DE PAGAMENTO", value: ascii(d.condicoes || "30 dias da NF") },
      { y: si2Y, label: "PARCELAS", value: `${d.parcelas}x ${ascii(currency(d.valorParcela))}` },
      { y: si3Y, label: "CARGA HORARIA", value: `${dias} dias` },
    ].forEach(it => {
      roundedRect(p, sideX, it.y, sideW, 60, 8, bgAlt);
      p.drawText(it.label, { x: sideX + 16, y: it.y + 40, size: 8, font: bold, color: accentLight });
      const vs = fitOneLine(bold, it.value, 16, sideW - 32);
      p.drawText(it.value, { x: sideX + 16, y: it.y + 14, size: vs, font: bold, color: white });
    });

    drawFooter(p, helv, bold);
  }

  /* ─────────────────────────────────────── PAGE 6 — ASSINATURAS ─────────────────────────────────────── */
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });

    pill(p, 56, H - 60, "#05 ACEITE", bold, 9, 14, 7, accent, white);
    p.drawText("Vamos juntos?", { x: 52, y: H - 120, size: 42, font: bold, color: white });

    // Foto Matteo+Paulo at right
    const phW = 360, phH = 360 * (1080 / 1920);
    p.drawImage(matteoPaulo, { x: W - 420, y: H - 280, width: phW, height: phH });

    // Date line
    p.drawText(`${cidade}, ${dataFmt}`, { x: 52, y: 240, size: 11, font: helv, color: gray });

    // Signer card
    const sigW = 360, sigH = 120;
    roundedRect(p, 52, 80, sigW, sigH, 10, bgAlt);
    p.drawText("CONSULTOR RESPONSAVEL", { x: 68, y: 80 + sigH - 24, size: 8, font: bold, color: accentLight });
    const cs = fitOneLine(bold, consultor, 22, sigW - 32);
    p.drawText(consultor, { x: 68, y: 80 + 28, size: cs, font: bold, color: white });
    p.drawText("Certifica Gestao de Sistemas", { x: 68, y: 80 + 12, size: 9, font: helv, color: gray });

    drawFooter(p, helv, bold);
  }

  return pdf.save();
}

function drawFooter(p: PDFPage, helv: PDFFont, bold: PDFFont) {
  // divider line
  p.drawLine({
    start: { x: 52, y: 40 }, end: { x: W - 52, y: 40 },
    thickness: 0.5, color: grayDark,
  });
  p.drawText("CERTIFICA GESTAO DE SISTEMAS", { x: 52, y: 22, size: 7, font: bold, color: accentLight });
  p.drawText("www.certificags.com.br", { x: W - 180, y: 22, size: 7, font: helv, color: gray });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
interface Props {
  data: PropostaData;
  onClose: () => void;
}

export default function PropostaPreviewV2({ data, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const handlePrint = useCallback(() => { frameRef.current?.contentWindow?.print(); }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const modified = await buildPdf(data);
        if (cancelled) return;
        const blob = new Blob([modified], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e.message || "Erro ao gerar PDF");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: "rgba(11,22,37,0.85)" }}>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-certifica-200 shadow-sm">
        <span className="text-[13px] text-certifica-900 font-semibold">
          Proposta {data.numero} — {data.clienteNome || data.clienteRazaoSocial}
          <span className="ml-2 text-[10px] text-certifica-500 font-normal">[V2 — novo design]</span>
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
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
        )}
        {pdfUrl && (
          <iframe
            ref={frameRef}
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Proposta Preview V2"
          />
        )}
        {!pdfUrl && !error && (
          <div className="flex items-center justify-center h-full text-white/60 text-sm">Gerando proposta...</div>
        )}
      </div>
    </div>
  );
}
