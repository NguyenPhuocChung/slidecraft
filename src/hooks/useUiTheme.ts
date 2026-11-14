import { create } from 'zustand';

type Mode = 'light' | 'dark';
const initial = (): Mode => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');
export const useUiTheme = create<{ mode: Mode; toggle: () => void; set: (m: Mode) => void }>((set, get) => ({
  mode: initial(),
  set: (m) => { document.documentElement.classList.toggle('dark', m === 'dark'); try { localStorage.setItem('slidecraft.uiTheme', m); } catch { /* ignore */ } set({ mode: m }); },
  toggle: () => get().set(get().mode === 'dark' ? 'light' : 'dark'),
}));
