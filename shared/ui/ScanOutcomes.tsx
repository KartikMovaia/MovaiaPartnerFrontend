// Completion / failure / still-processing breakdown of the submitted scans in a
// window. The denominator is completed + failed + processing (PENDING is excluded
// upstream), so the three shares always sum to 100%. Shared by the partner and
// Movaia-admin dashboards so the metric reads identically on both.
import { fmtNum } from './format';

export interface Funnel {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export default function ScanOutcomes({ funnel, label }: { funnel: Funnel; label: string }) {
  const total = funnel.completed + funnel.failed + funnel.processing;
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0');
  const stats = [
    { key: 'completed', label: 'Completion rate', value: `${pct(funnel.completed)}%`, sub: `${fmtNum(funnel.completed)} of ${fmtNum(total)} completed`, color: '#ABD037' },
    { key: 'failed', label: 'Failure rate', value: `${pct(funnel.failed)}%`, sub: `${fmtNum(funnel.failed)} failed`, color: '#df3f40' },
    { key: 'processing', label: 'Processing', value: fmtNum(funnel.processing), sub: 'still in progress', color: '#f59e0c' },
  ];
  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] p-5" style={{ background: '#fff', border: '1px solid #ececec' }}>
      <div className="flex items-center justify-between">
        <b className="text-[15px]">Scan outcomes</b>
        <span className="text-xs" style={{ color: '#686868' }}>
          {label}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key} className="flex flex-col gap-1 rounded-[10px] px-3.5 py-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#686868' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
              {s.label}
            </span>
            <b className="tnum text-[26px] font-extrabold tracking-[-.5px]" style={{ color: s.color }}>
              {s.value}
            </b>
            <span className="text-[11px]" style={{ color: '#9a9a9a' }}>
              {s.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
