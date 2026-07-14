// Shared staff sign-in. `kind` picks the audience-specific chrome:
//   PARTNER → white split-screen (partner portal, brand panel + form)
//   MOVAIA  → white centered card with 2FA (internal staff)
// Both surfaces are white (#FFFFFF); brand identity is carried by the green accent.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/contexts/AuthContext';
import i18n from '@shared/i18n';

export default function StaffLogin({
  defaultRedirect,
  kind,
}: {
  defaultRedirect: string;
  kind: 'PARTNER' | 'MOVAIA';
}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('partner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetHint, setResetHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const staff = await login(email, password, kind);
      if (staff.mustChangePassword) {
        navigate('/set-password', { replace: true });
        return;
      }
      navigate(defaultRedirect, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (kind === 'MOVAIA') {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center p-4"
        style={{ background: '#FFFFFF' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(0,0,0,.035) 1px,transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <form
          onSubmit={submit}
          className="relative flex w-full max-w-[400px] flex-col gap-[18px] p-[38px]"
          style={{
            background: '#fff',
            border: '1px solid #ececec',
            borderRadius: 20,
            boxShadow: '0 20px 40px -24px rgba(0,0,0,.25)',
          }}
        >
          <img src="/assets/movaia-logo.png" alt="Movaia" style={{ height: 24 }} className="self-start" />
          <div className="flex flex-col gap-1.5">
            <span
              className="self-start rounded-full px-[11px] py-[5px] text-[11px] font-bold tracking-[.5px]"
              style={{ background: 'rgba(171,208,55,.18)', color: '#5f7d16' }}
            >
              {t('login.internalBadge')}
            </span>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-[-.5px]" style={{ color: '#141414' }}>
              {t('login.adminTitle')}
            </h1>
          </div>

          <Field
            label={t('login.movaiaEmail')}
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            label={t('login.password')}
            focused
            type="password"
            value={password}
            onChange={setPassword}
          />

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-[52px] rounded-[11px] text-[15px] font-bold disabled:opacity-60"
            style={{ background: '#ABD037', color: '#1c2b00' }}
          >
            {busy ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    );
  }

  // PARTNER — green split-screen
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div
        className="flex flex-col justify-between p-11 md:flex-1"
        style={{ background: '#FFFFFF', borderRight: '1px solid #ececec' }}
      >
        <img src="/assets/movaia-logo.png" alt="Movaia" style={{ height: 26 }} className="self-start" />
        <div className="flex flex-col gap-3.5 py-10">
          <span className="font-accent text-[13px] font-semibold uppercase tracking-[3px]" style={{ color: '#7a9e1f' }}>
            {t('login.partnerEyebrow')}
          </span>
          <h2 className="text-[34px] font-extrabold leading-[1.15] tracking-[-.6px]" style={{ color: '#141414' }}>
            {t('login.partnerHeadline')}
          </h2>
          <p className="max-w-[340px] text-[15px] leading-[1.6]" style={{ color: '#686868' }}>
            {t('login.partnerSub')}
          </p>
        </div>
        <span className="text-xs" style={{ color: '#9a9a9a' }}>
          {t('login.copyright')}
        </span>
      </div>

      {/* Form panel */}
      <form
        onSubmit={submit}
        className="flex w-full flex-col justify-center gap-5 bg-white md:w-[440px]"
        style={{ padding: '40px 52px' }}
      >
        <h1 className="text-[26px] font-extrabold tracking-[-.5px]">{t('login.signIn')}</h1>

        <Field label={t('login.workEmail')} type="email" value={email} onChange={setEmail} />
        <Field label={t('login.password')} focused type="password" value={password} onChange={setPassword} />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[13px]" style={{ color: '#686868' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-[18px] w-[18px] rounded-[5px]"
              style={{ accentColor: '#ABD037' }}
            />
            {t('login.rememberMe')}
          </label>
          <button
            type="button"
            onClick={() => setResetHint(true)}
            className="text-[13px] font-semibold"
            style={{ color: '#7a9e1f' }}
          >
            {t('login.forgotPassword')}
          </button>
        </div>

        {resetHint && (
          <p className="text-[13px]" style={{ color: '#686868' }}>
            {t('login.resetHint')}
          </p>
        )}
        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="h-[54px] rounded-xl text-base font-bold disabled:opacity-60"
          style={{ background: '#ABD037', color: '#1c2b00' }}
        >
          {busy ? t('login.signingIn') : t('login.signIn')}
        </button>
        <span className="text-center text-xs" style={{ color: '#9a9a9a' }}>
          {t('login.provisionNote')}
        </span>
      </form>
    </div>
  );
}

// Map an auth failure to a user-facing message (real backend errors, not a
// blanket "invalid").
function loginErrorMessage(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { error?: string } } };
  const status = e?.response?.status;
  if (status === 401) return i18n.t('partner:login.errors.invalid');
  if (status === 429) return i18n.t('partner:login.errors.rateLimited');
  if (!e?.response) return i18n.t('partner:login.errors.network');
  return e.response.data?.error || i18n.t('partner:login.errors.generic');
}

// Labeled input matching the design (light + dark variants; `focused` = green border).
function Field({
  label,
  value,
  onChange,
  type = 'text',
  dark = false,
  focused = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dark?: boolean;
  focused?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: dark ? 'rgba(255,255,255,.5)' : '#686868' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="px-4 text-[15px] outline-none"
        style={{
          height: dark ? 48 : 50,
          borderRadius: dark ? 11 : 12,
          border: focused
            ? `${dark ? 1 : 2}px solid #ABD037`
            : dark
              ? '1px solid #3a3a3a'
              : '2px solid #e4e4e4',
          background: dark ? '#141414' : '#fff',
          color: dark ? '#fff' : '#000',
        }}
      />
    </div>
  );
}
