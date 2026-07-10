// Shared date-range model for the time-period-configurable dashboards. A range is
// a preset (or custom) plus the resolved ISO instants sent to the API. `all` maps
// to null/null (the backend treats both-omitted as all-time).
export type RangePreset = 'today' | '7d' | '30d' | 'all' | 'custom';

export interface DateRange {
  preset: RangePreset;
  from: string | null; // ISO instant, or null for all-time
  to: string | null;
}

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Resolve a non-custom preset to concrete instants (relative to now).
export function presetRange(preset: Exclude<RangePreset, 'custom'>): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { preset, from: startOfDay(now).toISOString(), to: now.toISOString() };
    case '7d':
      return { preset, from: new Date(now.getTime() - 7 * DAY).toISOString(), to: now.toISOString() };
    case '30d':
      return { preset, from: new Date(now.getTime() - 30 * DAY).toISOString(), to: now.toISOString() };
    case 'all':
      return { preset, from: null, to: null };
  }
}

// Build a custom range from two <input type="date"> values ("YYYY-MM-DD"). The end
// day is made inclusive (23:59:59.999). Returns null if either is missing.
export function customRange(fromDate: string, toDate: string): DateRange | null {
  if (!fromDate || !toDate) return null;
  return {
    preset: 'custom',
    from: startOfDay(new Date(`${fromDate}T00:00:00`)).toISOString(),
    to: endOfDay(new Date(`${toDate}T00:00:00`)).toISOString(),
  };
}

export const DEFAULT_RANGE: DateRange = presetRange('all');

export function rangeLabel(r: DateRange): string {
  switch (r.preset) {
    case 'today':
      return 'today';
    case '7d':
      return 'last 7 days';
    case '30d':
      return 'last 30 days';
    case 'all':
      return 'all time';
    case 'custom':
      return 'custom range';
  }
}

// Query params for the analytics API (omits nulls → all-time).
export function toParams(r: DateRange): { from?: string; to?: string } {
  const p: { from?: string; to?: string } = {};
  if (r.from) p.from = r.from;
  if (r.to) p.to = r.to;
  return p;
}

// Number of weeks the range spans, used for a range-correct "avg / week". Falls
// back to the backend-provided windowDays for all-time (no explicit bounds).
export function rangeWeeks(r: DateRange, windowDays: number): number {
  if (r.from && r.to) {
    const days = (new Date(r.to).getTime() - new Date(r.from).getTime()) / DAY;
    return Math.max(days / 7, 1 / 7);
  }
  return Math.max(windowDays / 7, 1 / 7);
}
