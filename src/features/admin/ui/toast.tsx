'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

/** Minimal toast system for the admin area: success/error messages, auto-dismiss, aria-live. */

type ToastKind = 'success' | 'error';

type ToastItem = { id: number; kind: ToastKind; text: string };

type ShowToast = (text: string, kind?: ToastKind) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return show;
}

const DISMISS_AFTER_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback<ShowToast>((text, kind = 'success') => {
    const id = nextId.current++;
    setItems((current) => [...current, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, DISMISS_AFTER_MS);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed end-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={
              item.kind === 'success'
                ? 'bg-surface text-text flex items-start gap-2 rounded-md border border-green-600/30 p-3 text-sm font-bold shadow-md'
                : 'border-fire-600/30 bg-surface text-fire-700 flex items-start gap-2 rounded-md border p-3 text-sm font-bold shadow-md'
            }
          >
            {item.kind === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-600" />
            ) : (
              <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
