import { cleanLabelText, type CleanedOcr } from './ocrCleanup';

/** Tokens that are never useful as standalone FODMAP ingredients */
const NOISE_ONLY =
  /^(organic|natural|pure|fresh|dried|raw|cooked|roasted|smoked|sliced|minced|ground|powdered|extra|virgin|filtered|carbonated|distilled|and|or|with|of|the|a|an|for|from|less|more|than|ingredients?|contains?)$/i;

/** Safe-to-ignore processing aids / carriers (still matched if in KB; filtered only when empty of meaning) */
const IGNORE_INGREDIENTS =
  /^(water|carbonated water|steam|air|nitrogen|oxygen)$/i;

function cleanToken(p: string): string {
  return p
    .replace(/^[\s*†‡§•·\-–—:]+/, '')
    .replace(/[\s*†‡§•·]+$/, '')
    .replace(/\d+(\.\d+)?\s*%/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(mg|g|kg|ml|l|oz|mcg|iu|kcal)\b/gi, ' ')
    .replace(/[.]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[(\[]+|[)\]]+$/g, '')
    .replace(/[.,;:(*\[]+$/g, '')
    .replace(/^[)\]]*|[(*\[]+$/g, '')
    .trim();
}

function looksLikeIngredient(p: string): boolean {
  if (p.length < 2 || p.length > 80) return false;
  if (!/[a-zA-Z]/.test(p)) return false;
  if (NOISE_ONLY.test(p)) return false;
  if (IGNORE_INGREDIENTS.test(p)) return false;
  // Mostly digits / codes
  if (/^\d+$/.test(p)) return false;
  if (/^(e\d{3}|ins\s*\d+)/i.test(p)) return false;
  // Nutrition leftovers
  if (/^(calories|total fat|saturated|trans fat|cholesterol|sodium|carbohydrate|protein|serving size|daily value|amount per)\b/i.test(p)) {
    return false;
  }
  // Too few letters relative to junk
  const letters = (p.match(/[a-zA-Z]/g) || []).length;
  if (letters < 2) return false;
  if (letters / p.replace(/\s/g, '').length < 0.5) return false;
  return true;
}

/** Split on commas/semicolons/bullets while respecting parentheses. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (depth === 0 && (ch === ',' || ch === ';' || ch === '|' || ch === '•' || ch === '·')) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else if (depth === 0 && text.slice(i).match(/^\s+and\s+(?=[A-Z])/)) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      i += text.slice(i).match(/^\s+and\s+/)![0].length - 1;
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Expand "Cheddar Cheese (milk, salt, cultures)" → outer + nested ingredients. */
function expandPart(part: string): string[] {
  const trimmed = part.trim();
  const m = trimmed.match(/^(.+?)\s*[\(\[](.+)[\)\]]\s*$/);
  if (m) {
    const outer = cleanToken(m[1]);
    const innerParts = splitTopLevel(m[2]).flatMap(expandPart);
    const out: string[] = [];
    if (outer && looksLikeIngredient(outer)) out.push(outer);
    for (const inn of innerParts) {
      const c = cleanToken(inn);
      if (c && looksLikeIngredient(c)) out.push(c);
    }
    return out;
  }
  const c = cleanToken(trimmed);
  return c && looksLikeIngredient(c) ? [c] : [];
}

function dedupePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of items) {
    const key = p.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Split messy label / paste text into ingredient-like tokens.
 * Applies OCR cleanup + Ingredients: extraction first.
 */
export function parseIngredientText(text: string): string[] {
  const cleaned = cleanLabelText(text);
  return parseIngredientTextAlreadyCleaned(cleaned.text);
}

/** Parse when caller already ran cleanLabelText (avoids double-clean). */
export function parseIngredientTextAlreadyCleaned(cleanedText: string): string[] {
  if (!cleanedText.trim()) return [];

  let working = cleanedText
    .replace(/\bingredients?\b\s*[:.\-–]?\s*/gi, ' ')
    .replace(/\bmay contain\b\s*[:.\-–]?[\s\S]*$/gi, ' ')
    .replace(/\ballergens?\b\s*[:.\-–]?[\s\S]*$/gi, ' ');

  // If a Contains: line remains as a duplicate allergen list at the end, drop it
  // when we already have a long ingredient list before it.
  const containsSplit = working.split(/\bcontains\b\s*[:.\-–]?\s*/i);
  if (containsSplit.length === 2 && containsSplit[0].split(/[,;]/).length >= 3) {
    // Keep main list; allergen "Contains" often duplicates milk/wheat/soy
    working = containsSplit[0];
  } else {
    working = working.replace(/\bcontains\b\s*[:.\-–]?\s*/gi, ' ');
  }

  const parts = splitTopLevel(working).flatMap(expandPart);
  return dedupePreserve(parts);
}

/** Clean + parse helper for the label UI. */
export function prepareLabelText(raw: string): CleanedOcr & { ingredients: string[] } {
  const cleaned = cleanLabelText(raw);
  return {
    ...cleaned,
    ingredients: parseIngredientTextAlreadyCleaned(cleaned.text),
  };
}

/** Split pasted restaurant menus into dish-like blocks. */
export function parseMenuText(text: string): { name: string; description: string }[] {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const dishes: { name: string; description: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (
      /^(appetizers|starters|mains?|entrees?|entrées?|sides?|desserts?|drinks?|beverages?|salads?|soups?|kids|lunch|dinner|breakfast|brunch)\b/i.test(
        line,
      ) &&
      line.length < 40
    ) {
      i++;
      continue;
    }
    const priceMatch = line.match(/^(.*?)(?:\s*[.·…]{2,}\s*|\s+)\$?\d+(\.\d{2})?\s*$/);
    let name = priceMatch ? priceMatch[1].trim() : line;
    name = name.replace(/\s*\$\d+(\.\d{2})?\s*$/, '').trim();

    const descParts: string[] = [];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        /\$\d/.test(next) ||
        (/^[A-Z0-9].{0,60}$/.test(next) && !/[.]$/.test(next) && next.split(' ').length <= 8) ||
        /^(appetizers|starters|mains?|entrees?|entrées?|sides?|desserts?)\b/i.test(next)
      ) {
        if (/\$\d/.test(next) && next.split(' ').length <= 10) break;
        if (/^(appetizers|starters|mains?|entrees?|entrées?|sides?|desserts?)\b/i.test(next)) break;
        if (/^[A-Z]/.test(next) && next.length < 50 && !next.includes(',')) break;
      }
      if (next.length > 20 || /[,.]/.test(next)) {
        descParts.push(next);
        i++;
      } else {
        break;
      }
    }

    if (name.length >= 2 && name.length < 120) {
      dishes.push({ name, description: descParts.join(' ') });
    }
  }

  if (dishes.length === 0) {
    return lines
      .filter((l) => l.length > 2)
      .map((l) => ({ name: l.replace(/\s*\$\d+(\.\d{2})?\s*$/, ''), description: '' }));
  }
  return dishes;
}
