// Movaia internal — Platform overview (all partners). Time-period configurable:
// the KPIs, "analyses over time" chart, and top-partners bar all reflect the
// selected range (default: all time). The partner roster lives on /admin/partners
// (this page links there) so it isn't duplicated here.
import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, Users, CreditCard } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import StatCard from '@shared/ui/StatCard';
import AreaChart from '@shared/ui/AreaChart';
import BarList from '@shared/ui/BarList';
import ScanOutcomes from '@shared/ui/ScanOutcomes';
import DateRangePicker from '@shared/ui/DateRangePicker';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorState from '@shared/components/ErrorState';
import { fmtNum } from '@shared/ui/format';
import { adminAnalyticsService, PartnersOverview, PlatformFunnel } from '@shared/services/analytics.service';
import { DateRange, DEFAULT_RANGE, rangeLabel, toParams } from '@shared/utils/dateRange';

const TOP_N = 5;

export default function MovaiaDashboard() {
  const { staff, logout } = useAuth();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [data, setData] = useState<PartnersOverview | null>(null);
  const [funnel, setFunnel] = useState<PlatformFunnel | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    adminAnalyticsService.partnersOverview(toParams(range)).then(setData).catch(() => setError(true));
    // Funnel is a live cross-tenant read — best-effort, so a failure here doesn't blank the page.
    adminAnalyticsService.funnel(toParams(range)).then(setFunnel).catch(() => setFunnel(null));
  }, [range]);
  useEffect(() => {
    load();
  }, [load]);

  const nav: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/admin', active: true },
    { icon: <Users size={16} />, label: 'Partners', to: '/admin/partners' },
    { icon: <CreditCard size={16} />, label: 'Billing', to: '/admin/billing' },
  ];

  const label = rangeLabel(range);
  const topPartners = data
    ? [...data.partners]
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, TOP_N)
        .map((p) => ({ label: p.name, value: p.scanCount }))
    : [];
  const totalOutlets = data ? data.partners.reduce((n, p) => n + p.storeCount, 0) : 0;
  const scans = data?.totals.scans ?? 0;
  const reports = data?.totals.reportsSent ?? 0;
  const delivery = scans ? ((reports / scans) * 100).toFixed(1) : '0.0';

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
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Partners" value={fmtNum(data.totals.partners)} sub={`${data.totals.activePartners} active in range`} />
            <StatCard label="Analyses" value={fmtNum(scans)} sub={label} />
            <StatCard label="Reports sent" value={fmtNum(reports)} sub={`${delivery}% delivery`} />
            <StatCard label="Active outlets" value={fmtNum(totalOutlets)} sub={`across ${fmtNum(data.totals.partners)} partners`} />
          </div>

          {/* Scan outcomes (platform-wide, live) */}
          {funnel && <ScanOutcomes funnel={funnel.funnel} label={label} />}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ececec] bg-white p-5">
              <div className="flex items-center justify-between">
                <b className="text-[15px]">Analyses over time</b>
                <span className="text-xs text-[#686868]">{label}</span>
              </div>
              <AreaChart id="mg" data={data.trend.map((t) => t.scans)} labels={data.trend.map((t) => t.label)} xTitle="Period" />
            </div>
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ececec] bg-white p-5">
              <div className="flex items-center justify-between">
                <b className="text-[15px]">Top partners</b>
                <span className="text-xs text-[#686868]">top {TOP_N} by analyses</span>
              </div>
              <BarList items={topPartners} />
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
