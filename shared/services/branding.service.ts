import { api } from './api.service';

export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  primaryHover: string;
  onPrimary: string;
  accentColor: string | null;
  emailFromName: string | null;
}

export const brandingService = {
  // Public — used by the kiosk to theme itself.
  async getPublicBranding(slug: string): Promise<{
    partner: {
      id: string;
      name: string;
      slug: string;
      branding: Branding | null;
      stores: Array<{ id: string; name: string }>;
    };
  }> {
    const { data } = await api.get(`/public/branding/${slug}`);
    return data;
  },

  // Partner-admin — read/update own branding.
  async getMine(): Promise<{ branding: Branding | null }> {
    const { data } = await api.get('/branding');
    return data;
  },
  async update(patch: Partial<Branding>): Promise<{ branding: Branding }> {
    const { data } = await api.put('/branding', patch);
    return data;
  },
  async requestLogoUpload(contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    const { data } = await api.post('/branding/logo/upload-url', { contentType });
    return data;
  },
  async saveLogo(logoUrl: string): Promise<void> {
    await api.post('/branding/logo', { logoUrl });
  },
};
