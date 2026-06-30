// Forced password change for first login (temp password) and any future
// must-change states. Calls the authenticated set-password endpoint, then
// refreshes auth state and routes the staff member to their dashboard.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { partnerAuthService } from '@shared/services/partnerAuth.service';

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'One number' },
  { test: (p: string) => /[!@#$%^&*]/.test(p), label: 'One special character (!@#$%^&*)' },
];

export default function SetPassword() {
  const { staff, refresh } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allValid = RULES.every((r) => r.test(password)) && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setBusy(true);
    setError(null);
    try {
      await partnerAuthService.setPassword(password);
      await refresh(); // clears mustChangePassword from the live session
      navigate(staff?.kind === 'MOVAIA' ? '/admin' : '/partner', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not set password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Set a new password</h1>
        <p className="mb-6 text-sm text-neutral-600">
          You're signed in with a temporary password. Choose a new one to continue.
        </p>

        <label className="mb-1 block text-sm text-neutral-700">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />

        <label className="mb-1 block text-sm text-neutral-700">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />

        <ul className="mb-4 space-y-1 text-xs">
          {RULES.map((r) => (
            <li key={r.label} className={r.test(password) ? 'text-green-600' : 'text-neutral-500'}>
              {r.test(password) ? '✓' : '○'} {r.label}
            </li>
          ))}
          <li className={password && password === confirm ? 'text-green-600' : 'text-neutral-500'}>
            {password && password === confirm ? '✓' : '○'} Passwords match
          </li>
        </ul>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={!allValid || busy}
          className="w-full rounded-lg py-2.5 font-semibold disabled:opacity-40"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          {busy ? 'Saving…' : 'Set password & continue'}
        </button>
      </form>
    </div>
  );
}
