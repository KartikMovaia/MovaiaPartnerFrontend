// Movaia internal — Platform overview (all partners).
// Dark sidebar signals the internal domain; content is the canvas surface.
// Design reference: "Movaia Gyms & Clubs.dc.html" lines 718–776.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import StatCard from '@shared/ui/StatCard';
import StatusPill from '@shared/ui/StatusPill';
import AreaChart from '@shared/ui/AreaChart';
import BarList from '@shared/ui/BarList';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorState from '@shared/components/ErrorState';
import { fmtNum } from '@shared/ui/format';
import { adminAnalyticsService, PartnersOverview } from '@shared/services/analytics.service';

export default function MovaiaDashboard() {
  const navigate = useNavigate();
  const { staff, logout } = useAuth();
  const [data, setData] = useState<PartnersOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    adminAnalyticsService.partnersOverview().then(setData).catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const nav: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/admin', active: true },
    { icon: <Users size={16} />, label: 'Partners', to: '/admin/partners' },
  ];

  const topPartners = data
    ? [...data.partners]
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, 4)
        .map((p) => ({ label: p.name, value: p.scanCount }))
    : [];
  // Real platform totals derived from the partner rows.
  const totalOutlets = data ? data.partners.reduce((n, p) => n + p.storeCount, 0) : 0;
  const activeThisMonth = data ? data.partners.filter((p) => p.last30Days > 0).length : 0;

  return (
    <AdminShell variant="movaia" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {error ? (
        <ErrorState message="Couldn’t load the platform overview." onRetry={load} />
      ) : !data ? (
        <LoadingSpinner label="Loading platform overview…" />
      ) : (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3.5">
            <div>
              <h1 className="mb-1 text-2xl font-extrabold tracking-[-.4px]">Platform overview</h1>
              <p className="text-[13px] text-[#686868]">
                {fmtNum(data.totals.partners)} partners · {fmtNum(totalOutlets)} outlets
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="dark" label="Partners" value={fmtNum(data.totals.partners)} sub={`${activeThisMonth} active this month`} />
            <StatCard label="Total analyses" value={fmtNum(data.totals.scans)} sub="all-time" />
            <StatCard label="This month" value={fmtNum(data.totals.last30Days)} sub="last 30 days" />
            <StatCard label="Active outlets" value={fmtNum(totalOutlets)} sub={`across ${fmtNum(data.totals.partners)} partners`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ececec] bg-white p-5">
              <div className="flex items-center justify-between">
                <b className="text-[15px]">Analyses over time</b>
                <span className="text-xs text-[#686868]">last 12 months</span>
              </div>
              <AreaChart id="mg" data={data.trend.map((t) => t.scans)} labels={data.trend.map((t) => t.label)} xTitle="Month" />
            </div>
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ececec] bg-white p-5">
              <b className="text-[15px]">Top partners</b>
              <BarList items={topPartners} />
            </div>
          </div>

          {/* Partners table */}
          <div className="overflow-hidden rounded-[14px] border border-[#ececec] bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
              <b className="text-[15px]">Partners</b>
              <button
                type="button"
                onClick={() => navigate('/admin/partners')}
                className="text-xs font-semibold text-[#7a9e1f]"
              >
                Manage →
              </button>
            </div>
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[.5px] text-[#9a9a9a]">
              <span>Partner</span>
              <span>Outlets</span>
              <span>Analyses</span>
              <span>Status</span>
            </div>
            {data.partners.map((p, i) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/partners/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/admin/partners/${p.id}`);
                  }
                }}
                className={`grid cursor-pointer grid-cols-[1.6fr_1fr_1fr_1fr] items-center px-5 py-3.5 text-[13px] outline-none transition-colors hover:bg-[#fafafa] focus-visible:bg-[#fafafa] ${
                  i < data.partners.length - 1 ? 'border-b border-[#f5f5f5]' : ''
                }`}
              >
                <b>{p.name}</b>
                <span>{fmtNum(p.storeCount)}</span>
                <span>{fmtNum(p.scanCount)}</span>
                <span>
                  <StatusPill status={p.status} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
