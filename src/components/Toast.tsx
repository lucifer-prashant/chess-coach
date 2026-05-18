'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error' | 'warn';
interface Toast { id: number; msg: string; kind: ToastKind }

const ToastContext = createContext<{ push: (msg: string, kind?: ToastKind) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: (m: string) => console.log('toast', m) };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'toast-enter pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-2xl backdrop-blur ' +
              tone(t.kind)
            }
          >
            <span className="text-lg leading-none">{icon(t.kind)}</span>
            <span className="text-sm">{t.msg}</span>
            <button
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
              className="ml-2 text-muted hover:text-text"
              aria-label="dismiss"
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function tone(k: ToastKind): string {
  switch (k) {
    case 'success': return 'border-good/40 bg-good/10 text-good';
    case 'error':   return 'border-bad/40 bg-bad/10 text-bad';
    case 'warn':    return 'border-warn/40 bg-warn/10 text-warn';
    default:        return 'border-border bg-panel/90 text-text';
  }
}
function icon(k: ToastKind): string {
  switch (k) {
    case 'success': return '✓';
    case 'error':   return '⚠';
    case 'warn':    return '!';
    default:        return 'ⓘ';
  }
}
