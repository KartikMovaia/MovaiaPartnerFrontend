// i18next initialization. One instance for the whole SPA.
//
// Resources are lazy-loaded per (language, namespace) via dynamic import, so Vite
// code-splits every catalog: a German kiosk user downloads only de/common +
// de/kiosk, never Korean and never the partner-admin strings. English is the
// fallback and preloaded so there's never a flash of raw keys.
//
// Language selection differs by surface:
//   • Staff surfaces (/partner) persist the choice to localStorage (mv_lang).
//   • The kiosk is a shared public device — it sets its language explicitly from
//     the device default and resets per customer (see useKioskLanguage), so it
//     does NOT depend on the persisted value.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, NAMESPACES, SUPPORTED_CODES } from './config';

i18n
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)
    )
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_CODES,
    // zh-Hant should NOT be reduced to zh (no zh catalog); keep the full tag.
    load: 'currentOnly',
    nonExplicitSupportedLngs: false,
    ns: NAMESPACES,
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    returnNull: false,
  });

// Keep <html lang> in sync for accessibility, correct CJK line-breaking, and the
// per-language font stack (see index.css `html[lang=…]` rules).
const applyHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
applyHtmlLang(i18n.resolvedLanguage || i18n.language || FALLBACK_LANGUAGE);
i18n.on('languageChanged', applyHtmlLang);

export default i18n;
