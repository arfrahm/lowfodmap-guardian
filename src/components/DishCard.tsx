import type { DishAnalysis } from '../types';
import { DishBadge } from './StatusBadge';

export function DishCard({ dish }: { dish: DishAnalysis }) {
  return (
    <article className={`dish-card verdict-${dish.verdict.toLowerCase()}`}>
      <header className="dish-head">
        <h3>{dish.name}</h3>
        <DishBadge verdict={dish.verdict} />
      </header>
      {dish.description && <p className="dish-desc">{dish.description}</p>}

      {dish.reasons.length > 0 && (
        <div className="dish-section">
          <h4>Why</h4>
          <ul>
            {dish.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {dish.flaggedIngredients.length > 0 && (
        <div className="dish-section">
          <h4>Flagged</h4>
          <div className="chip-row">
            {dish.flaggedIngredients.map((f) => (
              <span className="chip" key={f}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {dish.modifications.length > 0 && dish.verdict !== 'SAFE' && (
        <div className="dish-section">
          <h4>How to modify</h4>
          <ul>
            {dish.modifications.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {dish.portionNotes.length > 0 && (
        <div className="dish-section">
          <h4>Portion notes</h4>
          <ul>
            {dish.portionNotes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
