// Theme contract — DB-driven (fetched per partner slug), evolves Movaia's
// static PartnerTheme. Every partner-aware surface reads from this shape.
export interface PartnerTheme {
  id: string;
  slug: string;
  displayName: string;
  logoUrl: string | null;
  colors: {
    primary: string;
    primaryHover: string;
    onPrimary: string;
    accent?: string;
  };
}

export const DEFAULT_THEME: PartnerTheme = {
  id: 'movaia',
  slug: 'movaia',
  displayName: 'Movaia',
  logoUrl: null,
  colors: {
    primary: '#ABD037',
    primaryHover: '#98B830',
    // Dark "ink on green" (Tailwind movaia.ink) — AA-readable text on the lime
    // primary; matches --brand-on-primary and the DB default.
    onPrimary: '#1c2b00',
    // Green-family secondary (Movaia's "green text on light surfaces" token,
    // AA-readable on white — e.g. the kiosk "Done" button label).
    accent: '#5a7d16',
  },
};
