// Extract all embedded images from the original Proposta 155-2026.pdf
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { inflateSync } from 'zlib';

const PDF_PATH = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master/public/Proposta 155-2026.pdf';
const OUT_DIR = 'C:/Users/fluxi/Downloads/certifica-master/certifica-master/public/propostas/assets-raw';

mkdirSync(OUT_DIR, { recursive: true });

const bytes = readFileSync(PDF_PATH);
const pdf = await PDFDocument.load(bytes);
const ctx = pdf.context;

const resolve = (o) => o?.constructor?.name === 'PDFRef' ? ctx.lookup(o) : o;

// Enumerate every indirect object, find XObject images
let count = 0;
for (const [ref, obj] of ctx.indirectObjects) {
  const rawObj = obj;
  if (!rawObj || !rawObj.dict) continue;
  const dict = rawObj.dict;
  const type = dict.get(PDFName.of('Type'));
  const subtype = dict.get(PDFName.of('Subtype'));
  if (subtype?.toString() !== '/Image') continue;

  const width = dict.get(PDFName.of('Width'))?.toString();
  const height = dict.get(PDFName.of('Height'))?.toString();
  const filter = dict.get(PDFName.of('Filter'))?.toString() || '';

  const raw = rawObj.contents;
  if (!raw) continue;

  let ext = 'bin';
  let data = Buffer.from(raw);
  if (filter.includes('DCTDecode')) ext = 'jpg';
  else if (filter.includes('JPXDecode')) ext = 'jp2';
  else if (filter.includes('FlateDecode')) {
    // Raw pixels — skip unless small (likely icons)
    ext = 'raw.flate';
  } else if (filter.includes('CCITTFaxDecode')) ext = 'tiff';

  const filename = `img_${count}_${ref.objectNumber}_${width}x${height}.${ext}`;
  writeFileSync(`${OUT_DIR}/${filename}`, data);
  console.log(filename, filter, data.length, 'bytes');
  count++;
}

console.log(`\nTotal: ${count} images extracted`);
