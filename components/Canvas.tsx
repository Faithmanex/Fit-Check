
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, HeartIcon, UndoIcon,
    RedoIcon, RefreshCwIcon, DownloadIcon, ColumnsIcon, XIcon,
} from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import { Compare } from './ui/compare';
import { WardrobeItem } from '../types';

interface CanvasProps {
  displayImageUrl: string | null;
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  availablePoseKeys: string[];
  onSaveOutfit?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDropGarment: (item: WardrobeItem) => void;
  onRetry?: () => void;
  onCancelGeneration?: () => void;
  onDownload?: () => void;
  /** Image to diff against in the before/after slider (e.g. previous stack step). */
  compareImageUrl?: string | null;
}

const ctrlBtn =
  'inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] bg-white/80 dark:bg-gray-900/80 border border-gray-300/80 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/80 dark:disabled:hover:bg-gray-900/80';

const Canvas: React.FC<CanvasProps> = ({
    displayImageUrl,
    onStartOver,
    isLoading,
    loadingMessage,
    onSelectPose,
    poseInstructions,
    currentPoseIndex,
    availablePoseKeys,
    onSaveOutfit,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onDropGarment,
    onRetry,
    onCancelGeneration,
    onDownload,
    compareImageUrl,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Elapsed timer gives the wait a sense of progress
  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Keyboard shortcuts (undo / redo / compare) — ignored while typing anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || isLoading) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      } else if (key === 'y') {
        // Ctrl+Y is the classic redo alias
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo, onRedo, isLoading]);

  // Exit compare mode when the underlying image changes or comparison is impossible
  useEffect(() => {
    if (!compareImageUrl || !displayImageUrl) setShowCompare(false);
  }, [compareImageUrl, displayImageUrl]);

  const handleSave = () => {
      if (onSaveOutfit) {
          onSaveOutfit();
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isLoading && displayImageUrl) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isLoading || !displayImageUrl) return;
      try {
          const item = JSON.parse(e.dataTransfer.getData("application/json")) as WardrobeItem;
          if (item && item.id) onDropGarment(item);
      } catch (err) {
          console.error("Failed to parse dropped item", err);
      }
  };

  const handlePreviousPose = () => {
    if (isLoading || availablePoseKeys.length <= 1) return;
    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    if (currentIndexInAvailable === -1) {
        onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
        return;
    }
    const prevIndexInAvailable = (currentIndexInAvailable - 1 + availablePoseKeys.length) % availablePoseKeys.length;
    const prevPoseInstruction = availablePoseKeys[prevIndexInAvailable];
    const newGlobalPoseIndex = poseInstructions.indexOf(prevPoseInstruction);
    if (newGlobalPoseIndex !== -1) onSelectPose(newGlobalPoseIndex);
  };

  const handleNextPose = () => {
    if (isLoading) return;
    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    if (currentIndexInAvailable === -1 || availablePoseKeys.length === 0) {
        onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
        return;
    }
    const nextIndexInAvailable = currentIndexInAvailable + 1;
    if (nextIndexInAvailable < availablePoseKeys.length) {
        const nextPoseInstruction = availablePoseKeys[nextIndexInAvailable];
        const newGlobalPoseIndex = poseInstructions.indexOf(nextPoseInstruction);
        if (newGlobalPoseIndex !== -1) onSelectPose(newGlobalPoseIndex);
    } else {
        const newGlobalPoseIndex = (currentPoseIndex + 1) % poseInstructions.length;
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const altText = displayImageUrl ? 'Virtual try-on result showing you in your selected outfit' : 'Model placeholder';

  return (
    <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Start Over */}
      <button
          type="button"
          onClick={onStartOver}
          aria-label="Start over with a new photo"
          className="absolute top-4 left-4 z-30 inline-flex items-center justify-center bg-white/80 dark:bg-gray-900/80 border border-gray-300/80 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 min-h-[44px] px-4 rounded-full transition-all duration-150 hover:bg-white dark:hover:bg-gray-800 active:scale-95 text-sm backdrop-blur-sm"
      >
          <RotateCcwIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          <span className="hidden sm:inline">Start Over</span>
      </button>

      {/* Undo / Retry / Redo / Compare */}
      {displayImageUrl && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
              <button type="button" onClick={onUndo} disabled={!canUndo || isLoading} className={ctrlBtn} aria-label="Undo last change" title="Undo (Ctrl+Z)">
                  <UndoIcon className="w-5 h-5" aria-hidden="true" />
              </button>
              {onRetry && (
                  <button type="button" onClick={onRetry} disabled={isLoading} className={ctrlBtn} aria-label="Regenerate this look" title="Regenerate">
                      <RefreshCwIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
              )}
              {compareImageUrl && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setShowCompare(v => !v)}
                    aria-pressed={showCompare}
                    aria-label={showCompare ? 'Exit before and after comparison' : 'Compare with previous step'}
                    title="Before / after (one tap)"
                    className={`${ctrlBtn} ${showCompare ? 'ring-2 ring-indigo-500 text-indigo-600 dark:text-indigo-300' : ''}`}
                  >
                      <ColumnsIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
              )}
              <button type="button" onClick={onRedo} disabled={!canRedo || isLoading} className={ctrlBtn} aria-label="Redo change" title="Redo (Ctrl+Shift+Z or Ctrl+Y)">
                  <RedoIcon className="w-5 h-5" aria-hidden="true" />
              </button>
          </div>
      )}

      {/* Save + Download */}
      {(displayImageUrl && !isLoading && (onSaveOutfit || onDownload)) && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            {onDownload && (
                <button
                    type="button"
                    onClick={onDownload}
                    aria-label="Download this look"
                    title="Download"
                    className={ctrlBtn}
                >
                    <DownloadIcon className="w-5 h-5" aria-hidden="true" />
                </button>
            )}
            {onSaveOutfit && (
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaved}
                    aria-label={isSaved ? 'Outfit saved to My Looks' : 'Save outfit to My Looks'}
                    className={`inline-flex items-center justify-center font-semibold py-2 min-h-[44px] px-4 rounded-full transition-all duration-150 active:scale-95 text-sm backdrop-blur-sm ${
                        isSaved
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-white/80 dark:bg-gray-900/80 border border-gray-300/80 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800'
                    }`}
                >
                    <HeartIcon className={`w-4 h-4 mr-2 ${isSaved ? 'fill-green-700' : ''}`} aria-hidden="true" />
                    <span className="hidden sm:inline">{isSaved ? 'Saved!' : 'Save Look'}</span>
                </button>
            )}
        </div>
      )}

      {/* Image Display or Placeholder */}
      <div className="relative w-full h-full flex items-center justify-center">
        {displayImageUrl ? (
          showCompare && compareImageUrl ? (
            <figure key="compare-view" className="relative animate-fade-in">
              <Compare
                firstImage={compareImageUrl}
                secondImage={displayImageUrl}
                firstLabel="Previous version"
                secondLabel="Current look"
                sliderLabel="Before and after comparison slider. Use the Left and Right arrow keys to move the divider, or drag with mouse or touch."
                slideMode="drag"
                className="w-[280px] h-[420px] sm:w-[340px] sm:h-[510px] lg:w-[400px] lg:h-[600px] max-w-full rounded-lg bg-gray-200 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={() => setShowCompare(false)}
                aria-label="Close before and after comparison"
                className="absolute top-2 right-2 z-40 p-2 min-w-[36px] min-h-[36px] rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <XIcon className="w-4 h-4" aria-hidden="true" />
              </button>
              <figcaption className="sr-only">Before and after comparison slider — drag to reveal the change.</figcaption>
            </figure>
          ) : (
            <img
                key={displayImageUrl}
                src={displayImageUrl}
                alt={altText}
                className="max-w-full max-h-full object-contain transition-opacity duration-150 animate-fade-in rounded-lg shadow-md"
            />
          )
        ) : (
            <div className="w-[320px] h-[480px] max-w-full rounded-lg skeleton-shimmer flex flex-col items-center justify-end pb-8" role="status" aria-label="Loading model preview">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Preparing your studio…</p>
            </div>
        )}

        {/* Drag overlay */}
        {isDragOver && (
            <div className="absolute inset-0 bg-indigo-500/20 border-4 border-indigo-500 border-dashed rounded-lg flex items-center justify-center z-20 pointer-events-none">
                <p className="text-white text-2xl font-bold font-serif bg-black/50 px-6 py-3 rounded-xl backdrop-blur-sm">Drop to Try On</p>
            </div>
        )}

        {/* AI waiting state: skeleton shimmer + progress feel + cancel */}
        <AnimatePresence>
          {isLoading && (
              <motion.div
                  className="absolute inset-0 bg-white/85 dark:bg-gray-950/85 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  role="status"
                  aria-live="polite"
              >
                  <div className="relative w-40 h-56 rounded-xl overflow-hidden skeleton-shimmer mb-5" aria-hidden="true">
                      <div className="absolute bottom-3 inset-x-3 space-y-2">
                          <div className="h-2 rounded skeleton-shimmer" style={{ animationDelay: '0.2s' }} />
                          <div className="h-2 rounded skeleton-shimmer w-2/3 mx-auto" />
                      </div>
                  </div>
                  <Spinner sizeClass="h-6 w-6" />
                  {loadingMessage && (
                      <p className="text-base font-medium text-gray-700 dark:text-gray-200 mt-3 text-center px-6">{loadingMessage}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 tabular-nums" aria-hidden="true">{elapsed}s elapsed</p>
                  <div className="flex items-center gap-1.5 mt-3" aria-hidden="true">
                      {[0, 1, 2].map((d) => (
                          <span key={d} className="progress-dot w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                      ))}
                  </div>
                  {onCancelGeneration && (
                      <button
                        type="button"
                        onClick={onCancelGeneration}
                        className="mt-5 min-h-[44px] px-6 rounded-full border border-gray-400/70 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                      >
                          Cancel
                      </button>
                  )}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pose Controls — always visible for touch & keyboard */}
      {displayImageUrl && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-2rem)]">
          <div className="flex items-center justify-center gap-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full p-1.5 border border-gray-300/60 dark:border-gray-700 shadow-sm">
            <button
              type="button"
              onClick={handlePreviousPose}
              aria-label="Previous pose"
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-full hover:bg-white dark:hover:bg-gray-800 active:scale-90 transition-all disabled:opacity-40"
              disabled={isLoading}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-800 dark:text-gray-100" aria-hidden="true" />
            </button>
            <span
              className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 w-32 sm:w-52 text-center truncate"
              aria-live="polite"
              title={poseInstructions[currentPoseIndex]}
            >
              {poseInstructions[currentPoseIndex]}
            </span>
            <button
              type="button"
              onClick={handleNextPose}
              aria-label="Next pose"
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-full hover:bg-white dark:hover:bg-gray-800 active:scale-90 transition-all disabled:opacity-40"
              disabled={isLoading}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-800 dark:text-gray-100" aria-hidden="true" />
            </button>

            {/* Full pose picker popover on click of label */}
            <details className="relative">
              <summary
                className="list-none cursor-pointer p-2.5 min-w-[44px] min-h-[44px] rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
                aria-label="All poses"
              >
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">All</span>
              </summary>
              <div className="absolute bottom-full right-0 mb-3 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80 dark:border-gray-700 shadow-xl animate-fade-in max-h-72 overflow-y-auto">
                <div className="grid grid-cols-1 gap-1">
                  {poseInstructions.map((pose, index) => (
                    <button
                        type="button"
                        key={pose}
                        onClick={(e) => {
                            onSelectPose(index);
                            (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                        }}
                        disabled={isLoading || index === currentPoseIndex}
                        aria-current={index === currentPoseIndex || undefined}
                        className="w-full text-left text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 p-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:font-bold disabled:cursor-not-allowed"
                    >
                        {pose}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
