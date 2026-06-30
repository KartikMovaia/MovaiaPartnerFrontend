import { useEffect, useState } from 'react';
import { storeService } from '@shared/services/partner.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function StoreManagement() {
  const [stores, setStores] = useState<any[] | null>(null);
  const [form, setForm] = useState({ name: '', location: '' });

  const load = () => storeService.list().then(setStores);
  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await storeService.create(form);
    setForm({ name: '', location: '' });
    load();
  };

  const toggle = async (s: any) => {
    await storeService.update(s.id, { isActive: !s.isActive });
    load();
  };

  if (!stores) return <LoadingSpinner label="Loading stores…" />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Stores</h1>

      <form onSubmit={add} className="mb-6 flex gap-2">
        <input
          placeholder="Store name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />
        <button className="rounded-lg px-4 font-semibold" style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}>
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {stores.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <div>
              <p className="text-neutral-900">{s.name}</p>
              {s.location && <p className="text-xs text-neutral-500">{s.location}</p>}
              <p className="mt-1 text-xs text-neutral-600">Kiosk: /kiosk/&lt;slug&gt; · store {s.id.slice(0, 8)}</p>
            </div>
            <button onClick={() => toggle(s)} className={`text-sm ${s.isActive ? 'text-green-600' : 'text-neutral-500'}`}>
              {s.isActive ? 'Active' : 'Inactive'}
            </button>
          </li>
        ))}
        {stores.length === 0 && <p className="text-sm text-neutral-500">No stores yet.</p>}
      </ul>
    </div>
  );
}
