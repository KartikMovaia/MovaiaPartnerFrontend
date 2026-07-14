// Pill switch (branch active/paused). Controlled; `onChange` optional so it can
// render as a static indicator too.
export default function Toggle({
  on,
  onChange,
  'aria-label': ariaLabel,
}: {
  on: boolean;
  onChange?: (next: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={on}
      onClick={() => onChange?.(!on)}
      className="inline-flex items-center rounded-full p-[2px] transition-colors"
      style={{
        width: 38,
        height: 22,
        justifyContent: on ? 'flex-end' : 'flex-start',
        background: on ? '#8fb52e' : '#d8d8d8',
        cursor: onChange ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff' }} />
    </button>
  );
}
