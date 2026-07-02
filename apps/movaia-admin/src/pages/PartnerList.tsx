import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { adminAnalyticsService, PartnersOverview } from '@shared/services/analytics.service';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function PartnerList() {
  const [data, setData] = useState<PartnersOverview | null>(null);

  useEffect(() => {
    adminAnalyticsService.partnersOverview().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <LoadingSpinner label="Loading partners…" />;

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

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Partners" value={data.totals.partners} />
        <Stat label="Analyses (all time)" value={data.totals.scans} />
        <Stat label="Analyses (30 days)" value={data.totals.last30Days} />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Outlets</th>
              <th className="px-4 py-3">Analyses</th>
              <th className="px-4 py-3">Last 30d</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.partners.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/partners/${p.id}`} className="text-neutral-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">{p.slug}</td>
                <td className="px-4 py-3">{p.storeCount}</td>
                <td className="px-4 py-3">{p.scanCount}</td>
                <td className="px-4 py-3">{p.last30Days}</td>
                <td className="px-4 py-3">
                  <span className={p.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}>{p.status}</span>
                </td>
              </tr>
            ))}
            {data.partners.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-3xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{label}</p>
    </div>
  );
}
