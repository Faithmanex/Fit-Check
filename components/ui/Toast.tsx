/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn, uid } from '../../lib/utils';
import { CheckCircleIcon, AlertTriangleIcon, InfoIcon, XIcon } from '../icons';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  push: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};

const TOAST_STYLES: Record<ToastType, { icon: React.ReactNode; ring: string }> = {
  success: {
    icon: <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />,
    ring: 'ring-green-200 dark:ring-green-900',
  },
  error: {
    icon: <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />,
    ring: 'ring-red-200 dark:ring-red-900',
  },
  info: {
    icon: <InfoIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />,
    ring: 'ring-indigo-200 dark:ring-indigo-900',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = uid('toast');
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
      info: (message: string) => push(message, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live region so screen readers announce toasts */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'pointer-events-auto w-full flex items-start gap-3 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 px-4 py-3',
                TOAST_STYLES[toast.type].ring
              )}
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              {TOAST_STYLES[toast.type].icon}
              <p className="flex-1 text-sm text-gray-800 dark:text-gray-100">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 p-1.5 min-w-[36px] min-h-[36px] rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors md:min-w-[32px] md:min-h-[32px]"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
