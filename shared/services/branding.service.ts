// Branding — real API. Public branding themes the kiosk/partner surfaces; the
// partner-admin read/update + logo upload edit the caller's own branding.
import { api } from './api.service';

export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  primaryHover: string;
  onPrimary: string;
  accentColor: string | null;
  emailFromName: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const brandingService = {
  // Public — themes the kiosk/partner surfaces. 404s for a missing or suspended
  // partner (callers fall back to the default theme).
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
    return data as {
      partner: {
        id: string;
        name: string;
        slug: string;
        branding: Branding | null;
        stores: Array<{ id: string; name: string }>;
      };
    };
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
  async saveLogo(logoUrl: string): Promise<{ branding: Branding }> {
    const { data } = await api.post('/branding/logo', { logoUrl });
    return data;
  },

  // Presigned S3 PUT (prod). Falls back to an inline data URL when S3 isn't
  // configured (dev), so logo upload works in every environment.
  async uploadLogo(file: File): Promise<{ branding: Branding }> {
    try {
      const { uploadUrl, publicUrl } = await brandingService.requestLogoUpload(file.type);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('S3 upload failed');
      return brandingService.saveLogo(publicUrl);
    } catch {
      return brandingService.saveLogo(await fileToDataUrl(file));
    }
  },
};
