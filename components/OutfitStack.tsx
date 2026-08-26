/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon } from './icons';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLastGarment: () => void;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLastGarment }) => {
  return (
    <section aria-label="Outfit stack" className="flex flex-col">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 dark:text-gray-100 border-b border-gray-300/60 dark:border-gray-700 pb-2 mb-3">Outfit Stack</h2>
      <ul className="space-y-2 list-none p-0 m-0" aria-live="polite" aria-relevant="additions removals">
        {outfitHistory.map((layer, index) => (
          <li
            key={layer.garment?.id || 'base'}
            className="flex items-center justify-between bg-white/70 dark:bg-gray-800/70 p-2 rounded-lg animate-fade-in border border-gray-200/80 dark:border-gray-700"
          >
            <div className="flex items-center overflow-hidden">
                <span aria-hidden="true" className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-full">
                  {index + 1}
                </span>
                {layer.garment && (
                    <img src={layer.garment.url} alt="" className="flex-shrink-0 w-12 h-12 object-cover rounded-md mr-3" />
                )}
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate" title={layer.garment?.name}>
                  {layer.garment ? layer.garment.name : 'Base Model'}
                </span>
            </div>
            {index > 0 && index === outfitHistory.length - 1 && (
               <button
                type="button"
                onClick={onRemoveLastGarment}
                className="flex-shrink-0 p-2 min-w-[44px] min-h-[44px] text-gray-500 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950/40"
                aria-label={`Remove ${layer.garment?.name ?? 'last item'} from outfit`}
              >
                <Trash2Icon className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {outfitHistory.length === 1 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
            Your stacked items will appear here. Select an item from the wardrobe below.
          </p>
      )}
    </section>
  );
};

export default OutfitStack;
