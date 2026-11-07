import { create } from 'zustand';

interface EditorState {
  selectedSlideId: string | null;
  selectedElementId: string | null;
  zoom: number;
  isPlaying: boolean;
  activePanel: 'code' | 'preview' | 'properties';
  codeDirty: boolean;
  lastError: string | null;

  selectSlide: (id: string | null) => void;
  selectElement: (id: string | null) => void;
  setZoom: (z: number) => void;
  setPlaying: (v: boolean) => void;
  setActivePanel: (p: EditorState['activePanel']) => void;
  setCodeDirty: (v: boolean) => void;
  setLastError: (e: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedSlideId: null,
  selectedElementId: null,
  zoom: 1,
  isPlaying: false,
  activePanel: 'code',
  codeDirty: false,
  lastError: null,

  selectSlide: (id) => set({ selectedSlideId: id, selectedElementId: null }),
  selectElement: (id) => set({ selectedElementId: id }),
  setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.25, z)) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setActivePanel: (p) => set({ activePanel: p }),
  setCodeDirty: (v) => set({ codeDirty: v }),
  setLastError: (e) => set({ lastError: e }),
}));
