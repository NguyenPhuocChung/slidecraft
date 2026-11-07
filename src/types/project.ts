import type { SlideDocument } from './slide';

export interface ProjectFile {
  id: string;
  path: string;
  name: string;
  language: 'tsx' | 'jsx' | 'ts' | 'js' | 'css' | 'json' | 'other';
  content: string;
  isEntry?: boolean;
}

export interface ProjectAsset {
  id: string;
  name: string;
  mimeType: string;
  /** Base64 or blob key in IndexedDB */
  dataKey: string;
  size: number;
  createdAt: string;
}

export interface ProjectSettings {
  theme?: 'dark' | 'light';
  autoSave?: boolean;
  allowlist?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  files: ProjectFile[];
  slideDocument: SlideDocument | null;
  /** Visual overrides applied on top of measured/contract elements */
  overrides?: Record<string, Partial<import('./element').SlideElement>>;
  assets: ProjectAsset[];
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  version: number;
  thumbnailDataUrl?: string;
  status: 'draft' | 'ready' | 'error';
  slideCount: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  slideCount: number;
  updatedAt: string;
  createdAt: string;
  status: Project['status'];
  thumbnailDataUrl?: string;
}

/** Allowed packages that the sandbox may resolve */
export const DEPENDENCY_ALLOWLIST = [
  'react',
  'react-dom',
  'lucide-react',
  'framer-motion',
  'recharts',
  'clsx',
  'class-variance-authority',
] as const;
