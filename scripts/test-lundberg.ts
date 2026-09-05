import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { cleanLabelText } from '../src/lib/ocrCleanup';
import { analyzeCleanedLabelText, analyzeLabelText } from '../src/lib/classify';

const src = './lundberg-test.jpg';
const meta = await sharp(src).metadata();
const w = meta.width!;
const h = meta.height!;

const worker = await createWorker('eng', 1);
await worker.setParameters({ tessedit_pageseg_mode: '6' });

async function ocrRegion(label: string, box: { l: number; t: number; ww: number; hh: number }) {
  const buf = await sharp(src)
    .extract({
      left: Math.floor(w * box.l),
      top: Math.floor(h * box.t),
      width: Math.floor(w * box.ww),
      height: Math.floor(h * box.hh),
    })
    .resize({ width: 1600 })
    .grayscale()
    .normalize()
    .linear(1.4, -30)
    .png()
    .toBuffer();
  const r = await worker.recognize(buf);
  return { label, text: r.data.text || '', conf: r.data.confidence };
}

const full = await worker.recognize(src);
console.log('\n=== FULL IMAGE ===');
console.log('conf', full.data.confidence);
console.log((full.data.text || '').slice(0, 200).replace(/\n/g, ' | '));
const fullClean = cleanLabelText(full.data.text || '', { ocrConfidence: full.data.confidence });
console.log('clean quality', fullClean.quality, 'garbage', fullClean.looksLikeGarbage, 'text=', JSON.stringify(fullClean.text));
console.log('reject?', fullClean.looksLikeGarbage || fullClean.quality === 'poor');

const band = await ocrRegion('center-band', { l: 0.22, t: 0.12, ww: 0.58, hh: 0.42 });
console.log('\n=== CENTER BAND ===');
console.log('conf', band.conf);
console.log(band.text.replace(/\n/g, ' | ').slice(0, 300));
const bandClean = cleanLabelText(band.text, { ocrConfidence: band.conf });
console.log('clean', bandClean);
if (!bandClean.looksLikeGarbage && bandClean.text) {
  const a = analyzeCleanedLabelText(bandClean.text, { ocrQuality: bandClean.quality, warnings: bandClean.warnings });
  console.log('VERDICT', a.overall, a.ingredients);
} else {
  console.log('REJECTED as expected or unexpected');
}

console.log('\n=== TRUE PASTE ===');
const paste = 'Ingredients: Regenerative Organic Certified Brown Rice, Sea Salt.';
const pClean = cleanLabelText(paste);
console.log(pClean);
const pa = analyzeLabelText(paste);
console.log('VERDICT', pa.overall, pa.ingredients.map((i) => `${i.raw}=>${i.matchedName}/${i.level}`));

await worker.terminate();
