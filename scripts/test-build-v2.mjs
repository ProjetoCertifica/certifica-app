// Mirror of PropostaPreviewV2 buildPdf, runs in Node to produce test-output-v2.pdf
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const ROOT = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master';
const OUT = `${ROOT}/test-output-v2.pdf`;

const d = {
  numero: '156-2026',
  data: '2026-04-09',
  validade: '2026-05-09',
  clienteNome: 'Heineken Brasil',
  clienteRazaoSocial: 'Heineken Brasil S.A.',
  clienteContato: 'Carlos Silva',
  clienteCidade: 'Sorocaba',
  titulo: 'Implementacao ISO 14001:2015 - Sistema de Gestao Ambiental',
  descricaoProjeto: 'Consultoria para implementacao do Sistema de Gestao Ambiental conforme requisitos da norma ISO 14001:2015, incluindo levantamento de aspectos e impactos ambientais, definicao de controles operacionais e preparacao para auditoria de certificacao.',
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

// helpers
function currency(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(iso) {
  const dt = new Date(iso + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function ascii(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ''); }
function valorExtenso(v) { return 'Vinte e Quatro Mil Setecentos e Cinquenta Reais'; }
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
  while (s > 8 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

const W = 960, H = 540;
const bg = rgb(0.043, 0.086, 0.145);
const bgAlt = rgb(0.071, 0.133, 0.212);
const accent = rgb(0.12, 0.435, 0.659);
const accentLight = rgb(0.267, 0.596, 0.827);
const white = rgb(1, 1, 1);
const gray = rgb(0.686, 0.729, 0.812);
const grayDark = rgb(0.361, 0.408, 0.494);

function roundedRect(page, x, y, w, h, r, fill) {
  const path = `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  page.drawSvgPath(path, { x: 0, y: H, color: fill });
}
function pill(page, x, y, text, font, size, padX = 12, padY = 6, fill = accent, textColor = white) {
  const tw = font.widthOfTextAtSize(text, size);
  const w = tw + padX * 2;
  const h = size + padY * 2;
  roundedRect(page, x, y, w, h, h / 2, fill);
  page.drawText(text, { x: x + padX, y: y + padY + 1, size, font, color: textColor });
  return w;
}
function drawFooter(p, helv, bold) {
  p.drawLine({ start: { x: 52, y: 40 }, end: { x: W - 52, y: 40 }, thickness: 0.5, color: grayDark });
  p.drawText('CERTIFICA GESTAO DE SISTEMAS', { x: 52, y: 22, size: 7, font: bold, color: accentLight });
  p.drawText('www.certificags.com.br', { x: W - 180, y: 22, size: 7, font: helv, color: gray });
}

async function buildPdf() {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const matteoPauloBytes = readFileSync(`${ROOT}/public/propostas/assets/matteo-paulo.jpg`);
  const seloBytes = readFileSync(`${ROOT}/public/propostas/assets/selo-dfmea.jpg`);
  const casesBytes = readFileSync(`${ROOT}/public/propostas/assets/cases-grid-1.jpg`);
  const matteoPaulo = await pdf.embedJpg(matteoPauloBytes);
  const seloDfmea = await pdf.embedJpg(seloBytes);
  const casesGrid = await pdf.embedJpg(casesBytes);

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

  // PAGE 1 — CAPA
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    p.drawText('CERTIFICA', { x: 40, y: 60, size: 140, font: bold, color: rgb(0.067, 0.118, 0.188) });
    p.drawRectangle({ x: W - 160, y: 0, width: 160, height: H, color: bgAlt });
    const phW = 260, phH = 220, phX = W - 290, phY = H - 280;
    p.drawImage(matteoPaulo, { x: phX, y: phY, width: phW, height: phH });
    p.drawRectangle({ x: phX, y: phY, width: phW, height: 60, color: bg, opacity: 0.6 });
    pill(p, 56, H - 60, 'PROPOSTA COMERCIAL', bold, 9, 14, 7, accent, white);
    p.drawText('Proposta', { x: 52, y: H - 170, size: 62, font: bold, color: white });
    p.drawText(numero, { x: 52, y: H - 250, size: 68, font: bold, color: accentLight });
    p.drawText('CLIENTE', { x: 56, y: H - 310, size: 8, font: bold, color: gray });
    const empresaSize = fitOneLine(bold, empresa, 22, 500);
    p.drawText(empresa, { x: 56, y: H - 340, size: empresaSize, font: bold, color: white });
    p.drawText(contato, { x: 56, y: H - 362, size: 12, font: helv, color: gray });
    p.drawRectangle({ x: 56, y: H - 420, width: 3, height: 40, color: accentLight });
    wrapText(helv, escopo, 11, 480).slice(0, 3).forEach((ln, i) =>
      p.drawText(ln, { x: 68, y: H - 395 - i * 14, size: 11, font: helv, color: gray }));
    pill(p, 56, 40, `${cidade}, ${dataFmt}`, helv, 9, 12, 6, bgAlt, gray);
    p.drawText('CERTIFICA GESTAO DE SISTEMAS', { x: 56, y: 22, size: 7, font: bold, color: accentLight });
  }

  // PAGE 2 — SOBRE
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    pill(p, 56, H - 60, '#01 SOBRE NOS', bold, 9, 14, 7, accent, white);
    p.drawText('Um pouco sobre a', { x: 52, y: H - 110, size: 18, font: helv, color: gray });
    p.drawText('Certifica.', { x: 52, y: H - 150, size: 42, font: bold, color: white });
    const body1 = 'A Certifica possui em seu quadro de colaboradores, profissionais com mais de 20 anos de experiencia. Atuamos em todas as areas da gestao: qualidade, meio ambiente, saude e seguranca, eficiencia energetica, qualidade automotiva, ESG, etc.';
    const body2 = 'Mais de 735 empresas auditadas e certificadas em todo o mundo. Atraves desse know-how diferenciado, levamos as empresas a capacidade de implementar sistemas de gestao com muita eficiencia e eficacia.';
    wrapText(helv, body1, 10, 420).forEach((ln, i) => p.drawText(ln, { x: 52, y: H - 185 - i * 14, size: 10, font: helv, color: gray }));
    wrapText(helv, body2, 10, 420).slice(0, 4).forEach((ln, i) => p.drawText(ln, { x: 52, y: H - 270 - i * 14, size: 10, font: helv, color: gray }));
    p.drawText('735+', { x: 52, y: 100, size: 52, font: bold, color: accentLight });
    p.drawText('EMPRESAS CERTIFICADAS', { x: 52, y: 78, size: 8, font: bold, color: gray });
    p.drawText('20+', { x: 220, y: 100, size: 52, font: bold, color: accentLight });
    p.drawText('ANOS DE EXPERIENCIA', { x: 220, y: 78, size: 8, font: bold, color: gray });
    const cgW = 360, cgH = 360 * (634 / 1700);
    p.drawImage(casesGrid, { x: W - 420, y: H - 310, width: cgW, height: cgH });
    p.drawText('QUEM JA CONFIA', { x: W - 420, y: H - 325, size: 8, font: bold, color: accentLight });
    drawFooter(p, helv, bold);
  }

  // PAGE 3 — ESCOPO
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    pill(p, 56, H - 60, '#02 PROJETO', bold, 9, 14, 7, accent, white);
    p.drawText('Escopo &', { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText('Objetivos', { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });
    const dbX = 52, dbY = H - 280, dbW = 550, dbH = 90;
    roundedRect(p, dbX, dbY, dbW, dbH, 8, bgAlt);
    p.drawText('DESCRICAO DO PROJETO', { x: dbX + 16, y: dbY + dbH - 20, size: 8, font: bold, color: accentLight });
    wrapText(helv, descProjeto, 10, dbW - 32).slice(0, 4).forEach((ln, i) => p.drawText(ln, { x: dbX + 16, y: dbY + dbH - 38 - i * 13, size: 10, font: helv, color: gray }));
    pill(p, W - 340, H - 120, `MODALIDADE: ${modalidade}`, bold, 9, 14, 7, bgAlt, white);
    pill(p, W - 340, H - 150, `CARGA HORARIA: ${dias} DIAS`, bold, 9, 14, 7, accent, white);
    p.drawImage(seloDfmea, { x: W - 180, y: 60, width: 130, height: 130 * (486 / 515) });
    const cardY = 80, cardH = 110, cardW = 250;
    roundedRect(p, 52, cardY, cardW, cardH, 8, bgAlt);
    p.drawText('PREMISSAS', { x: 68, y: cardY + cardH - 20, size: 8, font: bold, color: accentLight });
    wrapText(helv, premissa, 9, cardW - 32).slice(0, 4).forEach((ln, i) => p.drawText(ln, { x: 68, y: cardY + cardH - 38 - i * 12, size: 9, font: helv, color: gray }));
    roundedRect(p, 320, cardY, cardW, cardH, 8, bgAlt);
    p.drawText('RESTRICOES', { x: 336, y: cardY + cardH - 20, size: 8, font: bold, color: accentLight });
    wrapText(helv, restricao, 9, cardW - 32).slice(0, 4).forEach((ln, i) => p.drawText(ln, { x: 336, y: cardY + cardH - 38 - i * 12, size: 9, font: helv, color: gray }));
    drawFooter(p, helv, bold);
  }

  // PAGE 4 — ETAPAS
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    pill(p, 56, H - 60, '#03 METODOLOGIA', bold, 9, 14, 7, accent, white);
    p.drawText('Etapas do', { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText('Projeto.', { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });
    const startY = H - 210, lineH = 38;
    etapas.slice(0, 8).forEach((e, i) => {
      const y = startY - i * lineH;
      const cx = 70, cy = y + 12, r = 14;
      p.drawCircle({ x: cx, y: cy, size: r, color: accent });
      const num = String(i + 1).padStart(2, '0');
      const numW = bold.widthOfTextAtSize(num, 11);
      p.drawText(num, { x: cx - numW / 2, y: cy - 4, size: 11, font: bold, color: white });
      if (i < Math.min(etapas.length, 8) - 1) {
        p.drawLine({ start: { x: cx, y: cy - r }, end: { x: cx, y: cy - lineH + r }, thickness: 1.5, color: grayDark });
      }
      const line = wrapText(helv, e, 11, 720)[0] || '';
      p.drawText(line, { x: 100, y: cy - 4, size: 11, font: helv, color: white });
    });
    drawFooter(p, helv, bold);
  }

  // PAGE 5 — INVESTIMENTO
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    pill(p, 56, H - 60, '#04 INVESTIMENTO', bold, 9, 14, 7, accent, white);
    p.drawText('Condicoes', { x: 52, y: H - 120, size: 42, font: bold, color: white });
    p.drawText('Comerciais.', { x: 52, y: H - 160, size: 42, font: bold, color: accentLight });
    const pbX = 52, pbY = 100, pbW = 560, pbH = 220;
    roundedRect(p, pbX, pbY, pbW, pbH, 12, bgAlt);
    p.drawText('INVESTIMENTO TOTAL', { x: pbX + 28, y: pbY + pbH - 32, size: 9, font: bold, color: accentLight });
    const priceSize = fitOneLine(bold, totalFmt, 92, pbW - 56);
    p.drawText(totalFmt, { x: pbX + 28, y: pbY + pbH - 130, size: priceSize, font: bold, color: white });
    wrapText(helv, `(${extenso})`, 11, pbW - 56).slice(0, 2).forEach((ln, i) => p.drawText(ln, { x: pbX + 28, y: pbY + 58 - i * 14, size: 11, font: oblique, color: gray }));
    p.drawText(`MO: ${diarioFmt} x ${dias} dias`, { x: pbX + 28, y: pbY + 28, size: 10, font: helv, color: gray });
    const sX = W - 330, sW = 280;
    const items = [
      { y: H - 220, label: 'PRAZO DE PAGAMENTO', value: ascii(d.condicoes) },
      { y: H - 300, label: 'PARCELAS', value: `${d.parcelas}x ${ascii(currency(d.valorParcela))}` },
      { y: H - 380, label: 'CARGA HORARIA', value: `${dias} dias` },
    ];
    items.forEach(it => {
      roundedRect(p, sX, it.y, sW, 60, 8, bgAlt);
      p.drawText(it.label, { x: sX + 16, y: it.y + 40, size: 8, font: bold, color: accentLight });
      const vs = fitOneLine(bold, it.value, 16, sW - 32);
      p.drawText(it.value, { x: sX + 16, y: it.y + 14, size: vs, font: bold, color: white });
    });
    drawFooter(p, helv, bold);
  }

  // PAGE 6 — ASSINATURAS
  {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg });
    pill(p, 56, H - 60, '#05 ACEITE', bold, 9, 14, 7, accent, white);
    p.drawText('Vamos juntos?', { x: 52, y: H - 120, size: 42, font: bold, color: white });
    const phW = 360, phH = 360 * (1080 / 1920);
    p.drawImage(matteoPaulo, { x: W - 420, y: H - 280, width: phW, height: phH });
    p.drawText(`${cidade}, ${dataFmt}`, { x: 52, y: 240, size: 11, font: helv, color: gray });
    const sigW = 360, sigH = 120;
    roundedRect(p, 52, 80, sigW, sigH, 10, bgAlt);
    p.drawText('CONSULTOR RESPONSAVEL', { x: 68, y: 80 + sigH - 24, size: 8, font: bold, color: accentLight });
    const cs = fitOneLine(bold, consultor, 22, sigW - 32);
    p.drawText(consultor, { x: 68, y: 80 + 28, size: cs, font: bold, color: white });
    p.drawText('Certifica Gestao de Sistemas', { x: 68, y: 80 + 12, size: 9, font: helv, color: gray });
    drawFooter(p, helv, bold);
  }

  return await pdf.save();
}

const out = await buildPdf();
writeFileSync(OUT, out);
console.log('Wrote', OUT, out.length, 'bytes');
