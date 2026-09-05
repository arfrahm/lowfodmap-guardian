import { useMemo, useState } from 'react';
import { SAMPLE_RESTAURANTS } from '../data/sampleRestaurants';
import { analyzeMenuPaste, analyzeSampleRestaurant } from '../lib/restaurantAnalyze';
import type { RestaurantResult } from '../types';
import { DishCard } from '../components/DishCard';
import { Disclaimer } from '../components/Disclaimer';

type Filter = 'ALL' | 'SAFE' | 'ASK_TO_MODIFY' | 'AVOID';

export function RestaurantPlanner() {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [menuText, setMenuText] = useState('');
  const [result, setResult] = useState<RestaurantResult | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState<string | null>(null);

  const filteredDishes = useMemo(() => {
    if (!result) return [];
    if (filter === 'ALL') return result.dishes;
    return result.dishes.filter((d) => d.verdict === filter);
  }, [result, filter]);

  const runPaste = () => {
    setError(null);
    if (!menuText.trim()) {
      setError('Paste menu text, or pick a sample restaurant below.');
      return;
    }
    setResult(analyzeMenuPaste(name.trim() || 'Pasted menu', menuText, city.trim() || undefined));
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
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Restaurant planner</h1>
        <p>Paste a menu (best) or open a sample. Get SAFE / ASK TO MODIFY / AVOID with tips.</p>
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
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="rest-city">
              City
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
          <button type="button" className="btn primary" onClick={runPaste}>
            Analyze menu
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMenuText('');
              setResult(null);
              setError(null);
            }}
          >
            Clear
          </button>
        </div>
        {error && <p className="error-line">{error}</p>}
      </div>

      <section className="card">
        <h2 className="section-title">Sample restaurants</h2>
        <p className="muted">Offline canned menus — useful when you cannot photograph a menu.</p>
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
