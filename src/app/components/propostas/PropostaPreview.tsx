import React, { useRef, useCallback, useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { DSButton } from "../ds/DSButton";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFName,
  PDFRawStream,
  PDFPage,
  PDFFont,
} from "pdf-lib";

/* ─────────────────────────────────────────────────────────────────────────────
   INTERFACE
───────────────────────────────────────────────────────────────────────────── */

export interface PropostaData {
  numero: string;
  data: string;
  validade: string;
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
  titulo: string;
  norma: string;
  escopo: string;
  descricaoProjeto?: string;
  modalidade?: string;
  diasEstimados: number;
  etapas: string[];
  premissa: string;
  restricao: string;
  valorDiario: number;
  valorTotal: number;
  parcelas: number;
  valorParcela: number;
  condicoes: string;
  codigoServicoNf?: string;
  despesasViagem?: string;
  despesasAlimentacao?: string;
  consultor: string;
  observacoes: string;
}

interface Props {
  data: PropostaData;
  onClose: () => void;
}

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

function valorExtenso(v: number): string {
  if (!v || isNaN(v)) return "";
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);
  if (inteiro === 0 && centavos === 0) return "Zero Reais";
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
    const milhoes = Math.floor(n / 1000000), restoM = n % 1000000;
    const mil = Math.floor(restoM / 1000), resto = restoM % 1000;
    const p: string[] = [];
    if (milhoes > 0) p.push(milhoes === 1 ? "Um Milhao" : `${grupo(milhoes)} Milhoes`);
    if (mil > 0) p.push(mil === 1 ? "Mil" : `${grupo(mil)} Mil`);
    if (resto > 0) p.push(grupo(resto));
    return p.join(" e ");
  }
  let r = "";
  if (inteiro > 0) { r = inteiroPorExtenso(inteiro) + (inteiro === 1 ? " Real" : " Reais"); }
  if (centavos > 0) { if (inteiro > 0) r += " e "; r += grupo(centavos) + (centavos === 1 ? " Centavo" : " Centavos"); }
  return r;
}

/* ── ASCII-safe (strip accents; Helvetica std can't render some Unicode) ── */
function ascii(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

/* ─────────────────────────────────────────────────────────────────────────────
   PDF TEMPLATE PATH
───────────────────────────────────────────────────────────────────────────── */
const PDF_TEMPLATE_URL = "/Proposta 155-2026.pdf";

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────────── */

export default function PropostaPreview({ data, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const handlePrint = useCallback(() => { frameRef.current?.contentWindow?.print(); }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const resp = await fetch(PDF_TEMPLATE_URL);
        if (!resp.ok) throw new Error(`Nao consegui carregar o PDF template (${resp.status})`);
        const pdfBytes = await resp.arrayBuffer();
        const modified = await buildPdf(new Uint8Array(pdfBytes), data);
        if (cancelled) return;
        const blob = new Blob([modified], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erro ao gerar PDF");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: "rgba(14,42,71,0.65)" }}>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-certifica-200 shadow-sm">
        <span className="text-[13px] text-certifica-900 font-semibold">
          Proposta {data.numero} — {data.clienteNome || data.clienteRazaoSocial}
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
            title="Proposta Preview"
          />
        )}
        {!pdfUrl && !error && (
          <div className="flex items-center justify-center h-full text-white/60 text-sm">Gerando proposta...</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FLATE via browser streams
═══════════════════════════════════════════════════════════════════════════════ */

async function inflateFlate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new (globalThis as any).DecompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function deflateFlate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new (globalThis as any).CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

function latin1Decode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function latin1Encode(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CONTENT STREAM SURGERY
   Blank BT...ET blocks whose Tm coordinates match our target list.
═══════════════════════════════════════════════════════════════════════════════ */

interface CoordRule {
  x?: number; // optional — if present, block must start at this X
  y: number;
  tol?: number; // tolerance on x (default 0.5)
}

function blockMatches(block: string, rules: CoordRule[]): boolean {
  // Find all "1 0 0 1 X Y Tm" inside the block
  const tmRe = /1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s+Tm/g;
  let m: RegExpExecArray | null;
  while ((m = tmRe.exec(block)) !== null) {
    const bx = parseFloat(m[1]);
    const by = parseFloat(m[2]);
    for (const r of rules) {
      if (Math.abs(by - r.y) > 0.05) continue;
      if (r.x === undefined) return true;
      const tol = r.tol ?? 0.5;
      if (Math.abs(bx - r.x) <= tol) return true;
    }
  }
  return false;
}

function blankMatchingBTBlocks(stream: string, rules: CoordRule[]): string {
  // Match BT ... ET. Simple non-greedy (PDF content streams rarely have
  // "ET" appearing inside strings, and if they do it's escaped).
  return stream.replace(/BT\b[\s\S]*?\bET/g, (block) => {
    if (!blockMatches(block, rules)) return block;
    // Blank all TJ operand arrays and Tj strings within this block.
    return block
      .replace(/\[[^\]]*\]\s*TJ/g, "[] TJ")
      .replace(/\([^)]*\)\s*Tj/g, "() Tj");
  });
}

async function blankPageBlocks(
  pdf: PDFDocument,
  page: PDFPage,
  rules: CoordRule[],
): Promise<void> {
  const context = pdf.context;
  const Contents = (page.node as any).Contents?.() ?? (page.node as any).get?.(PDFName.of("Contents"));
  if (!Contents) return;

  // Build list of stream objects to touch
  const streams: any[] = [];
  const resolve = (obj: any) => {
    if (!obj) return null;
    const name = obj.constructor?.name || "";
    if (name === "PDFRef") return context.lookup(obj);
    return obj;
  };

  const top = resolve(Contents);
  if (!top) return;
  if (top.constructor?.name === "PDFArray") {
    for (let i = 0; i < top.size(); i++) {
      const item = resolve(top.get(i));
      if (item) streams.push(item);
    }
  } else {
    streams.push(top);
  }

  for (const stream of streams) {
    const rawBytes: Uint8Array | undefined = stream.contents;
    if (!rawBytes) continue;

    const dict = stream.dict;
    const filter = dict.get(PDFName.of("Filter"));
    const filterStr = filter ? filter.toString() : "";
    const isFlate = filterStr.includes("FlateDecode");

    let decoded: Uint8Array;
    if (isFlate) {
      try {
        decoded = await inflateFlate(rawBytes);
      } catch {
        continue;
      }
    } else {
      decoded = rawBytes;
    }

    const text = latin1Decode(decoded);
    const newText = blankMatchingBTBlocks(text, rules);
    if (newText === text) continue;

    const newBytes = latin1Encode(newText);
    if (isFlate) {
      const compressed = await deflateFlate(newBytes);
      (stream as any).contents = compressed;
    } else {
      (stream as any).contents = newBytes;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEXT DRAWING HELPERS
═══════════════════════════════════════════════════════════════════════════════ */

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number, y: number,
  maxWidth: number, lineHeight: number,
  size: number, font: PDFFont,
  color: ReturnType<typeof rgb>,
  maxLines = 99,
) {
  const lines = wrapText(font, ascii(text), size, maxWidth).slice(0, maxLines);
  lines.forEach((ln, i) => {
    page.drawText(ln, { x, y: y - i * lineHeight, size, font, color });
  });
}

function fitOneLine(font: PDFFont, text: string, startSize: number, maxWidth: number): number {
  let size = startSize;
  while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PDF BUILDER
═══════════════════════════════════════════════════════════════════════════════ */

async function buildPdf(templateBytes: Uint8Array, d: PropostaData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  // Colors pulled from original content streams
  const navy = rgb(0.0902, 0.282, 0.376);   // "0.0902 0.282 0.376 rg" — title
  const navy2 = rgb(0.114, 0.18, 0.31);      // "0.114 0.18 0.31 rg"    — escopo/empresa
  const blue = rgb(0.184, 0.333, 0.592);     // "0.184 0.333 0.592 rg"  — section headers
  const gray = rgb(0.149, 0.149, 0.149);     // "0.149 g"                — labels
  const darkText = rgb(0.349, 0.349, 0.349); // "0.349 g"                — body text
  const white = rgb(1, 1, 1);

  // Prepare values (all ASCII-safe for Helvetica)
  const numero = ascii(d.numero || "—");
  const empresa = ascii(d.clienteNome || d.clienteRazaoSocial || "—");
  const contato = ascii(d.clienteContato || "—");
  const escopo = ascii(d.titulo || d.escopo || "—");
  const cidade = ascii(d.clienteCidade || "Sorocaba");
  const dataFmt = ascii(formatDate(d.data));
  const dias = d.diasEstimados || 0;
  const modalidade = ascii((d.modalidade || "PRESENCIAL").toUpperCase());
  const premissa = ascii(d.premissa || "");
  const restricao = ascii(d.restricao || "");
  const totalFmt = ascii(currency(d.valorTotal));
  const diarioFmt = ascii(currency(d.valorDiario));
  const extenso = ascii(valorExtenso(d.valorTotal));
  const consultor = ascii(d.consultor || "Paulo Mendonca");
  const descProjeto = ascii(d.descricaoProjeto || d.escopo || "");
  const etapas = (d.etapas || []).map(ascii).filter(Boolean);

  /* ─────────────────────────────────────────────────────────────────────────
     PAGE 2 — Cover (Proposta NNN-AAAA + data + escopo + empresa + contato)
  ───────────────────────────────────────────────────────────────────────── */
  {
    const p = pages[1];
    await blankPageBlocks(pdf, p, [
      { y: 409.27 }, // title line "Proposta 155-2026"
      { y: 373.49 }, // date line "Sorocaba, 02 de abril de 2026"
      { y: 250.44 }, // escopo line 1
      { y: 221.64 }, // escopo line 2
      { y: 168.02 }, // empresa "APEX Tools"
      { y: 109.51 }, // contato "Juliana"
    ]);

    // Title
    const titleText = `Proposta ${numero}`;
    const titleSize = fitOneLine(helveticaBold, titleText, 32, 380);
    p.drawText(titleText, { x: 78.504, y: 409.27, size: titleSize, font: helveticaBold, color: navy });

    // Date
    p.drawText(`${cidade}, ${dataFmt}`, {
      x: 78.504, y: 373.49, size: 18, font: helvetica, color: navy,
    });

    // Escopo — wrap up to 2 lines (baseline of line 1 = 250.44, line 2 ≈ 221.64)
    const escopoLines = wrapText(helveticaBold, escopo, 20, 530).slice(0, 2);
    escopoLines.forEach((ln, i) => {
      p.drawText(ln, {
        x: 361.7, y: 250.44 - i * 28.8, size: 20, font: helveticaBold, color: navy2,
      });
    });

    // Empresa
    const empresaSize = fitOneLine(helveticaBold, empresa, 22, 500);
    p.drawText(empresa, { x: 366.7, y: 168.02, size: empresaSize, font: helveticaBold, color: navy2 });

    // Contato
    const contatoSize = fitOneLine(helvetica, contato, 18, 500);
    p.drawText(contato, { x: 366.7, y: 109.51, size: contatoSize, font: helvetica, color: gray });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PAGE 14 — Projeto + Detalhamento (etapas) + card Carga/Premissa/Restricao
  ───────────────────────────────────────────────────────────────────────── */
  {
    const p = pages[13];
    await blankPageBlocks(pdf, p, [
      { y: 441.89 }, // projeto line 1
      { y: 423.41 }, // projeto line 2
      { y: 367.37 }, // descricao + PRESENCIAL line 1
      { y: 348.89 }, // descricao line 2
      { y: 288.31 }, { y: 270.29 },
      { y: 234.29 }, { y: 216.29 },
      { y: 180.29 }, { y: 162.38 },
      { y: 126.38 }, { y: 90.384 },
      { y: 54.36 },
      { y: 268.7 },  // carga horaria card
      { y: 227.26 }, { y: 214.06 }, // premissa
      { y: 181.73 }, // restricao
    ]);

    // Projeto: descricao (2 lines max)
    const projLines = wrapText(helvetica, descProjeto, 11, 660).slice(0, 2);
    projLines.forEach((ln, i) => {
      p.drawText(ln, { x: 53.208, y: 441.89 - i * 16, size: 11, font: helvetica, color: darkText });
    });

    // Detalhamento intro — fixed text + modalidade highlight
    const introA = `Consultoria tecnica especializada de forma `;
    const introB = modalidade;
    const introC = `, contemplando:`;
    const aw = helvetica.widthOfTextAtSize(introA, 11);
    const bw = helveticaBold.widthOfTextAtSize(introB, 11);
    p.drawText(introA, { x: 53.208, y: 367.37, size: 11, font: helvetica, color: darkText });
    p.drawText(introB, { x: 53.208 + aw, y: 367.37, size: 11, font: helveticaBold, color: darkText });
    p.drawText(introC, { x: 53.208 + aw + bw, y: 367.37, size: 11, font: helvetica, color: darkText });

    // Etapas — bullet list starting at y=288.31, line height 18
    const bulletYStart = 288.31;
    const bulletLineH = 20;
    const maxEtapas = 9;
    etapas.slice(0, maxEtapas).forEach((etapa, i) => {
      const y = bulletYStart - i * bulletLineH;
      if (y < 54) return;
      // bullet
      p.drawText("v", { x: 57.2, y, size: 11, font: helvetica, color: blue });
      // text (truncate to 1 line)
      const line = wrapText(helvetica, etapa + ";", 11, 620)[0] || "";
      p.drawText(line, { x: 75.768, y, size: 11, font: helvetica, color: darkText });
    });

    // Card lateral — Carga horaria: N dias (yellow highlight background exists)
    p.drawText(`Carga horaria: ${dias} dias`, {
      x: 725.62, y: 268.7, size: 14, font: helveticaBold, color: navy2,
    });

    // Premissa (2 lines)
    const premLines = wrapText(helvetica, `Premissa: ${premissa}`, 9, 200).slice(0, 2);
    premLines.forEach((ln, i) => {
      p.drawText(ln, { x: 720.24, y: 227.26 - i * 12, size: 9, font: helvetica, color: navy2 });
    });

    // Restricao (1 line)
    const restLine = wrapText(helvetica, `Restricao: ${restricao}`, 9, 200)[0] || "";
    p.drawText(restLine, { x: 720.24, y: 181.73, size: 9, font: helvetica, color: navy2 });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PAGE 15 — Condicoes comerciais (MO + TOTAL + extenso + card)
  ───────────────────────────────────────────────────────────────────────── */
  {
    const p = pages[14];
    await blankPageBlocks(pdf, p, [
      { y: 398.64 }, // MO line
      { y: 353.74 }, // TOTAL: R$ ...
      { y: 317.02 }, // extenso
      { y: 268.7 },  // carga card
      { y: 227.26 }, { y: 214.06 }, // premissa
      { y: 181.73 }, // restricao
    ]);

    // MO: R$ X,00 x N = R$ Y,00 — over yellow highlight
    const moLine = d.valorDiario > 0
      ? `MO: ${diarioFmt} x ${dias} = ${totalFmt}`
      : `Total: ${totalFmt}`;
    p.drawText(moLine, {
      x: 87.696, y: 398.64, size: 18, font: helveticaBold, color: navy2,
    });

    // TOTAL: R$ ... — huge line
    p.drawText(`TOTAL: ${totalFmt}`, {
      x: 87.696, y: 353.74, size: 28, font: helveticaBold, color: navy2,
    });

    // Extenso "(...)"
    p.drawText(`(${extenso})`, {
      x: 87.696, y: 317.02, size: 14, font: helvetica, color: navy2,
    });

    // Card lateral — same as p14
    p.drawText(`Carga horaria: ${dias} dias`, {
      x: 725.62, y: 268.7, size: 14, font: helveticaBold, color: navy2,
    });

    const premLines2 = wrapText(helvetica, `Premissa: ${premissa}`, 9, 200).slice(0, 2);
    premLines2.forEach((ln, i) => {
      p.drawText(ln, { x: 720.24, y: 227.26 - i * 12, size: 9, font: helvetica, color: navy2 });
    });

    const restLine2 = wrapText(helvetica, `Restricao: ${restricao}`, 9, 200)[0] || "";
    p.drawText(restLine2, { x: 720.24, y: 181.73, size: 9, font: helvetica, color: navy2 });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PAGE 17 — Consideracoes finais (data + consultor)
  ───────────────────────────────────────────────────────────────────────── */
  {
    const p = pages[16];
    await blankPageBlocks(pdf, p, [
      { y: 200.64 }, // date line "Sorocaba, 02 de Abril de 2026"
      { y: 101.06 }, // signer "Paulo Mendonca"
    ]);

    p.drawText(`${cidade}, ${dataFmt}`, {
      x: 111.98, y: 200.64, size: 11, font: helvetica, color: darkText,
    });

    // Center signer around original x≈184.03 (original length ~"Paulo Mendonca")
    const signerSize = 16;
    const signerWidth = helveticaBold.widthOfTextAtSize(consultor, signerSize);
    const originalCenter = 184.03 + helveticaBold.widthOfTextAtSize("Paulo Mendonca", signerSize) / 2;
    p.drawText(consultor, {
      x: originalCenter - signerWidth / 2,
      y: 101.06, size: signerSize, font: helveticaBold, color: navy2,
    });
  }

  const modifiedBytes = await pdf.save();
  return modifiedBytes;
}
