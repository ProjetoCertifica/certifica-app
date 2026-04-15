import { PDFDocument, PDFName } from 'pdf-lib';
import { readFileSync } from 'fs';
import { inflateSync } from 'zlib';

const bytes = readFileSync('C:/Users/fluxi/Downloads/certifica-master/certifica-master/test-output.pdf');
const pdf = await PDFDocument.load(bytes);

async function dumpPage(pageIdx, searchTerms = []) {
  const page = pdf.getPages()[pageIdx];
  const Contents = page.node.Contents();
  const ctx = pdf.context;
  const resolve = (o) => o?.constructor?.name === 'PDFRef' ? ctx.lookup(o) : o;
  const top = resolve(Contents);
  const streams = [];
  if (top?.constructor?.name === 'PDFArray') {
    for (let i = 0; i < top.size(); i++) streams.push(resolve(top.get(i)));
  } else { streams.push(top); }

  let allText = '';
  for (const s of streams) {
    if (!s?.contents) continue;
    const filter = s.dict.get(PDFName.of('Filter'));
    const isFlate = filter?.toString().includes('FlateDecode');
    try {
      const dec = isFlate ? inflateSync(Buffer.from(s.contents)).toString('latin1') : Buffer.from(s.contents).toString('latin1');
      allText += dec + '\n===STREAM BOUNDARY===\n';
    } catch(e) {
      allText += '[decompression failed: ' + e.message + ']\n';
    }
  }

  console.log(`\n========== PAGE ${pageIdx+1} ==========`);
  for (const term of searchTerms) {
    const idx = allText.indexOf(term);
    if (idx >= 0) {
      console.log(`  [FOUND] "${term}" at ${idx}`);
      console.log('  context:', JSON.stringify(allText.slice(Math.max(0,idx-60), idx+80)));
    } else {
      console.log(`  [NOT FOUND] "${term}"`);
    }
  }
  console.log(`  Total streams: ${streams.length}, total chars: ${allText.length}`);
  // Check for original-text remnants
  const origTerms = ['APEX', 'Juliana', 'DFMEA', '155', '1.650', '16.500', 'Dezesseis', 'Linha de Limas', 'Revisão'];
  console.log('  ORIGINAL TERMS still present:');
  for (const t of origTerms) {
    if (allText.includes(t)) console.log(`    - "${t}" STILL THERE`);
  }
}

await dumpPage(1, ['Proposta 156-2026', 'Heineken Brasil', 'Carlos Silva', 'Implementacao']);
await dumpPage(13, ['Carga horaria: 15 dias', 'PRESENCIAL', 'Diagnostico']);
await dumpPage(14, ['MO:', 'TOTAL:', 'Vinte e Quatro Mil']);
await dumpPage(16, ['Paulo Mendonca', 'Sorocaba, 09']);
