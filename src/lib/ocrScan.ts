import { createWorker, PSM, type Worker } from 'tesseract.js';
import { cleanLabelText, type CleanedOcr } from './ocrCleanup';

export interface OcrScanResult extends CleanedOcr {
  rawBest: string;
  rawFull?: string;
  regionLabel: string;
  /** True when we refuse to auto-analyze */
  rejected: boolean;
  rejectReason?: string;
}

type Region = { label: string; x: number; y: number; w: number; h: number };

function regions(): Region[] {
  // Normalized crop boxes — ingredients usually sit mid/right beside Nutrition Facts
  return [
    { label: 'center-band', x: 0.22, y: 0.12, w: 0.58, h: 0.42 },
    { label: 'mid-right', x: 0.35, y: 0.15, w: 0.5, h: 0.4 },
    { label: 'right-half', x: 0.4, y: 0.05, w: 0.58, h: 0.55 },
    { label: 'upper-mid', x: 0.2, y: 0.08, w: 0.6, h: 0.35 },
    { label: 'full', x: 0, y: 0, w: 1, h: 1 },
  ];
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

/** Grayscale + contrast boost into a PNG blob for Tesseract */
async function canvasRegionToBlob(
  img: HTMLImageElement,
  region: Region,
  opts?: { threshold?: boolean; upscale?: number },
): Promise<Blob> {
  const sx = Math.floor(img.naturalWidth * region.x);
  const sy = Math.floor(img.naturalHeight * region.y);
  const sw = Math.max(32, Math.floor(img.naturalWidth * region.w));
  const sh = Math.max(32, Math.floor(img.naturalHeight * region.h));
  const scale = opts?.upscale ?? (sw < 900 ? 1600 / sw : 1);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  const imageData = ctx.getImageData(0, 0, dw, dh);
  const d = imageData.data;
  // grayscale + contrast
  for (let i = 0; i < d.length; i += 4) {
    let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    y = (y - 128) * 1.45 + 128;
    if (opts?.threshold) y = y > 155 ? 255 : 0;
    else y = Math.max(0, Math.min(255, y));
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png');
  });
}

function scoreOcrText(text: string, confidence: number): number {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return -100;
  let score = confidence;
  if (/ingred/i.test(t)) score += 45;
  if (/ingredients\s*[:.\-–]/i.test(t) || /ingrediex'?ts\s*[:.\-–]/i.test(t)) score += 35;
  if (/\brice\b/i.test(t)) score += 20;
  if (/\bsalt\b/i.test(t)) score += 15;
  if (/\bbrown\b/i.test(t) || /ysrown|rown\s+rice/i.test(t)) score += 20;
  if (/nutrition\s*facts/i.test(t) && !/ingred/i.test(t)) score -= 40;
  // Penalize symbol soup
  const weird = (t.match(/[^A-Za-z0-9\s,;:.%()*\-\/'@]/g) || []).length;
  score -= Math.min(40, weird);
  const words = t.split(/\s+/).length;
  if (words > 80 && !/ingred/i.test(t)) score -= 25;
  return score;
}

async function recognizeOne(
  worker: Worker,
  blob: Blob,
): Promise<{ text: string; confidence: number }> {
  const result = await worker.recognize(blob);
  return {
    text: result.data.text || '',
    confidence: typeof result.data.confidence === 'number' ? result.data.confidence : 0,
  };
}

/**
 * Multi-region label OCR tuned for curved package photos.
 * Picks the crop that best looks like an Ingredients block; rejects gibberish.
 */
export async function scanLabelImage(
  file: Blob,
  onProgress?: (msg: string) => void,
): Promise<OcrScanResult> {
  onProgress?.('Loading image…');
  const img = await loadImage(file);

  onProgress?.('Starting OCR engine…');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(`Reading label… ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    let best: { text: string; confidence: number; label: string; score: number } | null = null;
    let fullRaw = '';

    const regs = regions();
    for (let i = 0; i < regs.length; i++) {
      const region = regs[i];
      onProgress?.(`Scanning region ${i + 1}/${regs.length} (${region.label})…`);
      try {
        const blob = await canvasRegionToBlob(img, region, {
          upscale: region.label === 'full' ? 1 : undefined,
        });
        const rec = await recognizeOne(worker, blob);
        if (region.label === 'full') fullRaw = rec.text;
        const score = scoreOcrText(rec.text, rec.confidence);
        if (!best || score > best.score) {
          best = { ...rec, label: region.label, score };
        }
        // Early exit if we clearly found ingredients + food words with decent confidence
        if (/ingred/i.test(rec.text) && /\b(rice|salt|water|flour|sugar|oil|milk)\b/i.test(rec.text) && rec.confidence >= 48) {
          best = { ...rec, label: region.label, score: score + 10 };
          break;
        }
      } catch {
        // try next region
      }
    }

    if (!best) {
      return {
        text: '',
        rawBest: '',
        rawFull: fullRaw,
        quality: 'poor',
        warnings: ['OCR failed on this image.'],
        looksLikeGarbage: true,
        regionLabel: 'none',
        rejected: true,
        rejectReason: 'OCR failed. Try a tighter crop of the INGREDIENTS line, or paste the text.',
      };
    }

    const cleaned = cleanLabelText(best.text, { ocrConfidence: best.confidence });
    const reject =
      cleaned.looksLikeGarbage ||
      cleaned.quality === 'poor' ||
      !cleaned.text.trim() ||
      (best.confidence < 38 && cleaned.quality !== 'good');

    if (reject) {
      return {
        ...cleaned,
        text: '',
        rawBest: best.text,
        rawFull: fullRaw || best.text,
        regionLabel: best.label,
        rejected: true,
        rejectReason:
          'Couldn’t read the ingredients clearly (photo may include nutrition panel, logos, or glare). Crop to the INGREDIENTS line only, improve lighting, or paste the text.',
        warnings: [
          ...(cleaned.warnings || []),
          'Tip: Fill the frame with “INGREDIENTS: …” — avoid QR codes, barcodes, and Nutrition Facts.',
        ],
      };
    }

    return {
      ...cleaned,
      rawBest: best.text,
      rawFull: fullRaw,
      regionLabel: best.label,
      rejected: false,
    };
  } finally {
    await worker.terminate();
  }
}
