// Imperative confirm dialog. Wrap the app in <ConfirmProvider>, then:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, danger: true })) { …destructive action… }
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  // Escape cancels.
  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,15,15,.45)' }}
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={options.title}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-[16px] bg-white p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,.5)]"
          >
            <h2 className="text-[17px] font-extrabold tracking-[-.3px]">{options.title}</h2>
            <p className="text-[13.5px] leading-[1.5]" style={{ color: '#686868' }}>
              {options.message}
            </p>
            <div className="mt-1 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => close(false)}
                className="h-10 rounded-[10px] border border-[#e4e4e4] bg-white px-4 text-[13px] font-semibold"
              >
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className="h-10 rounded-[10px] px-5 text-[13px] font-bold text-white"
                style={{ background: options.danger ? '#c5352b' : '#141414' }}
              >
                {options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
