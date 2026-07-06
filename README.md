# Movaia for Gyms/Clubs — Frontend

Single-page React application for **Movaia for Gyms/Clubs**. It serves three distinct
surfaces from one SPA, sharing auth, theming, and API plumbing:

| Surface           | Route          | Who | What they do |
| ----------------- | -------------- | --- | ------------ |
| **Movaia Admin**  | `/admin/*`     | Movaia internal staff | Manage partners, provision partner admins |
| **Partner Admin** | `/partner/*`   | Partner staff         | Branding, chain stores, analytics |
| **Kiosk**         | `/kiosk/:slug` | Walk-up customers     | identify → record → review → submit (themed per partner) |

It talks to the [backend](../backend) API and is themed at runtime by partner `slug`.

---

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | React 18 |
| Build tool     | Vite 5 |
| Language       | TypeScript 5 |
| Routing        | React Router 6 (with lazy-loaded routes) |
| Styling        | Tailwind CSS 3 (+ `@tailwindcss/forms`) |
| Icons          | lucide-react |
| HTTP           | Axios |
| Hosting        | Vercel (SPA rewrite) |

---

## Project structure

```
frontend/
├── index.html               # Vite entry HTML
├── src/
│   ├── main.tsx             # React root
│   ├── App.tsx             # Top-level router for all three surfaces
│   └── index.css           # Tailwind layers
├── apps/                    # One folder per surface (pages only)
│   ├── movaia-admin/       # PartnerList / PartnerCreate / PartnerDetail
│   ├── partner-admin/      # StaffLogin / SetPassword / Branding / Stores / Analytics
│   └── kiosk/              # KioskApp (the walk-up scan flow)
├── shared/                  # Cross-surface building blocks
│   ├── contexts/           # AuthContext
│   ├── components/         # ProtectedRoute, LoadingSpinner, KioskRecorder, …
│   ├── partners/           # PartnerThemeProvider + types (runtime theming)
│   └── services/           # api.service + per-domain API clients
├── vite.config.ts           # Plugins, path aliases, dev port, manual chunks
├── tailwind.config.js
└── vercel.json              # SPA fallback rewrite
```

### Path aliases

Configured in `vite.config.ts` (mirror them in `tsconfig.json` for editor support):

| Alias      | Resolves to |
| ---------- | ----------- |
| `@`        | `./src`     |
| `@shared`  | `./shared`  |
| `@apps`    | `./apps`    |

---

## Getting started

### Prerequisites

- **Node.js ≥ 20** and npm
- The [backend](../backend) running and reachable (default `http://localhost:4000`)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Set VITE_API_URL to your backend's /api base URL

# 3. Start the dev server
npm run dev          # → http://localhost:5174
```

> The dev server runs on **5174** (set in `vite.config.ts`) so it can run alongside the
> main Movaia frontend on 5173.

---

## Scripts

| Script            | Description |
| ----------------- | ----------- |
| `npm run dev`     | Start the Vite dev server with HMR |
| `npm run build`   | Type-check (`tsc`) then build to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Environment variables

Only variables prefixed with **`VITE_`** are exposed to the browser bundle. **Never put
secrets here** — anything in this file ships to the client.

| Variable       | Required | Description |
| -------------- | :------: | ----------- |
| `VITE_API_URL` | ✓        | Backend API base URL, e.g. `http://localhost:4000/api` |

---

## Build & deploy

```bash
npm run build        # outputs static assets to dist/
```

Deploy `dist/` to any static host. [`vercel.json`](vercel.json) rewrites app paths to
`index.html` so client-side routing works on deep links (e.g. `/kiosk/acme`).

**How the browser reaches the API — pick one (the auth cookie forces the choice):**

- **Same-origin proxy (recommended).** Leave `VITE_API_URL` **blank** and let `vercel.json`
  proxy `/api/*` to the backend. Edit `vercel.json` and replace
  `REPLACE-WITH-BACKEND-HOST` with your backend origin. The `/api` rewrite must stay
  **before** the SPA catch-all. This keeps the httpOnly auth cookie first-party
  (`SameSite=Lax`) with no CORS/preflight — the setup the backend already issues.
- **Cross-origin.** Delete the `/api` rewrite and set `VITE_API_URL` to the backend origin
  (e.g. `https://api.example.com/api`). The browser then calls the backend directly, which
  requires the backend to issue **`SameSite=None; Secure`** cookies and to list this origin
  in `CORS_ORIGINS`.

> ⚠️ Without one of these, `/api/*` calls fall through to the SPA rewrite and return
> `index.html` instead of JSON — the app will appear to load but every request fails.

---

## Notes

- Routes are **lazy-loaded** (`React.lazy` + `Suspense`) and split into vendor chunks
  (`react`, `icons`) via Vite `manualChunks` — keep heavy deps out of the shared bundle.
- The kiosk surface (`/kiosk/:slug`) is public and themed at runtime by
  `PartnerThemeProvider`; the admin/partner surfaces are gated by `ProtectedRoute`.
