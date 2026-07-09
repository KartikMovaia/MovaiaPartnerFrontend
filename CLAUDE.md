# CLAUDE.md — Movaia Partners Frontend

Vite + React + TypeScript + Tailwind SPA with three surfaces: Movaia admin (`/admin/*`),
partner/outlet (`/partner/*`), kiosk (`/kiosk/:slug`). Human docs: `README.md`.

## Commands
- `npm run dev` — dev server on :5174 (proxies `/api` → backend :4000; **needs the backend running**)
- `npm run build` (tsc + vite build) · `npm run preview` · `npm run typecheck` · `npm run lint`

## Architecture
- **All backend I/O goes through `shared/services/*`** — one client per domain (auth, analytics, branding, partner, stores, kiosk). Pages never call the API directly.
- **Bearer auth:** `shared/services/api.service.ts` keeps access+refresh tokens in `localStorage`, attaches `Authorization: Bearer`, and refreshes once on a 401. The kiosk uses a **separate device token** + `kioskApi` client.
- `AuthContext` holds the signed-in staff; `ProtectedRoute` guards `/admin` and `/partner` by kind/role.
- Kiosk theming: `PartnerThemeProvider` fetches a partner's public branding by slug → CSS variables.

## Conventions & gotchas
- **One staff session per browser** — `/admin` and `/partner` share the token slot, so signing into one signs the other out. Use a separate browser profile to be signed into both.
- Dev needs the backend on :4000 (the `/api` Vite proxy). Set `VITE_API_URL` to call a backend directly instead.
- `AdminShell`'s `variant` prop is currently **vestigial** (both surfaces use the same light chrome).
- Backend contract specifics already handled here: login/refresh return tokens in the body; `/public/branding/:slug` returns no `stores`; `deviceLogout` takes `{email,password}` (password-gated unbind).

## Structure
`apps/{kiosk,partner-admin,movaia-admin}/src/pages` · `shared/{services,ui,components,contexts,partners,utils}` · `src/{App.tsx,main.tsx}`.
