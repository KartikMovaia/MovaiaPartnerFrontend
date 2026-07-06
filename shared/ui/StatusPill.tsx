// Status chip used in scan tables and partner/branch rows.
// Handles scan statuses (Completed / Processing / Failed / Pending) and
// entity statuses (Active / Onboarding / Paused / Inactive).
type Tone = 'done' | 'proc' | 'fail' | 'neutral';

const TONES: Record<Tone, { bg: string; text: string; dot: string }> = {
  done: { bg: '#eef6dd', text: '#5a7d16', dot: '#7fb015' },
  proc: { bg: '#fdf0d9', text: '#a9720d', dot: '#e0930f' },
  fail: { bg: '#fce7e6', text: '#b23a34', dot: '#d64a43' },
  neutral: { bg: '#f0f0f0', text: '#686868', dot: '#b4b4b4' },
};

function toneFor(status: string): Tone {
  const s = status.toUpperCase();
  if (['COMPLETED', 'ACTIVE', 'SENT'].includes(s)) return 'done';
  if (['PROCESSING', 'PENDING', 'ONBOARDING'].includes(s)) return 'proc';
  if (['FAILED'].includes(s)) return 'fail';
  return 'neutral';
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export default function StatusPill({
  status,
  label,
  size = 'md',
}: {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const tone = TONES[toneFor(status)];
  const sm = size === 'sm';
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold"
      style={{
        gap: sm ? 5 : 6,
        padding: sm ? '4px 9px' : '5px 10px',
        fontSize: sm ? 10.5 : 11,
        background: tone.bg,
        color: tone.text,
      }}
    >
      <span style={{ width: sm ? 5 : 6, height: sm ? 5 : 6, borderRadius: '50%', background: tone.dot }} />
      {label ?? titleCase(status)}
    </span>
  );
}
