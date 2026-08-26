/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fc-theme';
const listeners = new Set<(theme: Theme) => void>();

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage unavailable — fall through
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore persistence failures
  }
  applyThemeToDocument(theme);
  listeners.forEach((listener) => listener(theme));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function subscribeTheme(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#ffffff');
}
