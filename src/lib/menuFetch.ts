import type { MenuSearchHit } from '../types';
import { parseMenuText } from './parseIngredients';
import { SAMPLE_RESTAURANTS } from '../data/sampleRestaurants';

const PROXY_BUILDERS: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchViaProxy(targetUrl: string, timeoutMs = 14000): Promise<{ html: string; proxyUsed: string }> {
  let lastErr: unknown;
  for (const build of PROXY_BUILDERS) {
    const proxyUrl = build(targetUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(proxyUrl, {
        signal: ctrl.signal,
        headers: { Accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`Proxy HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      if (!html || html.length < 40) {
        lastErr = new Error('Empty response from proxy');
        continue;
      }
      // allorigins sometimes wraps errors as JSON
      if (html.trim().startsWith('{') && /"error"|statusCode|CORS/i.test(html) && html.length < 500) {
        lastErr = new Error('Proxy error payload');
        continue;
      }
      return { html, proxyUsed: proxyUrl };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All proxies failed');
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|tr|h[1-6]|br|section|article|header|footer)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

/** Extract MenuItem names from JSON-LD if present. */
function extractJsonLdMenuItems(html: string): { name: string; description: string }[] {
  const out: { name: string; description: string }[] = [];
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of scripts) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      const stack = [...nodes];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;
        const types = ([] as string[]).concat((node as { '@type'?: string | string[] })['@type'] || []);
        if (types.some((t) => /MenuItem/i.test(String(t)))) {
          const name = String((node as { name?: string }).name || '').trim();
          const description = String((node as { description?: string }).description || '').trim();
          if (name) out.push({ name, description });
        }
        for (const v of Object.values(node)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    } catch {
      // ignore bad JSON-LD
    }
  }
  return out;
}

function looksLikeDishLine(line: string): boolean {
  if (line.length < 3 || line.length > 100) return false;
  if (/^(home|about|contact|privacy|terms|login|cart|order online|delivery|catering|gift cards?|locations?|hours|follow us|copyright|©)/i.test(line)) {
    return false;
  }
  if (/https?:\/\//i.test(line)) return false;
  if ((line.match(/[a-zA-Z]/g) || []).length < 3) return false;
  return true;
}

/**
 * Heuristic dish extraction from page text when JSON-LD is missing.
 */
export function extractDishesFromPageText(text: string): { name: string; description: string }[] {
  // Prefer structured menu parser first
  const parsed = parseMenuText(text);
  if (parsed.length >= 3) {
    return parsed.filter((d) => looksLikeDishLine(d.name)).slice(0, 60);
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const dishes: { name: string; description: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const price = line.match(/\$\s?\d+(\.\d{2})?/);
    const titleCase = /^[A-Z][\w'&()+.\- ]{2,60}$/.test(line) && line.split(' ').length <= 10;
    if (price || titleCase) {
      const name = line.replace(/\s*\$?\d+(\.\d{2})?\s*$/, '').replace(/\s{2,}/g, ' ').trim();
      if (!looksLikeDishLine(name)) continue;
      let description = '';
      const next = lines[i + 1];
      if (next && !/\$\d/.test(next) && next.length > 15 && next.length < 180 && !/^[A-Z][A-Z\s]{8,}$/.test(next)) {
        description = next;
        i++;
      }
      dishes.push({ name, description });
    }
  }
  return dedupeDishes(dishes).slice(0, 60);
}

function dedupeDishes(dishes: { name: string; description: string }[]) {
  const seen = new Set<string>();
  const out: { name: string; description: string }[] = [];
  for (const d of dishes) {
    const k = d.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

export interface FetchedMenu {
  dishes: { name: string; description: string }[];
  pageTitle?: string;
  rawTextPreview: string;
  note: string;
}

/** Fetch a menu URL via public CORS proxies and extract dishes. */
export async function fetchMenuFromUrl(url: string): Promise<FetchedMenu> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http(s) menu links are supported.');
  }

  let html: string;
  try {
    ({ html } = await fetchViaProxy(normalized));
  } catch {
    throw new Error(
      'Could not fetch that page (site or proxy blocked it). Paste the menu text instead, or try another link.',
    );
  }

  // Soft block detection
  if (/captcha|access denied|cf-browser-verification|just a moment|enable javascript|bot detection/i.test(html) && html.length < 8000) {
    throw new Error('The site blocked automated fetching (CAPTCHA / bot wall). Paste the menu text instead.');
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? decodeBasicEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : undefined;

  const jsonLd = extractJsonLdMenuItems(html);
  const text = stripTags(html);
  const fromText = extractDishesFromPageText(text);
  const dishes = dedupeDishes(jsonLd.length >= 2 ? [...jsonLd, ...fromText] : fromText);

  if (dishes.length === 0) {
    throw new Error(
      'Fetched the page but could not find dish names. The menu may be an image/PDF or heavily scripted — paste text instead.',
    );
  }

  const note =
    jsonLd.length >= 2
      ? `Pulled ${dishes.length} items (including structured menu data). Review for extras/noise.`
      : `Pulled ${dishes.length} likely dishes from page text. Review and edit below if needed — sites vary a lot.`;

  return {
    dishes,
    pageTitle,
    rawTextPreview: text.slice(0, 1500),
    note,
  };
}

function parseDuckDuckGoResults(html: string): MenuSearchHit[] {
  const hits: MenuSearchHit[] = [];
  // DuckDuckGo HTML endpoint uses result__a anchors
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < 10) {
    let href = decodeBasicEntities(m[1]);
    const title = decodeBasicEntities(m[2].replace(/<[^>]+>/g, '')).trim();
    // DDG sometimes wraps redirects
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        /* keep */
      }
    }
    if (!/^https?:\/\//i.test(href)) continue;
    if (/duckduckgo\.com|google\.com\/search/i.test(href)) continue;
    hits.push({ title: title || href, url: href });
  }

  // Fallback: plain links
  if (hits.length === 0) {
    const re2 = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = re2.exec(html)) && hits.length < 10) {
      const href = m[1];
      const title = decodeBasicEntities(m[2].replace(/<[^>]+>/g, '')).trim();
      if (/duckduckgo\.com|facebook\.com\/login/i.test(href)) continue;
      if (title.length < 3) continue;
      hits.push({ title, url: href });
    }
  }
  return hits;
}

/** Local sample restaurant matches (offline). */
export function searchSampleRestaurants(name: string, city?: string): MenuSearchHit[] {
  const q = name.trim().toLowerCase();
  const c = (city || '').trim().toLowerCase();
  if (!q) return [];
  return SAMPLE_RESTAURANTS.filter((r) => {
    const hay = `${r.name} ${r.city || ''} ${r.cuisine}`.toLowerCase();
    const nameOk = hay.includes(q) || q.split(/\s+/).every((w) => hay.includes(w));
    const cityOk = !c || (r.city || '').toLowerCase().includes(c);
    return nameOk && cityOk;
  }).map((r) => ({
    title: `${r.name}${r.city ? ` · ${r.city}` : ''} (sample menu)`,
    url: `sample:${r.id}`,
    snippet: r.cuisine,
  }));
}

/**
 * Search the web (via DuckDuckGo HTML + CORS proxy) for restaurant / menu pages.
 * Also returns matching offline sample restaurants.
 */
export async function searchRestaurantMenus(name: string, city?: string): Promise<{ hits: MenuSearchHit[]; note: string }> {
  const qName = name.trim();
  if (!qName) throw new Error('Enter a restaurant name to search.');

  const local = searchSampleRestaurants(qName, city);
  const query = [qName, city, 'menu'].filter(Boolean).join(' ');
  const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const { html } = await fetchViaProxy(ddg, 12000);
    const web = parseDuckDuckGoResults(html).filter((h) => {
      const t = `${h.title} ${h.url}`.toLowerCase();
      // Prefer food-ish results
      return /menu|restaurant|dining|eat|food|grill|cafe|café|kitchen|pizza|sushi|taco|bistro|bar\b/i.test(t) || true;
    });
    const hits = [...local, ...web].slice(0, 12);
    if (hits.length === 0) {
      return {
        hits: local,
        note: 'No web results came back. Try a more specific name/city, paste a menu URL, or use a sample.',
      };
    }
    return {
      hits,
      note: 'Pick a result to fetch its page, or paste a direct menu URL. Many sites block scraping — paste text if fetch fails.',
    };
  } catch {
    return {
      hits: local,
      note:
        local.length > 0
          ? 'Web search was blocked; showing offline sample matches. You can still paste a menu URL or text.'
          : 'Web search was blocked by the network/proxy. Paste a menu URL or menu text instead, or use a sample restaurant.',
    };
  }
}

export function dishesToMenuText(dishes: { name: string; description: string }[]): string {
  return dishes.map((d) => (d.description ? `${d.name}\n${d.description}` : d.name)).join('\n\n');
}
