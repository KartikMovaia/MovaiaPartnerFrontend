// Kiosk white-label editor with a live preview (design 532–598). Colors + logo
// persist to the real branding API; publishing re-themes every outlet kiosk.
import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Store, Palette, Upload } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/ui/Toast';
import { brandingService } from '@shared/services/branding.service';

const NAV: NavItem[] = [
  { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/partner' },
  { icon: <Store size={16} />, label: 'Branches', to: '/partner/stores' },
  { icon: <Palette size={16} />, label: 'Branding', to: '/partner/branding', active: true },
];

const PRIMARY_SWATCHES = ['#0e9e9e', '#e0930f', '#d64a43', '#6a5cff', '#141414'];
const ACCENT_SWATCHES = ['#0b6e6e', '#141414', '#686868'];

// A slightly darker shade for the button-hover token so the kiosk stays cohesive
// when the primary changes.
function darken(hex: string, amount = 0.12): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.round(v * (1 - amount)))
      .toString(16)
      .padStart(2, '0')
  );
  return `#${ch.join('')}`;
}

export default function BrandingSettings() {
  const { staff, logout } = useAuth();
  const toast = useToast();
  const [primary, setPrimary] = useState('#0e9e9e');
  const [accent, setAccent] = useState('#0b6e6e');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    brandingService.getMine().then((r) => {
      if (r.branding) {
        setPrimary(r.branding.primaryColor);
        if (r.branding.accentColor) setAccent(r.branding.accentColor);
        setLogoUrl(r.branding.logoUrl);
      }
    });
  }, []);

  const publish = async () => {
    setBusy(true);
    try {
      await brandingService.update({ primaryColor: primary, primaryHover: darken(primary), accentColor: accent });
      toast('Branding published — every outlet kiosk is updated.', 'success');
    } catch {
      toast('Couldn’t publish branding. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const { branding } = await brandingService.uploadLogo(file);
      setLogoUrl(branding.logoUrl);
      toast('Logo updated.', 'success');
    } catch {
      toast('Logo upload failed. Try a PNG, JPG, SVG, or WebP.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const brandName = staff?.partnerName ?? 'Your brand';

  return (
    <AdminShell variant="partner" nav={NAV} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-[-.4px]">Kiosk branding</h1>
          <p className="text-[13px]" style={{ color: '#686868' }}>
            Your colors &amp; logo — applied to every kiosk on publish.
          </p>
          {staff?.partnerSlug && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.5px]" style={{ color: '#9a9a9a' }}>
                Kiosk URL
              </span>
              <code className="rounded-[7px] bg-[#f2f2f2] px-2 py-1 text-[12px] text-[#141414]">
                {`${window.location.origin}/kiosk/${staff.partnerSlug}`} {/* double-check the URL in production */}
              </code>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={busy}
          className="h-[42px] rounded-[10px] px-[22px] text-sm font-bold disabled:opacity-60"
          style={{ background: '#ABD037', color: '#1c2b00' }}
        >
          {busy ? 'Publishing…' : 'Publish changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr]">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Logo */}
          <Panel title="Logo">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-[60px] w-[120px] items-center justify-center overflow-hidden rounded-[10px]"
                style={{ background: '#fff', border: '1px solid #eee' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={`${brandName} logo`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-base font-extrabold" style={{ color: primary }}>
                    {brandName.slice(0, 12)}
                  </span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onPickLogo} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-[38px] items-center gap-1.5 rounded-[9px] px-4 text-[13px] disabled:opacity-60"
                style={{ border: '1px dashed #cfcfcf', background: '#fafafa', color: '#686868' }}
              >
                <Upload size={14} /> {uploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload'}
              </button>
            </div>
          </Panel>

          {/* Primary color */}
          <Panel title="Primary color">
            <div className="flex flex-wrap items-center gap-2.5">
              {PRIMARY_SWATCHES.map((c) => (
                <Swatch key={c} color={c} selected={c.toLowerCase() === primary.toLowerCase()} onClick={() => setPrimary(c)} />
              ))}
              <ColorInput value={primary} onChange={setPrimary} />
              <span
                className="flex h-[38px] items-center rounded-[10px] px-3 text-[13px]"
                style={{ border: '1px solid #e4e4e4', color: '#686868', fontFamily: 'ui-monospace, monospace' }}
              >
                {primary.toUpperCase()}
              </span>
            </div>
          </Panel>

          {/* Accent / secondary */}
          <Panel title="Accent / secondary">
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_SWATCHES.map((c) => (
                <Swatch key={c} color={c} selected={c.toLowerCase() === accent.toLowerCase()} onClick={() => setAccent(c)} />
              ))}
              <ColorInput value={accent} onChange={setAccent} />
            </div>
          </Panel>
        </div>

        {/* Live preview */}
        <Panel>
          <div className="flex items-center justify-between">
            <b className="text-[13px]">Live preview</b>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#5a7d16' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7fb015' }} />
              Kiosk · Welcome
            </span>
          </div>
          <div className="flex items-center justify-center rounded-[14px] p-[22px]" style={{ background: '#e7e5e0' }}>
            <div className="w-full max-w-[520px] rounded-[22px] p-3" style={{ background: '#141414' }}>
              <div
                className="flex flex-col overflow-hidden rounded-xl px-[26px] py-5"
                style={{ background: '#fff', aspectRatio: '4 / 3' }}
              >
                <div className="flex items-center justify-between">
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${brandName} logo`} style={{ height: 18 }} className="object-contain" />
                  ) : (
                    <span className="text-[15px] font-extrabold" style={{ color: primary }}>
                      {brandName}
                    </span>
                  )}
                  <span className="text-[9px]" style={{ color: '#9a9a9a' }}>
                    Powered by Movaia
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2.5">
                  <span className="font-accent text-[9px] font-semibold uppercase tracking-[2px]" style={{ color: primary }}>
                    Running gait analysis
                  </span>
                  <span className="text-[26px] font-extrabold leading-[1.05] tracking-[-.5px]">
                    Let’s analyze
                    <br />
                    your run.
                  </span>
                  <div className="mt-1.5 h-[34px] rounded-lg" style={{ border: '1.5px solid #eee' }} />
                  <div className="h-[34px] rounded-lg" style={{ border: `1.5px solid ${accent}` }} />
                  <div
                    className="mt-1 flex h-[38px] items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ background: primary }}
                  >
                    Start →
                  </div>
                </div>
              </div>
            </div>
          </div>
          <span className="text-xs" style={{ color: '#9a9a9a' }}>
            Changes apply to all outlet kiosks on publish.
          </span>
        </Panel>
      </div>
    </AdminShell>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] p-[18px]" style={{ background: '#fff', border: '1px solid #ececec' }}>
      {title && <b className="text-[13px]">{title}</b>}
      {children}
    </div>
  );
}

function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Use ${color}`}
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-[10px]"
      style={{ width: 38, height: 38, background: color, boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : 'none' }}
    />
  );
}

// Native color picker for a fully custom brand color (backend validates hex).
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label
      className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[10px]"
      style={{ border: '1px dashed #cfcfcf', background: '#fafafa' }}
      title="Custom color"
    >
      <Palette size={15} style={{ color: '#9a9a9a' }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" aria-label="Custom color" />
    </label>
  );
}
