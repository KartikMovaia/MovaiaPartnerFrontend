// Partner analytics dashboard. Shared by PARTNER_ADMIN and OUTLET_ADMIN — the
// services scope every query, so an outlet admin automatically sees only their
// branch. The UI adapts: outlet admins get a teal single-branch banner + three
// KPIs; partner admins get the full overview with charts and the cross-branch
// scans table. The KPIs + "analyses over time" chart are time-period configurable
// (default: all time); the recent-scans table always shows the latest activity.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Store, Palette, ScrollText } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import StatCard from '@shared/ui/StatCard';
import StatusPill from '@shared/ui/StatusPill';
import ReportFlag from '@shared/ui/ReportFlag';
import AreaChart from '@shared/ui/AreaChart';
import BarList from '@shared/ui/BarList';
import ScanOutcomes from '@shared/ui/ScanOutcomes';
import DateRangePicker from '@shared/ui/DateRangePicker';
import ErrorState from '@shared/components/ErrorState';
import { fmtDateTime, fmtNum } from '@shared/ui/format';
import { analyticsService, AnalyticsOverview, ScanRow } from '@shared/services/analytics.service';
import { useAuth } from '@shared/contexts/AuthContext';
import { DateRange, DEFAULT_RANGE, rangeLabel, rangeWeeks, toParams } from '@shared/utils/dateRange';

function reportFlag(s: ScanRow): 'sent' | 'pending' | 'none' {
  if (s.emailSentAt) return 'sent';
  if (s.status === 'PROCESSING' || s.status === 'PENDING') return 'pending';
  return 'none';
}

export default function AnalyticsDashboard() {
  const { staff, logout } = useAuth();
  const isOutlet = staff?.role === 'OUTLET_ADMIN';

  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState(false);

  // Range-aware overview: reloads whenever the selected period changes.
  const loadOverview = useCallback(() => {
    setError(false);
    analyticsService.overview(toParams(range)).then(setData).catch(() => setError(true));
  }, [range]);
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Recent scans are always "recent" — fetched once, not filtered by the range.
  const loadScans = useCallback(() => {
    analyticsService.scans({ pageSize: 50 }).then((p) => setScans(p.items)).catch(() => setError(true));
  }, []);
  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const retry = () => {
    loadOverview();
    loadScans();
  };

  const nav: NavItem[] = isOutlet
    ? [
        { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/partner', active: true },
        { icon: <ScrollText size={16} />, label: 'Scans', to: '/partner/scans' },
      ]
    : [
        { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/partner', active: true },
        { icon: <ScrollText size={16} />, label: 'Scans', to: '/partner/scans' },
        { icon: <Store size={16} />, label: 'Branches', to: '/partner/stores' },
        { icon: <Palette size={16} />, label: 'Branding', to: '/partner/branding' },
      ];

  return (
    <AdminShell variant="partner" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {error ? (
        <ErrorState message="Couldn’t load your dashboard." onRetry={retry} />
      ) : isOutlet ? (
        <OutletView data={data} scans={scans} storeName={staff?.storeName ?? 'Your branch'} range={range} onRangeChange={setRange} />
      ) : (
        <PartnerView data={data} scans={scans} slug={staff?.partnerSlug} range={range} onRangeChange={setRange} />
      )}
    </AdminShell>
  );
}

/* ── Partner admin (all branches) ─────────────────────────────────────────── */
function PartnerView({
  data,
  scans,
  slug,
  range,
  onRangeChange,
}: {
  data: AnalyticsOverview | null;
  scans: ScanRow[] | null;
  slug?: string;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}) {
  const byStore = (data?.byStore ?? []).filter((s) => s.storeId);
  const topOutlets = [...byStore].sort((a, b) => b.scans - a.scans).slice(0, 5);
  const activeOutlets = byStore.length;
  const total = data?.totals.scans ?? 0;
  const reports = data?.totals.reportsSent ?? 0;
  const delivery = total ? ((reports / total) * 100).toFixed(1) : '0.0';
  const perWeek = Math.round(total / rangeWeeks(range, data?.windowDays ?? 1));
  const trend = data?.trend ?? [];
  const funnel = data?.funnel ?? { pending: 0, processing: 0, completed: 0, failed: 0 };
  const label = rangeLabel(range);

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-[-.4px]">Overview</h1>
          <p className="text-[13px]" style={{ color: '#686868' }}>
            {activeOutlets} active outlets · updated just now
            {slug && (
              <>
                {' · '}
                <span className="font-mono">{slug}</span>
              </>
            )}
          </p>
        </div>
        <DateRangePicker value={range} onChange={onRangeChange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total analyses" value={fmtNum(total)} sub={label} />
        <StatCard label="Reports sent" value={fmtNum(reports)} sub={`${delivery}% delivery`} />
        <StatCard label="Active outlets" value={String(activeOutlets)} sub="with scans" />
        <StatCard label="Avg / week" value={String(perWeek)} sub={label} />
      </div>

      {/* Scan outcomes */}
      <ScanOutcomes funnel={funnel} label={label} />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <b className="text-[15px]">Analyses over time</b>
            <span className="text-xs" style={{ color: '#686868' }}>
              {label}
            </span>
          </div>
          <AreaChart id="pg" data={trend.map((t) => t.scans)} labels={trend.map((t) => t.label)} xTitle="Period" />
        </Card>
        <Card>
          <b className="text-[15px]">By outlet</b>
          <BarList items={topOutlets.map((s) => ({ label: s.storeName ?? '—', value: s.scans }))} />
        </Card>
      </div>

      {/* Recent scans */}
      <ScansTable scans={scans} showOutlet title="Recent scans" viewAllTo="/partner/scans" />
    </>
  );
}

/* ── Outlet admin (single branch, scoped) ─────────────────────────────────── */
function OutletView({
  data,
  scans,
  storeName,
  range,
  onRangeChange,
}: {
  data: AnalyticsOverview | null;
  scans: ScanRow[] | null;
  storeName: string;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}) {
  const total = data?.totals.scans ?? 0;
  const reports = data?.totals.reportsSent ?? 0;
  const delivery = total ? ((reports / total) * 100).toFixed(1) : '0.0';
  const perWeek = Math.round(total / rangeWeeks(range, data?.windowDays ?? 1));
  const funnel = data?.funnel ?? { pending: 0, processing: 0, completed: 0, failed: 0 };
  const label = rangeLabel(range);

  return (
    <>
      {/* Scope banner */}
      <div
        className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px]"
        style={{ background: '#eef4f4', border: '1px solid #d5e8e8', color: '#0b6e6e' }}
      >
        <span className="font-bold">{storeName} only</span>
        <span style={{ color: '#4a8f8f' }}>· you see data for your branch. Other outlets are hidden.</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <h1 className="text-[22px] font-extrabold tracking-[-.4px]">{storeName} overview</h1>
        <DateRangePicker value={range} onChange={onRangeChange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard label="Total analyses" value={fmtNum(total)} sub={label} />
        <StatCard label="Reports sent" value={fmtNum(reports)} sub={`${delivery}%`} />
        <StatCard label="Avg / week" value={String(perWeek)} sub={label} />
      </div>

      {/* Scan outcomes (scoped) */}
      <ScanOutcomes funnel={funnel} label={label} />

      {/* Recent scans (scoped) */}
      <ScansTable scans={scans} showOutlet={false} title={`Recent scans · ${storeName}`} viewAllTo="/partner/scans" />
    </>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────────────── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] p-5" style={{ background: '#fff', border: '1px solid #ececec' }}>
      {children}
    </div>
  );
}

function ScansTable({
  scans,
  showOutlet,
  title,
  viewAllTo,
}: {
  scans: ScanRow[] | null;
  showOutlet: boolean;
  title: string;
  viewAllTo?: string;
}) {
  const cols = showOutlet ? '1.1fr 1fr 1.6fr 1fr 1fr' : '1fr 1.8fr 1fr 1fr';
  const rows = scans ?? [];
  return (
    <div className="overflow-hidden rounded-[14px]" style={{ background: '#fff', border: '1px solid #ececec' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0f0f0' }}>
        <b className="text-[15px]">{title}</b>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-semibold" style={{ color: '#7a9e1f' }}>
            View all →
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: showOutlet ? 640 : 460 }}>
          {/* Column head */}
          <div
            className="grid px-5 py-2.5 text-[11px] font-bold uppercase tracking-[.5px]"
            style={{ gridTemplateColumns: cols, color: '#9a9a9a', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
          >
            <span>Date</span>
            {showOutlet && <span>Outlet</span>}
            <span>Customer</span>
            <span>Status</span>
            <span>Report</span>
          </div>
          {/* Rows */}
          {rows.map((s, i) => (
            <div
              key={s.id}
              className="grid items-center px-5 py-3.5 text-[13px]"
              style={{ gridTemplateColumns: cols, borderBottom: i === rows.length - 1 ? 'none' : '1px solid #f5f5f5' }}
            >
              <span style={{ color: '#686868' }}>{fmtDateTime(s.createdAt)}</span>
              {showOutlet && <span>{s.store?.name ?? '—'}</span>}
              <span style={{ color: '#141414' }}>{s.customerEmail ?? '—'}</span>
              <span>
                <StatusPill status={s.status} />
              </span>
              <span>
                <ReportFlag value={reportFlag(s)} />
              </span>
            </div>
          ))}
          {scans === null && (
            <div className="px-5 py-6 text-[13px]" style={{ color: '#9a9a9a' }}>
              Loading scans…
            </div>
          )}
          {scans !== null && rows.length === 0 && (
            <div className="px-5 py-6 text-[13px]" style={{ color: '#9a9a9a' }}>
              No scans yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
