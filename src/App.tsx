import { NavLink, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { LabelChecker } from './pages/LabelChecker';
import { RestaurantPlanner } from './pages/RestaurantPlanner';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ◈
          </span>
          <span>LowFODMAP Guardian</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/label" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Labels
          </NavLink>
          <NavLink to="/restaurant" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Dining
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/label" element={<LabelChecker />} />
          <Route path="/restaurant" element={<RestaurantPlanner />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>Elimination-phase helper · Not medical advice · Verify with Monash</p>
      </footer>
    </div>
  );
}
