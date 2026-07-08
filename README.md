# Movaia Partners — Frontend

The web app for **Movaia for Gyms & Clubs**. One Vite + React + TypeScript + Tailwind single-page app that serves **three surfaces**:

| Surface | Route | Who uses it |
|---|---|---|
| **Movaia admin** | `/admin/*` | Movaia staff — manage partners, see platform analytics |
| **Partner admin / outlet** | `/partner/*` | Partner staff — branches, branding, and analytics |
| **Kiosk** | `/kiosk/:slug` | Public walk-up scan flow on a gym's iPad (white-labeled by partner) |

It talks to the [backend](../backend) over `/api`.

---

## Getting started

**Prerequisites:** Node 20+, and the **backend running on `http://localhost:4000`** (see `../backend`).

```bash
npm install
npm run dev        # http://localhost:5174
```

That's it — the Vite dev server **proxies `/api` to the backend on :4000**, so no CORS or extra config is needed. (To point at a different backend instead of the proxy, set `VITE_API_URL` in `.env`.)

First-time end-to-end: create a platform admin in the backend, then sign in at `/admin/login`, create a partner + its admin, sign in at `/partner/login`, and open `/kiosk/<slug>`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5174 (with `/api` proxy) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |

---

## How it's built

- **Auth is Bearer-token.** `shared/services/api.service.ts` is an axios client that keeps the access + refresh tokens in `localStorage`, attaches `Authorization: Bearer …`, and on a `401` refreshes once and retries. The kiosk uses a **separate device token** (its own storage key + client).
- **`AuthContext`** holds the signed-in staff; **`ProtectedRoute`** guards the `/admin` and `/partner` routes by role.
- **All backend calls go through `shared/services/*`** — one service per domain (auth, partners, stores, branding, analytics, kiosk). Pages never call the API directly.
- **Kiosk theming** is white-labeled per partner: `PartnerThemeProvider` fetches the partner's public branding by slug and exposes it as CSS variables.

> **Note:** there's one staff session per browser — both `/admin` and `/partner` share the same token slot, so signing into one signs you out of the other. To be signed into both at once, use a separate browser profile.

---

## Project structure

```
apps/
  kiosk/          the walk-up scan flow (/kiosk/:slug)
  partner-admin/  partner + outlet pages (/partner/*)
  movaia-admin/   Movaia staff pages (/admin/*)
shared/
  services/       API clients (api.service + one per domain)
  ui/             shared UI (AdminShell, StatCard, charts, …)
  components/      ProtectedRoute, error/loading, kiosk recorder, …
  contexts/       AuthContext
  partners/       PartnerThemeProvider (per-partner theming)
src/
  App.tsx         routes
  main.tsx        app entry (providers)
```

**Tech:** React 18 · React Router · Vite · Tailwind · axios · lucide-react.
