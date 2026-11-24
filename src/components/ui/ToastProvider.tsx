'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev.slice(-3), { id, variant, message }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: {
        success: (message: string) => push('success', message),
        error: (message: string) => push('error', message),
        info: (message: string) => push('info', message),
      },
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex flex-col gap-2 sm:w-96 pointer-events-none"
        >
          {toasts.map((item) => {
            const isError = item.variant === 'error';
            const isSuccess = item.variant === 'success';
            const borderColor = isError
              ? 'border-[#DC4444]/40'
              : isSuccess
                ? 'border-[#20A36B]/40'
                : 'border-[#2878D0]/40';
            const iconColor = isError
              ? 'text-[#DC4444]'
              : isSuccess
                ? 'text-[#20A36B]'
                : 'text-[#2878D0]';
            const textColor = isError
              ? 'text-[#B91C1C]'
              : isSuccess
                ? 'text-[#15803D]'
                : 'text-[#142B4A]';

            return (
              <div
                key={item.id}
                role={isError ? 'alert' : 'status'}
                className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border ${borderColor} bg-white px-4 py-3 shadow-lg transition-all`}
              >
                {isError ? (
                  <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
                ) : isSuccess ? (
                  <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
                ) : (
                  <Info className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
                )}
                <p className={`flex-1 text-xs sm:text-sm font-medium leading-6 ${textColor}`}>
                  {item.message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="بستن اعلان"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F2F7FC] hover:text-[#1E293B] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx.toast;
}
