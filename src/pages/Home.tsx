import { Link } from 'react-router-dom';
import { Disclaimer } from '../components/Disclaimer';

export function Home() {
  return (
    <div className="page home">
      <section className="hero-panel">
        <p className="eyebrow">Elimination-phase companion</p>
        <h1>LowFODMAP Guardian</h1>
        <p className="lede">
          Check labels and plan restaurant orders with a calm, offline-friendly guide tuned for the strict low-FODMAP
          elimination phase.
        </p>
      </section>

      <div className="home-actions">
        <Link className="action-card" to="/label">
          <span className="action-icon" aria-hidden>
            🏷️
          </span>
          <span>
            <strong>Label checker</strong>
            <span className="action-sub">Scan or paste ingredients → SAFE / CAUTION / AVOID</span>
          </span>
        </Link>
        <Link className="action-card" to="/restaurant">
          <span className="action-icon" aria-hidden>
            🍽️
          </span>
          <span>
            <strong>Restaurant planner</strong>
            <span className="action-sub">Paste a menu or open a sample → order smarter</span>
          </span>
        </Link>
      </div>

      <section className="card tips-card">
        <h2>Quick elimination reminders</h2>
        <ul className="checklist">
          <li>Strictly avoid onion & garlic in every form (powder, stock, “spices”).</li>
          <li>Watch serving sizes on avocado, sweet potato, almonds, and similar moderate foods.</li>
          <li>Plain proteins + rice/potato + low-FODMAP veg are your safest restaurant pattern.</li>
          <li>This app helps triage — Monash remains the source of truth for serves.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
