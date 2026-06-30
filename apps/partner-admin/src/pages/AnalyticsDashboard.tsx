import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsService, AnalyticsOverview } from '@shared/services/analytics.service';
import { useAuth } from '@shared/contexts/AuthContext';
import LoadingSpinner from '@shared/components/LoadingSpinner';

export default function AnalyticsDashboard() {
  const { staff } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);

  useEffect(() => {
    analyticsService.overview().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{staff?.partnerName ?? 'Dashboard'}</h1>
          {staff?.partnerSlug && (
            <p className="mt-1 text-sm text-neutral-600">
              Slug: <span className="font-mono text-neutral-700">{staff.partnerSlug}</span>
            </p>
          )}
        </div>
        <nav className="flex gap-4 text-sm text-neutral-600">
          <Link to="/partner/branding" className="hover:text-neutral-900">Branding</Link>
          <Link to="/partner/stores" className="hover:text-neutral-900">Stores</Link>
        </nav>
      </div>

      {!data ? (
        <LoadingSpinner label="Loading analytics…" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Scans (all time)" value={data.totals.allTime} />
            <Stat label="Scans (30 days)" value={data.totals.last30Days} />
            <Stat label="Completed" value={data.funnel.completed} />
            <Stat label="Processing" value={data.funnel.processing} />
          </div>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">By store</h2>
            <ul className="space-y-2 text-sm text-neutral-700">
              {data.byStore.map((s) => (
                <li key={s.storeId ?? 'none'} className="flex justify-between">
                  <span>{s.storeId ? `Store ${s.storeId.slice(0, 8)}` : 'No store'}</span>
                  <span>{s.scans}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
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
