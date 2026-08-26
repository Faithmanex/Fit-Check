/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WardrobeItem } from '../types';
import { generateColorway } from '../services/geminiService';
import { urlToDataUrl, getFriendlyErrorMessage } from '../lib/utils';
import Modal from './ui/Modal';
import Spinner from './Spinner';
import { CheckCircleIcon, PaletteIcon } from './icons';

/** Fixed preset palette: 4 genuinely different recolors of the garment. */
const COLORWAYS: { name: string; description: string; swatch: string }[] = [
  { name: 'Navy', description: 'a deep navy blue', swatch: '#1e2a4a' },
  { name: 'Sage', description: 'a muted sage green', swatch: '#9caf88' },
  { name: 'Burgundy', description: 'a rich burgundy wine red', swatch: '#6d2332' },
  { name: 'Sand', description: 'a warm sand beige', swatch: '#d8c29d' },
];

type VariantStatus = 'loading' | 'done' | 'error';

interface ColorwayVariant {
  status: VariantStatus;
  url?: string;
  error?: string;
}

interface ColorwayModalProps {
  isOpen: boolean;
  /** Garment to recolor; null when the modal is closed. */
  item: WardrobeItem | null;
  onClose: () => void;
  /** Called with the chosen recolored wardrobe item; parent persists it. */
  onSaveVariant: (variant: WardrobeItem) => void;
}

/**
 * "Generate colorways" picker: renders 3–4 AI-recolored variants of any
 * wardrobe garment (default or custom upload) and lets the user save one
 * back into their wardrobe as a new item.
 */
const ColorwayModal: React.FC<ColorwayModalProps> = ({ isOpen, item, onClose, onSaveVariant }) => {
  const [variants, setVariants] = useState<Record<string, ColorwayVariant>>({});
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceRef = useRef<string | null>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  // Successful results are cached per garment for the session so reopening is instant
  const cacheRef = useRef<Map<string, Record<string, ColorwayVariant>>>(new Map());

  /** Generates one variant, updating state; resolves with the image URL on success. */
  const runVariant = useCallback(async (
      color: { name: string; description: string },
      sourceDataUrl: string,
      token: { cancelled: boolean }
    ): Promise<string | null> => {
      setVariants(prev => ({ ...prev, [color.name]: { status: 'loading' } }));
      try {
        const url = await generateColorway(sourceDataUrl, color.description);
        if (token.cancelled) return null;
        setVariants(prev => ({ ...prev, [color.name]: { status: 'done', url } }));
        return url;
      } catch (err) {
        if (!token.cancelled) {
          setVariants(prev => ({
            ...prev,
            [color.name]: { status: 'error', error: getFriendlyErrorMessage(err, `Could not create the ${color.name} colorway`) },
          }));
        }
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen || !item) return;
    const token = { cancelled: false };
    cancelRef.current = token;

    const cached = cacheRef.current.get(item.id);
    if (cached) {
      setVariants(cached);
      setSourceError(null);
      sourceRef.current = null; // not needed when everything comes from cache
      return () => { token.cancelled = true; };
    }

    setSourceError(null);
    setVariants(Object.fromEntries(COLORWAYS.map(c => [c.name, { status: 'loading' as VariantStatus }])));

    void (async () => {
      try {
        const dataUrl = await urlToDataUrl(item.url);
        if (token.cancelled) return;
        sourceRef.current = dataUrl;
        const results = await Promise.all(
          COLORWAYS.map(async (color) => ({ color: color.name, url: await runVariant(color, dataUrl, token) }))
        );
        if (token.cancelled) return;
        // Only cache when every variant finished successfully
        if (results.every(r => r.url)) {
          cacheRef.current.set(
            item.id,
            Object.fromEntries(results.map(r => [r.color, { status: 'done' as VariantStatus, url: r.url! }]))
          );
        }
      } catch (err) {
        if (!token.cancelled) {
          setSourceError(getFriendlyErrorMessage(err, 'Could not load this garment for recoloring'));
        }
      }
    })();

    return () => { token.cancelled = true; };
  }, [isOpen, item, runVariant]);

  const handleRetryVariant = (colorName: string) => {
    if (!sourceRef.current) return;
    const color = COLORWAYS.find(c => c.name === colorName);
    if (!color) return;
    void runVariant(color, sourceRef.current, cancelRef.current);
  };

  const handleSave = (colorName: string) => {
    if (!item) return;
    const variant = variants[colorName];
    if (variant?.status !== 'done' || !variant.url) return;
    onSaveVariant({
      id: `${item.id}-cw-${colorName.toLowerCase()}-${Date.now().toString(36)}`,
      name: `${item.name} (${colorName})`,
      url: variant.url,
      category: item.category,
    });
    onClose();
  };

  if (!item) {
    return <Modal isOpen={false} onClose={onClose} title="Generate colorways" size="lg"><span /></Modal>;
  }

  const statuses = COLORWAYS.map(c => variants[c.name]?.status ?? 'loading');
  const doneCount = statuses.filter(s => s === 'done').length;
  const errorCount = statuses.filter(s => s === 'error').length;
  const pendingCount = statuses.filter(s => s === 'loading').length;

  const statusMessage = sourceError
    ? ''
    : pendingCount > 0
      ? `Generating colorways… ${doneCount + errorCount} of ${COLORWAYS.length} ready`
      : errorCount > 0
        ? `${doneCount} colorway${doneCount === 1 ? '' : 's'} ready, ${errorCount} failed to generate`
        : 'All colorways ready — pick your favorite';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate colorways"
      description={`AI-recolor “${item.name}” and save a new version to your wardrobe.`}
      size="lg"
    >
      <div aria-live="polite" className="sr-only">{statusMessage}</div>

      {sourceError ? (
        <div role="alert" className="text-center py-8">
          <PaletteIcon className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-xs mx-auto">{sourceError}</p>
          <button type="button" onClick={onClose} className="min-h-[44px] px-5 py-2 rounded-lg bg-gray-900 dark:bg-indigo-500 text-white text-sm font-semibold hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors">
            Close
          </button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
            {COLORWAYS.map((color) => {
              const variant = variants[color.name];
              const status = variant?.status ?? 'loading';
              return (
                <li key={color.name} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                    {status === 'loading' && (
                      <div className="absolute inset-0 skeleton-shimmer flex items-center justify-center" role="status" aria-label={`Generating ${color.name} colorway`}>
                        <Spinner sizeClass="h-6 w-6" />
                      </div>
                    )}
                    {status === 'done' && variant.url && (
                      <img src={variant.url} alt={`${item.name} recolored in ${color.description}`} className="w-full h-full object-cover animate-fade-in" />
                    )}
                    {status === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <p className="text-xs text-red-600 dark:text-red-400 line-clamp-3">{variant?.error}</p>
                        <button
                          type="button"
                          onClick={() => handleRetryVariant(color.name)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          Retry {color.name}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5 border-t border-gray-100 dark:border-gray-800">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: color.swatch }} aria-hidden="true" />
                      {color.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSave(color.name)}
                      disabled={status !== 'done'}
                      className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-indigo-500 disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors"
                      aria-label={`Save the ${color.name} colorway of ${item.name} to the wardrobe`}
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5" aria-hidden="true" /> Save
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400" aria-hidden="true">
              {pendingCount > 0 ? 'This usually takes a few seconds per color.' : 'Saved colorways appear in your wardrobe immediately.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default ColorwayModal;
