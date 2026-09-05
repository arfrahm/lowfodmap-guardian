import { buildAliasIndex, normalizeKey, FODMAP_DB } from '../data/fodmapDatabase';
import type { ClassifiedIngredient, FodmapEntry, FodmapLevel, LabelAnalysis, OverallVerdict } from '../types';
import { parseIngredientTextAlreadyCleaned, prepareLabelText } from './parseIngredients';
import type { OcrQuality } from './ocrCleanup';

const ALIAS_INDEX = buildAliasIndex();

/** Longest-alias-first list for word-boundary matching */
const SORTED_ALIASES: { key: string; entry: FodmapEntry }[] = (() => {
  const items: { key: string; entry: FodmapEntry }[] = [];
  for (const entry of FODMAP_DB) {
    for (const a of [entry.name, ...entry.aliases]) {
      const key = normalizeKey(a);
      if (key) items.push({ key, entry });
    }
  }
  items.sort((a, b) => b.key.length - a.key.length);
  return items;
})();

/** Minimum alias length for non-exact / substring-style matches */
const MIN_FUZZY_LEN = 4;

const PREFIXES =
  /^(regenerative\s+organic\s+certified|certified\s+organic|organic\s+certified|usda\s+organic|non\s*-?\s*gmo|gluten\s*-?\s*free|organic|natural|fresh|dried|raw|cooked|roasted|smoked|sliced|minced|powdered|ground|pure|extra virgin|virgin|unsalted|salted|sweetened|unsweetened|enriched|bleached|unbleached|instant|concentrated)\s+/i;

const SUFFIXES =
  /\s+(powder|powders|extract|extracts|solids|solid|puree|purée|paste|juice|flakes|pieces|pieces|granules|crumbles|concentrate|protein|protein concentrate|flour|starch|oil|oils|syrup|sauce|seasoning|seasonings|flavor|flavour|flavors|flavours)$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tryExact(key: string): FodmapEntry | null {
  return ALIAS_INDEX.get(key) ?? null;
}

/** Whole-phrase word-boundary match against aliases (longest first). */
function tryWordBoundary(key: string): { entry: FodmapEntry; matchedAs: string } | null {
  for (const { key: alias, entry } of SORTED_ALIASES) {
    if (alias.length < MIN_FUZZY_LEN) continue;
    if (key === alias) return { entry, matchedAs: entry.name };
    const re = new RegExp(`(?:^|\\s)${escapeRe(alias)}(?:\\s|$)`);
    if (re.test(key)) return { entry, matchedAs: entry.name };
  }
  return null;
}

/**
 * Match a single ingredient token against the FODMAP KB.
 * Prefers exact / normalized hits; avoids short-substring false positives.
 */
export function matchIngredient(raw: string): { entry: FodmapEntry | null; matchedAs: string | null } {
  let key = normalizeKey(raw);
  if (!key) return { entry: null, matchedAs: null };

  // Strip trailing junk left from OCR
  key = key.replace(/\s+/g, ' ').trim();

  const exact = tryExact(key);
  if (exact) return { entry: exact, matchedAs: exact.name };

  // Strip common culinary prefixes once and retry exact
  let stripped = key;
  for (let i = 0; i < 3; i++) {
    const next = stripped.replace(PREFIXES, '');
    if (next === stripped) break;
    stripped = next.trim();
  }
  if (stripped && stripped !== key) {
    const e2 = tryExact(stripped);
    if (e2) return { entry: e2, matchedAs: e2.name };
  }

  // Strip trailing form words: "onion powder" is an alias, but "annatto powder" → try "annatto"
  const withoutSuffix = key.replace(SUFFIXES, '').trim();
  if (withoutSuffix && withoutSuffix !== key && withoutSuffix.length >= 3) {
    const e3 = tryExact(withoutSuffix);
    if (e3) return { entry: e3, matchedAs: e3.name };
    const e4 = tryExact(stripped.replace(SUFFIXES, '').trim());
    if (e4) return { entry: e4, matchedAs: e4.name };
  }

  // Word-boundary phrase match (e.g. "whole milk powder" contains "milk powder")
  const wb = tryWordBoundary(key) || (stripped !== key ? tryWordBoundary(stripped) : null);
  if (wb) return wb;

  // Conservative contains: ingredient is longer and fully contains a long alias as a substring
  // with word boundaries — already covered above. As a last resort, allow alias to appear
  // inside key only when alias is long (>= 6) to avoid "oil", "pea", "rum"-style hits.
  for (const { key: alias, entry } of SORTED_ALIASES) {
    if (alias.length < 6) continue;
    if (key.includes(alias)) {
      const re = new RegExp(`(?:^|[^a-z])${escapeRe(alias)}(?:[^a-z]|$)`);
      if (re.test(key)) return { entry, matchedAs: entry.name };
    }
  }

  return { entry: null, matchedAs: null };
}

export function classifyIngredient(raw: string): ClassifiedIngredient {
  const { entry, matchedAs } = matchIngredient(raw);
  if (!entry) {
    return {
      raw,
      matchedName: null,
      level: 'unknown',
      reason:
        'Not in the local knowledge base — treat as caution and verify with the Monash app or the full ingredient context.',
      allium: false,
      trap: false,
    };
  }
  return {
    raw,
    matchedName: matchedAs,
    level: entry.level,
    reason: entry.reason,
    serving: entry.serving,
    allium: !!entry.allium,
    trap: !!entry.trap,
  };
}

export function analyzeLabelText(text: string): LabelAnalysis {
  const prepared = prepareLabelText(text);
  const ingredients = prepared.ingredients.map(classifyIngredient);
  return summarize(ingredients, {
    ocrQuality: prepared.quality,
    warnings: prepared.warnings,
    cleanedText: prepared.text,
  });
}

/** Analyze already-cleaned editable text (skip re-extracting section). */
export function analyzeCleanedLabelText(
  cleanedText: string,
  meta?: { ocrQuality?: OcrQuality; warnings?: string[] },
): LabelAnalysis {
  const parts = parseIngredientTextAlreadyCleaned(cleanedText);
  const ingredients = parts.map(classifyIngredient);
  return summarize(ingredients, {
    ocrQuality: meta?.ocrQuality,
    warnings: meta?.warnings,
    cleanedText,
  });
}

export function summarize(
  ingredients: ClassifiedIngredient[],
  meta?: { ocrQuality?: OcrQuality; warnings?: string[]; cleanedText?: string },
): LabelAnalysis {
  const highCount = ingredients.filter((i) => i.level === 'high').length;
  const moderateCount = ingredients.filter((i) => i.level === 'moderate').length;
  const lowCount = ingredients.filter((i) => i.level === 'low').length;
  const unknownCount = ingredients.filter((i) => i.level === 'unknown').length;
  const alliumAlert = ingredients.some((i) => i.allium);

  let overall: OverallVerdict = 'SAFE';
  if (highCount > 0 || alliumAlert) overall = 'AVOID';
  else if (moderateCount > 0 || unknownCount > 0) overall = 'CAUTION';

  // Poor OCR → never claim SAFE
  if (meta?.ocrQuality === 'poor' && overall === 'SAFE') {
    overall = 'CAUTION';
  }

  const bits: string[] = [];
  if (meta?.ocrQuality === 'poor') bits.push('OCR was unclear — edit the text and re-check.');
  if (alliumAlert) bits.push('Onion/garlic (or derivative) detected — avoid during elimination.');
  if (highCount > 0) bits.push(`${highCount} high-FODMAP ingredient${highCount > 1 ? 's' : ''}.`);
  if (moderateCount > 0) {
    bits.push(
      `${moderateCount} portion-sensitive / caution ingredient${moderateCount > 1 ? 's' : ''} — check serving sizes.`,
    );
  }
  if (unknownCount > 0) bits.push(`${unknownCount} unrecognized — verify separately (shown as unknown, not guessed).`);
  if (overall === 'SAFE') bits.push('No high-FODMAP flags in the matched ingredients for elimination.');

  return {
    ingredients,
    overall,
    summary: bits.join(' '),
    alliumAlert,
    highCount,
    moderateCount,
    lowCount,
    unknownCount,
    ocrQuality: meta?.ocrQuality,
    warnings: meta?.warnings,
    cleanedText: meta?.cleanedText,
  };
}

export function levelRank(level: FodmapLevel | 'unknown'): number {
  switch (level) {
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'unknown':
      return 1;
    case 'low':
      return 0;
  }
}
