
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WardrobeItem, GarmentCategory } from '../types';
import { UploadCloudIcon, CheckCircleIcon, MoreHorizontalIcon, SearchIcon, PaletteIcon, ImageIcon } from './icons';
import { categorizeGarment } from '../services/geminiService';
import Pagination from './ui/Pagination';
import { cn, paginate, readFileAsDataUrl, validateImageFile } from '../lib/utils';

const CATEGORIES: { id: GarmentCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tops', label: 'Tops' },
    { id: 'bottoms', label: 'Bottoms' },
    { id: 'outerwear', label: 'Outerwear' },
    { id: 'dresses', label: 'Dresses' },
    { id: 'accessories', label: 'Accessories' },
];

const WARDROBE_PAGE_SIZE = 12;

interface WardrobePanelProps {
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  onGenerateColorways: (item: WardrobeItem) => void;
  onShopSimilar: (item: WardrobeItem) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
  setWardrobe: React.Dispatch<React.SetStateAction<WardrobeItem[]>>;
}

// Helper to convert image URL to a File object
const urlToFile = (url: string, filename: string): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context.'));
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas toBlob failed.'));
                const mimeType = blob.type || 'image/png';
                const file = new File([blob], filename, { type: mimeType });
                resolve(file);
            }, 'image/png');
        };
        image.onerror = () => reject(new Error(`Could not load image: ${url}`));
        image.src = url;
    });
};

export const WardrobePanel: React.FC<WardrobePanelProps> = ({
    onGarmentSelect,
    onGenerateColorways,
    onShopSimilar,
    activeGarmentIds,
    isLoading,
    wardrobe,
    setWardrobe
}) => {
    const [activeCategory, setActiveCategory] = useState<GarmentCategory | 'all'>('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [uploadingName, setUploadingName] = useState<string | null>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);

    const filteredWardrobe = useMemo(() => {
        const q = query.trim().toLowerCase();
        return wardrobe.filter(item =>
            (activeCategory === 'all' || item.category === activeCategory) &&
            (!q || item.name.toLowerCase().includes(q))
        );
    }, [wardrobe, activeCategory, query]);

    const { items: pageItems, total, totalPages } = useMemo(
        () => paginate(filteredWardrobe, page, WARDROBE_PAGE_SIZE),
        [filteredWardrobe, page]
    );

    // Reset pagination when filters change
    useEffect(() => setPage(1), [activeCategory, query]);
    // Clamp page if the list shrinks
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    // Close item menu on outside click / Escape
    useEffect(() => {
        if (!openMenuId) return;
        const onClickAway = (e: MouseEvent) => {
            if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpenMenuId(null);
        };
        document.addEventListener('mousedown', onClickAway);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClickAway);
            document.removeEventListener('keydown', onKey);
        };
    }, [openMenuId]);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        setOpenMenuId(null);
        try {
            const file =
                item.url.startsWith('data:')
                    ? await (await fetch(item.url)).blob().then(b => new File([b], item.name, { type: b.type || 'image/png' }))
                    : await urlToFile(item.url, `${item.name}.png`);
            onGarmentSelect(file, item);
        } catch (err) {
            console.error(err);
            setError(`Couldn't load “${item.name}”. Check your connection and try again.`);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = '';
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }
        setError(null);

        try {
            // Store as a persistent data URL so uploads survive reloads and avoid CORS issues.
            setUploadingName(file.name.replace(/\.[^.]+$/, ''));
            const dataUrl = await readFileAsDataUrl(file);

            const newItem: WardrobeItem = {
                id: `custom-${Date.now()}`,
                name: file.name.replace(/\.[^.]+$/, ''),
                url: dataUrl,
                category: 'tops',
            };

            setWardrobe(prev => [newItem, ...prev]);
            setActiveCategory('all');

            // Auto-categorize and rename in the background
            try {
                const { category, name } = await categorizeGarment(file);
                setWardrobe(prev => prev.map(item =>
                    item.id === newItem.id ? { ...item, category, name } : item
                ));
            } catch (catErr) {
                console.error('Auto-categorization failed', catErr);
            } finally {
                setUploadingName(null);
            }
        } catch (readErr) {
            console.error(readErr);
            setError('That image could not be read. Please try a different file.');
            setUploadingName(null);
        }
    };

    const handleDragStart = (e: React.DragEvent, item: WardrobeItem) => {
        e.dataTransfer.setData("application/json", JSON.stringify(item));
        e.dataTransfer.setData("text/plain", item.name);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
        let nextIndex: number | null = null;
        if (e.key === 'ArrowRight') nextIndex = (index + 1) % CATEGORIES.length;
        if (e.key === 'ArrowLeft') nextIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
        if (e.key === 'Home') nextIndex = 0;
        if (e.key === 'End') nextIndex = CATEGORIES.length - 1;
        if (nextIndex !== null) {
            e.preventDefault();
            setActiveCategory(CATEGORIES[nextIndex].id);
            document.getElementById(`wardrobe-tab-${CATEGORIES[nextIndex].id}`)?.focus();
        }
    };

    return (
    <section aria-label="Wardrobe" className="pt-4 border-t border-gray-300/60 dark:border-gray-700 flex flex-col h-full overflow-hidden" ref={menuContainerRef}>
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-serif tracking-wider text-gray-800 dark:text-gray-100">Wardrobe</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{wardrobe.length} items</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <label htmlFor="wardrobe-search" className="sr-only">Search wardrobe</label>
            <input
                id="wardrobe-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items…"
                className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
        </div>

        {/* Category Tabs */}
        <div role="tablist" aria-label="Wardrobe categories" className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide">
            {CATEGORIES.map((cat, index) => (
                <button
                    key={cat.id}
                    id={`wardrobe-tab-${cat.id}`}
                    role="tab"
                    aria-selected={activeCategory === cat.id}
                    tabIndex={activeCategory === cat.id ? 0 : -1}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                        activeCategory === cat.id
                            ? 'bg-gray-900 dark:bg-indigo-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                    {cat.label}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1 pb-16 content-start" aria-live="polite">
            {/* Upload tile */}
            <label
                htmlFor="custom-garment-upload"
                className={cn(
                    'relative aspect-square min-h-[88px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 transition-colors duration-150 cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500',
                    isLoading || uploadingName
                        ? 'cursor-wait opacity-70 border-gray-300 dark:border-gray-600'
                        : 'hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-400 dark:hover:text-indigo-300'
                )}
            >
                <UploadCloudIcon className="w-6 h-6 mb-1" aria-hidden="true" />
                <span className="text-[10px] text-center px-1">{uploadingName ? `Adding ${uploadingName}…` : 'Upload'}</span>
                <input id="custom-garment-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} disabled={isLoading} />
            </label>

            {pageItems.map((item) => {
                const isActive = activeGarmentIds.includes(item.id);
                const isDisabled = isLoading || isActive;
                return (
                    <div
                        key={item.id}
                        draggable={!isDisabled}
                        onDragStart={(e) => handleDragStart(e, item)}
                        className={cn(
                            'relative aspect-square min-h-[88px] border rounded-lg overflow-hidden transition-all duration-150 group',
                            isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:border-gray-400 dark:hover:border-gray-500'
                        )}
                    >
                        <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover pointer-events-none" />

                        {/* Name overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 pointer-events-none">
                            <p className="text-white text-[9px] font-bold truncate">{item.name}</p>
                        </div>

                        {/* Menu Button */}
                        {!isDisabled && (
                            <button
                                type="button"
                                aria-label={`Options for ${item.name}`}
                                aria-expanded={openMenuId === item.id}
                                aria-haspopup="menu"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === item.id ? null : item.id);
                                }}
                                className="absolute top-1 right-1 z-10 p-1.5 bg-white/90 dark:bg-gray-900/90 rounded-full hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                            >
                                <MoreHorizontalIcon className="w-4 h-4" />
                            </button>
                        )}

                        {/* Context Menu */}
                        {openMenuId === item.id && (
                            <div role="menu" aria-label={`${item.name} actions`} className="absolute top-8 right-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden text-xs py-1 animate-fade-in">
                                <button
                                    role="menuitem"
                                    onClick={(e) => { e.stopPropagation(); void handleGarmentClick(item); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-800 dark:text-gray-100"
                                >
                                    <CheckCircleIcon className="w-3 h-3"/> Try On
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={(e) => { e.stopPropagation(); onGenerateColorways(item); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-800 dark:text-gray-100"
                                >
                                    <PaletteIcon className="w-3 h-3"/> Generate colorways
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={(e) => { e.stopPropagation(); onShopSimilar(item); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-800 dark:text-gray-100"
                                >
                                    <SearchIcon className="w-3 h-3"/> Shop Similar
                                </button>
                            </div>
                        )}

                        {/* Apply to model: full-card target (mouse + touch) with a visible
                            "Try On" affordance for keyboard and drag-free use */}
                        {!isActive && !isLoading && (
                            <button
                                type="button"
                                onClick={() => void handleGarmentClick(item)}
                                className="absolute inset-0 z-10 flex items-end justify-center pb-6 focus-visible:z-20"
                                aria-label={`Apply ${item.name} to model`}
                            >
                                <span className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-gray-900/95 px-2.5 py-1 text-[10px] font-bold text-gray-800 dark:text-gray-100 shadow border border-gray-200 dark:border-gray-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600">
                                    <CheckCircleIcon className="w-3 h-3" aria-hidden="true" /> Try On
                                </span>
                            </button>
                        )}

                        {/* Active State */}
                        {isActive && (
                            <div className="absolute inset-0 bg-gray-900/50 dark:bg-indigo-900/60 flex items-center justify-center pointer-events-none">
                                <CheckCircleIcon className="w-6 h-6 text-white" aria-hidden="true" />
                                <span className="sr-only">{item.name} is in the current outfit</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Empty state */}
        {filteredWardrobe.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {wardrobe.length === 0 ? 'Your wardrobe is empty' : query ? `No matches for “${query}”` : `No ${activeCategory === 'all' ? 'items' : activeCategory} yet`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[220px]">Upload a garment photo above to add it to your closet.</p>
            </div>
        )}

        {/* Pagination */}
        {total > WARDROBE_PAGE_SIZE && (
            <Pagination
                className="mt-auto pt-2 pb-14 border-t border-gray-200/70 dark:border-gray-700/70"
                label="Wardrobe pagination"
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={WARDROBE_PAGE_SIZE}
                onPageChange={setPage}
            />
        )}

        <div aria-live="assertive" className="min-h-[1rem] mt-1">
            {error && (
                <p role="alert" className="text-red-600 dark:text-red-400 text-xs">{error}</p>
            )}
        </div>
    </section>
  );
};
