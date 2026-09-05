import { buildAliasIndex, normalizeKey, FODMAP_DB } from '../data/fodmapDatabase';
import type { ClassifiedIngredient, FodmapEntry, FodmapLevel, LabelAnalysis, OverallVerdict } from '../types';
import { parseIngredientText } from './parseIngredients';

const ALIAS_INDEX = buildAliasIndex();

/** Longest-alias-first list for substring matching */
const SORTED_ALIASES: { key: string; entry: FodmapEntry }[] = (() => {
  const items: { key: string; entry: FodmapEntry }[] = [];
  for (const entry of FODMAP_DB) {
    for (const a of [entry.name, ...entry.aliases]) {
      items.push({ key: normalizeKey(a), entry });
    }
  }
  items.sort((a, b) => b.key.length - a.key.length);
  return items;
})();

export function matchIngredient(raw: string): { entry: FodmapEntry | null; matchedAs: string | null } {
  const key = normalizeKey(raw);
  if (!key) return { entry: null, matchedAs: null };

  // Exact alias hit
  const exact = ALIAS_INDEX.get(key);
  if (exact) return { entry: exact, matchedAs: exact.name };

  // Try removing common prefixes
  const stripped = key.replace(/^(organic|natural|fresh|dried|raw|cooked|roasted|smoked|sliced|minced|powdered|ground|pure|extra virgin|virgin)\s+/g, '');
  if (stripped !== key) {
    const e2 = ALIAS_INDEX.get(stripped);
    if (e2) return { entry: e2, matchedAs: e2.name };
  }

  // Substring / contains match (longest first)
  for (const { key: alias, entry } of SORTED_ALIASES) {
    if (alias.length < 3) continue;
    if (key === alias || key.includes(alias) || alias.includes(key)) {
      // Avoid tiny false positives (e.g. "oil" matching everything with "oil")
      if (alias.length <= 3 && key !== alias) continue;
      if (key.includes(alias) || (alias.includes(key) && key.length >= Math.min(5, alias.length))) {
        return { entry, matchedAs: entry.name };
      }
    }
  }

  // Word-boundary fuzzy: any alias word sequence in the raw text
  for (const { key: alias, entry } of SORTED_ALIASES) {
    if (alias.length < 4) continue;
    const re = new RegExp(`(?:^|\\s)${escapeRe(alias)}(?:\\s|$)`);
    if (re.test(key)) return { entry, matchedAs: entry.name };
  }

  return { entry: null, matchedAs: null };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function classifyIngredient(raw: string): ClassifiedIngredient {
  const { entry, matchedAs } = matchIngredient(raw);
  if (!entry) {
    return {
      raw,
      matchedName: null,
      level: 'unknown',
      reason: 'Not in the local knowledge base — check the Monash app or ingredients within this item.',
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
  const parts = parseIngredientText(text);
  const ingredients = parts.map(classifyIngredient);
  return summarize(ingredients);
}

export function summarize(ingredients: ClassifiedIngredient[]): LabelAnalysis {
  const highCount = ingredients.filter((i) => i.level === 'high').length;
  const moderateCount = ingredients.filter((i) => i.level === 'moderate').length;
  const lowCount = ingredients.filter((i) => i.level === 'low').length;
  const unknownCount = ingredients.filter((i) => i.level === 'unknown').length;
  const alliumAlert = ingredients.some((i) => i.allium);

  let overall: OverallVerdict = 'SAFE';
  if (highCount > 0 || alliumAlert) overall = 'AVOID';
  else if (moderateCount > 0 || unknownCount > 0) overall = 'CAUTION';

  const bits: string[] = [];
  if (alliumAlert) bits.push('Onion/garlic (or derivative) detected — avoid during elimination.');
  if (highCount > 0) bits.push(`${highCount} high-FODMAP ingredient${highCount > 1 ? 's' : ''}.`);
  if (moderateCount > 0) bits.push(`${moderateCount} portion-sensitive ingredient${moderateCount > 1 ? 's' : ''} — check serving sizes.`);
  if (unknownCount > 0) bits.push(`${unknownCount} unrecognized — verify separately.`);
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
