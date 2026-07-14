// Supported UI languages. `code` is a BCP-47 tag used verbatim for i18next, the
// <html lang> attribute, and Intl.* formatting. `label` is the language's own
// endonym (shown in the switcher so a speaker recognizes it regardless of the
// current UI language). Order here is the order shown in the switcher.
export interface Language {
  code: string;
  label: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fil', label: 'Filipino' },
];

export const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);
export const FALLBACK_LANGUAGE = 'en';

// Translation namespaces, split by surface so each surface lazy-loads only its
// own strings. `common` is shared chrome/formatting; `kiosk` and `partner` are
// the two localized surfaces. (The internal Movaia-admin surface stays English.)
export const NAMESPACES = ['common', 'kiosk', 'partner'] as const;
export type Namespace = (typeof NAMESPACES)[number];

// localStorage key for the persisted staff-surface language choice. Mirrors the
// `mv_*` prefix used by the auth tokens.
export const LANGUAGE_STORAGE_KEY = 'mv_lang';

// Map an arbitrary navigator/stored tag onto one of our supported codes. Handles
// the common aliases: zh-TW / zh-HK / zh-Hant-* → zh-Hant (Traditional), tl → fil
// (Tagalog↔Filipino), and any region subtag (en-GB → en, de-AT → de). Anything
// unrecognized falls back to English.
export function resolveLanguage(tag: string | null | undefined): string {
  if (!tag) return FALLBACK_LANGUAGE;
  const lower = tag.toLowerCase();

  // Chinese: only Traditional is supported. Traditional markers → zh-Hant.
  // (Simplified zh-CN/zh-Hans has no catalog, so it also falls back to zh-Hant
  // rather than English — closer than English for a Chinese reader.)
  if (lower.startsWith('zh')) return 'zh-Hant';
  if (lower === 'tl' || lower.startsWith('fil')) return 'fil';

  const base = lower.split('-')[0];
  const exact = SUPPORTED_CODES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const byBase = SUPPORTED_CODES.find((c) => c.toLowerCase().split('-')[0] === base);
  return byBase ?? FALLBACK_LANGUAGE;
}

// The device/browser's preferred supported language (used as the kiosk default,
// since the kiosk is a shared public device with no persisted user choice).
export function deviceLanguage(): string {
  const prefs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const resolved = resolveLanguage(p);
    if (resolved !== FALLBACK_LANGUAGE || p.toLowerCase().startsWith('en')) return resolved;
  }
  return FALLBACK_LANGUAGE;
}
