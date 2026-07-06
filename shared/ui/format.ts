// Small display formatters shared across admin surfaces.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

// "2026-07-02T14:02:00" -> "2 Jul, 14:02"
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-07-02T14:02:00" -> "2 Jul"
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// 1024 -> "1,024"
export function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
