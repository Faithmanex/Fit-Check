

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './StartScreen';
import Canvas from './Canvas';
import { WardrobePanel } from './WardrobeModal';
import OutfitStack from './OutfitStack';
import { generateVirtualTryOnImage, generatePoseVariation, generateColorway, findSimilarItems } from '../services/geminiService';
import { OutfitLayer, WardrobeItem, User, SavedOutfit, ShoppingResult } from '../types';
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ExternalLinkIcon, XIcon, SearchIcon } from './icons';
import { defaultWardrobe } from '../wardrobe';
import Footer from './Footer';
import { getFriendlyErrorMessage } from '../lib/utils';
import Spinner from './Spinner';
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

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', listener);
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }
    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};

interface VirtualTryOnProps {
    user: User;
    onBack: () => void;
    onUpgradeRequired: () => void;
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

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ user, onBack, onUpgradeRequired }) => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  
  // New States for Shopping
  const [shoppingResults, setShoppingResults] = useState<ShoppingResult[]>([]);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
  
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Load persistent model
  useEffect(() => {
      if (user.modelImage && !modelImageUrl) {
          setModelImageUrl(user.modelImage);
          setOutfitHistory([{
            garment: null,
            poseImages: { [POSE_INSTRUCTIONS[0]]: user.modelImage }
          }]);
      }
  }, [user.modelImage, modelImageUrl]);

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

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const checkSubscription = () => {
      if (user.plan === 'free' && user.subscriptionStatus !== 'active') {
          onUpgradeRequired();
          return false;
      }
      return true;
  };

  const handleModelFinalized = async (url: string) => {
    if (!checkSubscription()) return;
    setModelImageUrl(url);
    await db.updateUser(user.id, { modelImage: url });
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = async () => {
    setModelImageUrl(null);
    await db.updateUser(user.id, { modelImage: null });
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
  };

  const handleSaveOutfit = useCallback(async () => {
    if (!displayImageUrl) return;
    const garmentNames = activeOutfitLayers
      .map(layer => layer.garment?.name)
      .filter((name): name is string => !!name);

    const savedOutfit: SavedOutfit = {
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: displayImageUrl,
        date: new Date().toISOString(),
        garmentNames: garmentNames.length > 0 ? garmentNames : ['Base Model']
    };

    try {
        await db.saveOutfit(user.id, savedOutfit);
    } catch (e) {
        console.error("Failed to save outfit", e);
    }
  }, [displayImageUrl, activeOutfitLayers, user.id]);

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!checkSubscription()) return;
    if (!displayImageUrl || isLoading) return;

    // Duplicate check
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (currentLayer && currentLayer.garment?.id === garmentInfo.id) return;
    
    // Redo check
    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0);
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);

    try {
      // Create a cache key based on user, base pose index (usually 0 for fresh garment), and garment ID
      const cacheKey = `tryon_${user.id}_${garmentInfo.id}_${POSE_INSTRUCTIONS[currentPoseIndex]}`;

      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, garmentFile, cacheKey);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) return prev;
        return [garmentInfo, ...prev];
      });

    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex, user, checkSubscription]);

  // Auto-save
  useEffect(() => {
      if (currentOutfitIndex > 0 && outfitHistory[currentOutfitIndex]) {
          const timer = setTimeout(() => {
             handleSaveOutfit();
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [currentOutfitIndex, handleSaveOutfit]);

  const handleRetry = useCallback(async () => {
      if (!displayImageUrl || isLoading || currentOutfitIndex === 0) return;
      const currentLayer = outfitHistory[currentOutfitIndex];
      if (!currentLayer.garment) return; // Can't retry base model from here easily

      setError(null);
      setIsLoading(true);
      setLoadingMessage("Retrying generation...");

      try {
          // Get the garment file again
          const file = await urlToFile(currentLayer.garment.url, currentLayer.garment.name);
          // Get the *previous* image (the one we applied onto)
          const prevLayer = outfitHistory[currentOutfitIndex - 1];
          const prevImage = prevLayer.poseImages[POSE_INSTRUCTIONS[currentPoseIndex]] || Object.values(prevLayer.poseImages)[0];

          // Re-generate WITHOUT cache key to force fresh generation
          const newImageUrl = await generateVirtualTryOnImage(prevImage, file);
          
          // Replace current layer image
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

      } catch (err) {
          setError(getFriendlyErrorMessage(err, "Retry failed"));
      } finally {
          setIsLoading(false);
      }
  }, [displayImageUrl, isLoading, currentOutfitIndex, outfitHistory, currentPoseIndex]);

  const handleGenerateColorways = async (item: WardrobeItem) => {
      if (isLoading) return;
      setIsLoading(true);
      setLoadingMessage(`Creating variants for ${item.name}...`);
      try {
          // Generate 2 variants roughly
          const colors = ["a darker shade", "a lighter pastel shade"];
          for (const color of colors) {
             const variantUrl = await generateColorway(item.url, color);
             const variantItem: WardrobeItem = {
                 ...item,
                 id: item.id + '-var-' + Math.random().toString(36).substr(2, 5),
                 name: `${item.name} (${color.split(' ')[1]} variant)`,
                 url: variantUrl
             };
             setWardrobe(prev => [variantItem, ...prev]);
          }
      } catch(e) {
          setError("Failed to generate colorways.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleShopSimilar = async (item: WardrobeItem) => {
      setIsShoppingModalOpen(true);
      setShoppingResults([]); // clear previous
      try {
          const results = await findSimilarItems(item.url);
          setShoppingResults(results);
      } catch(e) {
          // Error handling for shop?
      }
  };

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };

  const handleUndo = () => {
      if (currentOutfitIndex > 0) {
          setCurrentOutfitIndex(prev => prev - 1);
          setCurrentPoseIndex(0);
      }
  };

  const handleRedo = () => {
      if (currentOutfitIndex < outfitHistory.length - 1) {
          setCurrentOutfitIndex(prev => prev + 1);
          setCurrentPoseIndex(0);
      }
  };

  const handleDropGarment = async (item: WardrobeItem) => {
      try {
          const file = await urlToFile(item.url, item.name);
          handleGarmentSelect(file, item);
      } catch (e) {
          console.error("Failed to process dropped item", e);
      }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (!checkSubscription()) return;
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    // If pose is already generated in this layer, use it (Fast switch)
    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0] as string;
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      // Create cache key for poses: user + outfitLayerId + poseInstruction
      // We use the garment ID in the current layer to identify the "Look"
      const garmentId = currentLayer.garment?.id || 'base';
      const cacheKey = `pose_${user.id}_${garmentId}_${poseInstruction}`;

      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction, cacheKey);
      
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = { ...newHistory[currentOutfitIndex] };
        updatedLayer.poseImages = { ...updatedLayer.poseImages, [poseInstruction]: newImageUrl };
        newHistory[currentOutfitIndex] = updatedLayer;
        return newHistory;
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex, user, checkSubscription]);

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-50">
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                <ChevronLeftIcon className="w-5 h-5 mr-1" />
                <span className="font-medium">Exit to Dashboard</span>
            </button>
            <div className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-full">
                {user.plan === 'pro' ? '💎 Pro Plan' : 'Free Preview'}
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
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="flex-grow relative flex flex-col bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
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
                  canUndo={currentOutfitIndex > 0}
                  canRedo={currentOutfitIndex < outfitHistory.length - 1}
                  onDropGarment={handleDropGarment}
                  onRetry={handleRetry}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-4">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                    />
                    <WardrobePanel
                      onGarmentSelect={handleGarmentSelect}
                      onGenerateColorways={handleGenerateColorways}
                      onShopSimilar={handleShopSimilar}
                      activeGarmentIds={activeGarmentIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                      setWardrobe={setWardrobe}
                    />
                  </div>
              </aside>
            </main>

            {/* Shopping Modal */}
            <AnimatePresence>
                {isShoppingModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsShoppingModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-serif font-bold">Shop Similar Items</h3>
                                <button onClick={() => setIsShoppingModalOpen(false)}><XIcon className="w-6 h-6 text-gray-400"/></button>
                            </div>
                            
                            {shoppingResults.length > 0 ? (
                                <div className="space-y-4">
                                    {shoppingResults.map((result, idx) => (
                                        <a href={result.uri} target="_blank" rel="noopener noreferrer" key={idx} className="block group p-4 border rounded-xl hover:border-indigo-300 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-gray-900 group-hover:text-indigo-600">{result.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{result.source || 'Online Store'}</p>
                                                </div>
                                                <ExternalLinkIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <SearchIcon className="w-12 h-12 mb-4 opacity-20"/>
                                    <p>Finding the best matches for you...</p>
                                    <Spinner />
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
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
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default VirtualTryOn;
