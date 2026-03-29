
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { defaultWardrobe } from '../wardrobe';
import type { WardrobeItem, GarmentCategory } from '../types';
import { UploadCloudIcon, CheckCircleIcon, MoreHorizontalIcon, SearchIcon, PaletteIcon } from './icons';
import { categorizeGarment } from '../services/geminiService';

const CATEGORIES: { id: GarmentCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tops', label: 'Tops' },
    { id: 'bottoms', label: 'Bottoms' },
    { id: 'outerwear', label: 'Outerwear' },
    { id: 'dresses', label: 'Dresses' },
    { id: 'accessories', label: 'Accessories' },
];

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
        image.onerror = (error) => reject(new Error(`Could not load image: ${error}`));
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
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const filteredWardrobe = useMemo(() => {
        if (activeCategory === 'all') return wardrobe;
        return wardrobe.filter(item => item.category === activeCategory);
    }, [wardrobe, activeCategory]);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        try {
            const file = await urlToFile(item.url, item.name);
            onGarmentSelect(file, item);
        } catch (err) {
            setError(`Failed to load item. CORS issue likely.`);
            console.error(err);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            
            // Create item immediately with temporary category and ID
            const newItem: WardrobeItem = {
                id: `custom-${Date.now()}`,
                name: file.name,
                url: URL.createObjectURL(file),
                category: 'tops', // Default, will update shortly
            };
            
            // Add to UI immediately
            setWardrobe(prev => [newItem, ...prev]);
            
            // Auto-categorize and name in background
            try {
                const { category, name } = await categorizeGarment(file);
                setWardrobe(prev => prev.map(item => 
                    item.id === newItem.id ? { ...item, category, name } : item
                ));
            } catch (e) {
                console.error("Auto-categorization failed", e);
            }
        }
    };

    const handleDragStart = (e: React.DragEvent, item: WardrobeItem) => {
        e.dataTransfer.setData("application/json", JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copy";
    };

  return (
    <div className="pt-4 border-t border-gray-400/50 flex flex-col h-full overflow-hidden" onClick={() => setOpenMenuId(null)}>
        <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3 flex-shrink-0">Wardrobe</h2>
        
        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 flex-shrink-0 scrollbar-hide">
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        activeCategory === cat.id 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {cat.label}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1 pb-20">
            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                <UploadCloudIcon className="w-6 h-6 mb-1"/>
                <span className="text-[10px] text-center">Upload</span>
                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} disabled={isLoading}/>
            </label>
            
            {filteredWardrobe.map((item) => {
            const isActive = activeGarmentIds.includes(item.id);
            return (
                <div
                    key={item.id}
                    draggable={!isLoading && !isActive}
                    onDragStart={(e) => handleDragStart(e, item)}
                    className={`relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 group ${isLoading || isActive ? 'opacity-60 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:border-gray-400'}`}
                >
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover pointer-events-none" />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/10 flex flex-col justify-end p-1 transition-opacity pointer-events-none">
                        <p className="text-white text-[9px] font-bold truncate drop-shadow-md">{item.name}</p>
                    </div>

                    {/* Menu Button */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === item.id ? null : item.id);
                        }}
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <MoreHorizontalIcon className="w-4 h-4" />
                    </button>

                    {/* Context Menu */}
                    {openMenuId === item.id && (
                        <div className="absolute top-8 right-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden text-xs py-1 animate-fade-in">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleGarmentClick(item); setOpenMenuId(null); }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <CheckCircleIcon className="w-3 h-3"/> Try On
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onGenerateColorways(item); setOpenMenuId(null); }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <PaletteIcon className="w-3 h-3"/> Variants
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onShopSimilar(item); setOpenMenuId(null); }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <SearchIcon className="w-3 h-3"/> Shop Similar
                            </button>
                        </div>
                    )}

                    {/* Active State */}
                    {isActive && (
                        <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center pointer-events-none">
                            <CheckCircleIcon className="w-6 h-6 text-white" />
                        </div>
                    )}
                </div>
            );
            })}
        </div>
        {filteredWardrobe.length === 0 && (
             <p className="text-center text-sm text-gray-500 mt-4">No items in this category.</p>
        )}
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
};
