/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, ImageIcon, XIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage } from '../services/geminiService';
import { validateImageFile } from '../lib/utils';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
}

const LOADING_STAGES = [
  'Analyzing your photo…',
  'Finding your best angles…',
  'Building your model…',
  'Polishing studio lighting…',
];

const screenVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized }) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  // Cancellation token: discards late results after the user cancels
  const cancelTokenRef = useRef<{ cancelled: boolean } | null>(null);

  const setPreviewUrl = (url: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setUserImageUrl(url);
  };

  // Rotate staged status messages while generating
  useEffect(() => {
    if (!isGenerating) return;
    setStageIndex(0);
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const runGeneration = useCallback(async (file: File) => {
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setIsGenerating(true);
    setGeneratedModelUrl(null);

    const token = { cancelled: false };
    cancelTokenRef.current = token;

    try {
      const result = await generateModelImage(file);
      if (token.cancelled) return; // user backed out — discard the late result
      setGeneratedModelUrl(result);
    } catch (err) {
      if (!token.cancelled) setError(err instanceof Error ? err.message : 'Failed to create your model. Please try again.');
    } finally {
      if (!token.cancelled) setIsGenerating(false);
    }
  }, []);

  const handleFileSelect = useCallback((file: File | undefined | null) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (validationError === null && file.size > 0) lastFileRef.current = file;
    void runGeneration(file);
  }, [runGeneration]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0]);
    e.target.value = ''; // allow re-selecting the same file
  };

  const reset = () => {
    if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true;
    setPreviewUrl(null);
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setError(null);
    setIsDragOver(false);
  };

  const retryLast = () => {
    if (lastFileRef.current) void runGeneration(lastFileRef.current);
    else reset();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!userImageUrl) setIsDragOver(true);
  };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!userImageUrl) handleFileSelect(e.dataTransfer.files?.[0]);
  };

  return (
    <AnimatePresence mode="wait">
      {!userImageUrl ? (
        <motion.div
          key="uploader"
          className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.18 }}
          aria-labelledby="start-heading"
        >
          <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="max-w-lg">
              <h1 id="start-heading" className="text-5xl md:text-6xl font-serif font-bold text-gray-900 dark:text-white leading-tight text-balance">
                Create Your Model for Any Look.
              </h1>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                Ever wondered how an outfit would look on you? Stop guessing. Upload a photo and see for yourself.
              </p>
              <hr className="my-8 border-gray-200 dark:border-gray-800" />

              <div
                role="button"
                tabIndex={0}
                aria-label="Upload a photo of yourself — drag and drop or press Enter to browse files"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`w-full rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors duration-150 ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-900'
                }`}
              >
                <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <UploadCloudIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </span>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Drop your photo here</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">or click to browse · PNG, JPEG or WEBP up to 12 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif"
                  onChange={handleFileChange}
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>

              <div aria-live="assertive" className="min-h-[1.5rem] mt-3">
                {error && (
                  <p role="alert" className="flex items-start justify-center lg:justify-start gap-2 text-red-600 dark:text-red-400 text-sm">
                    <XIcon className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                  </p>
                )}
              </div>

              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">A clear full-body photo works best. By uploading you agree to use this service responsibly.</p>
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
            <Compare
              firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
              secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
              firstLabel="Original outfit"
              secondLabel="AI try-on result"
              sliderLabel="Demo comparison slider. Use the Left and Right arrow keys to move the divider, or drag with mouse or touch."
              slideMode="drag"
              className="w-full max-w-sm aspect-[2/3] rounded-2xl bg-gray-200 dark:bg-gray-800"
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="compare"
          className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.18 }}
          aria-labelledby="result-heading"
        >
          <div className="md:w-1/2 flex-shrink-0 flex flex-col items-center md:items-start">
            <div className="text-center md:text-left">
              <h1 id="result-heading" className="text-4xl md:text-5xl font-serif font-bold text-gray-900 dark:text-white leading-tight">
                The New You
              </h1>
              <p className="mt-2 text-md text-gray-600 dark:text-gray-300">
                Drag the slider to compare before / after.
              </p>
            </div>

            {/* AI waiting state — skeleton + staged messages + cancel */}
            {isGenerating && (
              <div className="mt-6 w-full max-w-sm" role="status" aria-live="polite">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 rounded skeleton-shimmer w-3/4" />
                      <div className="h-2.5 rounded skeleton-shimmer w-1/2" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-3">{LOADING_STAGES[stageIndex]}</p>
                  <div className="flex items-center gap-1.5 mt-2" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="progress-dot w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && !isGenerating && (
              <div className="text-center md:text-left text-red-600 dark:text-red-400 max-w-md mt-6" role="alert">
                <p className="font-semibold">Generation failed</p>
                <p className="text-sm mb-4">{error}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={retryLast}
                    className="min-h-[44px] px-5 py-2 rounded-lg bg-gray-900 dark:bg-indigo-500 text-white text-sm font-semibold hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="min-h-[44px] px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Choose Different Photo
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence>
              {generatedModelUrl && !isGenerating && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col sm:flex-row items-center gap-4 mt-8"
                >
                  <button
                    type="button"
                    onClick={reset}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-base font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Use Different Photo
                  </button>
                  <button
                    type="button"
                    data-autofocus
                    onClick={() => onModelFinalized(generatedModelUrl)}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-8 py-2.5 text-base font-semibold text-white bg-gray-900 dark:bg-indigo-500 rounded-lg group hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors"
                  >
                    Proceed to Styling →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:w-1/2 w-full flex items-center justify-center">
            <figure className={`relative rounded-[1.25rem] transition-shadow duration-150 ${isGenerating ? '' : 'shadow-lg'}`}>
              {generatedModelUrl || isGenerating ? (
                <>
                  <Compare
                    firstImage={userImageUrl}
                    secondImage={generatedModelUrl ?? userImageUrl}
                    firstLabel="Your original photo"
                    secondLabel={generatedModelUrl ? 'Your generated AI model' : 'Generating…'}
                    sliderLabel="Before and after comparison slider. Use the Left and Right arrow keys to move the divider, or drag with mouse or touch."
                    slideMode="drag"
                    className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200 dark:bg-gray-800"
                  />
                  {!generatedModelUrl && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none" aria-hidden="true">
                      <div className="absolute inset-x-0 bottom-0 h-24 skeleton-shimmer opacity-60" />
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
                        <ImageIcon className="w-3.5 h-3.5" /> Generating…
                      </div>
                    </div>
                  )}
                  <figcaption className="sr-only">
                    Slider comparing your original photo with the generated AI model.
                  </figcaption>
                </>
              ) : (
                <img
                  src={userImageUrl}
                  alt="Your uploaded photo"
                  className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] object-cover rounded-2xl bg-gray-200"
                />
              )}
            </figure>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartScreen;
