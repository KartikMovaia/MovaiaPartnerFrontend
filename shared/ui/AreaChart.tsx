// "Analyses over time" area chart — a single-series, change-over-time chart.
//
// Design notes (dataviz best practices):
//  - One series, so no legend: the surrounding card title names it. Axis text and
//    labels use ink-gray tokens, never the series color.
//  - Both axes are titled (xTitle / yTitle) and tick-labelled, so the chart reads
//    on its own; baseline anchored at 0 (honest magnitude); a "nice" y-scale with
//    labelled ticks + recessive gridlines; a thin 2px line; the latest point
//    emphasised with a surface ring so it stays legible over the line.
//  - Interactive by default: hovering (or arrow-keying) shows a crosshair, an
//    active point, and a tooltip with the exact label + value. Value leads, label
//    follows — the reader has the period and wants the number.
//  - Accessible: role="img" summary + a visually-hidden data table + a polite
//    live region that announces the focused point during keyboard/hover
//    exploration; keyboard navigable; empty/single-point states handled.
//  - Responsive by measurement (ResizeObserver) so text stays crisp, strokes keep
//    their weight, and hover/label positions map exactly to the rendered pixels.
import { useId, useLayoutEffect, useRef, useState, KeyboardEvent, PointerEvent } from 'react';

interface AreaChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  /** Stable id for the gradient def (avoids collisions when several charts share a page). */
  id?: string;
  /** Names the single series; used in the tooltip and the accessible summary. */
  seriesLabel?: string;
  /** Y-axis title; defaults to seriesLabel. Pass null to hide. */
  yTitle?: string | null;
  /** X-axis title (e.g. "Week", "Month"). Pass null/undefined to hide. */
  xTitle?: string | null;
  formatValue?: (n: number) => string;
}

const INK = '#686868'; // passes contrast on white (unlike the old #9a9a9a)
const GRID = '#ececec';

// Smallest "nice" axis top (and tick step) that keeps 0..max within ~5 ticks.
function niceAxis(rawMax: number): { max: number; step: number } {
  const max = Math.max(1, rawMax);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const s of steps) {
    const top = Math.ceil(max / s) * s;
    if (top / s <= 5) return { max: top, step: s };
  }
  const s = Math.ceil(max / 5);
  return { max: s * 5, step: s };
}

export default function AreaChart({
  data,
  labels,
  height = 200,
  lineColor = '#8fb52e',
  fillColor = '#ABD037',
  id,
  seriesLabel = 'Analyses',
  yTitle,
  xTitle,
  formatValue = (n) => n.toLocaleString(),
}: AreaChartProps) {
  const generatedId = useId();
  const uid = (id ?? generatedId).replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Measure the container so geometry is in real pixels (crisp, exact hover).
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const yAxisTitle = yTitle === undefined ? seriesLabel : yTitle;
  const xAxisTitle = xTitle ?? null;

  // Empty state — no data means no geometry (guards the old Math.max([]) = -Infinity).
  if (n === 0) {
    return (
      <div
        ref={wrapRef}
        className="flex items-center justify-center rounded-[12px] border border-dashed"
        style={{ height, borderColor: GRID, color: INK, fontSize: 14 }}
      >
        No {seriesLabel.toLowerCase()} yet.
      </div>
    );
  }

  // Bottom margin grows to fit whatever the x-axis carries: nothing, tick labels,
  // or tick labels + a title — so they never collide or get clipped.
  const bottom = xAxisTitle ? 48 : labels ? 30 : 14;
  const margin = { top: 14, right: 16, bottom, left: yAxisTitle ? 48 : 36 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const rawMax = Math.max(...data, 0);
  const { max: yMax, step } = niceAxis(rawMax);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);

  const px = (i: number) => margin.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const py = (v: number) => margin.top + innerH * (1 - v / yMax);
  const baseline = py(0);

  // Thin out x-labels so they never collide: always keep first + last.
  const maxLabels = Math.max(2, Math.floor(innerW / 68));
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));
  const showLabel = (i: number) => i === 0 || i === n - 1 || i % labelStep === 0;

  const linePath = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${baseline.toFixed(1)} L${px(0).toFixed(1)},${baseline.toFixed(1)} Z`;

  const last = n - 1;
  const focus = active ?? null;

  const indexFromClientX = (clientX: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 1) return 0;
    const rel = clientX - rect.left - margin.left;
    return Math.min(n - 1, Math.max(0, Math.round((rel / innerW) * (n - 1))));
  };

  const onMove = (e: PointerEvent) => setActive(indexFromClientX(e.clientX));
  const onLeave = () => setActive(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const cur = active ?? last;
      const next =
        e.key === 'ArrowRight' ? Math.min(last, cur + 1)
        : e.key === 'ArrowLeft' ? Math.max(0, cur - 1)
        : e.key === 'Home' ? 0
        : last;
      setActive(next);
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const labelAt = (i: number) => (labels ? labels[i] : `Point ${i + 1}`);
  const summary =
    `${seriesLabel} over time. ${n} point${n === 1 ? '' : 's'}` +
    (labels ? ` from ${labels[0]} to ${labels[last]}` : '') +
    `. Latest ${formatValue(data[last])}, peak ${formatValue(rawMax)}.`;

  // Tooltip position (px within the container), clamped so it never overflows.
  const tipLeft = focus === null ? 0 : Math.min(Math.max(px(focus), 52), Math.max(52, width - 52));
  const tipTop = focus === null ? 0 : py(data[focus]);

  return (
    <div className="relative flex flex-col gap-1">
      <div
        ref={wrapRef}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
        onBlur={onLeave}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary,#ABD037)]/40 rounded-[8px]"
        style={{ height }}
      >
        {width > 0 && (
          <svg width={width} height={height} style={{ display: 'block', touchAction: 'none' }}>
            <defs>
              <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={fillColor} stopOpacity="0.24" />
                <stop offset="1" stopColor={fillColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gridlines + y-axis tick labels (recessive). */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={margin.left} y1={py(t)} x2={width - margin.right} y2={py(t)} stroke={GRID} strokeWidth="1" />
                <text
                  x={margin.left - 8}
                  y={py(t) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill={INK}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}

            {/* Y-axis title (rotated). */}
            {yAxisTitle && (
              <text
                transform={`translate(14 ${margin.top + innerH / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={INK}
                style={{ letterSpacing: '0.02em' }}
              >
                {yAxisTitle}
              </text>
            )}

            {/* Area + line. */}
            <path d={areaPath} fill={`url(#fill-${uid})`} />
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {/* Crosshair + active point on hover/keyboard focus. */}
            {focus !== null && (
              <>
                <line x1={px(focus)} y1={margin.top} x2={px(focus)} y2={baseline} stroke={lineColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <circle cx={px(focus)} cy={py(data[focus])} r="6" fill={lineColor} stroke="#fff" strokeWidth="2.5" />
              </>
            )}

            {/* Latest point, always emphasised (surface ring keeps it legible over the line). */}
            {focus !== last && <circle cx={px(last)} cy={py(data[last])} r="4" fill={lineColor} stroke="#fff" strokeWidth="2" />}

            {/* X-axis tick labels (thinned; edges anchored inward to avoid clipping). */}
            {labels &&
              labels.map((l, i) =>
                showLabel(i) ? (
                  <text
                    key={i}
                    x={px(i)}
                    y={baseline + 20}
                    textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                    fontSize="11"
                    fill={INK}
                  >
                    {l}
                  </text>
                ) : null
              )}

            {/* X-axis title (centred under the tick labels). */}
            {xAxisTitle && (
              <text
                x={margin.left + innerW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={INK}
                style={{ letterSpacing: '0.02em' }}
              >
                {xAxisTitle}
              </text>
            )}
          </svg>
        )}

        {/* Tooltip (HTML overlay, positioned in container pixels). */}
        {focus !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[8px] px-2.5 py-1.5 text-white shadow-lg"
            style={{ left: tipLeft, top: tipTop - 12, background: '#141414', whiteSpace: 'nowrap' }}
          >
            <div className="text-[11px] opacity-70">{labelAt(focus)}</div>
            <div className="text-[14px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatValue(data[focus])} <span className="font-medium opacity-80">{seriesLabel.toLowerCase()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Polite live region — announces the focused point during keyboard/hover exploration. */}
      <div aria-live="polite" className="sr-only">
        {focus !== null ? `${labelAt(focus)}: ${formatValue(data[focus])} ${seriesLabel.toLowerCase()}` : ''}
      </div>

      {/* Accessible data table alternative (screen readers / no-JS). */}
      <table className="sr-only">
        <caption>{seriesLabel} over time</caption>
        <thead>
          <tr>
            <th>{xAxisTitle ?? 'Period'}</th>
            <th>{seriesLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((v, i) => (
            <tr key={i}>
              <td>{labelAt(i)}</td>
              <td>{formatValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
