/** Split messy label / paste text into ingredient-like tokens. */
export function parseIngredientText(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, '\n')
    .replace(/ingredients?:/gi, ' ')
    .replace(/contains?:/gi, ' ')
    .replace(/may contain[:\s].*$/gim, ' ')
    .replace(/allerg[yen]s?[:\s].*$/gim, ' ');

  const parts = cleaned
    .split(/[,;|\n•·]+|(?:\s+and\s+)(?=[A-Z])/)
    .map((p) =>
      p
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\d+(\.\d+)?\s*%/g, ' ')
        .replace(/\b\d+(\.\d+)?\s*(mg|g|kg|ml|l|oz|mcg|iu)\b/gi, ' ')
        .replace(/[*†‡§]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 1 && /[a-zA-Z]/.test(p))
    .filter((p) => !/^(organic|natural|pure|fresh|dried|raw|cooked|roasted|spices|flavor|flavour|color|colour|water|carbonated water)$/i.test(p));

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
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
    // Skip obvious section headers
    if (/^(appetizers|starters|mains?|entrees?|entrées?|sides?|desserts?|drinks?|beverages?|salads?|soups?|kids|lunch|dinner)\b/i.test(line) && line.length < 40) {
      i++;
      continue;
    }
    // Price on same line: "Dish Name .... $12.50" or "Dish Name - 12"
    const priceMatch = line.match(/^(.*?)(?:\s*[\.·…]{2,}\s*|\s+)\$?\d+(\.\d{2})?\s*$/);
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
        // likely next dish / section
        if (/\$\d/.test(next) && next.split(' ').length <= 10) break;
        if (/^(appetizers|starters|mains?|entrees?|entrées?|sides?|desserts?)\b/i.test(next)) break;
        if (/^[A-Z]/.test(next) && next.length < 50 && !next.includes(',')) break;
      }
      // continuation description
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

  // Fallback: if almost nothing parsed, treat non-empty lines as dishes
  if (dishes.length === 0) {
    return lines.filter((l) => l.length > 2).map((l) => ({ name: l.replace(/\s*\$\d+(\.\d{2})?\s*$/, ''), description: '' }));
  }
  return dishes;
}
