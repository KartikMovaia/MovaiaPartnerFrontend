// Small display formatters shared across surfaces. All are locale-aware: they
// format for the active i18n language via the Intl.* APIs, so months, number
// grouping, and date order follow the user's language automatically (e.g.
// "2 Jul, 14:02" → "7月2日 14:02" in ja, "2. Juli, 14:02" in de).
import i18n from '@shared/i18n';

// The active BCP-47 locale, resolved once per call (cheap; Intl formatters are
// created per call but the browser caches the underlying data).
function locale(): string {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

// "2026-07-02T14:02:00" -> locale short date + time, e.g. "2 Jul, 14:02"
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

// "2026-07-02T14:02:00" -> locale short date, e.g. "2 Jul"
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(d);
}

// 1024 -> "1,024" (locale-grouped)
export function fmtNum(n: number): string {
  return new Intl.NumberFormat(locale()).format(n);
}
