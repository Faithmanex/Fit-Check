/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from '../icons';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  variant?: 'compact' | 'full';
  className?: string;
  label?: string; // accessible name for the nav region, e.g. "Wardrobe pagination"
}

const btnBase =
  'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Reusable pagination controls with item counts.
 * Announces the visible range politely for screen readers.
 */
const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  variant = 'full',
  className,
  label = 'Pagination',
}) => {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const go = (next: number) => {
    if (next >= 1 && next <= totalPages && next !== page) onPageChange(next);
  };

  return (
    <nav
      aria-label={label}
      className={cn('flex items-center justify-between gap-2 select-none', className)}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{totalItems === 0 ? 0 : start}–{end}</span>{' '}
        of <span className="font-semibold text-gray-700 dark:text-gray-200">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        {variant === 'full' && (
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page <= 1}
            aria-label="Go to first page"
            className={cn(btnBase, 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
          >
            <ChevronsLeftIcon className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={cn(btnBase, 'px-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span
          aria-current="page"
          className="px-2 text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap"
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={cn(btnBase, 'px-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
        {variant === 'full' && (
          <button
            type="button"
            onClick={() => go(totalPages)}
            disabled={page >= totalPages}
            aria-label="Go to last page"
            className={cn(btnBase, 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
          >
            <ChevronsRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </nav>
  );
};

export default Pagination;
