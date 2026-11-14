// Preload (sandboxed): a tiny, explicit bridge — no Node APIs are exposed to the page.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('slidecraftDesktop', {
  isDesktop: true,
  getToken: (): Promise<string | null> => ipcRenderer.invoke('desktop:token'),
  info: (): Promise<{ version: string; dataDir: string; platform: string }> => ipcRenderer.invoke('desktop:info'),
  openDataFolder: (): Promise<string> => ipcRenderer.invoke('desktop:open-data-folder'),
  onNavigate: (cb: (path: string) => void) => { ipcRenderer.on('desktop:navigate', (_e, p: string) => cb(p)); },
  onOpenCode: (cb: (text: string, name: string) => void) => { ipcRenderer.on('desktop:open-code', (_e, t: string, n: string) => cb(t, n)); },
  onOpenPptx: (cb: (bytes: Uint8Array, name: string) => void) => { ipcRenderer.on('desktop:open-pptx', (_e, b: Uint8Array, n: string) => cb(b, n)); },
});
