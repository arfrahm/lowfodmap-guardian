import { matchIngredient } from './classify';
import { normalizeKey } from '../data/fodmapDatabase';
import { parseMenuText } from './parseIngredients';
import type { DishAnalysis, DishVerdict, RestaurantResult } from '../types';

const HIGH_DISH_KEYWORDS: { re: RegExp; label: string; tip: string }[] = [
  { re: /\b(onion|onions|caramelized onion|onion ring)/i, label: 'onion', tip: 'Ask for no onion; watch stocks and salsas.' },
  { re: /\b(garlic|aioli|garlic bread|garlic butter|garlic oil with pieces)/i, label: 'garlic', tip: 'Ask for no garlic; request plain oil/butter.' },
  { re: /\b(hummus|falafel|chickpea)/i, label: 'chickpeas', tip: 'Avoid hummus/falafel during elimination.' },
  { re: /\b(bean|beans|black bean|chili con carne|refried)/i, label: 'beans', tip: 'Skip bean-based dishes or sides.' },
  { re: /\b(lentil|dal|daal|dhal)/i, label: 'lentils', tip: 'Avoid lentil soups/curries in elimination.' },
  { re: /\b(cauliflower|cauli\b)/i, label: 'cauliflower', tip: 'Avoid cauliflower crusts/riced cauli.' },
  { re: /\b(mushroom|mushrooms)/i, label: 'mushroom', tip: 'Ask to hold mushrooms; oyster mushrooms are sometimes OK.' },
  { re: /\b(apple|pear|mango|watermelon|honey-glazed|honey glaze|\bhoney\b)/i, label: 'high fruit/honey', tip: 'Skip honey glazes and high-FODMAP fruits.' },
  { re: /\b(cashew|pistachio)/i, label: 'cashew/pistachio', tip: 'Avoid cashew creams/cheeses and pistachios.' },
  { re: /\b(wheat|breaded|battered|fried chicken sandwich|burger bun|ciabatta|baguette|sourdough bun)/i, label: 'wheat', tip: 'Ask for no bun, lettuce wrap, or gluten-free only if low-FODMAP certified.' },
  { re: /\b(milkshake|ice cream|mac and cheese|macaroni|cream soup|chowder)/i, label: 'lactose', tip: 'Ask for lactose-free options or skip creamy dairy.' },
  { re: /\b(couscous|risotto barley|barley)/i, label: 'high grain', tip: 'Swap to rice or potato.' },
  { re: /\b(asparagus|artichoke|shallot|leek\b)/i, label: 'high veg', tip: 'Ask to omit these vegetables.' },
];

const MODIFY_FRIENDLY: { re: RegExp; tip: string }[] = [
  { re: /\b(salad|bowl|grain bowl)/i, tip: 'Build with lettuce, cucumber, tomato, carrot, protein; dressing on the side; no onion/garlic.' },
  { re: /\b(grill|grilled|steak|salmon|chicken|fish|shrimp)/i, tip: 'Ask for grilled protein with no marinade (or lemon/oil/herbs only); sides: rice, potato, carrot.' },
  { re: /\b(taco|burrito|fajita)/i, tip: 'Corn tortillas if possible; skip beans, onion, guacamole large serve; ask about seasoning.' },
  { re: /\b(sushi|sashimi)/i, tip: 'Choose plain rice + fish rolls; avoid onion, avocado overload, and sweet sauces with HFCS.' },
  { re: /\b(pizza)/i, tip: 'Difficult — most crusts are wheat; if GF crust available, ask no garlic oil and simple toppings.' },
  { re: /\b(soup)/i, tip: 'Most soups use onion/garlic stock — usually avoid unless kitchen confirms.' },
  { re: /\b(stir-?fry|curry)/i, tip: 'Ask for no onion/garlic; sauce on the side; pair with rice.' },
  { re: /\b(burger|sandwich)/i, tip: 'No bun or GF bun if suitable; no onion; plain mayo/mustard; skip aioli.' },
  { re: /\b(pasta)/i, tip: 'Ask if rice/corn pasta available; simple oil/butter + protein; no garlic.' },
];

const PORTION_NOTES: { re: RegExp; note: string }[] = [
  { re: /\bavocado\b|guacamole/i, note: 'Avocado: keep to ~1/8 fruit; guac often has onion/garlic — ask.' },
  { re: /\bsweet potato\b/i, note: 'Sweet potato: about ½ cup cubed is the usual low-FODMAP serve.' },
  { re: /\bcorn\b|\bsweetcorn\b/i, note: 'Sweet corn: about ½ cob.' },
  { re: /\bzucchini\b|\bcourgette\b/i, note: 'Zucchini: about ⅓ cup.' },
  { re: /\bbroccoli\b/i, note: 'Broccoli: modest florets (~¾ cup heads).' },
  { re: /\boatmeal\b|\boats\b|\boodles of oats/i, note: 'Oats: ~½ cup uncooked.' },
  { re: /\balmond\b/i, note: 'Almonds: ~10 nuts.' },
  { re: /\bcoconut (milk|cream)\b/i, note: 'Coconut milk: modest serve; check for inulin.' },
];

function scanText(text: string): {
  high: string[];
  mods: string[];
  portions: string[];
  allium: boolean;
} {
  const high: string[] = [];
  const mods: string[] = [];
  const portions: string[] = [];
  let allium = false;

  for (const k of HIGH_DISH_KEYWORDS) {
    if (k.re.test(text)) {
      high.push(k.label);
      mods.push(k.tip);
      if (/onion|garlic|shallot|leek|aioli/i.test(k.label) || /onion|garlic/i.test(k.re.source)) allium = true;
    }
  }
  for (const m of MODIFY_FRIENDLY) {
    if (m.re.test(text)) mods.push(m.tip);
  }
  for (const p of PORTION_NOTES) {
    if (p.re.test(text)) portions.push(p.note);
  }

  // Also run ingredient matcher over tokens
  const tokens = text.split(/[^a-zA-Z0-9%-]+/).filter((t) => t.length > 2);
  const joined = normalizeKey(text);
  for (const t of [...tokens, ...joined.split(' ')]) {
    const { entry } = matchIngredient(t);
    if (entry?.allium) allium = true;
    if (entry?.level === 'high' && !high.includes(entry.name)) {
      high.push(entry.name);
      mods.push(`Omit or replace: ${entry.name} (${entry.reason})`);
    }
    if (entry?.level === 'moderate' && entry.serving) {
      const note = `${entry.name}: ${entry.serving}`;
      if (!portions.includes(note)) portions.push(note);
    }
  }

  return { high: uniq(high), mods: uniq(mods), portions: uniq(portions), allium };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)];
}

export function analyzeDish(name: string, description = ''): DishAnalysis {
  const text = `${name} ${description}`;
  const { high, mods, portions, allium } = scanText(text);

  let verdict: DishVerdict = 'SAFE';
  const reasons: string[] = [];

  if (high.length >= 2 || (allium && high.length >= 1)) {
    // Many high flags — might still be modifiable if it's a grill item
    const grillLike = /\b(grill|grilled|steak|salmon|chicken breast|steamed|baked fish|rice bowl)\b/i.test(text);
    if (grillLike && high.length <= 3) {
      verdict = 'ASK_TO_MODIFY';
      reasons.push('Base protein/carb can work, but listed high-FODMAP components need changes.');
    } else if (/\b(soup|hummus|onion rings|garlic bread|bean burrito|mac and cheese)\b/i.test(text)) {
      verdict = 'AVOID';
      reasons.push('Core of this dish is typically high-FODMAP and hard to fix.');
    } else {
      verdict = 'ASK_TO_MODIFY';
      reasons.push('Several FODMAP risks — order only if the kitchen can simplify.');
    }
  } else if (high.length === 1) {
    verdict = 'ASK_TO_MODIFY';
    reasons.push(`Flagged for ${high[0]} — ask to remove or substitute.`);
  } else if (portions.length > 0) {
    verdict = 'SAFE';
    reasons.push('No high-FODMAP core detected; watch portion-sensitive items.');
  } else {
    verdict = 'SAFE';
    reasons.push('No obvious high-FODMAP ingredients from the menu text.');
  }

  // Force AVOID for clear landmines
  if (/\b(garlic bread|onion rings|french onion|hummus plate|baked beans|cauliflower crust pizza)\b/i.test(text)) {
    verdict = 'AVOID';
    reasons.push('Classic high-FODMAP dish — better to skip.');
  }

  const modifications =
    verdict === 'AVOID'
      ? uniq(['Choose a simpler grilled protein + rice/potato instead.', ...mods]).slice(0, 6)
      : uniq([
          'Say: “no onion, no garlic — including powders/stocks.”',
          'Ask for sauces/dressings on the side.',
          ...mods,
        ]).slice(0, 8);

  return {
    name,
    description: description || undefined,
    verdict,
    reasons: uniq(reasons),
    modifications,
    portionNotes: portions.slice(0, 6),
    flaggedIngredients: high,
  };
}

export function analyzeMenuPaste(restaurantName: string, menuText: string, city?: string): RestaurantResult {
  const dishes = parseMenuText(menuText).map((d) => analyzeDish(d.name, d.description));
  return {
    restaurantName: restaurantName || 'Pasted menu',
    city,
    dishes,
    tips: defaultTips(),
  };
}

export function analyzeSampleRestaurant(
  name: string,
  dishes: { name: string; description: string }[],
  city?: string,
): RestaurantResult {
  return {
    restaurantName: name,
    city,
    dishes: dishes.map((d) => analyzeDish(d.name, d.description)),
    tips: defaultTips(),
  };
}

function defaultTips(): string[] {
  return [
    'Magic phrase: “I need no onion and no garlic in any form — powder, oil with pieces, or stock.”',
    'Safe sides often: plain rice, baked potato, carrot, cucumber salad (check dressing), grilled zucchini (small).',
    'Prefer grilled / steamed / baked over breaded, creamy, or soup-based dishes.',
    'When unsure, ask how the protein is seasoned and whether the kitchen uses a shared garlic-onion marinade.',
  ];
}
