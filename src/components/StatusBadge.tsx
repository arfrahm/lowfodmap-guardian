import type { DishVerdict, FodmapLevel, OverallVerdict } from '../types';

export function OverallBadge({ verdict }: { verdict: OverallVerdict }) {
  const cls = verdict === 'SAFE' ? 'badge safe' : verdict === 'CAUTION' ? 'badge caution' : 'badge avoid';
  const label = verdict === 'SAFE' ? 'SAFE' : verdict === 'CAUTION' ? 'CAUTION' : 'AVOID';
  return <span className={cls}>{label}</span>;
}

export function DishBadge({ verdict }: { verdict: DishVerdict }) {
  if (verdict === 'SAFE') return <span className="badge safe">SAFE</span>;
  if (verdict === 'ASK_TO_MODIFY') return <span className="badge caution">ASK TO MODIFY</span>;
  return <span className="badge avoid">AVOID</span>;
}

export function LevelBadge({ level }: { level: FodmapLevel | 'unknown' }) {
  if (level === 'low') return <span className="badge safe">LOW</span>;
  if (level === 'moderate') return <span className="badge caution">MODERATE</span>;
  if (level === 'high') return <span className="badge avoid">HIGH</span>;
  return <span className="badge unknown">UNKNOWN</span>;
}
