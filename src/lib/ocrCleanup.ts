/** OCR normalization and ingredient-section extraction for food labels. */

export type OcrQuality = 'good' | 'fair' | 'poor';

export interface CleanedOcr {
  text: string;
  quality: OcrQuality;
  warnings: string[];
  looksLikeGarbage: boolean;
  /** Tesseract page confidence when available (0–100) */
  ocrConfidence?: number;
}

/** Common food-label OCR word fixes (lowercase keys). */
const WORD_FIXES: Record<string, string> = {
  ingredlents: 'ingredients',
  ingrediants: 'ingredients',
  lngredients: 'ingredients',
  ingredientslist: 'ingredients',
  ingrediexts: 'ingredients',
  ingrediex: 'ingredients',
  ysrown: 'brown',
  brwn: 'brown',
  brovn: 'brown',
  mater: 'water',
  vvater: 'water',
  wate: 'water',
  rlce: 'rice',
  ricc: 'rice',
  rlceflour: 'rice',
  '0nion': 'onion',
  onlon: 'onion',
  onlonpowder: 'onion powder',
  garllc: 'garlic',
  gariic: 'garlic',
  gar1ic: 'garlic',
  garlicpowder: 'garlic powder',
  onionpowder: 'onion powder',
  miik: 'milk',
  mi1k: 'milk',
  sait: 'salt',
  sa1t: 'salt',
  saltt: 'salt',
  fiour: 'flour',
  f1our: 'flour',
  ftour: 'flour',
  sugarr: 'sugar',
  buttter: 'butter',
  buter: 'butter',
  checse: 'cheese',
  cheesc: 'cheese',
  chcese: 'cheese',
  yoghrt: 'yogurt',
  yoghut: 'yogurt',
  frucose: 'fructose',
  syryp: 'syrup',
  syrap: 'syrup',
  powdcr: 'powder',
  powcler: 'powder',
  extractt: 'extract',
  lecithln: 'lecithin',
  annato: 'annatto',
  annatoo: 'annatto',
  cnzymes: 'enzymes',
  culturcs: 'cultures',
  naturai: 'natural',
  fiavors: 'flavors',
  fiavour: 'flavour',
  fiavours: 'flavours',
  wheatt: 'wheat',
  whcat: 'wheat',
  soya: 'soy',
  soyl: 'soy',
  lundbera: 'lundberg',
};

function fixDigitLetterConfusions(word: string): string {
  return word
    .replace(/(?<=[A-Za-z])0(?=[A-Za-z])/g, 'o')
    .replace(/^0(?=[A-Za-z])/g, 'o')
    .replace(/(?<=[A-Za-z])0$/g, 'o')
    .replace(/(?<=[A-Za-z])1(?=[A-Za-z])/g, 'l')
    .replace(/(?<=[A-Za-z])5(?=[A-Za-z])/g, 's')
    .replace(/(?<=[A-Za-z])8(?=[A-Za-z])/g, 'b');
}

function fixWord(token: string): string {
  const stripped = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (!stripped) return token;
  const confixed = fixDigitLetterConfusions(stripped);
  const lower = confixed.toLowerCase();
  const fixed = WORD_FIXES[lower] ?? confixed;
  if (fixed === confixed) return token.replace(stripped, confixed);
  if (stripped === stripped.toUpperCase() && stripped.length > 1) {
    return token.replace(stripped, fixed.toUpperCase());
  }
  if (stripped[0] === stripped[0].toUpperCase()) {
    return token.replace(stripped, fixed.charAt(0).toUpperCase() + fixed.slice(1));
  }
  return token.replace(stripped, fixed);
}

export function fixOcrWords(text: string): string {
  return text.replace(/[A-Za-z0-9\u0400-\u04FF]+/g, (w) => fixWord(w));
}

function joinHyphenatedLineBreaks(text: string): string {
  return text.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');
}

/** Phrases that end an ingredients block */
const STOP_TAIL =
  /\b(?:contains\b|may\s+contain\b|allergens?\b|nutrition\b|distributed\s+by\b|manufactured\b|produced\s+by\b|best\s+before\b|use\s+by\b|net\s+wt\b|keep\s+refrigerated\b|certified\s+organic\s+by\b|store\s+in\b|hello@|www\.|http)/i;

/**
 * Match a real Ingredients heading (with colon), including common OCR mangling.
 * Do NOT match the footnote "*Organic ingredient".
 */
const INGREDIENTS_HEADING =
  /(?:^|[\n\r]|[\s|])((?:ingred[a-z']{2,10}|1ngredients?|lngredients?)\b)\s*[:.\-–]\s*/i;

export function extractIngredientSection(raw: string): {
  section: string;
  usedFallback: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let text = raw.replace(/\r/g, '\n');
  text = joinHyphenatedLineBreaks(text);

  // Soft-fix mangled heading before extraction
  text = text
    .replace(/ingrediex'?ts/gi, 'Ingredients')
    .replace(/ingrediexts/gi, 'Ingredients')
    .replace(/ingred(?:lents|iants|ienis)/gi, 'Ingredients');

  const head = text.match(INGREDIENTS_HEADING);
  if (head && head.index != null) {
    const start = head.index + head[0].length;
    let section = text.slice(start);
    const stop = section.search(STOP_TAIL);
    if (stop >= 0) section = section.slice(0, stop);
    // Drop organic footnote lines
    section = section
      .replace(/\*\s*organic\s+ingredients?\b.*$/gim, '')
      .replace(/\(\s*\*\s*organic\s+ingredients?\s*\)/gi, '')
      .replace(/\*\s*organic\s+ingredient\b/gi, '')
      .trim();
    if (section.length >= 3) {
      return { section, usedFallback: false, warnings };
    }
  }

  // Allergen-only Contains: (not "may contain")
  const containsMatch = text.match(/(?:^|\n)\s*contains\b\s*[:.\-–]\s*([^\n]+)/i);
  if (containsMatch?.[1] && !/\bmay\s+contain\b/i.test(text.slice(0, containsMatch.index! + 12))) {
    warnings.push('No “Ingredients:” line found — using Contains: allergen list (incomplete).');
    return { section: containsMatch[1].trim(), usedFallback: true, warnings };
  }

  warnings.push(
    'Could not find an “Ingredients:” heading — analyzing full text. Edit if OCR picked up packaging noise.',
  );
  return { section: text.trim(), usedFallback: true, warnings };
}

/** Dictionary-ish tokens that suggest real food label content */
const FOODISH =
  /\b(water|salt|sugar|flour|oil|rice|wheat|milk|cream|butter|cheese|garlic|onion|soy|corn|oat|yeast|vinegar|spice|flavor|flavour|starch|syrup|egg|cocoa|tomato|potato|lemon|juice|acid|extract|organic|ingredients?)\b/i;

function dictionaryHitRate(text: string): number {
  const words = text.split(/[^A-Za-z]+/).filter((w) => w.length >= 3);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (FOODISH.test(w) || WORD_FIXES[w.toLowerCase()] || w.length >= 5) {
      // long words alone aren't enough — require vowel + consonant pattern
      if (/[aeiouy]/i.test(w) && /[bcdfghjklmnpqrstvwxz]/i.test(w)) hits += FOODISH.test(w) ? 2 : 0.25;
    }
  }
  return hits / Math.max(words.length, 1);
}

export function scoreQuality(
  original: string,
  section: string,
  ocrConfidence?: number,
): { quality: OcrQuality; looksLikeGarbage: boolean } {
  const sample = section || original;
  const words = sample.split(/\s+/).filter(Boolean);
  const letters = (sample.match(/[A-Za-z]/g) || []).length;
  const chars = sample.replace(/\s/g, '').length || 1;
  const letterRatio = letters / chars;
  const weird = (sample.match(/[^A-Za-z0-9\s,;:.%()*\-\/'"]/g) || []).length;
  const shortJunk = words.filter((w) => w.length <= 2 && !/^(of|or|in|to|as|by)$/i.test(w)).length;
  const hasHeading = INGREDIENTS_HEADING.test(original) || /\bingredients?\s*[:.\-–]/i.test(original);
  const foodHits = dictionaryHitRate(sample);
  const commaList = (sample.match(/,/g) || []).length >= 1 && words.length >= 2;

  const hasMangledHeading = /ingred[a-z']{2,10}\s*[:.\-–]/i.test(original);
  const headingOk = hasHeading || hasMangledHeading;

  // Hard reject: very low Tesseract confidence with no ingredient cue
  if (typeof ocrConfidence === 'number' && ocrConfidence < 40 && !headingOk) {
    return { quality: 'poor', looksLikeGarbage: true };
  }
  if (typeof ocrConfidence === 'number' && ocrConfidence < 50 && !headingOk && foodHits < 0.35) {
    return { quality: 'poor', looksLikeGarbage: true };
  }

  // Gibberish heuristics (Lundberg full-pack case)
  const gibberish =
    letterRatio < 0.75 ||
    shortJunk > words.length * 0.35 ||
    weird > sample.length * 0.1 ||
    foodHits < 0.15 ||
    (words.length >= 6 && foodHits < 0.35 && !headingOk) ||
    !/[aeiouy].*[aeiouy]/i.test(sample);

  if (words.length < 2 || gibberish) {
    // Still allow short real lists like "Brown Rice, Sea Salt"
    if (headingOk && commaList && foodHits >= 0.2) {
      return { quality: 'fair', looksLikeGarbage: false };
    }
    if (commaList && foodHits >= 0.45 && words.length <= 12) {
      return { quality: 'fair', looksLikeGarbage: false };
    }
    return { quality: 'poor', looksLikeGarbage: true };
  }

  if (!headingOk && foodHits < 0.5) {
    return { quality: 'fair', looksLikeGarbage: foodHits < 0.25 };
  }

  if (headingOk && commaList) return { quality: 'good', looksLikeGarbage: false };
  if (foodHits >= 0.5) return { quality: 'good', looksLikeGarbage: false };
  return { quality: 'fair', looksLikeGarbage: false };
}

/** Strip certification / marketing prefixes from a single ingredient token later in classify too */
export function stripLabelBoilerplate(section: string): string {
  return section
    .replace(/\bregenerative\s+organic\s+certified(?:\s*[®™]*)?/gi, '')
    .replace(/\busda\s+organic\b/gi, '')
    .replace(/\bnon\s*-?\s*gmo\b/gi, '')
    .replace(/\bgluten\s*-?\s*free\b/gi, '')
    .replace(/\bcertified\s+organic\b/gi, '')
    .replace(/\borganic\s+certified\b/gi, '')
    .replace(/[®™©]/g, '')
    .replace(/\*\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();
}

export function cleanLabelText(raw: string, opts?: { ocrConfidence?: number }): CleanedOcr {
  const warnings: string[] = [];
  if (!raw.trim()) {
    return { text: '', quality: 'poor', warnings: ['No text to analyze.'], looksLikeGarbage: true, ocrConfidence: opts?.ocrConfidence };
  }

  let text = raw.replace(/\u0000/g, '');
  text = joinHyphenatedLineBreaks(text);
  text = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ');

  // Phrase-level OCR fixes before word fixes
  text = text
    .replace(/ingrediex'?ts/gi, 'Ingredients')
    .replace(/ysrown\s+rice/gi, 'brown rice')
    .replace(/\brows?\s+rice/gi, 'brown rice')
    .replace(/certified\s+ysrown/gi, 'Certified Brown')
    .replace(/certified\s+rowns?/gi, 'Certified Brown')
    .replace(/\bwrown\b/gi, 'brown')
    .replace(/\bingrediets\b/gi, 'Ingredients')
    .replace(/\bingredients\b/gi, 'Ingredients');

  text = fixOcrWords(text);

  const { section, usedFallback, warnings: extractWarnings } = extractIngredientSection(text);
  warnings.push(...extractWarnings);

  let cleaned = stripLabelBoilerplate(section)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\s*]+|[,.\s*]+$/g, '')
    .trim();

  // Drop leftover footnote crumbs
  cleaned = cleaned
    .replace(/,?\s*\*?\s*Organic ingredients?\s*\.?$/i, '')
    .replace(/\(\s*\*?\s*Organic ingredients?\s*\.?\s*\)/gi, '')
    .replace(/\(\s*\*?\s*$/g, '')
    .replace(/^\s*\*\s*/g, '')
    .replace(/[,.\s]+$/g, '')
    .trim();

  if (cleaned.length > 12 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(Hfcs|Msg|Gmo|Usa|Uk)\b/g, (m) => m.toUpperCase());
  }

  const { quality, looksLikeGarbage } = scoreQuality(raw, cleaned, opts?.ocrConfidence);
  if (looksLikeGarbage) {
    warnings.push(
      'Couldn’t read this label clearly (OCR looks like packaging noise). Photograph just the INGREDIENTS line, or paste the text.',
    );
  } else if (quality === 'fair' && usedFallback) {
    warnings.push('Label text may include non-ingredient noise — review the editable text.');
  }

  return {
    text: looksLikeGarbage ? '' : cleaned,
    quality,
    warnings,
    looksLikeGarbage,
    ocrConfidence: opts?.ocrConfidence,
  };
}
