// Inline error panel with an optional retry, for failed data loads. Keeps the
// surrounding shell/nav intact so the user isn't stranded.
export default function ErrorState({
  message = 'Something went wrong loading this data.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-[14px] px-6 py-14 text-center"
      style={{ background: '#fff', border: '1px solid #f0dcdc' }}
    >
      <span className="text-[13px]" style={{ color: '#b23a34' }}>
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-9 rounded-[9px] px-4 text-[13px] font-semibold"
          style={{ background: '#141414', color: '#fff' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
