import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnerService } from '@shared/services/partner.service';

export default function PartnerCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-derive a URL-safe slug from the name until the user edits it.
  const onName = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const partner = await partnerService.create({ name, slug });
      navigate(`/admin/partners/${partner.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create partner');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">New partner</h1>
      <form onSubmit={submit} className="rounded-2xl border border-neutral-200 bg-white p-6">
        <label className="mb-1 block text-sm text-neutral-700">Partner name</label>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />
        <label className="mb-1 block text-sm text-neutral-700">Slug (kiosk URL)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
        />
        <p className="mb-4 text-xs text-neutral-500">/kiosk/{slug || 'your-slug'}</p>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg py-2.5 font-semibold disabled:opacity-50"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          {busy ? 'Creating…' : 'Create partner'}
        </button>
      </form>
    </div>
  );
}
