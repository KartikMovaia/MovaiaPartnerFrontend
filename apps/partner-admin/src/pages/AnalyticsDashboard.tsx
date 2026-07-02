// Shared by PARTNER_ADMIN and OUTLET_ADMIN. The backend scopes every query, so
// an outlet admin automatically sees only their store. The UI adapts: outlet
// admins get a single-outlet header and no partner-wide nav or store filter.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analyticsService,
  AnalyticsOverview,
  ScanRow,
  ScanStatus,
} from '@shared/services/analytics.service';
import { useAuth } from '@shared/contexts/AuthContext';
import LoadingSpinner from '@shared/components/LoadingSpinner';

const STATUS_STYLES: Record<ScanStatus, string> = {
  PENDING: 'bg-neutral-100 text-neutral-600',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function AnalyticsDashboard() {
  const { staff, logout } = useAuth();
  const isOutlet = staff?.role === 'OUTLET_ADMIN';

  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>('');

  useEffect(() => {
    analyticsService.overview().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
    analyticsService
      .scans({ pageSize: 50, ...(storeFilter ? { storeId: storeFilter } : {}) })
      .then((p) => setScans(p.items))
      .catch(() => setScans([]));
  }, [storeFilter]);

  const title = isOutlet
    ? staff?.storeName ?? 'Outlet'
    : staff?.partnerName ?? 'Dashboard';

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          {isOutlet ? (
            <p className="mt-1 text-sm text-neutral-600">
              {staff?.partnerName} · outlet view
            </p>
          ) : (
            staff?.partnerSlug && (
              <p className="mt-1 text-sm text-neutral-600">
                Slug: <span className="font-mono text-neutral-700">{staff.partnerSlug}</span>
              </p>
            )
          )}
        </div>
        <nav className="flex gap-4 text-sm text-neutral-600">
          {!isOutlet && (
            <>
              <Link to="/partner/branding" className="hover:text-neutral-900">Branding</Link>
              <Link to="/partner/stores" className="hover:text-neutral-900">Stores</Link>
              <Link to="/partner/outlet-admins" className="hover:text-neutral-900">Outlet admins</Link>
            </>
          )}
          <button onClick={() => logout()} className="hover:text-neutral-900">Log out</button>
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

          {/* Per-outlet breakdown only matters for partner admins (an outlet
              admin sees just their own store). */}
          {!isOutlet && (
            <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">By outlet</h2>
              <ul className="space-y-2 text-sm text-neutral-700">
                {data.byStore.map((s) => (
                  <li key={s.storeId ?? 'none'} className="flex justify-between">
                    <span>{s.storeName ?? (s.storeId ? `Store ${s.storeId.slice(0, 8)}` : 'No outlet')}</span>
                    <span>{s.scans}</span>
                  </li>
                ))}
                {data.byStore.length === 0 && <li className="text-neutral-500">No scans yet.</li>}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Recent scans</h2>
              {!isOutlet && data.byStore.length > 0 && (
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900"
                >
                  <option value="">All outlets</option>
                  {data.byStore
                    .filter((s) => s.storeId)
                    .map((s) => (
                      <option key={s.storeId} value={s.storeId!}>
                        {s.storeName ?? s.storeId!.slice(0, 8)}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <ScanTable scans={scans} showOutlet={!isOutlet} />
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

export function ScanTable({ scans, showOutlet }: { scans: ScanRow[] | null; showOutlet: boolean }) {
  if (!scans) return <LoadingSpinner label="Loading scans…" />;
  if (scans.length === 0) return <p className="text-sm text-neutral-500">No scans yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-neutral-500">
          <tr>
            <th className="py-2 pr-4">Date</th>
            {showOutlet && <th className="py-2 pr-4">Outlet</th>}
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Report sent</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id} className="border-t border-neutral-100">
              <td className="py-2 pr-4 text-neutral-600">{new Date(s.createdAt).toLocaleDateString()}</td>
              {showOutlet && <td className="py-2 pr-4 text-neutral-700">{s.store?.name ?? '—'}</td>}
              <td className="py-2 pr-4 text-neutral-900">{s.customerEmail ?? s.customerPhone ?? '—'}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[s.status]}`}>{s.status}</span>
              </td>
              <td className="py-2 pr-4 text-neutral-600">
                {s.emailSentAt ? new Date(s.emailSentAt).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
