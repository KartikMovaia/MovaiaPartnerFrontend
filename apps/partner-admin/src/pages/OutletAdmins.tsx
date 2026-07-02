// Partner-admin only. Create + list outlet admins (each scoped to one store).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from '@shared/services/partner.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function OutletAdmins() {
  const [stores, setStores] = useState<any[] | null>(null);
  const [admins, setAdmins] = useState<any[] | null>(null);
  const [form, setForm] = useState({ storeId: '', email: '', firstName: '', lastName: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    storeService.list().then(setStores);
    storeService.listOutletAdmins().then(setAdmins);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTempPassword(null);
    try {
      const res = await storeService.provisionOutletAdmin(form);
      setTempPassword(res.tempPassword);
      setForm({ storeId: '', email: '', firstName: '', lastName: '' });
      storeService.listOutletAdmins().then(setAdmins);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not create outlet admin');
    }
  };

  if (!stores || !admins) return <LoadingSpinner label="Loading outlet admins…" />;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Outlet admins</h1>
        <nav className="flex gap-4 text-sm text-neutral-600">
          <Link to="/partner" className="hover:text-neutral-900">Dashboard</Link>
          <Link to="/partner/stores" className="hover:text-neutral-900">Stores</Link>
        </nav>
      </div>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Add an outlet admin</h2>
        {stores.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Create a store first on the <Link to="/partner/stores" className="underline">Stores</Link> page.
          </p>
        ) : (
          <form onSubmit={create} className="grid grid-cols-2 gap-3">
            <select
              value={form.storeId}
              onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              required
              className="col-span-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            >
              <option value="" disabled>Select outlet…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.location ? ` — ${s.location}` : ''}
                </option>
              ))}
            </select>
            <input
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            />
            <input
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="col-span-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            />
            <button
              className="col-span-2 rounded-lg py-2.5 font-semibold"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
            >
              Create outlet admin & send invite
            </button>
          </form>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {tempPassword && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Temp password (shown once): <code className="font-mono">{tempPassword}</code>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Existing outlet admins</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>
                {a.firstName} {a.lastName} · <span className="text-neutral-500">{a.email}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {a.store?.name ?? 'No outlet'}
                </span>
                <span className="text-xs text-neutral-500">
                  {a.lastLoginAt ? 'active' : 'never logged in'}
                </span>
              </span>
            </li>
          ))}
          {admins.length === 0 && <p className="text-sm text-neutral-500">No outlet admins yet.</p>}
        </ul>
      </section>
    </div>
  );
}
