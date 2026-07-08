// Branding — public partner theming + the partner-admin branding editor.
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
  // Public — the theme the kiosk/partner surfaces render for a partner slug.
  // (No auth; a 404 for an unknown/suspended partner → callers use the default theme.)
  async getPublicBranding(slug: string): Promise<{
    partner: { id: string; name: string; slug: string; branding: Branding | null };
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
  async saveLogo(logoUrl: string): Promise<{ branding: Branding }> {
    const { data } = await api.post('/branding/logo', { logoUrl });
    return data;
  },

  // Presigned S3 PUT (prod). Falls back to an inline data URL when the presigned
  // upload isn't reachable (e.g. the dev S3 stub), so logo upload works anywhere.
  async uploadLogo(file: File): Promise<{ branding: Branding }> {
    try {
      const { uploadUrl, publicUrl } = await brandingService.requestLogoUpload(file.type);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload failed');
      return brandingService.saveLogo(publicUrl);
    } catch {
      return brandingService.saveLogo(await fileToDataUrl(file));
    }
  },
};
