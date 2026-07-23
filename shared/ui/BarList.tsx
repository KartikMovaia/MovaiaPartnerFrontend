// Horizontal "by outlet" / "top partners" breakdown bars. Bar shade tracks
// magnitude (design uses a darker green for the leaders).
export interface BarItem {
  label: string;
  value: number;
}

function shade(pct: number): string {
  if (pct >= 0.85) return '#8fb52e';
  if (pct >= 0.6) return '#abd037';
  return '#c3dd6b';
}

export default function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const pct = it.value / top;
        return (
          <div key={i} className="flex flex-col gap-[5px]">
            <div className="flex justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-semibold" style={{ color: '#000' }}>{it.label}</span>
              <span className="flex-none" style={{ color: '#686868' }}>{it.value.toLocaleString('en-US')}</span>
            </div>
            <span className="block h-2 overflow-hidden rounded" style={{ background: '#f0f0f0' }}>
              <span className="block h-full rounded" style={{ width: `${Math.max(4, pct * 100)}%`, background: shade(pct) }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
