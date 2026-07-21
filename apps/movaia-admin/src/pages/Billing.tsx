// Movaia internal — Billing (SCAFFOLD). The pricing model isn't finalised yet;
// the working assumption is usage-based (per analysis). This page is a usage
// preview: pick a billing month and (optionally) a price per analysis to model
// what each partner would be invoiced. It reuses the range-aware partners
// overview — analyses are the in-month scan counts — so no billing-specific
// backend/state exists yet. Wire real pricing + invoices once the model is set.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Users, CreditCard } from 'lucide-react';
import AdminShell, { NavItem, shellUserFromStaff } from '@shared/ui/AdminShell';
import { useAuth } from '@shared/contexts/AuthContext';
import StatCard from '@shared/ui/StatCard';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import ErrorState from '@shared/components/ErrorState';
import { fmtNum } from '@shared/ui/format';
import { adminAnalyticsService, PartnersOverview } from '@shared/services/analytics.service';

const pad = (n: number) => String(n).padStart(2, '0');

// "YYYY-MM" → inclusive ISO window covering that calendar month.
function monthToRange(m: string): { from: string; to: string } {
  const [y, mo] = m.split('-').map(Number);
  return {
    from: new Date(y, mo - 1, 1).toISOString(),
    to: new Date(y, mo, 0, 23, 59, 59, 999).toISOString(),
  };
}
function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
// Placeholder currency — the actual currency is TBD along with the pricing model.
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function Billing() {
  const { staff, logout } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [price, setPrice] = useState(''); // per-analysis unit price; blank = unpriced
  const [data, setData] = useState<PartnersOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setData(null);
    adminAnalyticsService.partnersOverview(monthToRange(month)).then(setData).catch(() => setError(true));
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const nav: NavItem[] = [
    { icon: <LayoutGrid size={16} />, label: 'Dashboard', to: '/admin' },
    { icon: <Users size={16} />, label: 'Partners', to: '/admin/partners' },
    { icon: <CreditCard size={16} />, label: 'Billing', to: '/admin/billing', active: true },
  ];

  const unit = price.trim() === '' ? null : Number(price);
  const priced = unit !== null && !Number.isNaN(unit) && unit >= 0;

  // Highest usage first — that's what matters for a billing review.
  const rows = useMemo(
    () => (data ? [...data.partners].sort((a, b) => b.scanCount - a.scanCount) : []),
    [data]
  );
  const totalAnalyses = data?.totals.scans ?? 0;
  const totalAmount = priced ? totalAnalyses * (unit as number) : null;

  return (
    <AdminShell variant="movaia" nav={nav} user={shellUserFromStaff(staff)} onSignOut={logout}>
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[18px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3.5">
          <div>
            <h1 className="mb-1 text-[22px] font-extrabold tracking-[-.4px]">Billing</h1>
            <p className="text-[13px] text-[#686868]">Usage preview · {monthLabel(month)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#686868]">
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Billing month"
                className="h-9 rounded-[9px] border border-[#e4e4e4] px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#ABD037]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#686868]">
              Price / analysis
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="—"
                aria-label="Price per analysis"
                className="h-9 w-24 rounded-[9px] border border-[#e4e4e4] px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#ABD037]"
              />
            </label>
          </div>
        </div>

        {/* Not-finalised notice */}
        <div className="rounded-[10px] border border-[#e7ddb0] bg-[#fbf6e3] px-4 py-3 text-[13px] text-[#7a6412]">
          Pricing isn’t finalised. This is a usage preview based on analyses per partner — set a
          price per analysis above to model invoice amounts. No charges are created.
        </div>

        {error ? (
          <ErrorState message="Couldn’t load billing usage." onRetry={load} />
        ) : !data ? (
          <LoadingSpinner label="Loading usage…" />
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard label="Billable analyses" value={fmtNum(totalAnalyses)} sub={monthLabel(month)} />
              <StatCard label="Partners billed" value={fmtNum(data.totals.activePartners)} sub="with analyses this month" />
              <StatCard label="Estimated total" value={totalAmount === null ? '—' : money(totalAmount)} sub={priced ? `@ ${money(unit as number)} / analysis` : 'set a price to estimate'} />
            </div>

            {/* Per-partner usage — table on tablet/desktop */}
            <div className="hidden overflow-hidden rounded-[14px] border border-[#ececec] bg-white sm:block">
              <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-[11px] text-[11px] font-bold uppercase tracking-[.5px] text-[#9a9a9a]">
                <span>Partner</span>
                <span>Outlets</span>
                <span>Analyses</span>
                <span className="text-right">Amount</span>
              </div>
              {rows.map((p, i) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-[1.8fr_1fr_1fr_1fr] items-center px-5 py-3.5 text-[13px] ${
                    i < rows.length - 1 ? 'border-b border-[#f5f5f5]' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <b className="truncate">{p.name}</b>
                    <span className="truncate font-mono text-[11px] text-[#9a9a9a]">{p.slug}</span>
                  </div>
                  <span>{fmtNum(p.storeCount)}</span>
                  <span>{fmtNum(p.scanCount)}</span>
                  <span className="text-right font-semibold">
                    {priced ? money(p.scanCount * (unit as number)) : '—'}
                  </span>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-[#9a9a9a]">No partners yet.</div>
              )}
              {/* Totals */}
              {rows.length > 0 && (
                <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] items-center border-t border-[#ececec] bg-[#fafafa] px-5 py-3.5 text-[13px] font-bold">
                  <span>Total</span>
                  <span />
                  <span>{fmtNum(totalAnalyses)}</span>
                  <span className="text-right">{totalAmount === null ? '—' : money(totalAmount)}</span>
                </div>
              )}
            </div>

            {/* Per-partner usage — cards on phones */}
            <div className="flex flex-col gap-3 sm:hidden">
              {rows.length === 0 ? (
                <div className="rounded-[14px] border border-[#ececec] bg-white px-5 py-8 text-center text-sm text-[#9a9a9a]">
                  No partners yet.
                </div>
              ) : (
                <>
                  {rows.map((p) => (
                    <div key={p.id} className="flex flex-col gap-2.5 rounded-[14px] border border-[#ececec] bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <b className="block truncate text-sm">{p.name}</b>
                          <span className="block truncate font-mono text-[11px] text-[#9a9a9a]">{p.slug}</span>
                        </div>
                        <span className="flex-none text-sm font-bold">
                          {priced ? money(p.scanCount * (unit as number)) : '—'}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[13px] text-[#686868]">
                        <span>
                          <b className="text-[#141414]">{fmtNum(p.storeCount)}</b> outlets
                        </span>
                        <span>
                          <b className="text-[#141414]">{fmtNum(p.scanCount)}</b> analyses
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Totals card */}
                  <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#ececec] bg-[#fafafa] p-4 text-[13px] font-bold">
                    <span>Total · {fmtNum(totalAnalyses)} analyses</span>
                    <span>{totalAmount === null ? '—' : money(totalAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
