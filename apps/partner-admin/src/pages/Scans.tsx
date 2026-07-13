// Full scan log for a partner. Shared by PARTNER_ADMIN and OUTLET_ADMIN — the
// service scopes every query, so an outlet admin only ever sees their own branch
// (the branch filter is hidden for them). Filterable by branch, date, and status,
// with server-side pagination. Reached from the sidebar and the dashboard's
// "View all →" link. "Scan" = a submitted analysis; abandoned (PENDING) sessions
// are excluded by the backend, matching the rest of analytics.
import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, Store, Palette, ScrollText, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import StatusPill from '@shared/ui/StatusPill';
import ReportFlag from '@shared/ui/ReportFlag';
import DateRangePicker from '@shared/ui/DateRangePicker';
import ErrorState from '@shared/components/ErrorState';
import { useToast } from '@shared/ui/Toast';
import { fmtDateTime, fmtNum } from '@shared/ui/format';
import { analyticsService, ScanPage, ScanRow, ScanStatus } from '@shared/services/analytics.service';
import { storeService } from '@shared/services/partner.service';
import { useAuth } from '@shared/contexts/AuthContext';
import { DateRange, DEFAULT_RANGE, toParams } from '@shared/utils/dateRange';

const PAGE_SIZE = 25;
const EXPORT_PAGE = 100; // backend max pageSize — fewer round-trips when exporting
const MAX_EXPORT = 5000; // safety cap so a huge history can't hang the browser

// Statuses the backend accepts as a filter (PENDING isn't a "scan").
const STATUS_OPTIONS: Array<{ value: '' | ScanStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'FAILED', label: 'Failed' },
];

function reportFlag(s: ScanRow): 'sent' | 'pending' | 'none' {
  if (s.emailSentAt) return 'sent';
  if (s.status === 'PROCESSING' || s.status === 'PENDING') return 'pending';
  return 'none';
}

export default function Scans() {
  const { staff, logout } = useAuth();
  const toast = useToast();
  const isOutlet = staff?.role === 'OUTLET_ADMIN';

  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [storeId, setStoreId] = useState(''); // '' = all branches (partner admin only)
  const [status, setStatus] = useState<'' | ScanStatus>('');
  const [page, setPage] = useState(1);

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [data, setData] = useState<ScanPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Branch filter options — partner admins only (outlet admins are scoped to one).
  useEffect(() => {
    if (isOutlet) return;
    storeService.listBranches().then(setBranches).catch(() => setBranches([]));
  }, [isOutlet]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    analyticsService
      .scans({
        page,
        pageSize: PAGE_SIZE,
        ...(storeId ? { storeId } : {}),
        ...(status ? { status } : {}),
        ...toParams(range),
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, storeId, status, range]);
  useEffect(() => {
    load();
  }, [load]);

  // Any filter change resets to the first page.
  const onRange = (r: DateRange) => {
    setPage(1);
    setRange(r);
  };
  const onStore = (id: string) => {
    setPage(1);
    setStoreId(id);
  };
  const onStatus = (s: '' | ScanStatus) => {
    setPage(1);
    setStatus(s);
  };

  // Export every scan matching the current filters (not just the visible page).
  // Pulls pages of EXPORT_PAGE until the server's totalCount is covered, then
  // builds + downloads a CSV. Outlet admins stay server-scoped to their branch.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const filters = {
        ...(storeId ? { storeId } : {}),
        ...(status ? { status } : {}),
        ...toParams(range),
      };
      const collected: ScanRow[] = [];
      let pageNum = 1;
      let totalCount = Infinity;
      while (collected.length < totalCount && collected.length < MAX_EXPORT) {
        const p = await analyticsService.scans({ ...filters, page: pageNum, pageSize: EXPORT_PAGE });
        totalCount = p.totalCount;
        collected.push(...p.items);
        if (p.items.length < EXPORT_PAGE) break; // last page reached
        pageNum++;
      }
      downloadScansCsv(collected, !isOutlet);
      const truncated = totalCount > MAX_EXPORT;
      toast(
        truncated
          ? `Exported the first ${collected.length} of ${fmtNum(totalCount)} scans (${MAX_EXPORT} max).`
          : `Exported ${collected.length} scan${collected.length === 1 ? '' : 's'}.`,
        'success'
      );
    } catch {
      toast('Couldn’t export scans. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const nav: NavItem[] = isOutlet
    ? [
        { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/partner' },
        { icon: <ScrollText size={16} />, label: 'Scans', to: '/partner/scans', active: true },
      ]
    : [
        { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/partner' },
        { icon: <ScrollText size={16} />, label: 'Scans', to: '/partner/scans', active: true },
        { icon: <Store size={16} />, label: 'Branches', to: '/partner/stores' },
        { icon: <Palette size={16} />, label: 'Branding', to: '/partner/branding' },
      ];

  const total = data?.totalCount ?? 0;
  const rows = data?.items ?? [];
  const showOutlet = !isOutlet;
  const cols = showOutlet ? '1.1fr 1fr 1.6fr 1fr 1fr' : '1fr 1.8fr 1fr 1fr';
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <AdminShell variant="partner" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-[-.4px]">Scans</h1>
          <p className="text-[13px]" style={{ color: '#686868' }}>
            {isOutlet ? `${staff?.storeName ?? 'Your branch'} only · every submitted analysis` : 'Every submitted analysis across your branches'}
          </p>
        </div>
        <DateRangePicker value={range} onChange={onRange} />
      </div>

      {/* Outlet scope banner */}
      {isOutlet && (
        <div
          className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px]"
          style={{ background: '#eef4f4', border: '1px solid #d5e8e8', color: '#0b6e6e' }}
        >
          <span className="font-bold">{staff?.storeName ?? 'Your branch'} only</span>
          <span style={{ color: '#4a8f8f' }}>· you see scans for your branch. Other outlets are hidden.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!isOutlet && (
          <Select value={storeId} onChange={onStore} aria-label="Filter by branch">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={status} onChange={(v) => onStatus(v as '' | ScanStatus)} aria-label="Filter by status">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || loading || total === 0}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#e4e4e4', background: '#fff', color: '#686868' }}
        >
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState message="Couldn’t load scans." onRetry={load} />
      ) : (
        <div className="overflow-hidden rounded-[14px]" style={{ background: '#fff', border: '1px solid #ececec' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <b className="text-[15px]">
              {loading ? 'Loading…' : total === 0 ? 'No scans' : `${fmtNum(total)} scan${total === 1 ? '' : 's'}`}
            </b>
            {total > 0 && (
              <span className="text-xs" style={{ color: '#9a9a9a' }}>
                {firstRow}–{lastRow} of {fmtNum(total)}
              </span>
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
              {loading && rows.length === 0 && (
                <div className="px-5 py-6 text-[13px]" style={{ color: '#9a9a9a' }}>
                  Loading scans…
                </div>
              )}
              {!loading && rows.length === 0 && (
                <div className="px-5 py-6 text-[13px]" style={{ color: '#9a9a9a' }}>
                  No scans match these filters.
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f0f0f0' }}>
              <span className="text-xs" style={{ color: '#9a9a9a' }}>
                Page {page}
              </span>
              <div className="flex items-center gap-2">
                <PageButton disabled={!hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft size={15} /> Prev
                </PageButton>
                <PageButton disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight size={15} />
                </PageButton>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function Select({
  value,
  onChange,
  children,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-[9px] border px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#ABD037]"
      style={{ borderColor: '#e4e4e4', background: '#fff' }}
      {...rest}
    >
      {children}
    </select>
  );
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{ borderColor: '#e4e4e4', background: '#fff', color: '#686868' }}
    >
      {children}
    </button>
  );
}

// Serialize one CSV cell. Two concerns:
//  1. Formula-injection guard: a leading = + - @ (or tab/CR) makes Excel/Sheets
//     treat the cell as a formula — a security risk, and it also mangles legit
//     values like "+1 555…" phone numbers. Prefix with a quote so it stays text.
//  2. RFC 4180 quoting: wrap in quotes (doubling any internal quote) only when the
//     value contains a comma, quote, or newline.
function csvCell(v: string | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build a CSV from the rows and trigger a client-side download. A UTF-8 BOM keeps
// accented names/emails intact when the file is opened in Excel.
function downloadScansCsv(rows: ScanRow[], includeBranch: boolean): void {
  const header = ['Date', ...(includeBranch ? ['Branch'] : []), 'Customer email', 'Customer phone', 'Status', 'Report sent at', 'Analysis ID'];
  const lines = [header.join(',')];
  for (const s of rows) {
    lines.push(
      [
        s.createdAt,
        ...(includeBranch ? [s.store?.name ?? ''] : []),
        s.customerEmail ?? '',
        s.customerPhone ?? '',
        s.status,
        s.emailSentAt ?? '',
        s.movaiaAnalysisId ?? '',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scans-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
