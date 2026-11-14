import { COMMON } from './common';
import { EDITOR } from './editor';
import { PAGES } from './pages';
import { REGISTRY } from './registry';

/** Vietnamese dictionary — English source string → Vietnamese. */
export const VI: Record<string, string> = { ...REGISTRY, ...COMMON, ...PAGES, ...EDITOR };
