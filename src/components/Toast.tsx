'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon } from './Icon';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void }>({
  push: () => {}
});

// Replaces the inline "Something went wrong" / "Saved." text that used to sit
// under each form — actions now confirm themselves in one consistent place.
export function useToast() {
  const { push } = useContext(ToastContext);
  return {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message)
  };
}

const STYLES: Record<ToastKind, { wrap: string; icon: 'checkCircle' | 'alert' | 'bell'; iconColor: string }> = {
  success: { wrap: 'border-emerald-200 bg-white', icon: 'checkCircle', iconColor: 'text-emerald-600' },
  error: { wrap: 'border-red-200 bg-white', icon: 'alert', iconColor: 'text-red-600' },
  info: { wrap: 'border-gold-300 bg-white', icon: 'bell', iconColor: 'text-gold-600' }
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.kind === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  const style = STYLES[toast.kind];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/5 animate-slide-up ${style.wrap}`}
      role="status"
    >
      <Icon name={style.icon} className={`w-5 h-5 shrink-0 mt-px ${style.iconColor}`} />
      <p className="text-sm text-brand-800 leading-snug flex-1">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-300 hover:text-gray-500 transition-colors">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), kind, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
