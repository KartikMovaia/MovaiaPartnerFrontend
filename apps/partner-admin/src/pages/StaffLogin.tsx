import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';

export default function StaffLogin({
  defaultRedirect,
  kind = 'PARTNER',
}: {
  defaultRedirect: string;
  kind?: 'PARTNER' | 'MOVAIA';
}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Authenticate against the audience this login page belongs to.
      const staff = await login(email, password, kind);
      // First login with a temp password → force a change before the dashboard.
      if (staff.mustChangePassword) {
        navigate('/set-password', { replace: true });
        return;
      }
      navigate(staff.kind === 'MOVAIA' ? '/admin' : '/partner', { replace: true });
    } catch {
      setError('Invalid email or password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-luxury">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Sign in</h1>
        <p className="mb-6 text-sm text-neutral-600">Movaia for Partners</p>

        <label className="mb-1 block text-sm text-neutral-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />

        <label className="mb-1 block text-sm text-neutral-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={busy}
          className="w-full rounded-lg py-2.5 font-semibold disabled:opacity-50"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-xs text-neutral-500">Redirects to {defaultRedirect} by role</p>
      </form>
    </div>
  );
}
