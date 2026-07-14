# Translation catalogs

One folder per language (BCP-47 code); one JSON file per namespace.

| Code | Language | Source |
|------|----------|--------|
| `en` | English | **source of truth** — author here first |
| `de` | German | machine-translated · ⚠️ needs human review |
| `zh-Hant` | Traditional Chinese | machine-translated · ⚠️ needs human review |
| `ja` | Japanese | machine-translated · ⚠️ needs human review |
| `ko` | Korean | machine-translated · ⚠️ needs human review |
| `fil` | Filipino / Tagalog | machine-translated · ⚠️ needs human review |

Namespaces: `common` (shared chrome, status, date-range, formatting), `kiosk`
(the customer walk-up flow), `partner` (partner/outlet admin surface). The internal
Movaia-admin surface (`/admin/*`) is intentionally English-only.

## ⚠️ Before launch
Every non-English file is **machine-translated and must be reviewed by a native
speaker**, especially the customer-facing `kiosk` namespace. Watch particularly:
- **Korean / Japanese** honorific level and politeness register.
- **German** string length vs. fixed-height buttons / table columns.
- Brand voice and any club-specific terminology.

## Conventions (keep these when editing/adding)
- **English is canonical.** Add a key to `en/<ns>.json` first, then to every other
  language. Keys and structure must match across all languages exactly.
- Interpolation uses `{{var}}` (double braces) — never translate or reorder the
  variable name; you may move the placeholder within the sentence.
- Inline emphasis uses `<bold>…</bold>` component tags — keep the tags, translate
  the text between them.
- Plural keys come in `_one` / `_other` pairs (i18next CLDR plurals). Languages
  without grammatical plural (zh-Hant, ja, ko) use the same text in both.
- Do not translate the brand name **Movaia** or unit codes (`cm`/`ft`/`kg`/`lb`).

Run `node scripts/i18n-check.mjs` (if present) or the parity check to confirm keys
and placeholders line up across languages before committing.
