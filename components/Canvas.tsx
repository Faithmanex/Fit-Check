
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, HeartIcon, UndoIcon, RedoIcon, RefreshCwIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
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
}

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
    onRetry
}) => {
  const [isPoseMenuOpen, setIsPoseMenuOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSave = () => {
      if (onSaveOutfit) {
          onSaveOutfit();
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (!isLoading && displayImageUrl) {
          setIsDragOver(true);
      }
  };

  const handleDragLeave = () => {
      setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isLoading || !displayImageUrl) return;

      try {
          const item = JSON.parse(e.dataTransfer.getData("application/json")) as WardrobeItem;
          if (item && item.id) {
              onDropGarment(item);
          }
      } catch (e) {
          console.error("Failed to parse dropped item", e);
      }
  };
  
  const handlePreviousPose = () => {
    if (isLoading || availablePoseKeys.length <= 1) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    
    // Fallback if current pose not in available list (shouldn't happen)
    if (currentIndexInAvailable === -1) {
        onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
        return;
    }

    const prevIndexInAvailable = (currentIndexInAvailable - 1 + availablePoseKeys.length) % availablePoseKeys.length;
    const prevPoseInstruction = availablePoseKeys[prevIndexInAvailable];
    const newGlobalPoseIndex = poseInstructions.indexOf(prevPoseInstruction);
    
    if (newGlobalPoseIndex !== -1) {
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleNextPose = () => {
    if (isLoading) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);

    // Fallback or if there are no generated poses yet
    if (currentIndexInAvailable === -1 || availablePoseKeys.length === 0) {
        onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
        return;
    }
    
    const nextIndexInAvailable = currentIndexInAvailable + 1;
    if (nextIndexInAvailable < availablePoseKeys.length) {
        // There is another generated pose, navigate to it
        const nextPoseInstruction = availablePoseKeys[nextIndexInAvailable];
        const newGlobalPoseIndex = poseInstructions.indexOf(nextPoseInstruction);
        if (newGlobalPoseIndex !== -1) {
            onSelectPose(newGlobalPoseIndex);
        }
    } else {
        // At the end of generated poses, generate the next one from the master list
        const newGlobalPoseIndex = (currentPoseIndex + 1) % poseInstructions.length;
        onSelectPose(newGlobalPoseIndex);
    }
  };
  
  return (
    <div 
        className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in group"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Start Over Button */}
      <button 
          onClick={onStartOver}
          className="absolute top-4 left-4 z-30 flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
      >
          <RotateCcwIcon className="w-4 h-4 mr-2" />
          Start Over
      </button>

      {/* Undo/Redo/Retry Controls */}
      {displayImageUrl && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
              <button
                  onClick={onUndo}
                  disabled={!canUndo || isLoading}
                  className="p-2 bg-white/60 border border-gray-300/80 rounded-full text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
                  aria-label="Undo"
              >
                  <UndoIcon className="w-5 h-5" />
              </button>
              {onRetry && (
                  <button
                      onClick={onRetry}
                      disabled={isLoading}
                      className="p-2 bg-white/60 border border-gray-300/80 rounded-full text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
                      aria-label="Retry Generation"
                      title="Retry"
                  >
                      <RefreshCwIcon className="w-5 h-5" />
                  </button>
              )}
              <button
                  onClick={onRedo}
                  disabled={!canRedo || isLoading}
                  className="p-2 bg-white/60 border border-gray-300/80 rounded-full text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
                  aria-label="Redo"
              >
                  <RedoIcon className="w-5 h-5" />
              </button>
          </div>
      )}

      {/* Save Button */}
      {displayImageUrl && !isLoading && onSaveOutfit && (
        <button 
          onClick={handleSave}
          disabled={isSaved}
          className={`absolute top-4 right-4 z-30 flex items-center justify-center text-center font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out active:scale-95 text-sm backdrop-blur-sm ${isSaved ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white/60 border border-gray-300/80 text-gray-700 hover:bg-white hover:border-gray-400'}`}
        >
          <HeartIcon className={`w-4 h-4 mr-2 ${isSaved ? 'fill-green-700' : ''}`} />
          {isSaved ? 'Saved!' : 'Save Outfit'}
        </button>
      )}

      {/* Image Display or Placeholder */}
      <div className="relative w-full h-full flex items-center justify-center">
        {displayImageUrl ? (
          <>
            <img
                key={displayImageUrl} // Use key to force re-render and trigger animation on image change
                src={displayImageUrl}
                alt="Virtual try-on model"
                className="max-w-full max-h-full object-contain transition-opacity duration-500 animate-fade-in rounded-lg"
            />
            {/* Drag Overlay */}
            {isDragOver && (
                <div className="absolute inset-0 bg-indigo-500/20 border-4 border-indigo-500 border-dashed rounded-lg flex items-center justify-center z-20 pointer-events-none">
                    <p className="text-white text-2xl font-bold font-serif bg-black/50 px-6 py-3 rounded-xl backdrop-blur-sm">Drop to Try On</p>
                </div>
            )}
          </>
        ) : (
            <div className="w-[400px] h-[600px] bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center">
              <Spinner />
              <p className="text-md font-serif text-gray-600 mt-4">Loading Model...</p>
            </div>
        )}
        
        <AnimatePresence>
          {isLoading && (
              <motion.div
                  className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
              >
                  <Spinner />
                  {loadingMessage && (
                      <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pose Controls */}
      {displayImageUrl && !isLoading && (
        <div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onMouseEnter={() => setIsPoseMenuOpen(true)}
          onMouseLeave={() => setIsPoseMenuOpen(false)}
        >
          {/* Pose popover menu */}
          <AnimatePresence>
              {isPoseMenuOpen && (
                  <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute bottom-full mb-3 w-64 bg-white/80 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80"
                  >
                      <div className="grid grid-cols-2 gap-2">
                          {poseInstructions.map((pose, index) => (
                              <button
                                  key={pose}
                                  onClick={() => onSelectPose(index)}
                                  disabled={isLoading || index === currentPoseIndex}
                                  className="w-full text-left text-sm font-medium text-gray-800 p-2 rounded-md hover:bg-gray-200/70 disabled:opacity-50 disabled:bg-gray-200/70 disabled:font-bold disabled:cursor-not-allowed"
                              >
                                  {pose}
                              </button>
                          ))}
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>
          
          <div className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md rounded-full p-2 border border-gray-300/50">
            <button 
              onClick={handlePreviousPose}
              aria-label="Previous pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-800" />
            </button>
            <span className="text-sm font-semibold text-gray-800 w-48 text-center truncate" title={poseInstructions[currentPoseIndex]}>
              {poseInstructions[currentPoseIndex]}
            </span>
            <button 
              onClick={handleNextPose}
              aria-label="Next pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
