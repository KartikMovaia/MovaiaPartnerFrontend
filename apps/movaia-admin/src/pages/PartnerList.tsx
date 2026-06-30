import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { partnerService } from '@shared/services/partner.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function PartnerList() {
  const [partners, setPartners] = useState<any[] | null>(null);

  useEffect(() => {
    partnerService.list().then(setPartners).catch(() => setPartners([]));
  }, []);

  if (!partners) return <LoadingSpinner label="Loading partners…" />;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Partners</h1>
        <Link
          to="/admin/partners/new"
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
        >
          <Plus className="h-4 w-4" /> New partner
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Stores</th>
              <th className="px-4 py-3">Scans</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/partners/${p.id}`} className="text-neutral-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">{p.slug}</td>
                <td className="px-4 py-3">{p._count?.stores ?? 0}</td>
                <td className="px-4 py-3">{p._count?.scans ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={p.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}>{p.status}</span>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No partners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
