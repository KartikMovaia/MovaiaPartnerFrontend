import { useEffect, useState } from 'react';
import { brandingService, Branding } from '@shared/services/branding.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function BrandingSettings() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    brandingService.getMine().then((d) => setBranding(d.branding ?? defaultBranding()));
  }, []);

  const save = async () => {
    if (!branding) return;
    const { branding: updated } = await brandingService.update(branding);
    setBranding(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const uploadLogo = async (file: File) => {
    const { uploadUrl, publicUrl } = await brandingService.requestLogoUpload(file.type);
    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    await brandingService.saveLogo(publicUrl);
    setBranding((b) => (b ? { ...b, logoUrl: publicUrl } : b));
  };

  if (!branding) return <LoadingSpinner label="Loading branding…" />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Branding</h1>

      <div className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <label className="mb-2 block text-sm text-neutral-700">Logo</label>
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt="logo" className="mb-3 h-12 rounded bg-neutral-100 p-1" />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            className="text-sm text-neutral-600"
          />
        </div>

        <ColorField label="Primary color" value={branding.primaryColor} onChange={(v) => setBranding({ ...branding, primaryColor: v })} />
        <ColorField label="Primary hover" value={branding.primaryHover} onChange={(v) => setBranding({ ...branding, primaryHover: v })} />
        <ColorField label="On-primary (text)" value={branding.onPrimary} onChange={(v) => setBranding({ ...branding, onPrimary: v })} />
        <ColorField label="Accent" value={branding.accentColor || '#3B82F6'} onChange={(v) => setBranding({ ...branding, accentColor: v })} />

        <div>
          <label className="mb-1 block text-sm text-neutral-700">Email sender name</label>
          <input
            value={branding.emailFromName || ''}
            onChange={(e) => setBranding({ ...branding, emailFromName: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
          />
        </div>

        <button
          onClick={save}
          className="rounded-lg px-6 py-2.5 font-semibold"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          {saved ? 'Saved ✓' : 'Save branding'}
        </button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-neutral-700">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-lg border border-neutral-300 bg-white px-2 py-1 font-mono text-sm text-neutral-900"
        />
      </div>
    </div>
  );
}

function defaultBranding(): Branding {
  return {
    logoUrl: null,
    primaryColor: '#ABD037',
    primaryHover: '#98B830',
    onPrimary: '#FFFFFF',
    accentColor: '#3B82F6',
    emailFromName: null,
  };
}
