/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { XIcon, AlertTriangleIcon } from '../icons';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/**
 * Accessible dialog: role="dialog" + aria-modal, focus trapped inside,
 * Escape to close, focus restored to the trigger on close, scroll locked.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, description, children, footer, size = 'md' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId('modal-title');
  const descId = useId('modal-desc');

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || !panelRef.current) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown, true);

    // Lock body scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog
    const raf = requestAnimationFrame(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panelRef.current;
      target?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            tabIndex={-1}
            className={cn(
              'bg-white dark:bg-gray-900 dark:text-gray-100 rounded-2xl w-full shadow-2xl outline-none max-h-[90vh] flex flex-col',
              SIZE_CLASSES[size]
            )}
          >
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 id={titleId} className="text-xl font-serif font-bold text-gray-900 dark:text-white pr-4">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 -mt-1 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">{children}</div>
            {footer && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function useId(prefix: string): string {
  const ref = useRef(`${prefix}-${Math.random().toString(36).slice(2, 9)}`);
  return ref.current;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'dangerous' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Guarded confirmation for destructive or hard-to-reverse actions. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'dangerous',
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors',
              tone === 'dangerous'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-gray-900 hover:bg-gray-700'
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'dangerous' && <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />}
        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
      </div>
    </Modal>
  );
};

export default Modal;
