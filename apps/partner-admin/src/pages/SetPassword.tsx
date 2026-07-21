// Finish sign-in after a temp password (design 346–358 card styling). Sets the
// new password via the real /set-password endpoint, refreshes the live session
// so the must-change flag clears, then routes to the partner dashboard.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/contexts/AuthContext';
import { partnerAuthService } from '@shared/services/partnerAuth.service';
import i18n from '@shared/i18n';

export default function SetPassword() {
  const { t } = useTranslation('partner');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('setPassword.errors.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPassword.errors.mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await partnerAuthService.setPassword(password);
      await refresh(); // clears mustChangePassword before the guarded dashboard
      navigate('/partner', { replace: true });
    } catch (err) {
      setError(setPasswordErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#f7f7f5' }}>
      <form
        onSubmit={submit}
        className="flex w-full max-w-[420px] flex-col gap-[22px] px-7 py-10 sm:px-9"
        style={{ background: '#fff', borderRadius: 24, boxShadow: '0 20px 40px -20px rgba(0,0,0,.3)' }}
      >
        <img src="/assets/movaia-logo.png" alt="Movaia" style={{ height: 26 }} className="self-start" />

        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-extrabold tracking-[-.5px]">{t('setPassword.title')}</h1>
          <p className="text-sm leading-[1.5]" style={{ color: '#686868' }}>
            {t('setPassword.desc')}
          </p>
        </div>

        <PasswordField label={t('setPassword.newPassword')} value={password} onChange={setPassword} />
        <PasswordField label={t('setPassword.confirmPassword')} value={confirm} onChange={setConfirm} />

        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="h-[54px] rounded-xl text-base font-bold disabled:opacity-60"
          style={{ background: '#ABD037', color: '#1c2b00' }}
        >
          {busy ? t('setPassword.saving') : t('setPassword.saveContinue')}
        </button>
      </form>
    </div>
  );
}

// Surface the backend's password-policy errors. Two shapes are possible: the
// controller's complexity check returns `details: string[]` ("Weak password"),
// while the route's Zod length check returns `details: { fieldErrors }`.
function setPasswordErrorMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: string; details?: string[] | { fieldErrors?: Record<string, string[]> } } };
  };
  const details = e?.response?.data?.details;
  if (Array.isArray(details) && details.length) return details.join(' ');
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  if (fieldErrors) {
    const msgs = Object.values(fieldErrors).flat().filter(Boolean);
    if (msgs.length) return msgs.join(' ');
  }
  if (!e?.response) return i18n.t('partner:setPassword.errors.network');
  return e.response.data?.error || i18n.t('partner:setPassword.errors.generic');
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: '#686868' }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="h-[50px] rounded-xl px-4 text-[15px] outline-none"
        style={{ border: '2px solid #e4e4e4' }}
      />
    </div>
  );
}
