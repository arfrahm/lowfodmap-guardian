# LowFODMAP Guardian

Mobile-friendly web app for the **strict low-FODMAP elimination phase**:

1. **Label / ingredient checker** — paste an ingredient list or photograph a label (Tesseract.js OCR) → each ingredient classified **low / moderate / high**, with onion/garlic alerts, overall **SAFE / CAUTION / AVOID**, reasons, and serving guidance.
2. **Restaurant planner** — paste a menu or open a sample restaurant → each dish **SAFE / ASK TO MODIFY / AVOID**, modification tips, and portion notes.

Built with **Vite + React + TypeScript**. FODMAP knowledge is a curated **local** database (Monash-style elimination cutoffs) so the app works offline after load.

## Medical disclaimer

**This app is guidance only — not medical advice.** It does not replace a registered dietitian, gastroenterologist, or the official **[Monash University FODMAP App](https://www.monashfodmap.com/ibs-central/i-have-ibs/get-the-app/)**, which remains the gold standard for food ratings and serving sizes. Food tolerances vary. Use professional guidance for reintroduction.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

### Use on your phone

1. Run the dev server with network access (Vite is configured with `server.host: true`).
2. Find your computer LAN IP and open `http://YOUR_IP:5173` on your phone (same Wi-Fi).
3. Or build and deploy the `dist/` folder to any static host, then **Add to Home Screen** (PWA-friendly).

```bash
npm run build
npm run preview
```

## Features

- Elimination-focused classification (onion/garlic flagged aggressively)
- Paste-first flows with large tap targets and calm yellow / warm UI
- Camera / upload OCR for labels via Tesseract.js (client-side)
- Sample restaurants with canned menus
- Portion-sensitive notes for moderate foods
- PWA manifest + service worker

## Project structure

```
src/
  data/           # FODMAP knowledge base + sample restaurant menus
  lib/            # parsing, classification, restaurant analysis
  pages/          # Home, Label checker, Restaurant planner
  components/     # badges, cards, disclaimer
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |

## Known limitations

- Local KB is curated, not exhaustive — unknown ingredients marked UNKNOWN; verify with Monash.
- OCR quality depends on lighting/focus; paste text when OCR is messy.
- No live restaurant menu API — paste menus or use samples.
- Ratings target elimination, not post-challenge personalization.
- Not a substitute for clinical care.

## License

MIT

