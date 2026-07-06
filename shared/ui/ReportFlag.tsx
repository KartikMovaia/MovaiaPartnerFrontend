// "Report sent" indicator for scan tables (partner surface).
export default function ReportFlag({ value }: { value: 'sent' | 'pending' | 'none' }) {
  if (value === 'sent') return <span className="font-semibold text-[13px]" style={{ color: '#5a7d16' }}>✓ Sent</span>;
  if (value === 'pending') return <span className="text-[13px]" style={{ color: '#9a9a9a' }}>Pending</span>;
  return <span className="text-[13px]" style={{ color: '#9a9a9a' }}>—</span>;
}
