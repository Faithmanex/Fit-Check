/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

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

export const usePrefersReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');

export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
};
