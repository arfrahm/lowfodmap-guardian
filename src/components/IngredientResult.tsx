import type { ClassifiedIngredient, LabelAnalysis } from '../types';
import { LevelBadge, OverallBadge } from './StatusBadge';

export function LabelResults({ analysis }: { analysis: LabelAnalysis }) {
  const sorted = [...analysis.ingredients].sort((a, b) => rank(b) - rank(a));
  return (
    <div className="results">
      <div className={`verdict-banner ${analysis.overall.toLowerCase()}`}>
        <OverallBadge verdict={analysis.overall} />
        <p>{analysis.summary}</p>
        {analysis.alliumAlert && (
          <p className="allium-alert">Garlic / onion alert — skip this product during elimination.</p>
        )}
        {analysis.ocrQuality === 'poor' && (
          <p className="allium-alert">Low OCR confidence — edit ingredient text before relying on this.</p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="muted">No ingredient tokens parsed. Check the editable text above.</p>
      ) : (
        <ul className="ingredient-list">
          {sorted.map((ing, idx) => (
            <IngredientCard key={`${ing.raw}-${idx}`} ing={ing} />
          ))}
        </ul>
      )}
    </div>
  );
}

function IngredientCard({ ing }: { ing: ClassifiedIngredient }) {
  return (
    <li className={`ingredient-card level-${ing.level}`}>
      <div className="ingredient-head">
        <div>
          <strong>{ing.raw}</strong>
          {ing.matchedName && ing.matchedName.toLowerCase() !== ing.raw.toLowerCase() && (
            <span className="matched-as"> matched as {ing.matchedName}</span>
          )}
        </div>
        <LevelBadge level={ing.level} />
      </div>
      <p className="reason">{ing.reason}</p>
      {ing.serving && <p className="serving">Serving: {ing.serving}</p>}
      {ing.allium && <p className="tag danger">Allium (onion/garlic family)</p>}
      {ing.trap && !ing.allium && <p className="tag warn">Common hidden trap</p>}
    </li>
  );
}

function rank(ing: ClassifiedIngredient): number {
  if (ing.level === 'high') return 4;
  if (ing.level === 'moderate') return 3;
  if (ing.level === 'unknown') return 2;
  return 1;
}
