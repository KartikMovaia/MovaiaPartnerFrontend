// Language picker for the localized surfaces: the staff sidebar (`admin`, styled
// as a nav row) and the kiosk header (`kiosk`, a pill). The trigger shows the
// current language; opening it reveals a menu of the supported languages, each in
// its own script (endonym) so a speaker recognizes it regardless of the active UI
// language.
//
// Selecting a language calls i18n.changeLanguage. On staff surfaces that persists
// to localStorage (mv_lang); the kiosk resets it per customer, so there it is a
// session-only choice.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { LANGUAGES } from '@shared/i18n/config';

export default function LanguageSwitcher({
  variant = 'admin',
  className = '',
}: {
  variant?: 'admin' | 'kiosk';
  className?: string;
}) {
  const { i18n, t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const current =
    LANGUAGES.find((l) => l.code === i18n.language) ??
    LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ??
    LANGUAGES[0];

  // Close on outside click or Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // On open, move focus into the menu (to the selected language) for keyboard use.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('button');
    if (!items?.length) return;
    (Array.from(items).find((b) => b.dataset.active === 'true') ?? items[0]).focus();
  }, [open]);

  const select = (code: string) => {
    void i18n.changeLanguage(code);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Roving focus between menu items with the arrow keys.
  const onMenuKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = (e.key === 'ArrowDown' ? i + 1 : i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const kiosk = variant === 'kiosk';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('language.change')}
        className={
          kiosk
            ? 'inline-flex items-center gap-2 rounded-full border-2 px-4 font-semibold'
            : `flex w-full items-center gap-[11px] rounded-[10px] px-[14px] py-[11px] text-sm font-medium transition-colors ${open ? '' : 'hover:bg-[#f7f7f5]'}`
        }
        style={
          kiosk
            ? { height: 48, fontSize: 16, borderColor: '#e4e4e4', background: '#fff', color: '#141414' }
            : { background: open ? '#f2f7e3' : undefined, color: open ? '#5a7d16' : '#686868' }
        }
      >
        <Globe size={kiosk ? 20 : 16} style={{ color: kiosk ? '#686868' : 'currentColor' }} />
        <span className={kiosk ? '' : 'flex-1 text-left'}>{current.label}</span>
        {!kiosk && <ChevronDown size={15} style={{ opacity: 0.6 }} />}
      </button>

      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={t('language.label')}
          onKeyDown={onMenuKey}
          className={`absolute z-50 overflow-hidden rounded-[12px] border bg-white py-1 shadow-lg ${
            kiosk ? 'right-0 mt-2 min-w-[200px]' : 'inset-x-0 mt-1.5'
          }`}
          style={{ borderColor: '#e4e4e4' }}
        >
          {LANGUAGES.map((l) => {
            const active = l.code === current.code;
            return (
              <li key={l.code} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-active={active}
                  onClick={() => select(l.code)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 text-left transition-colors ${
                    active ? '' : 'hover:bg-[#f7f7f5]'
                  }`}
                  style={{
                    height: kiosk ? 46 : 40,
                    fontSize: kiosk ? 17 : 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#5a7d16' : '#141414',
                    background: active ? '#f2f7e3' : undefined,
                  }}
                >
                  <span>{l.label}</span>
                  {active && <Check size={kiosk ? 18 : 15} style={{ color: '#5a7d16' }} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
