/** Renderer side of the desktop (Electron) integration. No-op in the browser. */
import { auth } from '@/services/api';

interface DesktopBridge {
  isDesktop: true;
  getToken: () => Promise<string | null>;
  info: () => Promise<{ version: string; dataDir: string; platform: string }>;
  openDataFolder: () => Promise<string>;
  onNavigate: (cb: (path: string) => void) => void;
  onOpenCode: (cb: (text: string, name: string) => void) => void;
}
declare global { interface Window { slidecraftDesktop?: DesktopBridge } }

export const desktop = typeof window !== 'undefined' ? window.slidecraftDesktop : undefined;
export const isDesktop = !!desktop?.isDesktop;

function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Sign in to the bundled local server and listen to menu commands. */
export async function initDesktop(): Promise<void> {
  if (!desktop) return;
  document.documentElement.dataset.desktop = 'true';
  try { const t = await desktop.getToken(); if (t) auth.token = t; } catch { /* keep working locally */ }
  desktop.onNavigate((p) => go(p));
  desktop.onOpenCode((text) => { sessionStorage.setItem('slidecraft.importDraft', text); if (window.location.pathname === '/import') window.location.reload(); else go('/import'); });
}
