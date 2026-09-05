export type FodmapLevel = 'low' | 'moderate' | 'high';

export type OverallVerdict = 'SAFE' | 'CAUTION' | 'AVOID';

export type DishVerdict = 'SAFE' | 'ASK_TO_MODIFY' | 'AVOID';

export interface FodmapEntry {
  /** Canonical name */
  name: string;
  /** Aliases / OCR variants for matching */
  aliases: string[];
  level: FodmapLevel;
  /** Category for grouping */
  category: string;
  /** Why it is flagged during elimination */
  reason: string;
  /** Serving guidance during elimination (Monash-style) */
  serving?: string;
  /** Extra strong flag for onion/garlic derivatives */
  allium?: boolean;
  /** Hidden/common trap ingredient */
  trap?: boolean;
}

export interface ClassifiedIngredient {
  raw: string;
  matchedName: string | null;
  level: FodmapLevel | 'unknown';
  reason: string;
  serving?: string;
  allium: boolean;
  trap: boolean;
}

export interface LabelAnalysis {
  ingredients: ClassifiedIngredient[];
  overall: OverallVerdict;
  summary: string;
  alliumAlert: boolean;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  unknownCount: number;
  /** OCR / paste quality heuristic */
  ocrQuality?: 'good' | 'fair' | 'poor';
  warnings?: string[];
  cleanedText?: string;
}

export interface DishAnalysis {
  name: string;
  description?: string;
  verdict: DishVerdict;
  reasons: string[];
  modifications: string[];
  portionNotes: string[];
  flaggedIngredients: string[];
}

export interface RestaurantMenu {
  id: string;
  name: string;
  city?: string;
  cuisine: string;
  dishes: { name: string; description: string }[];
}

export interface RestaurantResult {
  restaurantName: string;
  city?: string;
  dishes: DishAnalysis[];
  tips: string[];
  sourceUrl?: string;
  sourceNote?: string;
}

export interface MenuSearchHit {
  title: string;
  url: string;
  snippet?: string;
}
