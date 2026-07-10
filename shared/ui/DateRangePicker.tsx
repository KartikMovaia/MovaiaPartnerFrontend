// Time-period selector for the dashboards. Presets (Today / 7d / 30d / All time)
// plus a Custom mode that reveals two date inputs. Light chrome, green accent to
// match the admin surfaces. Emits a fully-resolved DateRange to the parent.
import { useState } from 'react';
import { DateRange, RangePreset, presetRange, customRange } from '@shared/utils/dateRange';

const PRESETS: Array<{ key: Exclude<RangePreset, 'custom'>; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [from, setFrom] = useState(toDateInput(value.from));
  const [to, setTo] = useState(toDateInput(value.to));

  const applyCustom = (nextFrom: string, nextTo: string) => {
    const r = customRange(nextFrom, nextTo);
    if (r) onChange(r);
  };

  const btn = (active: boolean): React.CSSProperties =>
    active
      ? { background: '#f2f7e3', color: '#5a7d16', borderColor: '#cfe08c', fontWeight: 700 }
      : { background: '#fff', color: '#686868', borderColor: '#e4e4e4', fontWeight: 600 };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => {
            setCustomOpen(false);
            onChange(presetRange(p.key));
          }}
          className="h-9 rounded-[9px] border px-3 text-[13px] transition-colors"
          style={btn(value.preset === p.key)}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCustomOpen((v) => !v)}
        className="h-9 rounded-[9px] border px-3 text-[13px] transition-colors"
        style={btn(value.preset === 'custom')}
        aria-expanded={customOpen}
      >
        Custom
      </button>

      {customOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={from}
            max={to || undefined}
            aria-label="Start date"
            onChange={(e) => {
              setFrom(e.target.value);
              applyCustom(e.target.value, to);
            }}
            className="h-9 rounded-[9px] border border-[#e4e4e4] px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#ABD037]"
          />
          <span className="text-[13px] text-[#9a9a9a]">→</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            aria-label="End date"
            onChange={(e) => {
              setTo(e.target.value);
              applyCustom(from, e.target.value);
            }}
            className="h-9 rounded-[9px] border border-[#e4e4e4] px-2.5 text-[13px] text-[#141414] outline-none focus:border-[#ABD037]"
          />
        </div>
      )}
    </div>
  );
}
