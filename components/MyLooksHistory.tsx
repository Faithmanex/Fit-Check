/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/db';
import { LookEntry, LookPage } from '../types';
import Pagination from './ui/Pagination';
import { ConfirmDialog } from './ui/Modal';
import {
  XIcon, DownloadIcon, Trash2Icon, ImageIcon, SparklesIcon, HeartIcon,
} from './icons';
import { downloadDataUrl, formatDateRelative } from '../lib/utils';

const PAGE_SIZE = 12;

interface MyLooksHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onUseLook: (lookUrl: string) => void;
}

/**
 * "My Looks" — paginated AI generation history stored in IndexedDB.
 * Slide-over panel: every result the studio generates lands here automatically.
 * Includes favoriting: hearted looks get their own filter and are trimmed last.
 */
const MyLooksHistory: React.FC<MyLooksHistoryProps> = ({ isOpen, onClose, userId, onUseLook }) => {
  const [pageData, setPageData] = useState<LookPage>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [favCount, setFavCount] = useState(0);

  const loadPage = useCallback(async (targetPage: number, favoritesOnly?: boolean) => {
    const useFavFilter = favoritesOnly ?? favOnly;
    setIsLoading(true);
    setError(null);
    try {
      const [result, favorites] = await Promise.all([
        db.getLooksPage(userId, targetPage, PAGE_SIZE, useFavFilter),
        db.getFavoriteCount(userId),
      ]);
      setPageData(result);
      setPage(result.page);
      setFavCount(favorites);
    } catch (e) {
      console.error('Failed to load looks', e);
      setError('Could not load your history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, favOnly]);

  useEffect(() => {
    if (isOpen) void loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await db.deleteLook(userId, pendingDeleteId);
      await loadPage(page);
    } catch (e) {
      console.error('Delete failed', e);
      setError('That look could not be deleted.');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleToggleFavorite = async (look: LookEntry) => {
    const updated = await db.setLookFavorite(userId, look.id, !look.favorite);
    if (!updated) return;
    // Reload so the favorites filter stays consistent (un-favorited items leave the view)
    await loadPage(page);
  };

  const pendingLook = pageData.items.find(l => l.id === pendingDeleteId);

  const switchFilter = (favorites: boolean) => {
    if (favorites === favOnly) return;
    setFavOnly(favorites);
    void loadPage(1, favorites);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-looks-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-[61] flex flex-col animate-slide-in-right"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 id="my-looks-title" className="text-xl font-serif font-bold text-gray-900 dark:text-white">My Looks</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {pageData.total === 0 && !favOnly
                    ? 'No looks yet'
                    : `${favOnly ? `${pageData.total} favorite${pageData.total === 1 ? '' : 's'}` : `${pageData.total} look${pageData.total === 1 ? '' : 's'} generated`}${favCount > 0 ? ` · ${favCount} favorited` : ''}`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close history"
                data-autofocus
                className="p-2 min-w-[44px] min-h-[44px] rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* All / Favorites filter */}
            <div role="group" aria-label="Filter looks" className="flex gap-2 px-4 pt-3">
              <button
                type="button"
                aria-pressed={!favOnly}
                onClick={() => switchFilter(false)}
                className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-colors ${
                  !favOnly
                    ? 'bg-gray-900 dark:bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                type="button"
                aria-pressed={favOnly}
                onClick={() => switchFilter(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-colors ${
                  favOnly
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <HeartIcon className={`w-3.5 h-3.5 ${favOnly ? 'fill-white' : ''}`} aria-hidden="true" />
                Favorites{favCount > 0 ? ` (${favCount})` : ''}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
              {isLoading && (
                <div className="grid grid-cols-2 gap-3" role="status" aria-label="Loading looks">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl skeleton-shimmer" />
                  ))}
                </div>
              )}

              {!isLoading && error && (
                <div role="alert" className="text-center py-10">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadPage(page)}
                    className="min-h-[44px] px-5 py-2 rounded-lg bg-gray-900 dark:bg-indigo-500 text-white text-sm font-semibold hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!isLoading && !error && pageData.items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <span className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    {favOnly
                      ? <HeartIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                      : <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />}
                  </span>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{favOnly ? 'No favorites yet' : 'No looks yet'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[240px]">
                    {favOnly
                      ? 'Tap the heart on any look to keep it here — favorites are trimmed last when your history fills up.'
                      : 'Every outfit you generate is saved here automatically — start stacking garments in the wardrobe.'}
                  </p>
                </div>
              )}

              {!isLoading && !error && pageData.items.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 list-none p-0 m-0">
                  {pageData.items.map((look) => (
                    <motion.li
                      key={look.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      <img
                        src={look.imageUrl}
                        alt={`Look from ${formatDateRelative(look.timestamp)}${look.garmentNames.length > 1 ? ` wearing ${look.garmentNames.slice(1).join(', ')}` : ''}`}
                        loading="lazy"
                        className="w-full aspect-[3/4] object-cover"
                      />
                      {look.favorite && (
                        <span className="absolute top-2 left-2 inline-flex items-center bg-red-500/95 text-white text-[10px] font-semibold px-1.5 py-1 rounded-full" title="Favorited">
                          <HeartIcon className="w-3 h-3 fill-white" aria-hidden="true" />
                          <span className="sr-only">Favorited</span>
                        </span>
                      )}
                      {!look.favorite && look.source === 'manual' && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-indigo-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full" title="Pinned with Save Look">
                          <SparklesIcon className="w-3 h-3" aria-hidden="true" /> Saved
                        </span>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none">
                        <p className="text-white text-[11px] font-semibold truncate">{look.garmentNames.slice(0, 3).join(' · ')}</p>
                        <p className="text-white/70 text-[10px]">{formatDateRelative(look.timestamp)}</p>
                      </div>

                      {/* Action bar */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity duration-150">
                        <button
                          type="button"
                          onClick={() => void handleToggleFavorite(look)}
                          aria-pressed={!!look.favorite}
                          aria-label={look.favorite ? 'Remove this look from favorites' : 'Add this look to favorites'}
                          title={look.favorite ? 'Remove from favorites' : 'Add to favorites'}
                          className={`p-2 min-w-[36px] min-h-[36px] rounded-full bg-white/95 shadow-sm transition-colors ${
                            look.favorite ? 'text-red-500 hover:bg-white' : 'text-gray-700 hover:bg-white'
                          }`}
                        >
                          <HeartIcon className={`w-4 h-4 ${look.favorite ? 'fill-red-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { onUseLook(look.imageUrl); onClose(); }}
                          aria-label={`Use this look as my model`}
                          title="Use as model"
                          className="p-2 min-w-[36px] min-h-[36px] rounded-full bg-white/95 text-gray-700 hover:bg-white shadow-sm transition-colors"
                        >
                          <SparklesIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDataUrl(look.imageUrl, `fit-check-look-${new Date(look.timestamp).toISOString().slice(0, 10)}.png`)}
                          aria-label="Download this look"
                          title="Download"
                          className="p-2 min-w-[36px] min-h-[36px] rounded-full bg-white/95 text-gray-700 hover:bg-white shadow-sm transition-colors"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(look.id)}
                          aria-label="Delete this look"
                          title="Delete"
                          className="p-2 min-w-[36px] min-h-[36px] rounded-full bg-white/95 text-red-500 hover:bg-white shadow-sm transition-colors"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {pageData.total > PAGE_SIZE && (
              <div className="border-t border-gray-100 dark:border-gray-800 p-3">
                <Pagination
                  label="My Looks pagination"
                  page={page}
                  totalPages={pageData.totalPages}
                  totalItems={pageData.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(next) => void loadPage(next)}
                />
              </div>
            )}
          </motion.aside>

          <ConfirmDialog
            isOpen={!!pendingDeleteId}
            title="Delete this look?"
            description={pendingLook ? `This removes “${pendingLook.garmentNames.join(', ')}” (${formatDateRelative(pendingLook.timestamp)}) from your history. This can't be undone.` : 'This look will be permanently removed.'}
            confirmLabel="Delete"
            onCancel={() => setPendingDeleteId(null)}
            onConfirm={() => void handleDelete()}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default MyLooksHistory;
