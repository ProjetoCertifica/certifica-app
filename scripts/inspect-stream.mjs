import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { inflateSync } from 'zlib';

const pdfPath = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master/Proposta 155-2026.pdf';
const pdfBytes = readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

const targetPages = [13]; // 0-indexed: page 14

// Primary search terms AND their partial/split variants (since PDF text can be split with kerning)
const searchTerms = [
  '155', 'APEX', 'Juliana', '16.500', '1.650', 'Dezesseis', 'Sorocaba',
  // Also search partial strings in case they're split across TJ kerning pairs
  'APE', 'EX', 'Juli', 'iana', 'Dez', 'essa', 'Soroc', 'ocaba',
  '16.5', '1.65', '16,5', '1,65',
];

function findAllOccurrences(text, term) {
  const results = [];
  let idx = 0;
  while (true) {
    const pos = text.indexOf(term, idx);
    if (pos === -1) break;
    results.push(pos);
    idx = pos + 1;
  }
  return results;
}

function getContext(text, pos, termLen, contextSize = 150) {
  const start = Math.max(0, pos - contextSize);
  const end = Math.min(text.length, pos + termLen + contextSize);
  const before = text.slice(start, pos);
  const match = text.slice(pos, pos + termLen);
  const after = text.slice(pos + termLen, end);
  return { before, match, after };
}

// Helper to get all page content streams
async function getPageStream(pageIdx) {
  const pages = pdfDoc.getPages();
  if (pageIdx >= pages.length) return null;

  const page = pages[pageIdx];
  const context = pdfDoc.context;
  const pageObj = context.lookup(page.ref);

  let contentsVal = null;
  for (const [k, v] of pageObj.entries()) {
    const kName = k.asString ? k.asString() : k.encodedName || k.toString();
    if (kName === '/Contents') {
      contentsVal = v;
      break;
    }
  }
  if (!contentsVal) return null;

  const getStreamBytes = (val) => {
    if (val.constructor.name === 'PDFRef') {
      const resolved = context.lookup(val);
      if (resolved && resolved.contents) return [resolved.contents];
    }
    if (val.constructor.name === 'PDFArray') {
      const results = [];
      for (let i = 0; i < val.size(); i++) {
        const item = val.lookup(i);
        if (item && item.contents) results.push(item.contents);
      }
      return results;
    }
    if (val.contents) return [val.contents];
    return [];
  };

  return getStreamBytes(contentsVal);
}

function decodeStream(rawBytes) {
  try {
    const decompressed = inflateSync(Buffer.from(rawBytes));
    return { text: decompressed.toString('latin1'), compressed: true, size: decompressed.length };
  } catch(e) {
    return { text: Buffer.from(rawBytes).toString('latin1'), compressed: false, size: rawBytes.length };
  }
}

for (const pageIdx of targetPages) {
  const pageNum = pageIdx + 1;
  console.log('\n' + '='.repeat(80));
  console.log(`PAGE ${pageNum} (0-indexed: ${pageIdx})`);
  console.log('='.repeat(80));

  const streams = await getPageStream(pageIdx);
  if (!streams || streams.length === 0) {
    console.log('  No streams found.');
    continue;
  }

  for (let si = 0; si < streams.length; si++) {
    const { text, compressed, size } = decodeStream(streams[si]);
    console.log(`\n  Stream ${si + 1}: ${size} bytes (${compressed ? 'FlateDecode' : 'raw'})`);

    // Print the full stream for complete analysis
    console.log(`\n--- FULL STREAM CONTENT (page ${pageNum}, stream ${si + 1}) ---`);
    console.log(text);
    console.log('--- END STREAM ---');

    console.log(`\n--- SEARCH RESULTS ---`);
    const primaryTerms = ['155', 'APEX', 'Juliana', '16.500', '1.650', 'Dezesseis', 'Sorocaba'];
    for (const term of primaryTerms) {
      const positions = findAllOccurrences(text, term);
      if (positions.length > 0) {
        console.log(`\n  [FOUND] "${term}" — ${positions.length} occurrence(s):`);
        for (const pos of positions) {
          const ctx = getContext(text, pos, term.length, 150);
          console.log(`    pos=${pos}`);
          console.log(`    BEFORE: ${JSON.stringify(ctx.before)}`);
          console.log(`    MATCH:  ${JSON.stringify(ctx.match)}`);
          console.log(`    AFTER:  ${JSON.stringify(ctx.after)}`);
        }
      } else {
        console.log(`  [NOT FOUND] "${term}"`);
      }
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('DONE');
