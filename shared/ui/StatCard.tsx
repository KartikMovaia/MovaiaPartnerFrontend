// KPI stat card. `tone="dark"` renders the panel-black card with a green figure
// (design highlights one KPI per row this way).
import { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  sub,
  subTone = 'muted',
  tone = 'light',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  subTone?: 'up' | 'muted';
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl p-[18px]"
      style={
        dark
          ? { background: '#141414' }
          : { background: '#fff', border: '1px solid #ececec' }
      }
    >
      <span
        className="text-xs font-semibold"
        style={{ color: dark ? 'rgba(255,255,255,.6)' : '#686868' }}
      >
        {label}
      </span>
      <b
        className="tnum font-extrabold tracking-[-.5px]"
        style={{ fontSize: 32, color: dark ? '#ABD037' : '#000' }}
      >
        {value}
      </b>
      {sub && (
        <span
          className="text-xs font-semibold"
          style={{
            color: dark ? 'rgba(255,255,255,.5)' : subTone === 'up' ? '#5a7d16' : '#686868',
            fontWeight: subTone === 'up' ? 600 : 500,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
