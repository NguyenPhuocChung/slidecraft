import { useEffect } from 'react';
import { THEME_FONTS } from '@/themes/themes';

const loaded = new Set<string>(['Inter', 'JetBrains Mono']);
const SYSTEM = new Set(['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Calibri', 'Segoe UI', 'Courier New', 'Verdana', 'Tahoma', 'system-ui']);

/** Load Google Fonts (with Vietnamese subsets) for the given families. Safe offline: failures fall back to system fonts. */
export function loadFonts(families: (string | undefined)[]): void {
  if (typeof document === 'undefined') return;
  const todo = [...new Set(families.filter((f): f is string => !!f && !f.startsWith('$') && !loaded.has(f) && !SYSTEM.has(f)))];
  if (!todo.length) return;
  todo.forEach((f) => loaded.add(f));
  const q = todo.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700`).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${q}&display=swap&subset=vietnamese`;
  link.onerror = () => {
    // some families don't have every weight — retry with the default weight set
    const l2 = document.createElement('link');
    l2.rel = 'stylesheet';
    l2.href = `https://fonts.googleapis.com/css2?${todo.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&')}&display=swap`;
    document.head.appendChild(l2);
  };
  document.head.appendChild(link);
}

export function useFonts(families: (string | undefined)[]) {
  const key = families.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadFonts(families), [key]);
}

export function preloadThemeFonts() { loadFonts(THEME_FONTS); }
