/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SparklesCore } from "./sparkles";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { DotsVerticalIcon } from "../icons";
import { usePrefersReducedMotion } from "../../lib/hooks";

interface CompareProps {
  firstImage?: string;
  secondImage?: string;
  className?: string;
  firstImageClassName?: string;
  secondImageClassname?: string;
  initialSliderPercentage?: number;
  slideMode?: "hover" | "drag";
  showHandlebar?: boolean;
  autoplay?: boolean;
  autoplayDuration?: number;
  /** Accessible name for the "before" (left) image. */
  firstLabel?: string;
  /** Accessible name for the "after" (right) image. */
  secondLabel?: string;
  /** Accessible name for the slider control itself. */
  sliderLabel?: string;
}

const KEYBOARD_STEP = 5;

export const Compare = ({
  firstImage = "",
  secondImage = "",
  className,
  firstImageClassName,
  secondImageClassname,
  initialSliderPercentage = 50,
  slideMode = "hover",
  showHandlebar = true,
  autoplay = false,
  autoplayDuration = 5000,
  firstLabel = "Before",
  secondLabel = "After",
  sliderLabel = "Before and after comparison slider. Use Left and Right arrow keys to move the divider.",
}: CompareProps) => {
  const [sliderXPercent, setSliderXPercent] = useState(initialSliderPercentage);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // FIX: Use ReturnType<typeof setTimeout> for browser compatibility instead of NodeJS.Timeout
  const autoplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoplay = useCallback(() => {
    if (!autoplay || prefersReducedMotion) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress =
        (elapsedTime % (autoplayDuration * 2)) / autoplayDuration;
      const percentage = progress <= 1 ? progress * 100 : (2 - progress) * 100;

      setSliderXPercent(percentage);
      autoplayRef.current = setTimeout(animate, 16); // ~60fps
    };

    animate();
  }, [autoplay, autoplayDuration, prefersReducedMotion]);

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearTimeout(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoplay();
    return () => stopAutoplay();
  }, [startAutoplay, stopAutoplay]);

  function mouseEnterHandler() {
    setIsMouseOver(true);
    stopAutoplay();
  }

  function mouseLeaveHandler() {
    setIsMouseOver(false);
    if (slideMode === "hover") {
      setSliderXPercent(initialSliderPercentage);
    }
    if (slideMode === "drag") {
      setIsDragging(false);
    }
    startAutoplay();
  }

  const handleStart = useCallback(
    (_clientX: number) => {
      if (slideMode === "drag") {
        setIsDragging(true);
      }
    },
    [slideMode]
  );

  const handleEnd = useCallback(() => {
    if (slideMode === "drag") {
      setIsDragging(false);
    }
  }, [slideMode]);

  const setPercentFromClientX = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    requestAnimationFrame(() => {
      setSliderXPercent(Math.max(0, Math.min(100, percent)));
    });
  }, []);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;
      if (slideMode === "hover" || (slideMode === "drag" && isDragging)) {
        setPercentFromClientX(clientX);
      }
    },
    [slideMode, isDragging, setPercentFromClientX]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => handleStart(e.clientX),
    [handleStart]
  );
  const handleMouseUp = useCallback(() => handleEnd(), [handleEnd]);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => handleMove(e.clientX),
    [handleMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!autoplay) {
        handleStart(e.touches[0].clientX);
      }
    },
    [handleStart, autoplay]
  );

  const handleTouchEnd = useCallback(() => {
    if (!autoplay) {
      handleEnd();
    }
  }, [handleEnd, autoplay]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!autoplay) {
        handleMove(e.touches[0].clientX);
      }
    },
    [handleMove, autoplay]
  );

  // Keyboard support: the divider is a WAI-ARIA slider.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = Math.max(0, sliderXPercent - KEYBOARD_STEP);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = Math.min(100, sliderXPercent + KEYBOARD_STEP);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 100;
          break;
        default:
          return;
      }
      e.preventDefault();
      stopAutoplay();
      setSliderXPercent(next);
    },
    [sliderXPercent, stopAutoplay]
  );

  const roundedPercent = Math.round(sliderXPercent);

  return (
    <div
      ref={sliderRef}
      className={cn(
        "w-[400px] h-[400px] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        isFocused && "ring-2 ring-indigo-500 ring-offset-0",
        className
      )}
      style={{
        position: "relative",
        cursor: slideMode === "drag" ? (isDragging ? "grabbing" : "grab") : "col-resize",
      }}
      role="slider"
      aria-label={sliderLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={roundedPercent}
      aria-valuetext={`${roundedPercent}% showing ${firstLabel}, rest showing ${secondLabel}`}
      aria-orientation="horizontal"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onMouseMove={handleMouseMove}
      onMouseLeave={mouseLeaveHandler}
      onMouseEnter={mouseEnterHandler}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <AnimatePresence initial={false}>
        <motion.div
          className="w-px h-full absolute top-0 m-auto z-30"
          style={{
            left: `${sliderXPercent}%`,
            top: "0",
            zIndex: 40,
          }}
          transition={{ duration: 0 }}
        >
          <div className="absolute top-0 bottom-0 -translate-x-1/2 w-[2px] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
          <div className="w-36 h-full [mask-image:radial-gradient(100px_at_left,white,transparent)] absolute top-1/2 -translate-y-1/2 left-0 bg-gradient-to-r from-indigo-400 via-transparent to-transparent z-20 opacity-50" />
          <div className="w-10 h-1/2 [mask-image:radial-gradient(50px_at_left,white,transparent)] absolute top-1/2 -translate-y-1/2 left-0 bg-gradient-to-r from-cyan-400 via-transparent to-transparent z-10 opacity-100" />
          {!prefersReducedMotion && (
            <div className="w-10 h-3/4 top-1/2 -translate-y-1/2 absolute -right-10 [mask-image:radial-gradient(100px_at_left,white,transparent)]">
              <MemoizedSparklesCore
                background="transparent"
                minSize={0.4}
                maxSize={1}
                particleDensity={1200}
                className="w-full h-full"
                particleColor="#FFFFFF"
              />
            </div>
          )}
          {showHandlebar && (
            <div className="h-5 w-5 rounded-md top-1/2 -translate-y-1/2 bg-white z-30 -right-2.5 absolute flex items-center justify-center border border-gray-300/80">
              <DotsVerticalIcon className="h-4 w-4 text-black" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="overflow-hidden w-full h-full relative z-20 pointer-events-none">
        <AnimatePresence initial={false}>
          {firstImage ? (
            <motion.div
              className={cn(
                "absolute inset-0 z-20 rounded-2xl shrink-0 w-full h-full select-none overflow-hidden",
                firstImageClassName
              )}
              style={{
                clipPath: `inset(0 ${100 - sliderXPercent}% 0 0)`,
              }}
              transition={{ duration: 0 }}
            >
              <img
                alt={firstLabel}
                src={firstImage}
                className={cn(
                  "absolute inset-0  z-20 rounded-2xl shrink-0 w-full h-full select-none object-cover",
                  firstImageClassName
                )}
                draggable={false}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {secondImage ? (
          <motion.img
            className={cn(
              "absolute top-0 left-0 z-[19]  rounded-2xl w-full h-full select-none object-cover",
              secondImageClassname
            )}
            alt={secondLabel}
            src={secondImage}
            draggable={false}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const MemoizedSparklesCore = React.memo(SparklesCore);
