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
    onPrimary: '#0F1115',
    accent: '#3B82F6',
  },
};
