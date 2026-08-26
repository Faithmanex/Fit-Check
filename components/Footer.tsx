/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REMIX_SUGGESTIONS = [
  "Tip: Save your favorite looks to My Looks.",
  "Tip: Generate colorway variants for any garment.",
  "Tip: Drag garments straight onto your model.",
  "Tip: Use Ctrl+Z to undo a garment instantly.",
  "Tip: Compare before / after with one tap.",
];

interface FooterProps {
  isOnDressingScreen?: boolean;
}

const Footer: React.FC<FooterProps> = ({ isOnDressingScreen = false }) => {
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    // Respect reduced-motion users by not auto-cycling at all
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const interval = setInterval(() => {
      setSuggestionIndex((prevIndex) => (prevIndex + 1) % REMIX_SUGGESTIONS.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <footer
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={`fixed bottom-0 left-0 right-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-t border-gray-200/60 dark:border-gray-800 p-2.5 z-40 ${isOnDressingScreen ? 'hidden sm:block' : ''}`}
    >
      <div className="mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-gray-600 dark:text-gray-400 max-w-7xl px-4 gap-1">
        <p>
          Created by{' '}
          <a
            href="https://x.com/ammaar"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-800 dark:text-gray-200 hover:underline rounded focus-visible:outline-offset-4"
          >
            @ammaar
          </a>
        </p>
        <p className="h-4 mt-1 sm:mt-0 flex items-center overflow-hidden" aria-live="off">
            <AnimatePresence mode="wait">
              <motion.span
                key={suggestionIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="text-center sm:text-right whitespace-nowrap"
              >
                {REMIX_SUGGESTIONS[suggestionIndex]}
              </motion.span>
            </AnimatePresence>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
