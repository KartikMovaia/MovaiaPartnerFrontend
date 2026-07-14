// Lightweight toast notifications. Wrap the app in <ToastProvider> and call
// useToast() to push success/error/info messages that auto-dismiss.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  success: { background: '#eef6dd', color: '#3f5a0f', border: '1px solid #cfd6bd' },
  error: { background: '#fce7e6', color: '#8f2b26', border: '1px solid #f0cfcd' },
  info: { background: '#141414', color: '#fff', border: '1px solid #141414' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[min(92vw,380px)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto rounded-[11px] px-4 py-3 text-[13px] font-medium shadow-[0_10px_30px_-12px_rgba(0,0,0,.4)]"
            style={TONE_STYLE[t.tone]}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
