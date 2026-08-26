

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './StartScreen';
import Canvas from './Canvas';
import { WardrobePanel } from './WardrobeModal';
import OutfitStack from './OutfitStack';
import MyLooksHistory from './MyLooksHistory';
import ColorwayModal from './ColorwayModal';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { generateVirtualTryOnImage, generatePoseVariation, findSimilarItems } from '../services/geminiService';
import { OutfitLayer, WardrobeItem, User, ShoppingResult, LookEntry } from '../types';
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ExternalLinkIcon, XIcon, SearchIcon, HistoryIcon, WifiOffIcon, AlertTriangleIcon } from './icons';
import { defaultWardrobe } from '../wardrobe';
import Footer from './Footer';
import { getFriendlyErrorMessage, downloadDataUrl } from '../lib/utils';
import Spinner from './Spinner';
import { useMediaQuery, useOnlineStatus } from '../lib/hooks';
import { db } from '../lib/db';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Walking towards camera, confident stride",
  "Leaning against a wall, casual",
  "Sitting on a stool, elegant",
  "Arms crossed, professional headshot style",
  "Jumping in the air, energetic",
  "Back view, looking over shoulder"
];

interface VirtualTryOnProps {
    user: User;
    /** Look handed over from the Dashboard gallery ("Use as model"). */
    initialModelUrl?: string | null;
    onBack: () => void;
    onUpgradeRequired: () => void;
}

/** Point-in-time capture of the outfit timeline, used by undo/redo. */
interface StudioSnapshot {
    outfitHistory: OutfitLayer[];
    currentOutfitIndex: number;
    currentPoseIndex: number;
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

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ user, initialModelUrl, onBack, onUpgradeRequired }) => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);

  // My Looks history
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [looksCount, setLooksCount] = useState(0);

  // Colorway picker (AI recolors of a wardrobe garment)
  const [colorwayItem, setColorwayItem] = useState<WardrobeItem | null>(null);

  // Undo/redo: snapshots captured before every mutating action
  // (garment apply/remove, pose change, regeneration)
  const [pastStack, setPastStack] = useState<StudioSnapshot[]>([]);
  const [futureStack, setFutureStack] = useState<StudioSnapshot[]>([]);
  const studioRef = useRef<StudioSnapshot>({ outfitHistory: [], currentOutfitIndex: 0, currentPoseIndex: 0 });

  useEffect(() => {
    studioRef.current = { outfitHistory, currentOutfitIndex, currentPoseIndex };
  });

  /** Record the pre-mutation state so the change can be undone. */
  const pushSnapshot = useCallback((snap: StudioSnapshot) => {
    setPastStack(prev => [...prev.slice(-49), snap]);
    setFutureStack([]);
  }, []);

  /** Drop the stacks when a brand-new timeline starts (new model / start over). */
  const clearUndoHistory = useCallback(() => {
    setPastStack([]);
    setFutureStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (pastStack.length === 0) return;
    const snap = pastStack[pastStack.length - 1];
    setFutureStack(f => [studioRef.current, ...f].slice(0, 50));
    setPastStack(p => p.slice(0, -1));
    setOutfitHistory(snap.outfitHistory);
    setCurrentOutfitIndex(snap.currentOutfitIndex);
    setCurrentPoseIndex(snap.currentPoseIndex);
  }, [pastStack]);

  const handleRedo = useCallback(() => {
    if (futureStack.length === 0) return;
    const snap = futureStack[0];
    setPastStack(p => [...p.slice(-49), studioRef.current]);
    setFutureStack(f => f.slice(1));
    setOutfitHistory(snap.outfitHistory);
    setCurrentOutfitIndex(snap.currentOutfitIndex);
    setCurrentPoseIndex(snap.currentPoseIndex);
  }, [futureStack]);

  // Shopping
  const [shoppingResults, setShoppingResults] = useState<ShoppingResult[]>([]);
  const [isShoppingLoading, setIsShoppingLoading] = useState(false);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);

  const toast = useToast();
  const online = useOnlineStatus();
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Cancellation tokens for in-flight AI generations (results are discarded when cancelled)
  const activeTokenRef = useRef<{ cancelled: boolean } | null>(null);

  // Suppresses model restoration after an explicit "Start Over" (user prop can be stale)
  const suppressModelRestoreRef = useRef(false);

  const refreshLooksCount = useCallback(async () => {
      setLooksCount(await db.getLookCount(user.id));
  }, [user.id]);

  // Load persistent model (dashboard hand-off takes priority)
  useEffect(() => {
      if (suppressModelRestoreRef.current) return;
      const sourceUrl = initialModelUrl ?? user.modelImage;
      if (sourceUrl && !modelImageUrl) {
          setModelImageUrl(sourceUrl);
          setOutfitHistory([{
            garment: null,
            poseImages: { [POSE_INSTRUCTIONS[0]]: sourceUrl }
          }]);
      }
  }, [initialModelUrl, user.modelImage, modelImageUrl]);

  // Load persisted custom wardrobe items once per session/user
  const wardrobeLoadedRef = useRef(false);
  useEffect(() => {
      let disposed = false;
      (async () => {
          try {
              const custom = await db.getWardrobe(user.id);
              if (disposed) return;
              const customIds = new Set(custom.map(i => i.id));
              const defaults = defaultWardrobe.filter(d => !customIds.has(d.id));
              setWardrobe([...custom, ...defaults]);
          } catch (e) {
              console.error('Failed to load wardrobe', e);
          } finally {
              wardrobeLoadedRef.current = true;
              void refreshLooksCount();
          }
      })();
      return () => { disposed = true; };
  }, [user.id, refreshLooksCount]);

  // Persist wardrobe changes (debounced)
  useEffect(() => {
      if (!wardrobeLoadedRef.current) return;
      const timer = setTimeout(() => {
          void db.setWardrobe(user.id, wardrobe).catch(e => console.error('Failed to persist wardrobe', e));
      }, 600);
      return () => clearTimeout(timer);
  }, [wardrobe, user.id]);

  const activeOutfitLayers = useMemo(() =>
    outfitHistory.slice(0, currentOutfitIndex + 1),
    [outfitHistory, currentOutfitIndex]
  );

  const activeGarmentIds = useMemo(() =>
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[],
    [activeOutfitLayers]
  );

  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  /** Image before the latest change, used by the before/after slider. */
  const compareImageUrl = useMemo(() => {
      if (outfitHistory.length < 2 || currentOutfitIndex === 0) return null;
      const prevLayer = outfitHistory[currentOutfitIndex - 1];
      if (!prevLayer) return null;
      const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      return prevLayer.poseImages[poseInstruction] ?? Object.values(prevLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const checkSubscription = useCallback((): boolean => {
      if (user.plan === 'free' && user.subscriptionStatus !== 'active') {
          onUpgradeRequired();
          return false;
      }
      return true;
  }, [user.plan, user.subscriptionStatus, onUpgradeRequired]);

  const beginGeneration = useCallback((message: string): { cancelled: boolean } | null => {
      if (!online) {
          toast.error("You're offline — reconnect to generate new looks.");
          return null;
      }
      setError(null);
      setIsLoading(true);
      setLoadingMessage(message);
      const token = { cancelled: false };
      activeTokenRef.current = token;
      return token;
  }, [online, toast]);

  const endGeneration = useCallback((token: { cancelled: boolean } | null) => {
      if (token && token.cancelled) {
          toast.info('Generation cancelled.');
      }
      activeTokenRef.current = null;
      setIsLoading(false);
      setLoadingMessage('');
  }, [toast]);

  const handleCancelGeneration = useCallback(() => {
      if (activeTokenRef.current) activeTokenRef.current.cancelled = true;
      setIsLoading(false);
      setLoadingMessage('');
  }, []);

  /** Persist a generated result into the paginated "My Looks" history. */
  const recordLook = useCallback(async (
      imageUrl: string,
      source: LookEntry['source'],
      poseLabel?: string
  ) => {
      if (!imageUrl) return;
      const names = [
        'Base Model',
        ...activeOutfitLayers.map(layer => layer.garment?.name).filter((n): n is string => !!n),
      ];
      try {
          await db.saveLook(user.id, {
              imageUrl,
              timestamp: Date.now(),
              garmentNames: names,
              poseLabel,
              source,
          });
          void refreshLooksCount();
      } catch (e) {
          console.error('Failed to record look', e);
      }
  }, [activeOutfitLayers, user.id, refreshLooksCount]);

  const handleModelFinalized = async (url: string) => {
    if (!checkSubscription()) return;
    setModelImageUrl(url);
    try {
        await db.updateUser(user.id, { modelImage: url });
    } catch (e) {
        console.error(e);
    }
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
    setCurrentPoseIndex(0);
    clearUndoHistory();
  };

  /** Reuse a saved look as the new base — no AI call, so no plan gate. */
  const applyLookAsModel = useCallback((url: string) => {
    suppressModelRestoreRef.current = true;
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
    setCurrentPoseIndex(0);
    clearUndoHistory();
    void db.updateUser(user.id, { modelImage: url }).catch(() => undefined);
  }, [user.id, clearUndoHistory]);

  const handleStartOver = async () => {
    suppressModelRestoreRef.current = true;
    setModelImageUrl(null);
    try {
        await db.updateUser(user.id, { modelImage: null });
    } catch (e) {
        console.error(e);
    }
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    clearUndoHistory();
  };

  const handleSaveOutfit = useCallback(async () => {
    if (!displayImageUrl) return;
    await recordLook(displayImageUrl, 'manual');
    toast.success('Saved to My Looks');
  }, [displayImageUrl, recordLook, toast]);

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!checkSubscription()) return;
    if (!displayImageUrl || isLoading) return;

    // Duplicate check
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (currentLayer && currentLayer.garment?.id === garmentInfo.id) {
        toast.info(`${garmentInfo.name} is already part of this outfit.`);
        return;
    }

    // Re-apply check: the very next step in the undo stack already has this garment,
    // so just walk forward (same as pressing Redo).
    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        handleRedo();
        return;
    }

    const token = beginGeneration(`Adding ${garmentInfo.name}…`);
    if (!token) return;

    try {
      const cacheKey = `tryon_${user.id}_${garmentInfo.id}_${POSE_INSTRUCTIONS[currentPoseIndex]}`;
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, garmentFile, cacheKey);
      if (token.cancelled) return;
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];

      const newLayer: OutfitLayer = {
        garment: garmentInfo,
        poseImages: { [currentPoseInstruction]: newImageUrl }
      };

      pushSnapshot(studioRef.current);
      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);

      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) return prev;
        return [garmentInfo, ...prev];
      });

      await recordLook(newImageUrl, 'auto', currentPoseInstruction);
    } catch (err) {
      if (!token.cancelled) setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
    } finally {
      endGeneration(token);
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex, user, checkSubscription, beginGeneration, endGeneration, recordLook, toast, handleRedo, pushSnapshot]);

  const handleRetry = useCallback(async () => {
      if (!displayImageUrl || isLoading || currentOutfitIndex === 0) return;
      const currentLayer = outfitHistory[currentOutfitIndex];
      if (!currentLayer.garment) return;

      const token = beginGeneration('Regenerating your look…');
      if (!token) return;

      try {
          const file = await urlToFile(currentLayer.garment.url, currentLayer.garment.name);
          const prevLayer = outfitHistory[currentOutfitIndex - 1];
          const prevImage = prevLayer.poseImages[POSE_INSTRUCTIONS[currentPoseIndex]] || Object.values(prevLayer.poseImages)[0];

          // No cache key — force a fresh generation
          const newImageUrl = await generateVirtualTryOnImage(prevImage, file);
          if (token.cancelled) return;

          pushSnapshot(studioRef.current);
          setOutfitHistory(prev => {
              const copy = [...prev];
              copy[currentOutfitIndex] = {
                  ...copy[currentOutfitIndex],
                  poseImages: {
                      ...copy[currentOutfitIndex].poseImages,
                      [POSE_INSTRUCTIONS[currentPoseIndex]]: newImageUrl
                  }
              };
              return copy;
          });

          await recordLook(newImageUrl, 'auto', POSE_INSTRUCTIONS[currentPoseIndex]);
          toast.success('Fresh version ready');
      } catch (err) {
          if (!token.cancelled) setError(getFriendlyErrorMessage(err, 'Regeneration failed'));
      } finally {
          endGeneration(token);
      }
  }, [displayImageUrl, isLoading, currentOutfitIndex, outfitHistory, currentPoseIndex, beginGeneration, endGeneration, recordLook, toast, pushSnapshot]);

  /** Open the AI colorway picker for a garment; chosen variants land in the wardrobe. */
  const handleSaveColorwayVariant = useCallback((variant: WardrobeItem) => {
      setWardrobe(prev => [variant, ...prev]);
      toast.success(`“${variant.name}” added to your wardrobe`);
  }, [toast]);

  const openShopSimilar = async (item: WardrobeItem) => {
      setIsShoppingModalOpen(true);
      setIsShoppingLoading(true);
      setShoppingError(null);
      setShoppingResults([]);
      try {
          const results = await findSimilarItems(item.url);
          setShoppingResults(results);
          if (results.length === 0) setShoppingError('No similar items found right now — try again later.');
      } catch (e) {
          setShoppingError(getFriendlyErrorMessage(e, 'Could not search for similar items'));
      } finally {
          setIsShoppingLoading(false);
      }
  };

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      pushSnapshot(studioRef.current);
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };

  const handleDropGarment = async (item: WardrobeItem) => {
      try {
          const file = await urlToFile(item.url, item.name);
          await handleGarmentSelect(file, item);
      } catch (e) {
          console.error("Failed to process dropped item", e);
          setError(`Couldn't load “${item.name}” for drop.`);
      }
  };

  const handleDownload = useCallback(() => {
      if (!displayImageUrl) return;
      downloadDataUrl(displayImageUrl, `fit-check-look-${new Date().toISOString().slice(0, 10)}.png`);
      toast.success('Look downloaded');
  }, [displayImageUrl, toast]);

  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (!checkSubscription()) return;
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;

    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    // Fast switch if already generated
    if (currentLayer.poseImages[poseInstruction]) {
      pushSnapshot(studioRef.current);
      setCurrentPoseIndex(newIndex);
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0] as string;
    if (!baseImageForPoseChange) return;

    const token = beginGeneration('Changing pose…');
    if (!token) return;

    const prevPoseIndex = currentPoseIndex;
    const preSnap = studioRef.current;
    setCurrentPoseIndex(newIndex);

    try {
      const garmentId = currentLayer.garment?.id || 'base';
      const cacheKey = `pose_${user.id}_${garmentId}_${poseInstruction}`;
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction, cacheKey);
      if (token.cancelled) return;

      pushSnapshot(preSnap);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = { ...newHistory[currentOutfitIndex] };
        updatedLayer.poseImages = { ...updatedLayer.poseImages, [poseInstruction]: newImageUrl };
        newHistory[currentOutfitIndex] = updatedLayer;
        return newHistory;
      });

      await recordLook(newImageUrl, 'auto', poseInstruction);
    } catch (err) {
      if (!token.cancelled) {
        setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
        setCurrentPoseIndex(prevPoseIndex);
      }
    } finally {
      endGeneration(token);
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex, user, checkSubscription, beginGeneration, endGeneration, recordLook, pushSnapshot]);

  const viewVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="font-sans h-screen flex flex-col bg-gray-50 dark:bg-[#0b0d12]">
        {/* Screen-reader announcements for AI generation status */}
        <div aria-live="polite" className="sr-only">
            {isLoading ? (loadingMessage || 'Generating…') : error ? '' : 'Done'}
        </div>

        <div className="bg-white dark:bg-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center justify-between shadow-sm z-50">
            <button onClick={onBack} aria-label="Exit to dashboard" className="flex items-center min-h-[44px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                <ChevronLeftIcon className="w-5 h-5 mr-1" aria-hidden="true" />
                <span className="font-medium">Dashboard</span>
            </button>

            {!online && (
                <span className="hidden sm:inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full" role="status">
                    <WifiOffIcon className="w-3.5 h-3.5" aria-hidden="true" /> Offline — generations paused
                </span>
            )}

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    aria-label={`My Looks history, ${looksCount} saved`}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors duration-150"
                >
                    <HistoryIcon className="w-4 h-4" aria-hidden="true" />
                    My Looks
                    {looksCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">{looksCount}</span>
                    )}
                </button>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-full" title="Current subscription">
                    {user.plan === 'pro' ? '💎 Pro Plan' : 'Free Preview'}
                </span>
            </div>
        </div>

      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="flex-grow flex items-start sm:items-center justify-center p-4 pb-20 overflow-y-auto"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18 }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="flex-grow relative flex flex-col bg-white dark:bg-[#0b0d12] overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18 }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white dark:bg-[#0b0d12] pb-16 md:pb-0 relative">
                <Canvas
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onSaveOutfit={handleSaveOutfit}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={pastStack.length > 0}
                  canRedo={futureStack.length > 0}
                  onDropGarment={handleDropGarment}
                  onRetry={handleRetry}
                  onCancelGeneration={isLoading ? handleCancelGeneration : undefined}
                  onDownload={displayImageUrl ? handleDownload : undefined}
                  compareImageUrl={compareImageUrl}
                />
              </div>

              <aside
                aria-label="Styling panel"
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 dark:border-gray-700 transition-transform duration-200 ease-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
              >
                  <button
                    type="button"
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)}
                    aria-expanded={!isSheetCollapsed}
                    aria-label={isSheetCollapsed ? 'Expand styling panel' : 'Collapse styling panel'}
                    className="md:hidden w-full min-h-[44px] flex items-center justify-center bg-gray-100/60 dark:bg-gray-800/60"
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-5 pb-20 overflow-y-auto flex-grow flex flex-col gap-4">
                    {/* Error state with retry */}
                    {error && (
                      <div className="bg-red-50 dark:bg-red-950/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md" role="alert">
                          <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                  <AlertTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                                  <div>
                                      <p className="font-bold text-sm">Something went wrong</p>
                                      <p className="text-sm mt-0.5">{error}</p>
                                  </div>
                              </div>
                              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0">
                                  <XIcon className="w-4 h-4" />
                              </button>
                          </div>
                          {currentOutfitIndex > 0 && (
                              <button
                                  type="button"
                                  onClick={() => void handleRetry()}
                                  disabled={isLoading}
                                  className="mt-3 min-h-[44px] px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                              >
                                  Try Again
                              </button>
                          )}
                      </div>
                    )}
                    <OutfitStack
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                    />
                    <WardrobePanel
                      onGarmentSelect={handleGarmentSelect}
                      onGenerateColorways={setColorwayItem}
                      onShopSimilar={(item) => void openShopSimilar(item)}
                      activeGarmentIds={activeGarmentIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                      setWardrobe={setWardrobe}
                    />
                  </div>
              </aside>
            </main>

            {/* Shop Similar modal */}
            <Modal
                isOpen={isShoppingModalOpen}
                onClose={() => setIsShoppingModalOpen(false)}
                title="Shop Similar Items"
                size="lg"
            >
                {isShoppingLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500" role="status">
                        <Spinner />
                        <p className="mt-4 text-sm">Finding the best matches for you…</p>
                    </div>
                )}

                {!isShoppingLoading && shoppingError && (
                    <div className="text-center py-8" role="alert">
                        <SearchIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" aria-hidden="true" />
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{shoppingError}</p>
                        <button type="button" onClick={() => setIsShoppingModalOpen(false)} className="min-h-[44px] px-5 py-2 rounded-lg bg-gray-900 dark:bg-indigo-500 text-white text-sm font-semibold hover:bg-gray-700 dark:hover:bg-indigo-400 transition-colors">
                            Close
                        </button>
                    </div>
                )}

                {!isShoppingLoading && !shoppingError && shoppingResults.length > 0 && (
                    <ul className="space-y-3 list-none p-0 m-0">
                        {shoppingResults.map((result, idx) => (
                            <li key={idx}>
                                <a href={result.uri} target="_blank" rel="noopener noreferrer" className="block group p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-400 transition-colors duration-150">
                                    <div className="flex justify-between items-start gap-3">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{result.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{result.source || 'Online Store'}</p>
                                        </div>
                                        <ExternalLinkIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 shrink-0 mt-1" aria-hidden="true" />
                                    </div>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>

            {isLoading && isMobile && isSheetCollapsed && (
              <div className="fixed top-16 inset-x-0 z-40 flex justify-center pointer-events-none">
                <span className="bg-gray-900/90 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-fade-in" role="status">
                  {loadingMessage || 'Generating…'}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <MyLooksHistory
        isOpen={isHistoryOpen}
        onClose={() => { setIsHistoryOpen(false); void refreshLooksCount(); }}
        userId={user.id}
        onUseLook={applyLookAsModel}
      />

      {/* AI colorway picker for any wardrobe garment */}
      <ColorwayModal
        isOpen={!!colorwayItem}
        item={colorwayItem}
        onClose={() => setColorwayItem(null)}
        onSaveVariant={handleSaveColorwayVariant}
      />

      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default VirtualTryOn;
