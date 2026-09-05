import { useMemo, useState } from 'react';
import { SAMPLE_RESTAURANTS } from '../data/sampleRestaurants';
import { analyzeMenuPaste, analyzeSampleRestaurant } from '../lib/restaurantAnalyze';
import {
  dishesToMenuText,
  fetchMenuFromUrl,
  searchRestaurantMenus,
} from '../lib/menuFetch';
import type { MenuSearchHit, RestaurantResult } from '../types';
import { DishCard } from '../components/DishCard';
import { Disclaimer } from '../components/Disclaimer';

type Filter = 'ALL' | 'SAFE' | 'ASK_TO_MODIFY' | 'AVOID';

export function RestaurantPlanner() {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [menuText, setMenuText] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const [result, setResult] = useState<RestaurantResult | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hits, setHits] = useState<MenuSearchHit[]>([]);

  const filteredDishes = useMemo(() => {
    if (!result) return [];
    if (filter === 'ALL') return result.dishes;
    return result.dishes.filter((d) => d.verdict === filter);
  }, [result, filter]);

  const runPaste = () => {
    setError(null);
    setInfo(null);
    if (!menuText.trim()) {
      setError('Paste menu text, fetch a URL, search, or pick a sample restaurant below.');
      return;
    }
    const analyzed = analyzeMenuPaste(name.trim() || 'Pasted menu', menuText, city.trim() || undefined);
    setResult(analyzed);
    setFilter('ALL');
  };

  const loadSample = (id: string) => {
    const sample = SAMPLE_RESTAURANTS.find((r) => r.id === id);
    if (!sample) return;
    setName(sample.name);
    setCity(sample.city || '');
    setMenuText(sample.dishes.map((d) => `${d.name}\n${d.description}`).join('\n\n'));
    setResult(analyzeSampleRestaurant(sample.name, sample.dishes, sample.city));
    setFilter('ALL');
    setError(null);
    setInfo('Loaded offline sample menu.');
    setHits([]);
  };

  const onSearch = async () => {
    setError(null);
    setInfo(null);
    setBusy('Searching for menus…');
    try {
      const { hits: found, note } = await searchRestaurantMenus(name, city);
      setHits(found);
      setInfo(note);
      if (found.length === 0) setError('No matches. Try another name/city, paste a URL, or use a sample.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
      setHits([]);
    } finally {
      setBusy(null);
    }
  };

  const applyFetched = async (url: string, titleHint?: string) => {
    if (url.startsWith('sample:')) {
      loadSample(url.slice('sample:'.length));
      return;
    }
    setError(null);
    setInfo(null);
    setBusy('Fetching menu page…');
    try {
      const fetched = await fetchMenuFromUrl(url);
      const text = dishesToMenuText(fetched.dishes);
      setMenuText(text);
      setMenuUrl(url);
      if (!name.trim() && fetched.pageTitle) {
        setName(fetched.pageTitle.split(/[|\-–]/)[0].trim().slice(0, 80));
      } else if (!name.trim() && titleHint) {
        setName(titleHint.split(/[|\-–]/)[0].trim().slice(0, 80));
      }
      const restaurantName = name.trim() || titleHint?.split(/[|\-–]/)[0].trim() || fetched.pageTitle || 'Menu from URL';
      const analyzed = analyzeMenuPaste(restaurantName, text, city.trim() || undefined);
      analyzed.sourceUrl = url;
      analyzed.sourceNote = fetched.note;
      setResult(analyzed);
      setFilter('ALL');
      setInfo(fetched.note + ' You can edit the menu text and re-analyze.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed.');
    } finally {
      setBusy(null);
    }
  };

  const onFetchUrl = () => {
    if (!menuUrl.trim()) {
      setError('Paste a menu page URL first.');
      return;
    }
    void applyFetched(menuUrl.trim());
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Restaurant planner</h1>
        <p>
          Search by name, paste a menu link, or paste menu text. Get SAFE / ASK TO MODIFY / AVOID with tips.
        </p>
      </header>

      <div className="card">
        <div className="field-grid">
          <div>
            <label className="field-label" htmlFor="rest-name">
              Restaurant name
            </label>
            <input
              id="rest-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harbor Grill"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="rest-city">
              City / location
            </label>
            <input
              id="rest-city"
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => void onSearch()} disabled={!!busy}>
            Search online
          </button>
        </div>

        {hits.length > 0 && (
          <div className="search-hits">
            <p className="field-label">Search results</p>
            <ul className="hit-list">
              {hits.map((h) => (
                <li key={h.url}>
                  <button type="button" className="hit-btn" onClick={() => void applyFetched(h.url, h.title)} disabled={!!busy}>
                    <strong>{h.title}</strong>
                    <span className="hit-url">{h.url.startsWith('sample:') ? 'Offline sample' : h.url}</span>
                    {h.snippet ? <span className="hit-snip">{h.snippet}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="field-label" htmlFor="menu-url">
          Menu page URL
        </label>
        <div className="url-row">
          <input
            id="menu-url"
            className="input"
            value={menuUrl}
            onChange={(e) => setMenuUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
          <button type="button" className="btn secondary" onClick={onFetchUrl} disabled={!!busy}>
            Fetch menu
          </button>
        </div>
        <p className="muted tiny">
          Static app: pages are loaded through a public CORS proxy. Many restaurants block this — if so, paste menu text
          below.
        </p>

        <label className="field-label" htmlFor="menu">
          Menu text
        </label>
        <textarea
          id="menu"
          className="input textarea"
          rows={9}
          placeholder={'Paste dishes, e.g.\nGrilled Salmon $24\nLemon herb butter, rice, carrots\n\nGarlic Shrimp Pasta $19\n...'}
          value={menuText}
          onChange={(e) => setMenuText(e.target.value)}
        />

        <div className="btn-row">
          <button type="button" className="btn primary" onClick={runPaste} disabled={!!busy}>
            Analyze menu
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMenuText('');
              setMenuUrl('');
              setResult(null);
              setError(null);
              setInfo(null);
              setHits([]);
            }}
          >
            Clear
          </button>
        </div>
        {busy && <p className="status-line">{busy}</p>}
        {info && <p className="status-line">{info}</p>}
        {error && <p className="error-line">{error}</p>}
      </div>

      <section className="card">
        <h2 className="section-title">Sample restaurants</h2>
        <p className="muted">Offline canned menus — always available when the web fetch is blocked.</p>
        <div className="sample-grid">
          {SAMPLE_RESTAURANTS.map((r) => (
            <button key={r.id} type="button" className="sample-chip" onClick={() => loadSample(r.id)}>
              <strong>{r.name}</strong>
              <span>
                {r.cuisine}
                {r.city ? ` · ${r.city}` : ''}
              </span>
            </button>
          ))}
        </div>
      </section>

      {result && (
        <section className="results">
          <div className="verdict-banner caution">
            <h2>
              {result.restaurantName}
              {result.city ? ` · ${result.city}` : ''}
            </h2>
            <p>
              {result.dishes.filter((d) => d.verdict === 'SAFE').length} safe ·{' '}
              {result.dishes.filter((d) => d.verdict === 'ASK_TO_MODIFY').length} modify ·{' '}
              {result.dishes.filter((d) => d.verdict === 'AVOID').length} avoid
            </p>
            {result.sourceUrl && (
              <p className="muted tiny">
                Source:{' '}
                <a href={result.sourceUrl} target="_blank" rel="noreferrer">
                  {result.sourceUrl}
                </a>
              </p>
            )}
            {result.sourceNote && <p className="muted tiny">{result.sourceNote}</p>}
          </div>

          <div className="filter-row" role="tablist" aria-label="Filter dishes">
            {(['ALL', 'SAFE', 'ASK_TO_MODIFY', 'AVOID'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ASK_TO_MODIFY' ? 'MODIFY' : f}
              </button>
            ))}
          </div>

          <div className="dish-list">
            {filteredDishes.map((d) => (
              <DishCard key={d.name + (d.description || '')} dish={d} />
            ))}
            {filteredDishes.length === 0 && <p className="muted">No dishes in this filter.</p>}
          </div>

          <div className="card tips-card">
            <h3>Ordering tips</h3>
            <ul className="checklist">
              {result.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Disclaimer compact />
    </div>
  );
}
