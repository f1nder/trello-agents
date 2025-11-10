# Trello Agents Power-Up UI

React + TypeScript Power-Up that renders a live OpenShift pod roster directly on Trello cards. The current milestone wires
the real Trello iframe surfaces, board-level configuration, OpenShift watch/log clients, and optimistic pod controls.

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` for the inner-page sandbox. The dev server also exposes the production iframes used by
Trello:

- `/powerup.html` – capability bootstrap (registered through `public/manifest.json`).
- `/card-back.html` – card-back section iframe with live pod roster + actions.
- `/settings.html` – native Power-Up board settings iframe (opened from Trello’s admin drawer).
- `/logs.html` – Trello modal that streams pod logs via the OpenShift follow API.

## Scripts

- `npm run dev` — start Vite dev server.
- `npm run build` — type-check via `tsc --build` then emit production bundle.
- `npm run preview` — preview the production bundle locally.
- `npm run lint` — run ESLint across `.ts`/`.tsx` files with the recommended rule set.

## Configuration Flow

1. Open Trello’s Power-Up admin drawer and launch the **Cluster Settings** surface (native iframe connector).
2. Provide the cluster URL, namespace, operator-facing alias, and optional CA bundle.
3. Paste the service-account token; Trello secrets persist it and only the generated secret ID is stored.
4. Toggle **Ignore SSL** only for trusted staging clusters—prefer supplying a CA bundle instead.

Roster iframes use the saved settings to instantiate an `OpenShiftClient`, bootstrap with a pod list, and then rely solely
on `watch=true` streams. Stop/log actions reuse the same client so credentials never leave Trello.

## Architecture Highlights

- **Hooks:** `usePowerUpClient`, `useClusterSettings`, `useCardMetadata`, and `useLivePods` isolate Trello/bootstrap logic
  from UI code so new surfaces (badges, buttons) can reuse the same data pipeline.
- **OpenShift client:** Fetch-based implementation handles bootstrap lists, watch streams with exponential backoff,
  stop/delete flows (including DeploymentConfig owners), and log streaming readers.
- **Optimistic UX:** Stopping a pod immediately fades the row out while the OpenShift request runs; failures restore the
  previous snapshot and surface Trello alerts.
- **Log streaming:** Modals receive the selected pod via `t.modal({ args })` and stream chunks into a scrolling terminal
  with automatic cleanup on close/unmount.

## Deployment Notes

- Replace `__POWERUP_BASE_URL__` placeholders in `public/manifest.json` (or set `VITE_POWERUP_BASE_URL`) before hosting on
  GitHub Pages.
- Each build emits static assets in `dist/`. Deploy that folder to your CDN/GitHub Pages target, then update the Trello
  Power-Up manifest to reference the hosted origin.
