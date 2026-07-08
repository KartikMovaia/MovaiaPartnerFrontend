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
import { PartnerThemeProvider, usePartnerContext } from '@shared/partners/PartnerThemeProvider';
import { PartnerTheme } from '@shared/partners/types';
import LoadingSpinner from '@shared/components/LoadingSpinner';
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
  phone: string;
  heightCm: number;
  weightKg: number;
}

const MOVAIA_LOGO = '/assets/movaia-logo.png';
// Brand hero shown beside the details form on wider screens — mirrors the
// Movaia login page's right panel (full-bleed photo + tagline + feature list).
const WELCOME_IMAGE = '/assets/kiosk-welcome.jpg';

// The three selling points listed over the hero photo (icons match the login).
const HERO_FEATURES = [
  {
    title: 'AI Analysis',
    body: 'Get AI-powered insights to improve your performance and lower injury risk.',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    title: 'Personalized Insights',
    body: 'Tailored recommendations for your running style.',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    title: 'Track Progress',
    body: 'Monitor your improvement over time.',
    icon: (
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
];

export default function KioskApp() {
  const { slug } = useParams();
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
        <LoadingSpinner label="Loading…" />
      </div>
    );
  }

  // Bound, but to a different partner than the URL slug → refuse (attribution safety).
  if (binding && slug && binding.partnerSlug !== slug) {
    return (
      <DeviceSetup
        theme={theme}
        slug={slug}
        notice={`This iPad is set up for ${binding.partnerName}, not “${slug}”. Sign in with an outlet account for this partner to switch.`}
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
        setError(`That account belongs to ${b.partnerName}, not this kiosk (“${slug}”).`);
        await kioskService.deviceLogout(email.trim(), password).catch(() => {});
        return;
      }
      onBound();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Couldn’t sign in. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-[58px] rounded-[14px] border-2 px-[20px] text-[18px] outline-none';
  return (
    <Screen>
      <KioskHeader theme={theme} />
      <div className="flex flex-1 flex-col justify-center px-[90px]">
        <form onSubmit={submit} className="flex w-full max-w-[520px] flex-col gap-4">
          <span className="text-[13px]" style={eyebrow}>Device setup</span>
          <h1 className="m-0 text-[40px] font-extrabold leading-[1.05]" style={{ letterSpacing: '-.8px' }}>
            Set up this kiosk
          </h1>
          <p className="m-0 text-[17px] leading-[1.5]" style={{ color: '#686868' }}>
            Sign in with this outlet's account to link the iPad. Staff only — this is for
            authentication and shows no dashboard data.
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
            placeholder="Outlet account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className={input}
            style={{ borderColor: 'var(--brand-primary)' }}
            type="password"
            placeholder="Password"
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
            {busy ? 'Linking…' : 'Link this device'}
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
    setResetNonce((n) => n + 1); // remounts Welcome → clears any typed PII
    setStep('welcome');
    newSession();
  }, [newSession]);

  useIdleReset(step, goHome);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner label="Loading…" />
      </div>
    );
  }

  const identify = async (d: IdentifyDetails) => {
    const res = await kioskService.identify({
      kioskSessionId: sessionRef.current,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone || undefined,
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
          aria-label="Start over"
          className="fixed bottom-5 right-5 z-50 h-10 rounded-full px-4 text-[13px] font-semibold"
          style={{ background: 'rgba(20,20,20,.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          ⟲ Start over
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
function Wordmark({ theme, size = 26, logoHeight = 46 }: { theme: PartnerTheme; size?: number; logoHeight?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { logoUrl } = theme;
  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <img
        src={logoUrl}
        alt={theme.displayName}
        // An uploaded logo gets more room than the generated wordmark, but is
        // bounded so a very wide mark can't crowd the "Powered by" logo.
        style={{ height: logoHeight, maxWidth: 280, objectFit: 'contain' }}
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
  return (
    <div className="flex items-center justify-between px-10 py-6">
      <Wordmark theme={theme} />
      <div className="flex items-center gap-2" style={{ opacity: 0.65 }}>
        <span className="text-xs" style={{ color: '#686868' }}>Powered by</span>
        <img src={MOVAIA_LOGO} alt="Movaia" style={{ height: 16 }} />
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
  const weightValid = kg !== null && kg >= WEIGHT_MIN_KG && kg <= WEIGHT_MAX_KG;
  const ready =
    firstName.trim() !== '' && lastName.trim() !== '' && emailValid && heightValid && weightValid && consent;

  const start = async () => {
    if (busy) return;
    if (!firstName.trim()) return setError('Please enter your first name.');
    if (!lastName.trim()) return setError('Please enter your last name.');
    if (!email.trim()) return setError('Please enter your email so we can send your report.');
    if (!emailValid) return setError('Please enter a valid email address.');
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) return setError('Please enter a valid phone number, or leave it blank.');
    if (cm === null) return setError('Please enter your height.');
    if (!heightValid) return setError('Please enter a realistic height.');
    if (kg === null) return setError('Please enter your weight.');
    if (!weightValid) return setError('Please enter a realistic weight.');
    if (!consent) return setError('Please agree to the consent to continue.');
    setError(null);
    setBusy(true);
    try {
      await onStart({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        heightCm: cm,
        weightKg: kg,
      });
    } catch {
      setError('Something went wrong. Please try again or ask a team member.');
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
      {/* Left: intro + details form. This is the only column below `lg`; the
          photo panel to the right appears once there's room to spare. `min-w-0`
          lets this flex column shrink below its content's intrinsic width so
          the header/inputs never overflow on narrow screens. */}
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <KioskHeader theme={theme} />
        <div className="flex flex-1 flex-col justify-center gap-7 px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-[90px]">
        <div className="flex flex-col gap-2.5">
          <span className="text-[14px]" style={eyebrow}>Running gait analysis</span>
          <h1 className="m-0 text-[46px] font-extrabold leading-[1.05]" style={{ letterSpacing: '-1px' }}>
            Let’s analyze<br />your run.
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] leading-[1.5]" style={{ color: '#686868' }}>
            Enter your details and we’ll email your personal analysis report — usually within a few minutes.
          </p>
        </div>
        <div className="flex max-w-[620px] flex-col gap-3.5">
          {/* Name — first + last, side by side */}
          <div className="flex gap-3.5">
            <input className={`${input} min-w-0 flex-1`} aria-label="First name" autoComplete="off" style={{ borderColor: '#e4e4e4' }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className={`${input} min-w-0 flex-1`} aria-label="Last name" autoComplete="off" style={{ borderColor: '#e4e4e4' }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <input className={input} type="email" inputMode="email" autoComplete="off" aria-label="Email address" style={{ borderColor: 'var(--brand-primary)' }} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="tel" inputMode="tel" autoComplete="off" aria-label="Phone number (optional)" style={{ borderColor: '#e4e4e4' }} placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {/* Height + weight — value(s) with a unit toggle each */}
          <div className="flex gap-3.5">
            <div className="flex min-w-0 flex-1 gap-2">
              {heightUnit === 'cm' ? (
                <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="decimal" aria-label="Height in centimetres" placeholder="Height" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              ) : (
                <>
                  <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="numeric" aria-label="Height in feet" placeholder="ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                  <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="numeric" aria-label="Height, inches" placeholder="in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
                </>
              )}
              <SegToggle ariaLabel="Height unit" value={heightUnit} options={HEIGHT_UNITS} onChange={setHeightUnit} />
            </div>
            <div className="flex min-w-0 flex-1 gap-2">
              <input className={numInput} style={{ borderColor: '#e4e4e4' }} type="number" inputMode="decimal" aria-label="Weight" placeholder="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <SegToggle ariaLabel="Weight unit" value={weightUnit} options={WEIGHT_UNITS} onChange={setWeightUnit} />
            </div>
          </div>
          <span className="pl-1 text-[14px]" style={{ color: '#9a9a9a' }}>We’ll email your report here. Height &amp; weight help tailor your analysis; phone is optional.</span>
          <label className="flex cursor-pointer items-start gap-3 pl-1 pt-1">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-6 w-6 flex-none" style={{ accentColor: 'var(--brand-primary)' }} />
            <span className="text-[15px] leading-[1.45]" style={{ color: '#686868' }}>
              I agree to be recorded and to Movaia creating an account to deliver my analysis, per the{' '}
              <b style={{ color: '#141414' }}>terms &amp; privacy policy</b>.
            </span>
          </label>
          {error && (
            <span className="pl-1 text-[15px]" style={{ color: '#c5352b' }}>
              {error}
            </span>
          )}
        </div>
        <button
          onClick={start}
          disabled={!ready || busy}
          className="flex h-[72px] max-w-[620px] items-center justify-center gap-3 rounded-[14px] text-[22px] font-bold disabled:opacity-40"
          style={brandBtn}
        >
          {busy ? 'Setting up…' : 'Start  →'}
        </button>
        </div>
        <div className="px-6 pb-[30px] pt-[22px] sm:px-10 lg:px-12 xl:px-16 2xl:px-[90px]">
          <span className="text-[13px]" style={{ color: '#9a9a9a' }}>
            By continuing you agree to Movaia’s terms &amp; privacy policy. Your data is never shared with other customers.
          </span>
        </div>
      </div>

      {/* Right: brand hero — mirrors the Movaia login's right panel. Full-bleed
          photo with a dark bottom gradient, then the tagline + feature list
          anchored to the bottom. Desktop/tablet only; below `lg` it's hidden
          and the form takes the full width, so nothing is lost on phones. */}
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
          <h3 className="mb-4 text-5xl font-extrabold leading-tight">
            <span style={{ color: 'var(--brand-primary)' }}>Master your mechanics.</span>
            <br />
            <span className="text-white">Run better.</span>
          </h3>
          <p className="mb-8 max-w-sm text-base text-white/80">
            Get AI-powered insights to improve your performance and prevent injuries.
          </p>

          <div className="space-y-5">
            {HERO_FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
                >
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{f.title}</h4>
                  <p className="mt-0.5 text-xs text-white/80">{f.body}</p>
                </div>  
              </div>
            ))}
          </div>
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
  return (
    <Screen>
      <KioskHeader theme={theme} />
      <div className="flex flex-1 flex-col items-center justify-center gap-[30px] px-[90px] text-center">
        <div
          className="flex h-[120px] w-[120px] items-center justify-center rounded-full text-[46px] font-extrabold"
          style={{ background: 'color-mix(in srgb, var(--brand-primary) 16%, #fff)', color: 'var(--brand-primary)' }}
        >
          {customer.initials ?? customer.firstName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[14px]" style={eyebrow}>Welcome back</span>
          <h1 className="m-0 text-[48px] font-extrabold leading-[1.05]" style={{ letterSpacing: '-1px' }}>
            Hi again, {customer.firstName}!
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] leading-[1.5]" style={{ color: '#686868' }}>
            We found your account — <b style={{ color: '#141414' }}>{customer.email}</b>. Ready for another run analysis?
          </p>
        </div>
        <div className="flex w-full max-w-[620px] gap-3.5">
          <button onClick={onNotMe} className="h-[72px] flex-1 rounded-[14px] border-2 text-[19px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            Not me
          </button>
          <button onClick={onContinue} className="h-[72px] flex-[2] rounded-[14px] text-[22px] font-bold" style={brandBtn}>
            Continue  →
          </button>
        </div>
        {customer.lastAnalysis && <span className="text-[14px]" style={{ color: '#9a9a9a' }}>Your last analysis: {customer.lastAnalysis}</span>}
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 03 · Get ready ─────────────────────────── */

function GetReady({ onReady }: { onReady: () => void }) {
  const card = 'flex flex-1 flex-col gap-4 rounded-[18px] border-2 p-[26px]';
  const numChip = 'flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-[22px] font-extrabold';
  const chipStyle = { background: 'color-mix(in srgb, var(--brand-primary) 14%, #fff)', color: 'var(--brand-primary)' };
  const illo = 'mt-2 flex min-h-[150px] flex-1 items-center justify-center rounded-[12px] font-mono text-xs';
  const illoStyle = {
    color: '#9a9a9a',
    background: 'repeating-linear-gradient(135deg,#f4f4f4,#f4f4f4 11px,#eee 11px,#eee 22px)',
  };

  return (
    <Screen>
      <div className="flex min-h-screen flex-col px-[60px] py-10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[15px] font-semibold" style={{ color: '#686868' }}>Step 1 of 3 · Get ready</span>
          <div className="flex gap-1.5">
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: 'var(--brand-primary)' }} />
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: '#e4e4e4' }} />
            <span className="h-1.5 w-[34px] rounded-sm" style={{ background: '#e4e4e4' }} />
          </div>
        </div>
        <h1 className="mb-1 mt-3.5 text-[40px] font-extrabold" style={{ letterSpacing: '-.8px' }}>Set up your treadmill run</h1>
        <p className="mb-[26px] text-[19px]" style={{ color: '#686868' }}>Two quick things, then we’ll record a short side-view clip.</p>
        <div className="grid flex-1 grid-cols-1 gap-[22px] md:grid-cols-2">
          {[
            { n: 1, title: 'Position on the treadmill', body: 'Warm up and settle into an easy, natural running pace before we start.', label: '[ illustration: runner on treadmill ]' },
            { n: 2, title: 'Frame yourself side-on', body: 'Stand the iPad to your side so your whole body is in view from head to toe.', label: '[ illustration: side-view framing ]' },
          ].map((c) => (
            <div key={c.n} className={card} style={{ borderColor: '#eee' }}>
              <span className={numChip} style={chipStyle}>{c.n}</span>
              <b className="text-[22px]">{c.title}</b>
              <p className="m-0 text-[16px] leading-[1.55]" style={{ color: '#686868' }}>{c.body}</p>
              <div className={illo} style={illoStyle}>{c.label}</div>
            </div>
          ))}
        </div>
        {/* What happens during recording — prep time + the beep signals */}
        <div
          className="mt-5 rounded-[16px] px-7 py-[22px]"
          style={{ background: 'color-mix(in srgb, var(--brand-primary) 7%, #fff)' }}
        >
          <b className="text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: '#141414' }}>
            What happens next
          </b>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: '⏱️', title: '20 seconds to get set', body: 'Build up to your natural running pace before we start.' },
              { icon: '🔊', title: 'One beep = recording starts', body: 'Just keep running — the clip is about 10 seconds.' },
              { icon: '🔊🔊', title: 'Two beeps = recording ends', body: 'You’re done — slow down and step off.' },
            ].map((s) => (
              <div key={s.title} className="flex flex-col gap-2">
                <span className="text-[28px] leading-none">{s.icon}</span>
                <b className="text-[16px]" style={{ color: '#141414' }}>{s.title}</b>
                <span className="text-[15px] leading-[1.45]" style={{ color: '#686868' }}>{s.body}</span>
              </div>
            ))}
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
          I’m ready — set up camera  →
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

  const feedLabel = `SIDE-VIEW ${live ? '· LIVE' : '· SIMULATED'}`;
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
          Cancel
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
          <span className="text-[16px]" style={{ ...eyebrow, color: 'rgba(255,255,255,.75)' }}>Get set — recording starts in</span>
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
          <span className="text-[18px]" style={{ color: 'rgba(255,255,255,.7)' }}>You’ll hear a beep when recording starts</span>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-[22px] text-center">
          <span className="text-[26px] font-bold text-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>Keep running — you’re doing great</span>
          <div className="h-3.5 w-[520px] max-w-[80vw] overflow-hidden rounded-lg" style={{ background: 'rgba(255,255,255,.18)' }}>
            <span className="block h-full rounded-lg" style={{ width: `${(recElapsed / RECORD_SECONDS) * 100}%`, background: 'var(--brand-primary)' }} />
          </div>
          <span className="text-[16px]" style={{ color: 'rgba(255,255,255,.7)' }}>{Math.max(0, count)} seconds left</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── 06 · Review ─────────────────────────── */

function Review({ blob, onRecordAgain, onSubmit }: { blob: Blob | null; onRecordAgain: () => void; onSubmit: () => void }) {
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
      <div className="flex min-h-screen flex-col px-[60px] py-10">
        <h1 className="mb-1 text-[40px] font-extrabold" style={{ letterSpacing: '-.8px' }}>Happy with your clip?</h1>
        <p className="mb-[22px] text-[19px]" style={{ color: '#686868' }}>Give it a quick watch. You can re-record if you’d like.</p>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[18px]" style={{ background: 'linear-gradient(135deg,#1b2430,#0e141c)' }}>
          {url ? (
            <video src={url} controls autoPlay muted playsInline className="h-full w-full object-contain" />
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 14px,transparent 14px,transparent 28px)' }} />
              <span className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-[16px]" style={{ color: 'rgba(255,255,255,.7)' }}>No preview available on this device</span>
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,.45)' }}>Your clip will still be submitted for analysis.</span>
              </span>
            </>
          )}
        </div>
        <div className="mt-6 flex gap-3.5">
          <button onClick={onRecordAgain} className="h-[72px] flex-1 rounded-[14px] border-2 text-[19px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            ↻ Record again
          </button>
          <button onClick={onSubmit} className="h-[72px] flex-[2] rounded-[14px] text-[22px] font-bold" style={brandBtn}>
            Submit for analysis  →
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-[34px] px-[90px] text-center">
        <div className="relative flex h-[150px] w-[150px] items-center justify-center">
          <span className="absolute inset-0 rounded-full" style={{ border: '8px solid #eef2f2' }} />
          <span className="absolute inset-0 animate-mv-spin rounded-full" style={{ border: '8px solid var(--brand-primary)', borderRightColor: 'transparent', borderTopColor: 'transparent' }} />
          <span className="tnum text-[34px] font-extrabold" style={{ color: '#141414' }}>{pct}%</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[40px] font-extrabold" style={{ letterSpacing: '-.8px' }}>Uploading your run…</h1>
          <p className="m-0 text-[19px]" style={{ color: '#686868' }}>Hang tight — this only takes a moment. Please don’t close this screen.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={chip} style={{ background: '#eef6dd', color: '#5a7d16' }}>✓ Clip captured</span>
          <span className={chip} style={{ background: '#fdf0d9', color: '#a9720d' }}>
            <span className="h-[7px] w-[7px] animate-mv-pulse rounded-full" style={{ background: '#e0930f' }} />Uploading
          </span>
          <span className={chip} style={{ background: '#f4f4f4', color: '#9a9a9a' }}>Analysis</span>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 08 · Confirmation ─────────────────────────── */

function Confirmation({ email, onDone }: { email: string; onDone: () => void }) {
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
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[30px] px-[90px] text-center" style={{ background: 'var(--brand-primary)' }}>
      <div className="flex h-[130px] w-[130px] items-center justify-center rounded-full bg-white text-[60px]" style={{ color: 'var(--brand-primary)' }}>✓</div>
      <div className="flex flex-col gap-3.5">
        <h1 className="m-0 text-[52px] font-extrabold text-white" style={{ letterSpacing: '-1px' }}>You’re all set!</h1>
        <p className="m-0 max-w-[600px] text-[21px] leading-[1.5]" style={{ color: 'rgba(255,255,255,.9)' }}>
          We’ll email your analysis to<br /><b className="text-white">{email || 'your inbox'}</b> as soon as it’s ready.
        </p>
      </div>
      <button onClick={onDone} className="h-[66px] rounded-[14px] bg-white px-[46px] text-[20px] font-bold" style={{ color: 'var(--brand-accent)' }}>
        Done
      </button>
      <span className="text-[15px]" style={{ color: 'rgba(255,255,255,.75)' }}>
        Returning to start in {secs}s · this device won’t keep your details
      </span>
    </div>
  );
}

/* ─────────────────────── 09 · Camera permission denied ─────────────────────── */

function CameraDenied({ theme, onRetry, onHome }: { theme: PartnerTheme; onRetry: () => void; onHome: () => void }) {
  return (
    <Screen>
      <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-[100px] text-center">
        <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[28px] text-[56px]" style={{ background: '#fce7e6', color: '#d64a43' }}>⚠</div>
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[40px] font-extrabold" style={{ letterSpacing: '-.8px' }}>Camera access is needed</h1>
          <p className="m-0 max-w-[600px] text-[19px] leading-[1.55]" style={{ color: '#686868' }}>
            To record your run we need permission to use this iPad’s camera. Enable it in{' '}
            <b style={{ color: '#141414' }}>Settings → {theme.displayName} → Camera</b>, then try again.
          </p>
        </div>
        <div className="flex gap-3.5">
          <button onClick={onHome} className="h-[66px] rounded-[14px] border-2 px-[34px] text-[18px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            Get staff help
          </button>
          <button onClick={onRetry} className="h-[66px] rounded-[14px] px-10 text-[19px] font-bold" style={brandBtn}>
            Try again
          </button>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────── 10 · Upload failed ─────────────────────────── */

function UploadFailed({ theme, onRetry, onHome }: { theme: PartnerTheme; onRetry: () => void; onHome: () => void }) {
  return (
    <Screen>
      <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-[100px] text-center">
        <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[28px] text-[56px]" style={{ background: '#fce7e6', color: '#d64a43' }}>⟳</div>
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[40px] font-extrabold" style={{ letterSpacing: '-.8px' }}>Upload didn’t go through</h1>
          <p className="m-0 max-w-[600px] text-[19px] leading-[1.55]" style={{ color: '#686868' }}>
            We couldn’t reach the network — check the connection and tap retry. You won’t need to record again.
          </p>
        </div>
        <div className="flex gap-3.5">
          <button onClick={onHome} className="h-[66px] rounded-[14px] border-2 px-[34px] text-[18px] font-semibold" style={{ borderColor: '#e4e4e4', background: '#fff', color: '#141414' }}>
            Start over
          </button>
          <button onClick={onRetry} className="h-[66px] rounded-[14px] px-10 text-[19px] font-bold" style={brandBtn}>
            ↻ Retry upload
          </button>
        </div>
        <span className="text-[14px]" style={{ color: '#9a9a9a' }}>Still stuck? Ask a {theme.displayName} team member for help.</span>
      </div>
    </Screen>
  );
}
