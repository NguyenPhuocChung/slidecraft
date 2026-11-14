import { COMMON } from './common';
import { EDITOR } from './editor';
import { PAGES } from './pages';
import { REGISTRY } from './registry';
import { PPTXIMPORT } from './pptximport';

/** Vietnamese dictionary — English source string → Vietnamese. */
export const VI: Record<string, string> = { ...REGISTRY, ...COMMON, ...PAGES, ...EDITOR, ...PPTXIMPORT };
