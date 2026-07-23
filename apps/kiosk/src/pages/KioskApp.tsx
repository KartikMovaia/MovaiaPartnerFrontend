// Customer kiosk — the walk-up scan flow, white-labeled by the partner slug in
// the URL (/kiosk/:slug). Runs full-screen on a gym-provided iPad in landscape
// and behaves as a public shared device: it resets to Welcome after each
// customer and keeps nothing between sessions.
//
// State machine (matches the design screens 01–10):
//   welcome → [returning?] → ready → preroll(~20s) → recording(~10s) →
//   review → uploading → done → (auto-reset to welcome)
// with error branches: error-camera, error-upload.
//
// Any state is previewable for QA via ?screen=<step> (e.g. ?screen=done).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { PartnerThemeProvider, usePartnerContext } from '@shared/partners/PartnerThemeProvider';
import { PartnerTheme } from '@shared/partners/types';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import LanguageSwitcher from '@shared/ui/LanguageSwitcher';
import i18n from '@shared/i18n';
import { deviceLanguage } from '@shared/i18n/config';
import { kioskService, DeviceBinding } from '@shared/services/kiosk.service';
import { beeps, unlockAudio } from '@shared/components/cues';

const IDLE_MS = 60_000; // shared-device inactivity → reset + PII wipe

const SETUP_SECONDS = 20; // pre-roll: time to get set on the treadmill
const RECORD_SECONDS = 10; // recorded clip length

type Step =
  | 'welcome'
  | 'returning'
  | 'ready'
  | 'preroll'
  | 'recording'
  | 'review'
  | 'uploading'
  | 'done'
  | 'error-camera'
  | 'error-upload';

interface Recognized {
  firstName: string;
  email: string;
  lastAnalysis?: string;
  initials?: string;
}

// What the Welcome form collects and hands to identify(). Height/weight are
// normalized to canonical units (cm / kg) inside the form before they get here.
interface IdentifyDetails {
  firstName: string;
  lastName: string;
  email: string;
  heightCm: number;
  weightKg: number;
}

const MOVAIA_LOGO = '/assets/movaia-logo.png';
// Brand hero shown beside the details form on wider screens — mirrors the
// Movaia login page's right panel (full-bleed photo + tagline + feature list).
const WELCOME_IMAGE = '/assets/kiosk-welcome.jpg';
// Get-ready illustration: a runner framed side-on, set up and ready to run.
const SETUP_IMAGE = '/assets/kiosk-setup.png';

// The three selling points listed over the hero photo (icons match the login).
// Text is pulled from the `welcome.hero.features.<key>` catalog entries at render.
const HERO_FEATURES = [
  {
    key: 'analysis',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: 'insights',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: 'progress',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
] as const;

export default function KioskApp() {
  const { slug } = useParams();
  // Shared public device: start in the iPad/browser's language. Per-customer
  // choices are made via the on-screen switcher and reset on each goHome, so the
  // kiosk never inherits the previous customer's language.
  useEffect(() => {
    void i18n.changeLanguage(deviceLanguage());
  }, []);
  return (
    <PartnerThemeProvider slug={slug}>
      <DeviceGate slug={slug}>
        <KioskFlow />
      </DeviceGate>
    </PartnerThemeProvider>
  );
}

/* ─────────────────── Device binding gate (auth only) ─────────────────── */
// The iPad must be bound to an outlet before the walk-up flow runs. Binding is
// a one-time outlet-admin sign-in that authorizes kiosk-session creation only —
// it exposes no dashboard/business data.
function DeviceGate({ slug, children }: { slug?: string; children: React.ReactNode }) {
  const { theme } = usePartnerContext();
  const { t } = useTranslation(['kiosk', 'common']);
  const [binding, setBinding] = useState<DeviceBinding | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(() => {
    setChecking(true);
    kioskService
      .deviceMe()
      .then(setBinding)
      .catch(() => setBinding(null))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    check();
  }, [check]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner label={t('common:loading')} />
      </div>
    );
  }

  // Bound, but to a different partner than the URL slug → refuse (attribution safety).
  if (binding && slug && binding.partnerSlug !== slug) {
    return (
      <DeviceSetup
        theme={theme}
        slug={slug}
        notice={t('deviceSetup.wrongPartner', { partner: binding.partnerName, slug })}
        onBound={check}
      />
    );
  }
  if (!binding) {
    return <DeviceSetup theme={theme} slug={slug} onBound={check} />;
  }
  return <>{children}</>;
}

function DeviceSetup({
  theme,
  slug,
  notice,
  onBound,
}: {
  theme: PartnerTheme;
  slug?: string;
  notice?: string;
  onBound: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const b = await kioskService.deviceLogin(email.trim(), password);
      if (slug && b.partnerSlug !== slug) {
        setError(t('deviceSetup.accountMismatch', { partner: b.partnerName, slug }));
        await kioskService.deviceLogout(email.trim(), password).catch(() => {});
        return;
      }
      onBound();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('deviceSetup.signInError'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-[58px] rounded-[14px] border-2 px-[20px] text-[18px] outline-none';
  return (
    <Screen>
      <KioskHeader theme={theme} />
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-10 lg:px-[90px]">
        <form onSubmit={submit} className="flex w-full max-w-[520px] flex-col gap-4">
          <span className="text-[13px]" style={eyebrow}>{t('deviceSetup.eyebrow')}</span>
          <h1 className="m-0 text-[30px] font-extrabold leading-[1.05] sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>
            {t('deviceSetup.title')}
          </h1>
          <p className="m-0 text-[16px] leading-[1.5] sm:text-[17px]" style={{ color: '#686868' }}>
            {t('deviceSetup.desc')}
          </p>
          {notice && (
            <p className="rounded-[12px] px-4 py-3 text-[14px]" style={{ background: '#fdf0d9', color: '#a9720d' }}>
              {notice}
            </p>
          )}
          <input
            className={input}
            style={{ borderColor: '#e4e4e4' }}
            type="email"
            placeholder={t('deviceSetup.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className={input}
            style={{ borderColor: 'var(--brand-primary)' }}
            type="password"
            placeholder={t('deviceSetup.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <span className="text-[14px]" style={{ color: '#c5352b' }}>{error}</span>}
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="mt-1 flex h-[64px] items-center justify-center rounded-[14px] text-[20px] font-bold disabled:opacity-40"
            style={brandBtn}
          >
            {busy ? t('deviceSetup.linking') : t('deviceSetup.link')}
          </button>
        </form>
      </div>
    </Screen>
  );
}

// Shared-device inactivity → reset + PII wipe. Runs on every step except the
// confirmation screen (which has its own short auto-reset).
function useIdleReset(step: Step, onIdle: () => void) {
  useEffect(() => {
    if (step === 'done') return;
    let timer: number;
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [step, onIdle]);
}

function KioskFlow() {
  const { theme, loading } = usePartnerContext();
  const { t } = useTranslation(['kiosk', 'common']);
  const [params] = useSearchParams();
  const initial = (params.get('screen') as Step | null) ?? 'welcome';

  const [step, setStep] = useState<Step>(initial);
  const [customer, setCustomer] = useState<Recognized>({ firstName: 'there', email: '' });
  const [resetNonce, setResetNonce] = useState(0);
  const sessionRef = useRef<string>('');
  const scanRef = useRef<string>('');
  const uploadUrlRef = useRef<string>('');
  const blobRef = useRef<Blob | null>(null);

  // Fresh kiosk session per customer (store derived from the device token).
  const newSession = useCallback(() => {
    kioskService.startSession().then((s) => (sessionRef.current = s.kioskSessionId)).catch(() => {});
  }, []);
  useEffect(() => {
    newSession();
  }, [newSession]);

  const goHome = useCallback(() => {
    setCustomer({ firstName: 'there', email: '' });
    blobRef.current = null;
    scanRef.current = '';
    uploadUrlRef.current = '';
    void i18n.changeLanguage(deviceLanguage()); // shared device: drop the previous customer's language
    setResetNonce((n) => n + 1); // remounts Welcome → clears any typed PII
    setStep('welcome');
    newSession();
  }, [newSession]);

  useIdleReset(step, goHome);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner label={t('common:loading')} />
      </div>
    );
  }

  const identify = async (d: IdentifyDetails) => {
    const res = await kioskService.identify({
      kioskSessionId: sessionRef.current,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      heightCm: d.heightCm,
      weightKg: d.weightKg,
      consent: true,
    });
    scanRef.current = res.scanId;
    uploadUrlRef.current = res.uploadUrl;
    setCustomer(res.customer);
    setStep(res.isReturning ? 'returning' : 'ready');
  };

  const screen = (() => {
    switch (step) {
      case 'welcome':
        return <Welcome key={resetNonce} theme={theme} onStart={identify} />;
      case 'returning':
        return <Returning theme={theme} customer={customer} onContinue={() => setStep('ready')} onNotMe={goHome} />;
      case 'ready':
        return <GetReady onReady={() => setStep('preroll')} />;
      case 'preroll':
      case 'recording':
        return (
          <CameraStage
            step={step}
            onStartRecording={() => setStep('recording')}
            onRecorded={(blob) => {
              blobRef.current = blob;
              setStep('review');
            }}
            onCameraError={() => setStep('error-camera')}
            onCancel={goHome}
          />
        );
      case 'review':
        return <Review blob={blobRef.current} onRecordAgain={() => setStep('preroll')} onSubmit={() => setStep('uploading')} />;
      case 'uploading':
        return (
          <Uploading
            blob={blobRef.current}
            uploadUrl={uploadUrlRef.current}
            scanId={scanRef.current}
            onDone={() => setStep('done')}
            onError={() => setStep('error-upload')}
          />
        );
      case 'done':
        return <Confirmation email={customer.email} onDone={goHome} />;
      case 'error-camera':
        return <CameraDenied theme={theme} onRetry={() => setStep('preroll')} onHome={goHome} />;
      case 'error-upload':
        return <UploadFailed theme={theme} onRetry={() => setStep('uploading')} onHome={goHome} />;
      default:
        return <Welcome key={resetNonce} theme={theme} onStart={identify} />;
    }
  })();

  // Always-available reset for a shared device (the camera screens have their
  // own Cancel; welcome/done don't need one).
  const showReset = !['welcome', 'done', 'preroll', 'recording'].includes(step);
  return (
    <>
      {screen}
      {showReset && (
        <button
          type="button"
          onClick={goHome}
          aria-label={t('startOver')}
          className="fixed bottom-5 right-5 z-50 h-10 rounded-full px-4 text-[13px] font-semibold"
          style={{ background: 'rgba(20,20,20,.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          ⟲ {t('startOver')}
        </button>
      )}
    </>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

// Partner logo: renders the uploaded image when present, otherwise falls back to
// a generated wordmark (first word in the brand color, the rest in ink). The same
// fallback covers a broken upload — if the image 404s (e.g. a deleted/expired S3
// object) we remember the bad URL and drop through to the wordmark instead of
// showing a broken-image icon.
function Wordmark({ theme, size = 26 }: { theme: PartnerTheme; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { logoUrl } = theme;
  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <img
        src={logoUrl}
        alt={theme.displayName}
        // An uploaded logo gets more room than the generated wordmark, but is
        // bounded so a very wide mark can't crowd the "Powered by" logo. Smaller
        // and tighter on phones so it never pushes the language pill off-screen.
        className="h-9 max-w-[150px] object-contain sm:h-[46px] sm:max-w-[280px]"
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }
  const [first, ...rest] = theme.displayName.toUpperCase().split(' ');
  return (
    <div className="flex items-baseline" style={{ gap: 2 }}>
      <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.5px', color: 'var(--brand-primary)' }}>{first}</span>
      {rest.length > 0 && (
        <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.5px', color: '#141414' }}>{rest.join(' ')}</span>
      )}
    </div>
  );
}

function KioskHeader({ theme }: { theme: PartnerTheme }) {
  const { t } = useTranslation('kiosk');
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-10 sm:py-6">
      <Wordmark theme={theme} />
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Customer language picker — the choice lasts this session and resets on reset. */}
        <LanguageSwitcher variant="kiosk" />
        {/* "Powered by Movaia" — hidden on phones to keep the header on one row. */}
        <div className="hidden items-center gap-2 sm:flex" style={{ opacity: 0.65 }}>
          <span className="text-xs" style={{ color: '#686868' }}>{t('poweredBy')}</span>
          <img src={MOVAIA_LOGO} alt="Movaia" style={{ height: 16 }} />
        </div>
      </div>
    </div>
  );
}

// Full-viewport landscape white screen wrapper.
function Screen({ children, bg = '#fff' }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col" style={{ background: bg }}>
      {children}
    </div>
  );
}

const brandBtn: React.CSSProperties = { background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' };
const eyebrow: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontWeight: 600,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: 'var(--brand-primary)',
};

/* ───────────────────────── height / weight units ───────────────────────── */

type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lb';
const HEIGHT_UNITS: readonly HeightUnit[] = ['cm', 'ft'];
const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

// Sanity bounds (canonical units) — reject typos, not real people.
const HEIGHT_MIN_CM = 90;
const HEIGHT_MAX_CM = 250;
const WEIGHT_MIN_KG = 30;
const WEIGHT_MAX_KG = 250;

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

// Normalize the form's height inputs to whole centimetres (null = not yet valid).
function heightToCm(unit: HeightUnit, cm: string, ft: string, inch: string): number | null {
  if (unit === 'cm') {
    const v = parseFloat(cm);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  const f = parseFloat(ft);
  if (!Number.isFinite(f)) return null;
  const i = inch.trim() === '' ? 0 : parseFloat(inch); // inches optional (e.g. exactly 6 ft)
  if (!Number.isFinite(i)) return null;
  return Math.round((f * 12 + i) * CM_PER_INCH);
}

// Normalize the form's weight input to whole kilograms (null = not yet valid).
function weightToKg(unit: WeightUnit, value: string): number | null {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return null;
  return unit === 'kg' ? Math.round(v) : Math.round(v * KG_PER_LB);
}

// Compact two-option unit switch (cm/ft, kg/lb) sized to sit beside a 66px input.
function SegToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex h-[66px] flex-none overflow-hidden rounded-[14px] border-2"
      style={{ borderColor: '#e4e4e4' }}
    >
      {options.map((opt, i) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className="px-4 text-[17px] font-bold outline-none"
            style={{
              background: active ? 'var(--brand-primary)' : '#fff',
              color: active ? 'var(--brand-on-primary)' : '#9a9a9a',
              borderLeft: i > 0 ? '2px solid #e4e4e4' : undefined,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── 01 · Welcome ─────────────────────────── */

function Welcome({ theme, onStart }: { theme: PartnerTheme; onStart: (d: IdentifyDetails) => Promise<void> }) {
  const { t } = useTranslation('kiosk');
  // The form is split in two so neither panel feels crowded: who you are, then
  // your body measurements + consent.
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weight, setWeight] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const cm = heightToCm(heightUnit, heightCm, heightFt, heightIn);
  const kg = weightToKg(weightUnit, weight);
  const heightValid = cm !== null && cm >= HEIGHT_MIN_CM && cm <= HEIGHT_MAX_CM;
  const whoValid = firstName.trim() !== '' && lastName.trim() !== '' && emailValid;
  const weightValid = kg !== null && kg >= WEIGHT_MIN_KG && kg <= WEIGHT_MAX_KG;
  const ready = whoValid && heightValid && weightValid && consent;

  // Step 1 → 2. Re-checks the same fields `start` does, so a bad value can't
  // slip past the disabled button and only surface at submit.
  const next = () => {
    if (!firstName.trim()) return setError(t('welcome.errors.firstName'));
    if (!lastName.trim()) return setError(t('welcome.errors.lastName'));
    if (!email.trim()) return setError(t('welcome.errors.emailRequired'));
    if (!emailValid) return setError(t('welcome.errors.emailInvalid'));
    setError(null);
    setFormStep(2);
  };

  const start = async () => {
    if (busy) return;
    if (!firstName.trim()) return setError(t('welcome.errors.firstName'));
    if (!lastName.trim()) return setError(t('welcome.errors.lastName'));
    if (!email.trim()) return setError(t('welcome.errors.emailRequired'));
    if (!emailValid) return setError(t('welcome.errors.emailInvalid'));
    if (cm === null) return setError(t('welcome.errors.heightRequired'));
    if (!heightValid) return setError(t('welcome.errors.heightInvalid'));
    if (kg === null) return setError(t('welcome.errors.weightRequired'));
    if (!weightValid) return setError(t('welcome.errors.weightInvalid'));
    if (!consent) return setError(t('welcome.errors.consent'));
    setError(null);
    setBusy(true);
    try {
      await onStart({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        heightCm: cm,
        weightKg: kg,
      });
    } catch {
      setError(t('welcome.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-[66px] rounded-[14px] border-2 px-[22px] text-[20px] outline-none';
  // Numeric fields (height/weight) share a tighter, centred variant so a value
  // plus its unit toggle fit two-up on one row.
  const numInput = 'h-[66px] w-0 flex-1 rounded-[14px] border-2 px-[14px] text-[20px] text-center outline-none';

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left: brand hero — full-bleed photo with a dark bottom gradient, then
          the tagline + feature list anchored to the bottom. Desktop/tablet only;
          below `lg` it's hidden and the form takes the full width. */}
      <div
        className="relative hidden flex-col justify-end lg:flex lg:flex-1"
        style={{
          backgroundImage: `url('${WELCOME_IMAGE}')`,
          backgroundSize: 'cover',
          // Landscape source in a portrait panel: bias the crop toward the
          // runner (right-of-centre) so she stays framed.
          backgroundPosition: '66% center',
          backgroundColor: '#1b2430', // fallback tone while the photo loads
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)',
          }}
        />

        <div className="relative z-10 p-12 pb-14">
          {/* The hero now carries the screen's main title, so it's the h1. */}
          <h1 className="mb-8 text-5xl font-extrabold leading-tight" style={{ color: 'var(--brand-primary)' }}>
            {t('welcome.hero.titleAccent')}
          </h1>

          <div className="space-y-5">
            {HERO_FEATURES.map((f) => (
              <div key={f.key} className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
                >
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{t(`welcome.hero.features.${f.key}.title`)}</h4>
                  <p className="mt-0.5 text-xs text-white/80">{t(`welcome.hero.features.${f.key}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: intro + details form. This is the only column below `lg`; the
          photo panel to the left appears once there's room to spare. `min-w-0`
          lets this flex column shrink below its content's intrinsic width so
          the header/inputs never overflow on narrow screens. */}
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <KioskHeader theme={theme} />
        <div className="flex flex-1 flex-col justify-center gap-7 px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-[90px]">
        <div className="flex flex-col gap-2.5">
          <span className="text-[14px]" style={eyebrow}>{t('welcome.eyebrow')}</span>
          {/* Headline — the brand hero carries it on lg+, so surface it here on
              phones/tablets where the hero panel is hidden (no headless screen). */}
          <h1 className="m-0 text-[30px] font-extrabold leading-[1.05] sm:text-[38px] lg:hidden" style={{ letterSpacing: '-1px' }}>
            {t('welcome.hero.titleAccent')}
          </h1>
          <p className="m-0 max-w-[560px] text-[17px] leading-[1.5] sm:text-[19px]" style={{ color: '#686868' }}>
            {t('welcome.desc')}
          </p>
        </div>
        <div className="flex max-w-[620px] flex-col gap-3.5">
          {formStep === 1 ? (
            <>
              {/* Name — first + last, side by side */}
              <div className="flex gap-3.5">
                <input className={`${input} min-w-0 flex-1`} aria-label={t('welcome.firstName')} autoComplete="off" style={{ borderColor: '#e4e4e4' }} placeholder={t('welcome.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className={`${input} min-w-0 flex-1`} aria-label={t('welcome.lastName')} autoComplete="off" style={{ borderColor: '#e4e4e4' }} placeholder={t('welcome.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <input className={input} type="email" inputMode="email" autoComplete="off" aria-label={t('welcome.email')} style={{ borderColor: 'var(--brand-primary)' }} placeholder={t('welcome.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="pl-1 text-[14px]" style={{ color: '#9a9a9a' }}>{t('welcome.helperEmail')}</span>
            </>
          ) : (
            <>
              {/* Height + weight — value(s) with a unit toggle each. Stacked on
                  phones so each value + its toggle has room; side by side from sm up. */}
              <div className="flex flex-col gap-3.5 sm:flex-row">
                <div className="flex min-w-0 flex-1 gap-2">
                  {heightUnit === 'cm' ? (
                    <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="decimal" aria-label={t('welcome.heightCmAria')} placeholder={t('welcome.height')} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                  ) : (
                    <>
                      <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="numeric" aria-label={t('welcome.heightFtAria')} placeholder={t('welcome.ft')} value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                      <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="numeric" aria-label={t('welcome.heightInAria')} placeholder={t('welcome.in')} value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
                    </>
                  )}
                  <SegToggle ariaLabel={t('welcome.heightUnitAria')} value={heightUnit} options={HEIGHT_UNITS} onChange={setHeightUnit} />
                </div>
                <div className="flex min-w-0 flex-1 gap-2">
                  <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="decimal" aria-label={t('welcome.weightAria')} placeholder={t('welcome.weight')} value={weight} onChange={(e) => setWeight(e.target.value)} />
                  <SegToggle ariaLabel={t('welcome.weightUnitAria')} value={weightUnit} options={WEIGHT_UNITS} onChange={setWeightUnit} />
                </div>
              </div>
              <span className="pl-1 text-[14px]" style={{ color: '#9a9a9a' }}>{t('welcome.helper')}</span>
              <label className="flex cursor-pointer items-start gap-3 pl-1 pt-1">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-6 w-6 flex-none" style={{ accentColor: 'var(--brand-primary)' }} />
                <span className="text-[15px] leading-[1.45]" style={{ color: '#686868' }}>
                  <Trans t={t} i18nKey="welcome.consent" components={{ bold: <b style={{ color: '#141414' }} /> }} />
                </span>
              </label>
            </>
          )}
          {error && (
            <span className="pl-1 text-[15px]" style={{ color: '#c5352b' }}>
              {error}
            </span>
          )}
        </div>
        <button
          onClick={formStep === 1 ? next : start}
          disabled={formStep === 1 ? !whoValid : !ready || busy}
          className="flex h-[72px] max-w-[620px] items-center justify-center gap-3 rounded-[14px] text-[22px] font-bold disabled:opacity-40"
          style={brandBtn}
        >
          {formStep === 1
            ? `${t('welcome.next')}  →`
            : busy
              ? t('welcome.settingUp')
              : `${t('welcome.start')}  →`}
        </button>
        </div>
        <div className="px-6 pb-[30px] pt-[22px] sm:px-10 lg:px-12 xl:px-16 2xl:px-[90px]">
          <span className="text-[13px]" style={{ color: '#9a9a9a' }}>
            {t('welcome.footer')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── 02 · Returning customer ─────────────────────── */

function Returning({
  theme,
  customer,
  onContinue,
  onNotMe,
}: {
  theme: PartnerTheme;
  customer: Recognized;
  onContinue: () => void;
  onNotMe: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <Screen>
      <KioskHeader theme={theme} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center sm:gap-[30px] sm:px-10 lg:px-[90px]">
        <div
          className="flex h-[92px] w-[92px] items-center justify-center rounded-full text-[36px] font-extrabold sm:h-[120px] sm:w-[120px] sm:text-[46px]"
          style={{ background: 'color-mix(in srgb, var(--brand-primary) 16%, #fff)', color: 'var(--brand-primary)' }}
        >
          {customer.initials ?? customer.firstName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[14px]" style={eyebrow}>{t('returning.eyebrow')}</span>
          <h1 className="m-0 text-[32px] font-extrabold leading-[1.05] sm:text-[44px] lg:text-[48px]" style={{ letterSpacing: '-1px' }}>
            {t('returning.title', { name: customer.firstName })}
          </h1>
          <p className="m-0 max-w-[560px] text-[17px] leading-[1.5] sm:text-[19px]" style={{ color: '#686868' }}>
            <Trans t={t} i18nKey="returning.desc" values={{ email: customer.email }} components={{ bold: <b style={{ color: '#141414' }} /> }} />
          </p>
        </div>
        <div className="flex w-full max-w-[620px] gap-3.5">
          <button onClick={onNotMe} className="h-[72px] flex-1 rounded-[14px] border-2 text-[19px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            {t('returning.notMe')}
          </button>
          <button onClick={onContinue} className="h-[72px] flex-[2] rounded-[14px] text-[22px] font-bold" style={brandBtn}>
            {t('returning.continue')}  →
          </button>
        </div>
        {customer.lastAnalysis && <span className="text-[14px]" style={{ color: '#9a9a9a' }}>{t('returning.lastAnalysis', { date: customer.lastAnalysis })}</span>}
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 03 · Get ready ─────────────────────────── */

function GetReady({ onReady }: { onReady: () => void }) {
  const { t } = useTranslation('kiosk');
  const numChip = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[17px] font-extrabold';
  const chipStyle = { background: 'color-mix(in srgb, var(--brand-primary) 16%, #fff)', color: 'var(--brand-primary)' };

  return (
    <Screen>
      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-[60px]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[15px] font-semibold" style={{ color: '#686868' }}>{t('getReady.step')}</span>
          <div className="flex gap-1.5">
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: 'var(--brand-primary)' }} />
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: '#e4e4e4' }} />
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: '#e4e4e4' }} />
          </div>
        </div>
        <h1 className="mb-1 mt-3.5 text-[30px] font-extrabold sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>{t('getReady.title')}</h1>
        <p className="mb-[26px] text-[17px] sm:text-[19px]" style={{ color: '#686868' }}>
          <Trans t={t} i18nKey="getReady.subtitle" components={{ bold: <b style={{ color: '#141414' }} /> }} />
        </p>
        {/* Illustration and recording steps share a row: the landscape iPad has
            far more width than height, so side-by-side buys the artwork height. */}
        <div className="grid flex-1 grid-cols-1 gap-[22px] md:grid-cols-2">
          {/* Framing illustration — a runner set up side-on, ready to run.
              Absolutely positioned so its intrinsic size can't feed back into
              the layout and push the CTA off a short iPad. */}
          <div className="relative min-h-[200px] overflow-hidden rounded-[18px]">
            <img
              src={SETUP_IMAGE}
              alt={t('getReady.imageAlt')}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
          {/* What happens during recording — prep time + the beep signals.
              Centred vertically: the panel stretches to the illustration's
              height, so short step lists would otherwise sit in dead space. */}
          <div
            className="flex flex-col justify-center rounded-[16px] px-5 py-5 sm:px-7 sm:py-[22px]"
            style={{ background: 'color-mix(in srgb, var(--brand-primary) 7%, #fff)' }}
          >
            <b className="text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: '#141414' }}>
              {t('getReady.whatNext')}
            </b>
            <div className="mt-4 flex flex-col gap-5">
              {[
                { n: 1, title: t('getReady.next.getSet.title', { count: SETUP_SECONDS }), body: t('getReady.next.getSet.body') },
                { n: 2, title: t('getReady.next.oneBeep.title'), body: t('getReady.next.oneBeep.body', { count: RECORD_SECONDS }) },
                { n: 3, title: t('getReady.next.twoBeeps.title'), body: t('getReady.next.twoBeeps.body') },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className={numChip} style={chipStyle}>{s.n}</span>
                  <div className="flex flex-col gap-1">
                    <b className="text-[16px]" style={{ color: '#141414' }}>{s.title}</b>
                    <span className="text-[15px] leading-[1.45]" style={{ color: '#686868' }}>{s.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            unlockAudio(); // prime audio during this tap so the beeps play on iPad
            onReady();
          }}
          className="mt-5 h-[72px] rounded-[14px] text-[22px] font-bold"
          style={brandBtn}
        >
          {t('getReady.cta')}  →
        </button>
      </div>
    </Screen>
  );
}

/* ────────────────────── 04/05 · Pre-roll + Recording ────────────────────── */

// Pick a MediaRecorder mime the browser actually supports (iPad Safari doesn't
// do webm; falls back to mp4/H.264). Empty string = let the browser choose.
function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const t of candidates) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

function CameraStage({
  step,
  onStartRecording,
  onRecorded,
  onCameraError,
  onCancel,
}: {
  step: 'preroll' | 'recording';
  onStartRecording: () => void;
  onRecorded: (blob: Blob | null) => void;
  onCameraError: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [live, setLive] = useState(false);
  const [count, setCount] = useState(step === 'preroll' ? SETUP_SECONDS : RECORD_SECONDS);

  // Acquire the camera once for the whole stage (kept across preroll→recording).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setLive(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        onCameraError();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    beeps(1); // one beep signals recording has started
    onStartRecording();
    if (!stream) return; // still advances the UI even without a real camera
    chunksRef.current = [];
    try {
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      // Build the Blob when recording stops and hand it to the flow so it can be
      // played back in Review and uploaded for real.
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' })
          : null;
        onRecorded(blob);
      };
      rec.start(1000); // timeslice → emit a chunk each second (partial data survives an interruption)
      recorderRef.current = rec;
    } catch {
      /* recording unsupported — stopRecording still advances the flow */
    }
  }, [onStartRecording, onRecorded]);

  const stopRecording = useCallback(() => {
    beeps(2); // two beeps signal the clip is done
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop(); // onstop builds the Blob → onRecorded(blob)
    } else {
      onRecorded(null); // camera unsupported/simulated — advance with no clip
    }
  }, [onRecorded]);

  // One self-contained countdown per step. A LOCAL counter (not the display
  // `count` state) drives the transition, so a step change can never read a
  // stale count and fire the next transition early — which was ending the
  // recording ~0s after it started. preroll(20s) → start; recording(10s) → stop.
  useEffect(() => {
    const total = step === 'preroll' ? SETUP_SECONDS : RECORD_SECONDS;
    setCount(total);
    let remaining = total;
    const id = window.setInterval(() => {
      remaining -= 1;
      setCount(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        if (step === 'preroll') startRecording();
        else stopRecording();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, startRecording, stopRecording]);

  const feedLabel = live ? t('camera.feedLive') : t('camera.feedSimulated');
  const recElapsed = RECORD_SECONDS - count;
  const mmss = `0:${String(Math.max(0, recElapsed)).padStart(2, '0')}`;
  const ringPct = step === 'preroll' ? (SETUP_SECONDS - count) / SETUP_SECONDS : 0;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg,#1b2430,#0e141c)' }}>
      {/* camera feed */}
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ opacity: live ? 1 : 0 }} />
      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 14px,transparent 14px,transparent 28px)' }} />

      {/* recording red border */}
      {step === 'recording' && <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ border: '5px solid #d64a43' }} />}

      <div className="absolute left-[30px] top-[26px] font-mono text-xs" style={{ color: 'rgba(255,255,255,.45)', letterSpacing: 1 }}>{feedLabel}</div>

      {step === 'preroll' && (
        <button onClick={onCancel} className="absolute right-[30px] top-6 h-11 rounded-full px-5 text-[15px] font-semibold" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>
          {t('camera.cancel')}
        </button>
      )}

      {/* REC pill */}
      {step === 'recording' && (
        <div className="absolute left-1/2 top-[26px] flex -translate-x-1/2 items-center gap-2.5 rounded-full px-5 py-2.5" style={{ background: 'rgba(0,0,0,.5)' }}>
          <span className="h-3.5 w-3.5 animate-mv-pulse rounded-full" style={{ background: '#ff4d42' }} />
          <span className="text-[16px] font-bold text-white" style={{ letterSpacing: 1 }}>REC</span>
          <span className="tnum text-[16px]" style={{ color: 'rgba(255,255,255,.8)' }}>{mmss}</span>
        </div>
      )}

      {/* center content */}
      {step === 'preroll' ? (
        <div className="relative z-10 flex flex-col items-center gap-3.5 text-center">
          <span className="text-[16px]" style={{ ...eyebrow, color: 'rgba(255,255,255,.75)' }}>{t('camera.prerollEyebrow')}</span>
          <div className="relative flex h-[220px] w-[220px] items-center justify-center">
            <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90">
              <circle cx="110" cy="110" r="104" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="6" />
              <circle
                cx="110" cy="110" r="104" fill="none" stroke="var(--brand-primary)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 104}
                strokeDashoffset={2 * Math.PI * 104 * (1 - ringPct)}
              />
            </svg>
            <span className="text-[104px] font-extrabold leading-none text-white">{count}</span>
          </div>
          <span className="text-[18px]" style={{ color: 'rgba(255,255,255,.7)' }}>{t('camera.prerollHint')}</span>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-[22px] text-center">
          <span className="text-[26px] font-bold text-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>{t('camera.recordingTitle')}</span>
          <div className="h-3.5 w-[520px] max-w-[80vw] overflow-hidden rounded-lg" style={{ background: 'rgba(255,255,255,.18)' }}>
            <span className="block h-full rounded-lg" style={{ width: `${(recElapsed / RECORD_SECONDS) * 100}%`, background: 'var(--brand-primary)' }} />
          </div>
          <span className="text-[16px]" style={{ color: 'rgba(255,255,255,.7)' }}>{t('camera.secondsLeft', { count: Math.max(0, count) })}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── 06 · Review ─────────────────────────── */

function Review({ blob, onRecordAgain, onSubmit }: { blob: Blob | null; onRecordAgain: () => void; onSubmit: () => void }) {
  const { t } = useTranslation('kiosk');
  // Create the playback URL in an effect (NOT useMemo) and revoke it in the SAME
  // effect's cleanup. The useMemo + separate-revoke pattern gets the URL revoked
  // out from under the <video> under React StrictMode's double-invoke, so the
  // clip never renders.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return (
    <Screen>
      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-[60px]">
        <h1 className="mb-1 text-[30px] font-extrabold sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>{t('review.title')}</h1>
        <p className="mb-[22px] text-[17px] sm:text-[19px]" style={{ color: '#686868' }}>{t('review.subtitle')}</p>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[18px]" style={{ background: 'linear-gradient(135deg,#1b2430,#0e141c)' }}>
          {url ? (
            <video src={url} controls autoPlay muted playsInline className="h-full w-full object-contain" />
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 14px,transparent 14px,transparent 28px)' }} />
              <span className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-[16px]" style={{ color: 'rgba(255,255,255,.7)' }}>{t('review.noPreview')}</span>
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,.45)' }}>{t('review.noPreviewSub')}</span>
              </span>
            </>
          )}
        </div>
        <div className="mt-6 flex gap-3.5">
          <button onClick={onRecordAgain} className="h-[72px] flex-1 rounded-[14px] border-2 text-[19px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            ↻ {t('review.recordAgain')}
          </button>
          <button onClick={onSubmit} className="h-[72px] flex-[2] rounded-[14px] text-[22px] font-bold" style={brandBtn}>
            {t('review.submit')}  →
          </button>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────── 07 · Uploading & processing ─────────────────────── */

function Uploading({
  blob,
  uploadUrl,
  scanId,
  onDone,
  onError,
}: {
  blob: Blob | null;
  uploadUrl: string;
  scanId: string;
  onDone: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (blob && uploadUrl) {
          // Real presigned PUT straight to Movaia's S3, with genuine progress.
          await kioskService.uploadVideo(uploadUrl, blob, (p) => mounted && setPct(p));
        } else if (mounted) {
          setPct(100); // no real clip captured (simulated) — skip the PUT
        }
        await kioskService.submit(scanId);
        if (mounted) {
          setPct(100);
          setTimeout(() => mounted && onDone(), 400);
        }
      } catch {
        if (mounted) onError();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [blob, uploadUrl, scanId, onDone, onError]);

  const chip = 'inline-flex items-center gap-[7px] rounded-full px-3.5 py-2 text-[13px] font-semibold';

  return (
    <Screen>
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center sm:gap-[34px] sm:px-10">
        <div className="relative flex h-[150px] w-[150px] items-center justify-center">
          <span className="absolute inset-0 rounded-full" style={{ border: '8px solid #eef2f2' }} />
          <span className="absolute inset-0 animate-mv-spin rounded-full" style={{ border: '8px solid var(--brand-primary)', borderRightColor: 'transparent', borderTopColor: 'transparent' }} />
          <span className="tnum text-[34px] font-extrabold" style={{ color: '#141414' }}>{pct}%</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[30px] font-extrabold sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>{t('uploading.title')}</h1>
          <p className="m-0 text-[17px] sm:text-[19px]" style={{ color: '#686868' }}>{t('uploading.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className={chip} style={{ background: '#eef6dd', color: '#5a7d16' }}>✓ {t('uploading.clipCaptured')}</span>
          <span className={chip} style={{ background: '#fdf0d9', color: '#a9720d' }}>
            <span className="h-[7px] w-[7px] animate-mv-pulse rounded-full" style={{ background: '#e0930f' }} />{t('uploading.uploading')}
          </span>
          <span className={chip} style={{ background: '#f4f4f4', color: '#9a9a9a' }}>{t('uploading.analysis')}</span>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 08 · Confirmation ─────────────────────────── */

function Confirmation({ email, onDone }: { email: string; onDone: () => void }) {
  const { t } = useTranslation('kiosk');
  const [secs, setSecs] = useState(8);
  useEffect(() => {
    if (secs <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onDone]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-7 px-6 text-center sm:gap-[30px] sm:px-10" style={{ background: 'var(--brand-primary)' }}>
      <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-white text-[46px] sm:h-[130px] sm:w-[130px] sm:text-[60px]" style={{ color: 'var(--brand-primary)' }}>✓</div>
      <div className="flex flex-col gap-3.5">
        <h1 className="m-0 text-[34px] font-extrabold text-white sm:text-[46px] lg:text-[52px]" style={{ letterSpacing: '-1px' }}>{t('confirmation.title')}</h1>
        <p className="m-0 max-w-[600px] text-[17px] leading-[1.5] sm:text-[21px]" style={{ color: 'rgba(255,255,255,.9)' }}>
          <Trans t={t} i18nKey="confirmation.desc" values={{ email: email || t('confirmation.inbox') }} components={{ bold: <b className="text-white" /> }} />
        </p>
      </div>
      <button onClick={onDone} className="h-[66px] rounded-[14px] bg-white px-[46px] text-[20px] font-bold" style={{ color: 'var(--brand-accent)' }}>
        {t('confirmation.done')}
      </button>
      <span className="text-[15px]" style={{ color: 'rgba(255,255,255,.75)' }}>
        {t('confirmation.resetIn', { count: secs })}
      </span>
    </div>
  );
}

/* ─────────────────────── 09 · Camera permission denied ─────────────────────── */

function CameraDenied({ theme, onRetry, onHome }: { theme: PartnerTheme; onRetry: () => void; onHome: () => void }) {
  const { t } = useTranslation('kiosk');
  return (
    <Screen>
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center sm:gap-7 sm:px-10">
        <div className="flex h-[96px] w-[96px] items-center justify-center rounded-[28px] text-[44px] sm:h-[120px] sm:w-[120px] sm:text-[56px]" style={{ background: '#fce7e6', color: '#d64a43' }}>⚠</div>
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[30px] font-extrabold sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>{t('cameraDenied.title')}</h1>
          <p className="m-0 max-w-[600px] text-[17px] leading-[1.55] sm:text-[19px]" style={{ color: '#686868' }}>
            <Trans t={t} i18nKey="cameraDenied.desc" values={{ partner: theme.displayName }} components={{ bold: <b style={{ color: '#141414' }} /> }} />
          </p>
        </div>
        <div className="flex w-full max-w-[420px] flex-col gap-3.5 sm:w-auto sm:max-w-none sm:flex-row">
          <button onClick={onHome} className="h-[66px] w-full rounded-[14px] border-2 px-[34px] text-[18px] font-semibold sm:w-auto" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            {t('cameraDenied.getHelp')}
          </button>
          <button onClick={onRetry} className="h-[66px] w-full rounded-[14px] px-10 text-[19px] font-bold sm:w-auto" style={brandBtn}>
            {t('cameraDenied.tryAgain')}
          </button>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 10 · Upload failed ─────────────────────────── */

function UploadFailed({ theme, onRetry, onHome }: { theme: PartnerTheme; onRetry: () => void; onHome: () => void }) {
  const { t } = useTranslation('kiosk');
  return (
    <Screen>
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center sm:gap-7 sm:px-10">
        <div className="flex h-[96px] w-[96px] items-center justify-center rounded-[28px] text-[44px] sm:h-[120px] sm:w-[120px] sm:text-[56px]" style={{ background: '#fce7e6', color: '#d64a43' }}>⟳</div>
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[30px] font-extrabold sm:text-[40px]" style={{ letterSpacing: '-.8px' }}>{t('uploadFailed.title')}</h1>
          <p className="m-0 max-w-[600px] text-[17px] leading-[1.55] sm:text-[19px]" style={{ color: '#686868' }}>
            {t('uploadFailed.desc')}
          </p>
        </div>
        <div className="flex w-full max-w-[420px] flex-col gap-3.5 sm:w-auto sm:max-w-none sm:flex-row">
          <button onClick={onHome} className="h-[66px] w-full rounded-[14px] border-2 px-[34px] text-[18px] font-semibold sm:w-auto" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            {t('uploadFailed.startOver')}
          </button>
          <button onClick={onRetry} className="h-[66px] w-full rounded-[14px] px-10 text-[19px] font-bold sm:w-auto" style={brandBtn}>
            ↻ {t('uploadFailed.retry')}
          </button>
        </div>
        <span className="text-[14px]" style={{ color: '#9a9a9a' }}>{t('uploadFailed.help', { partner: theme.displayName })}</span>
      </div>
    </Screen>
  );
}
