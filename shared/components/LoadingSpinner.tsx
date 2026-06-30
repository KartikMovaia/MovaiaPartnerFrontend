import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-neutral-600">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--brand-primary)' }} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
