// Time-range segmented control (Month / Quarter / Year) used on dashboards.
export default function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-[10px] text-[13px] font-semibold"
      style={{ background: '#fff', border: '1px solid #e4e4e4' }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange?.(opt)}
            className="px-[14px] py-[9px]"
            style={active ? { background: '#141414', color: '#fff' } : { color: '#686868' }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
