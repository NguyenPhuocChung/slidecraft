/** Renderer side of the desktop (Electron) integration. No-op in the browser. */
import { auth } from '@/services/api';
import { toast } from '@/components/ui';
import { tr } from '@/i18n';

interface DesktopBridge {
  isDesktop: true;
  getToken: () => Promise<string | null>;
  info: () => Promise<{ version: string; dataDir: string; platform: string }>;
  openDataFolder: () => Promise<string>;
  onNavigate: (cb: (path: string) => void) => void;
  onOpenCode: (cb: (text: string, name: string) => void) => void;
  onOpenPptx?: (cb: (bytes: Uint8Array, name: string) => void) => void;
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
  desktop.onNavigate((p) => (p === 'donate' ? window.dispatchEvent(new Event('slidecraft:donate')) : go(p)));
  desktop.onOpenPptx?.((bytes, name) => {
    toast.info(tr('Importing {name}…', { name }));
    void (async () => {
      try {
        const { importPptxAsProject, trPptx } = await import('@/services/pptxImport');
        const { saved, report } = await importPptxAsProject(bytes, name);
        toast.success(tr('Imported “{title}” — {n} slides', { title: saved.title, n: saved.slides.length }));
        if (report.warnings.length) toast.warning(tr('Imported with {n} warnings — see the import report.', { n: report.warnings.length }) + ' ' + report.warnings.slice(0, 2).map(trPptx).join(' · '));
        go(`/editor/${saved.id}`);
      } catch (e) {
        const { trPptx } = await import('@/services/pptxImport');
        toast.error(tr('PowerPoint import failed: {msg}', { msg: trPptx((e as Error).message) }));
      }
    })();
  });
  desktop.onOpenCode((text) => { sessionStorage.setItem('slidecraft.importDraft', text); if (window.location.pathname === '/import') window.location.reload(); else go('/import'); });
}
