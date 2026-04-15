// Replicates buildPdf logic from PropostaPreview.tsx (Node 18+ with DecompressionStream)
import { PDFDocument, rgb, StandardFonts, PDFName, PDFRawStream } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const PDF_PATH = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master/public/Proposta 155-2026.pdf';
const OUT_PATH = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master/test-output.pdf';

const EXEMPLO = {
  numero: '156-2026',
  data: '2026-04-09',
  validade: '2026-05-09',
  clienteNome: 'Heineken Brasil',
  clienteRazaoSocial: 'Heineken Brasil S.A.',
  clienteContato: 'Carlos Silva',
  clienteCidade: 'Sorocaba',
  titulo: 'Implementacao ISO 14001:2015 - Sistema de Gestao Ambiental',
  norma: 'ISO 14001:2015',
  escopo: 'Implementacao ISO 14001:2015 - Sistema de Gestao Ambiental',
  descricaoProjeto: 'Consultoria para implementacao do Sistema de Gestao Ambiental conforme requisitos da norma ISO 14001:2015, incluindo levantamento de aspectos e impactos ambientais.',
  modalidade: 'PRESENCIAL',
  diasEstimados: 15,
  etapas: [
    'Diagnostico inicial do sistema de gestao ambiental atual',
    'Levantamento e classificacao de aspectos e impactos ambientais',
    'Elaboracao da politica ambiental e objetivos ambientais',
    'Desenvolvimento da documentacao obrigatoria',
    'Treinamento e capacitacao das equipes envolvidas',
    'Realizacao de auditoria interna',
    'Preparacao para auditoria de certificacao',
    'Demais atividades pertinentes ao escopo',
  ],
  premissa: 'disponibilizacao das equipes para apoio na implementacao. Cumprimento do plano.',
  restricao: 'internet, acidentes, doenca.',
  valorDiario: 1650,
  valorTotal: 24750,
  parcelas: 1,
  valorParcela: 24750,
  condicoes: '30 dias da NF',
  consultor: 'Paulo Mendonca',
};

function currency(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function ascii(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ''); }

function valorExtenso(v) { return 'Vinte e Quatro Mil Setecentos e Cinquenta Reais'; }

async function inflateFlate(bytes) {
  const cs = new DecompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(bytes); writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
async function deflateFlate(bytes) {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(bytes); writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
function latin1Decode(b) { let s=''; for (let i=0;i<b.length;i++) s += String.fromCharCode(b[i]); return s; }
function latin1Encode(s) { const o = new Uint8Array(s.length); for (let i=0;i<s.length;i++) o[i] = s.charCodeAt(i) & 0xff; return o; }

function blockMatches(block, rules) {
  const tmRe = /1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s+Tm/g;
  let m;
  while ((m = tmRe.exec(block)) !== null) {
    const bx = parseFloat(m[1]); const by = parseFloat(m[2]);
    for (const r of rules) {
      if (Math.abs(by - r.y) > 0.05) continue;
      if (r.x === undefined) return true;
      if (Math.abs(bx - r.x) <= (r.tol ?? 0.5)) return true;
    }
  }
  return false;
}
function blankMatchingBTBlocks(stream, rules) {
  return stream.replace(/BT\b[\s\S]*?\bET/g, (block) => {
    if (!blockMatches(block, rules)) return block;
    return block.replace(/\[[^\]]*\]\s*TJ/g, '[] TJ').replace(/\([^)]*\)\s*Tj/g, '() Tj');
  });
}

async function blankPageBlocks(pdf, page, rules) {
  const context = pdf.context;
  const Contents = page.node.Contents?.() ?? page.node.get(PDFName.of('Contents'));
  if (!Contents) return;
  const resolve = (obj) => obj?.constructor?.name === 'PDFRef' ? context.lookup(obj) : obj;
  const streams = [];
  const top = resolve(Contents);
  if (top?.constructor?.name === 'PDFArray') {
    for (let i = 0; i < top.size(); i++) { const it = resolve(top.get(i)); if (it) streams.push(it); }
  } else if (top) streams.push(top);
  for (const stream of streams) {
    const rawBytes = stream.contents;
    if (!rawBytes) continue;
    const filter = stream.dict.get(PDFName.of('Filter'));
    const isFlate = filter ? filter.toString().includes('FlateDecode') : false;
    let decoded;
    try { decoded = isFlate ? await inflateFlate(rawBytes) : rawBytes; } catch { continue; }
    const text = latin1Decode(decoded);
    const newText = blankMatchingBTBlocks(text, rules);
    if (newText === text) continue;
    const newBytes = latin1Encode(newText);
    stream.contents = isFlate ? await deflateFlate(newBytes) : newBytes;
  }
}

function wrapText(font, text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = []; let current = '';
  for (const w of words) {
    const cand = current ? current + ' ' + w : w;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth || !current) current = cand;
    else { lines.push(current); current = w; }
  }
  if (current) lines.push(current);
  return lines;
}
function fitOneLine(font, text, startSize, maxWidth) {
  let s = startSize;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

async function buildPdf(templateBytes, d) {
  const pdf = await PDFDocument.load(templateBytes);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  const navy = rgb(0.0902, 0.282, 0.376);
  const navy2 = rgb(0.114, 0.18, 0.31);
  const blue = rgb(0.184, 0.333, 0.592);
  const gray = rgb(0.149, 0.149, 0.149);
  const darkText = rgb(0.349, 0.349, 0.349);

  const numero = ascii(d.numero);
  const empresa = ascii(d.clienteNome);
  const contato = ascii(d.clienteContato);
  const escopo = ascii(d.titulo);
  const cidade = ascii(d.clienteCidade);
  const dataFmt = ascii(formatDate(d.data));
  const dias = d.diasEstimados;
  const modalidade = ascii((d.modalidade || 'PRESENCIAL').toUpperCase());
  const premissa = ascii(d.premissa);
  const restricao = ascii(d.restricao);
  const totalFmt = ascii(currency(d.valorTotal));
  const diarioFmt = ascii(currency(d.valorDiario));
  const extenso = ascii(valorExtenso(d.valorTotal));
  const consultor = ascii(d.consultor);
  const descProjeto = ascii(d.descricaoProjeto);
  const etapas = (d.etapas || []).map(ascii).filter(Boolean);

  // PAGE 2
  {
    const p = pages[1];
    await blankPageBlocks(pdf, p, [
      { y: 409.27 }, { y: 373.49 }, { y: 250.44 }, { y: 221.64 }, { y: 168.02 }, { y: 109.51 },
    ]);
    const titleText = `Proposta ${numero}`;
    const titleSize = fitOneLine(helveticaBold, titleText, 32, 380);
    p.drawText(titleText, { x: 78.504, y: 409.27, size: titleSize, font: helveticaBold, color: navy });
    p.drawText(`${cidade}, ${dataFmt}`, { x: 78.504, y: 373.49, size: 18, font: helvetica, color: navy });
    const escopoLines = wrapText(helveticaBold, escopo, 20, 530).slice(0, 2);
    escopoLines.forEach((ln, i) => p.drawText(ln, { x: 361.7, y: 250.44 - i * 28.8, size: 20, font: helveticaBold, color: navy2 }));
    const empresaSize = fitOneLine(helveticaBold, empresa, 22, 500);
    p.drawText(empresa, { x: 366.7, y: 168.02, size: empresaSize, font: helveticaBold, color: navy2 });
    const contatoSize = fitOneLine(helvetica, contato, 18, 500);
    p.drawText(contato, { x: 366.7, y: 109.51, size: contatoSize, font: helvetica, color: gray });
  }

  // PAGE 14
  {
    const p = pages[13];
    await blankPageBlocks(pdf, p, [
      { y: 441.89 }, { y: 423.41 }, { y: 367.37 }, { y: 348.89 },
      { y: 288.31 }, { y: 270.29 }, { y: 234.29 }, { y: 216.29 },
      { y: 180.29 }, { y: 162.38 }, { y: 126.38 }, { y: 90.384 }, { y: 54.36 },
      { y: 268.7 }, { y: 227.26 }, { y: 214.06 }, { y: 181.73 },
    ]);
    const projLines = wrapText(helvetica, descProjeto, 11, 660).slice(0, 2);
    projLines.forEach((ln, i) => p.drawText(ln, { x: 53.208, y: 441.89 - i * 16, size: 11, font: helvetica, color: darkText }));
    const introA = 'Consultoria tecnica especializada de forma ';
    const introB = modalidade;
    const introC = ', contemplando:';
    const aw = helvetica.widthOfTextAtSize(introA, 11);
    const bw = helveticaBold.widthOfTextAtSize(introB, 11);
    p.drawText(introA, { x: 53.208, y: 367.37, size: 11, font: helvetica, color: darkText });
    p.drawText(introB, { x: 53.208 + aw, y: 367.37, size: 11, font: helveticaBold, color: darkText });
    p.drawText(introC, { x: 53.208 + aw + bw, y: 367.37, size: 11, font: helvetica, color: darkText });
    const bulletY = 288.31, bulletH = 20;
    etapas.slice(0, 9).forEach((e, i) => {
      const y = bulletY - i * bulletH;
      if (y < 54) return;
      p.drawText('v', { x: 57.2, y, size: 11, font: helvetica, color: blue });
      const line = wrapText(helvetica, e + ';', 11, 620)[0] || '';
      p.drawText(line, { x: 75.768, y, size: 11, font: helvetica, color: darkText });
    });
    p.drawText(`Carga horaria: ${dias} dias`, { x: 725.62, y: 268.7, size: 14, font: helveticaBold, color: navy2 });
    const premL = wrapText(helvetica, `Premissa: ${premissa}`, 9, 200).slice(0, 2);
    premL.forEach((ln, i) => p.drawText(ln, { x: 720.24, y: 227.26 - i * 12, size: 9, font: helvetica, color: navy2 }));
    const restL = wrapText(helvetica, `Restricao: ${restricao}`, 9, 200)[0] || '';
    p.drawText(restL, { x: 720.24, y: 181.73, size: 9, font: helvetica, color: navy2 });
  }

  // PAGE 15
  {
    const p = pages[14];
    await blankPageBlocks(pdf, p, [
      { y: 398.64 }, { y: 353.74 }, { y: 317.02 }, { y: 268.7 },
      { y: 227.26 }, { y: 214.06 }, { y: 181.73 },
    ]);
    const moLine = d.valorDiario > 0 ? `MO: ${diarioFmt} x ${dias} = ${totalFmt}` : `Total: ${totalFmt}`;
    p.drawText(moLine, { x: 87.696, y: 398.64, size: 18, font: helveticaBold, color: navy2 });
    p.drawText(`TOTAL: ${totalFmt}`, { x: 87.696, y: 353.74, size: 28, font: helveticaBold, color: navy2 });
    p.drawText(`(${extenso})`, { x: 87.696, y: 317.02, size: 14, font: helvetica, color: navy2 });
    p.drawText(`Carga horaria: ${dias} dias`, { x: 725.62, y: 268.7, size: 14, font: helveticaBold, color: navy2 });
    const premL = wrapText(helvetica, `Premissa: ${premissa}`, 9, 200).slice(0, 2);
    premL.forEach((ln, i) => p.drawText(ln, { x: 720.24, y: 227.26 - i * 12, size: 9, font: helvetica, color: navy2 }));
    const restL = wrapText(helvetica, `Restricao: ${restricao}`, 9, 200)[0] || '';
    p.drawText(restL, { x: 720.24, y: 181.73, size: 9, font: helvetica, color: navy2 });
  }

  // PAGE 17
  {
    const p = pages[16];
    await blankPageBlocks(pdf, p, [{ y: 200.64 }, { y: 101.06 }]);
    p.drawText(`${cidade}, ${dataFmt}`, { x: 111.98, y: 200.64, size: 11, font: helvetica, color: darkText });
    const signerSize = 16;
    const signerWidth = helveticaBold.widthOfTextAtSize(consultor, signerSize);
    const originalCenter = 184.03 + helveticaBold.widthOfTextAtSize('Paulo Mendonca', signerSize) / 2;
    p.drawText(consultor, { x: originalCenter - signerWidth / 2, y: 101.06, size: signerSize, font: helveticaBold, color: navy2 });
  }

  return await pdf.save();
}

const bytes = readFileSync(PDF_PATH);
const out = await buildPdf(new Uint8Array(bytes), EXEMPLO);
writeFileSync(OUT_PATH, out);
console.log('Wrote', OUT_PATH, out.length, 'bytes');
