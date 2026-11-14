/**
 * Lightweight i18n. English source strings are the keys, so untranslated text
 * falls back to English. Vietnamese dictionaries live in ./vi/*.ts (one per area).
 *
 *   const t = useT();          // in components (re-renders on language change)
 *   t('Add slide')             // → "Thêm slide"
 *   t('{n} slides', { n: 3 })  // interpolation with {name}
 *   tr('Add slide')            // outside React (toasts, helpers)
 */
import { create } from 'zustand';
import { VI } from './vi';
import { translateMessage } from './messages';

export type Lang = 'vi' | 'en';
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'vi', label: 'Tiếng Việt', flag: 'VI' },
  { id: 'en', label: 'English', flag: 'EN' },
];
const KEY = 'slidecraft.lang';

function initial(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'vi' || s === 'en') return s;
  } catch { /* ignore */ }
  if (typeof navigator !== 'undefined' && /^en/i.test(navigator.language)) return 'en';
  return 'vi';
}

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: typeof window === 'undefined' ? 'en' : initial(),
  setLang: (lang) => {
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    set({ lang });
  },
}));
if (typeof document !== 'undefined') document.documentElement.lang = useLang.getState().lang;

export type Vars = Record<string, string | number | undefined>;
function fill(s: string, vars?: Vars): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k]))) : s;
}

/** Translate outside React. */
export function tr(s: string, vars?: Vars): string {
  if (useLang.getState().lang === 'en') return fill(s, vars);
  return fill(VI[s] ?? s, vars);
}
/** Translate a generated message (validator / export / quality) via patterns. */
export function trMsg(s: string): string {
  if (useLang.getState().lang === 'en') return s;
  return VI[s] ?? translateMessage(s);
}

/** Hook: returns t() bound to the current language (component re-renders on change). */
export function useT() {
  const lang = useLang((s) => s.lang);
  return (s: string, vars?: Vars) => fill(lang === 'en' ? s : VI[s] ?? s, vars);
}
