# Trello Agents Power-Up UI

Bootstrap React + TypeScript project for the Card Agents live roster Trello Power-Up. The initial milestone provides:

- Vite build tooling with strict TypeScript config and ESLint wiring.
- React component shell (`InnerPage`) simulating the roster view that will later stream OpenShift pods.
- Ready-to-run local dev server + production build commands.

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to load the inner-page prototype.

The dev server now exposes multiple entry points used by Trello:

- `/powerup.html` — capability bootstrap (no visible UI).
- `/card-back.html` — iframe used for the card-back section + buttons.
- `/settings.html` — native Power-Up board settings iframe.
- `/logs.html` — Trello modal placeholder for live log streaming.

## Scripts

- `npm run dev` — start Vite dev server.
- `npm run build` — type-check via `tsc --build` then emit production bundle.
- `npm run preview` — preview the production bundle locally.
- `npm run lint` — run ESLint across `.ts`/`.tsx` files with the recommended rule set.

## Next Steps

- Wire Trello Power-Up capabilities (card-back section, card buttons, badges, modals, settings).
- Implement OpenShift watch client + hooks for live pod updates.
- Add stop/log actions plus GitHub Pages deployment pipeline per acceptance criteria.
- Replace `__POWERUP_BASE_URL__` placeholders in `public/manifest.json` with your deployed origin or drive the value via `VITE_POWERUP_BASE_URL` for local previews.
