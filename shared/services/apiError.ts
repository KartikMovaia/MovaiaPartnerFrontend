// Extract a user-facing message from an axios error, falling back to a default.
// Backend errors are shaped `{ error: string }` (validation adds `details`).
export function apiError(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
}
