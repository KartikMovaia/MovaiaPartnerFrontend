# CLAUDE.md — Movaia Partners Frontend

Vite + React + TypeScript + Tailwind SPA. Three surfaces: Movaia admin (`/admin/*`), partner/outlet (`/partner/*`), kiosk (`/kiosk/:slug`). Human docs: `README.md`.

## Commands
- `npm run dev` — dev server on :5174 (proxies `/api` → backend :4000; **needs the backend running**)
- `npm run build` (tsc + vite) · `npm run preview` · `npm run typecheck` · `npm run lint`
- `npm run i18n:check` — verify locale key parity with `en` + intact `{{placeholders}}`/`<bold>` tags (run after any catalog edit)

## Architecture
- **All backend I/O goes through `shared/services/*`** — one client per domain (auth, analytics, branding, partner, stores, kiosk). Pages never call the API directly.
- **Bearer auth** (`shared/services/api.service.ts`): access+refresh tokens in `localStorage`, `Authorization: Bearer`, refresh once on 401. Kiosk uses a **separate device token** + `kioskApi` client.
- `AuthContext` holds the signed-in staff; `ProtectedRoute` guards `/admin` + `/partner` by kind/role.
- Kiosk theming (`PartnerThemeProvider`): fetches public branding by slug → CSS variables.

## Conventions & gotchas
- **One staff session per browser** — `/admin` and `/partner` share the token slot, so signing into one signs the other out. Use a separate browser profile for both.
- Dev needs the backend on :4000 (the `/api` Vite proxy); set `VITE_API_URL` to call a backend directly.
- `AdminShell`'s `variant` prop is **vestigial** — both surfaces use the same light chrome.
- Backend contract quirks handled here: login/refresh return tokens in the body; `/public/branding/:slug` returns no `stores`; `deviceLogout` takes `{email,password}` (password-gated unbind).
- **Dashboards are date-range configurable** (`shared/ui/DateRangePicker` + `shared/utils/dateRange`): `analyticsService.overview` / `adminAnalyticsService.partnersOverview` take `{from?,to?}`. KPIs + trend reflect the range (default **all time**); the **recent-scans** table is intentionally **not** range-filtered (latest 50). Fetches on mount + range change only — no polling.
- **Full scan log** is `/partner/scans` (`partner-admin/src/pages/Scans.tsx`), shared by partner + outlet admins. Filters: branch (partner admin only, `storeService.listBranches` → `GET /stores`), date, status, debounced customer search (name/email/phone). Server-side pagination; client-side CSV export (all matching rows, formula-injection-guarded). `analyticsService.scans` takes `{page,pageSize,storeId?,status?,from?,to?,search?}`. Outlet admins auto-scoped server-side.
- `PartnerList` sorts (name/outlets/analyses) + filters by status client-side. `Billing` (`/admin/billing`) is a **scaffold** — usage preview over `partnersOverview`; pricing not finalized (no persistence/invoices).

## i18n (react-i18next)
- **Init:** `shared/i18n/index.ts`, imported once from `main.tsx` before render. Catalogs at `shared/i18n/locales/<lang>/<ns>.json`, lazy-loaded per (language, namespace) via dynamic `import()` (`i18next-resources-to-backend`); Vite code-splits each, `<Suspense>` in `App.tsx` covers the load.
- **Languages** (`shared/i18n/config.ts`): `en` · `de` · `zh-Hant` · `ja` · `ko` · `fil`. `en` is the fallback and source of truth — **add keys to `en` first**, then every other locale. `resolveLanguage` maps `zh-TW`/`zh-HK`→`zh-Hant`, `tl`→`fil`, regioned tags→base. Non-English is machine-translated, review pending (`locales/README.md`).
- **Namespaces:** `common` (shared chrome + `status`/`report`/`dateRange`/formatting), `kiosk`, `partner`. The **`/admin/*` surface is intentionally English-only** (shared chrome still localizes).
- **Usage:** `useTranslation('<ns>')`; cross-ns via `t('common:key')`. Interpolate `{{var}}`; emphasis via `<Trans components={{ bold: <b/> }}>` on a `<bold>…</bold>` value; plurals via `_one`/`_other` keys + `t(key, { count })`. Module-level helpers read the `i18n` singleton directly.
- **Formatting** (`shared/ui/format.ts`): `Intl.DateTimeFormat`/`NumberFormat` keyed to active language; `<html lang>` stays in sync (drives per-language CJK system-font stacks in `src/index.css`).
- **Switcher** (`shared/ui/LanguageSwitcher`): admin surfaces persist to `localStorage` (`mv_lang`); the **kiosk** is session-only — starts from device language and resets on every `goHome`.
- Run `npm run i18n:check` after any catalog edit.

## Structure
- `apps/{kiosk,partner-admin,movaia-admin}/src/pages` (movaia-admin also has `Billing.tsx`)
- `shared/{services,ui,components,contexts,partners,utils,i18n}` — incl. `ui/{DateRangePicker,LanguageSwitcher,format}`, `utils/dateRange`, `i18n/{config,index}` + `i18n/locales/<lang>/<ns>.json`
- `src/{App.tsx,main.tsx}`
