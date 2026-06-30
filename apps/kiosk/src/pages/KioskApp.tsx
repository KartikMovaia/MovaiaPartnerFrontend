// Kiosk wizard, themed by the partner slug in the URL (/kiosk/:slug). Runs the
// walk-up flow as a small state machine:
//   Identify (+consent) → Record → Review → Submitted
// Identify is the landing step: a dark intro panel on the left, the sign-up
// form on the right (light). The kiosk session is started lazily when that
// form is submitted (so the store is known by then).
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { PartnerThemeProvider, usePartnerContext } from '@shared/partners/PartnerThemeProvider';
import { PartnerTheme } from '@shared/partners/types';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import { kioskService, IdentifyResult } from '@shared/services/kiosk.service';
import KioskRecorder from '@shared/components/KioskRecorder';

// Drop the treadmill/pose-overlay image here and it'll be served at this path.
const HERO_IMAGE = '/kiosk-hero.png';

type Step = 'identify' | 'record' | 'review' | 'submitted';

export default function KioskApp() {
  const { slug } = useParams();
  return (
    <PartnerThemeProvider slug={slug}>
      <KioskFlow />
    </PartnerThemeProvider>
  );
}

function KioskFlow() {
  const { theme, stores, loading } = usePartnerContext();
  const [step, setStep] = useState<Step>('identify');
  const [identify, setIdentify] = useState<IdentifyResult | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  if (loading) return <LoadingSpinner label="Loading…" />;

  // Identify is the landing step and owns its own full-width two-column layout.
  if (step === 'identify') {
    return (
      <IdentifyStep
        theme={theme}
        stores={stores}
        onDone={(res) => {
          setIdentify(res);
          setStep('record');
        }}
      />
    );
  }

  // Later steps share a simple centered layout with the partner header.
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-6 py-12">
      <header className="mb-10 flex flex-col items-center">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={theme.displayName} className="h-12" />
        ) : (
          <h2 className="text-xl font-bold text-neutral-900">{theme.displayName}</h2>
        )}
        <p className="mt-1 text-xs text-neutral-500">Powered by Movaia</p>
      </header>

      {step === 'record' && (
        <div className="w-full">
          <h1 className="mb-6 text-center text-2xl font-bold text-neutral-900">Record your run</h1>
          <KioskRecorder
            onComplete={(b) => {
              setBlob(b);
              setStep('review');
            }}
          />
        </div>
      )}

      {step === 'review' && blob && identify && (
        <ReviewStep
          blob={blob}
          onRetake={() => {
            setBlob(null);
            setStep('record');
          }}
          onSubmit={async () => {
            await kioskService.uploadVideo(identify.uploadUrl, blob);
            await kioskService.submit(identify.scanId);
            setStep('submitted');
          }}
        />
      )}

      {step === 'submitted' && <SubmittedStep />}
    </div>
  );
}

function IdentifyStep({
  theme,
  stores,
  onDone,
}: {
  theme: PartnerTheme;
  stores: Array<{ id: string; name: string }>;
  onDone: (r: IdentifyResult) => void;
}) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [storeId, setStoreId] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveStore = storeId || stores[0]?.id || '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email && !form.phone) {
      setError('Please provide an email or phone number');
      return;
    }
    if (!effectiveStore) {
      setError('This kiosk has no active store configured');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Start the session now that we know the store, then identify against it.
      const session = await kioskService.startSession(effectiveStore);
      const res = await kioskService.identify({
        kioskSessionId: session.kioskSessionId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        consent: true,
      });
      onDone(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-2">
      {/* Left: static intro — dark panel with light text */}
      <div className="flex flex-col gap-8 rounded-3xl bg-neutral-900 p-8 text-white sm:p-10">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-800">
          <img
            src={HERO_IMAGE}
            alt="Runner on a treadmill with an AI pose overlay"
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-xl font-medium leading-relaxed text-white">
          AI analyses your running form in minutes — personalized insights to run safer and faster.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <HeroStat top="10s" label="recording" />
          <HeroStat top="11" label="metrics" />
          <HeroStat top="AI" label="coaching" />
        </div>
      </div>

      {/* Right: branding + sign-up form — light */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt={theme.displayName} className="h-12" />
          ) : (
            <h2 className="text-xl font-bold text-neutral-900">{theme.displayName}</h2>
          )}
          <p className="mt-1 text-xs text-neutral-500">Powered by Movaia</p>
        </div>

        <h1 className="text-center text-2xl font-bold text-neutral-900">Start Your Running Form Analysis</h1>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Enter your name and email to begin. Your personalized report will be sent directly to you.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {stores.length > 1 && (
            <select
              value={effectiveStore}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-neutral-900"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              className="rounded-lg border border-neutral-300 bg-white px-3 py-3 text-neutral-900"
            />
            <input
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              className="rounded-lg border border-neutral-300 bg-white px-3 py-3 text-neutral-900"
            />
          </div>
          <input
            type="email"
            placeholder="Email (for your report)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-neutral-900"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-neutral-900"
          />

          <label className="flex items-start gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I consent to recording a video of my run and creating a Movaia account to receive my
              analysis.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={!consent || busy}
            className="w-full rounded-xl py-4 text-lg font-semibold disabled:opacity-40"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            {busy ? 'Setting up…' : 'Continue to recording'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Headline stat: large brand-coloured value with a smaller label beneath it.
// Rendered on the dark left panel, so the label uses a light muted tone.
function HeroStat({ top, label }: { top: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
        {top}
      </span>
      <span className="mt-1 text-sm text-neutral-400">{label}</span>
    </div>
  );
}

function ReviewStep({ blob, onRetake, onSubmit }: { blob: Blob; onRetake: () => void; onSubmit: () => void }) {
  const [busy, setBusy] = useState(false);
  const url = URL.createObjectURL(blob);
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h1 className="text-2xl font-bold text-neutral-900">Review your clip</h1>
      <video src={url} controls className="w-full rounded-2xl bg-black" style={{ aspectRatio: '16/9' }} />
      <div className="flex w-full gap-3">
        <button onClick={onRetake} className="flex-1 rounded-xl border border-neutral-300 py-3 font-semibold text-neutral-900">
          Record again
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            await onSubmit();
          }}
          disabled={busy}
          className="flex-1 rounded-xl py-3 font-semibold disabled:opacity-50"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function SubmittedStep() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
      >
        ✓
      </div>
      <h1 className="text-2xl font-bold text-neutral-900">You're all set!</h1>
      <p className="max-w-sm text-neutral-600">
        We're analysing your run now. Check your email shortly for a link to your full Movaia report.
      </p>
    </div>
  );
}
