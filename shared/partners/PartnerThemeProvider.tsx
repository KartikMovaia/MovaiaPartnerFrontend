// DYNAMIC, DB-driven partner theming (evolves Movaia's static PartnerThemeProvider).
// Fetches a partner's branding by slug from the public endpoint and exposes it
// as CSS custom properties so utility classes like `bg-brand` pick it up.
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { brandingService } from '@shared/services/branding.service';
import { PartnerTheme, DEFAULT_THEME } from './types';

interface ContextValue {
  theme: PartnerTheme;
  stores: Array<{ id: string; name: string }>;
  loading: boolean;
}

const ThemeContext = createContext<ContextValue>({ theme: DEFAULT_THEME, stores: [], loading: false });

export const PartnerThemeProvider: React.FC<{ slug?: string; children: ReactNode }> = ({ slug, children }) => {
  const [theme, setTheme] = useState<PartnerTheme>(DEFAULT_THEME);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(!!slug);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    brandingService
      .getPublicBranding(slug)
      .then((data) => {
        if (cancelled) return;
        const b = data.partner.branding;
        setTheme({
          id: data.partner.id,
          slug: data.partner.slug,
          displayName: data.partner.name,
          logoUrl: b?.logoUrl ?? null,
          colors: {
            primary: b?.primaryColor || DEFAULT_THEME.colors.primary,
            primaryHover: b?.primaryHover || DEFAULT_THEME.colors.primaryHover,
            onPrimary: b?.onPrimary || DEFAULT_THEME.colors.onPrimary,
            accent: b?.accentColor || DEFAULT_THEME.colors.accent,
          },
        });
        setStores(data.partner.stores || []);
      })
      .catch(() => setTheme(DEFAULT_THEME))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Push theme tokens to CSS variables at the root.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', theme.colors.primary);
    root.style.setProperty('--brand-primary-hover', theme.colors.primaryHover);
    root.style.setProperty('--brand-on-primary', theme.colors.onPrimary);
    if (theme.colors.accent) root.style.setProperty('--brand-accent', theme.colors.accent);
  }, [theme]);

  const value = useMemo(() => ({ theme, stores, loading }), [theme, stores, loading]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): PartnerTheme => useContext(ThemeContext).theme;
export const usePartnerContext = (): ContextValue => useContext(ThemeContext);
