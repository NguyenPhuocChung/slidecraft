/**
 * SlideCraft AI Studio — desktop (Electron) main process.
 * Starts the SlideCraft server in-process on 127.0.0.1 (file storage in the user's
 * app-data folder), signs in a local account automatically and opens the app window.
 */
import { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, type MenuItemConstructorOptions } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createApp } from '../server/index';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT_BASE = 47821; // fixed so the browser storage origin (IndexedDB) stays the same between launches
let port = PORT_BASE;
let server: Server | null = null;
let token: string | null = null;
let mainWindow: BrowserWindow | null = null;
const vi = !/^en/i.test(app.getLocale?.() ?? 'vi');
const L = (viText: string, en: string) => (vi ? viText : en);

if (!app.requestSingleInstanceLock()) app.quit();

function distDir(): string {
  const candidates = [path.join(HERE, '../dist'), path.join(process.resourcesPath ?? '', 'app.asar', 'dist'), path.join(process.resourcesPath ?? '', 'app', 'dist')];
  return candidates.find((d) => fs.existsSync(path.join(d, 'index.html'))) ?? candidates[0];
}

interface DesktopSettings { jwtSecret: string; password: string }
function settings(): DesktopSettings {
  const f = path.join(app.getPath('userData'), 'desktop.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) as DesktopSettings; } catch { /* first launch */ }
  const s = { jwtSecret: crypto.randomBytes(48).toString('hex'), password: crypto.randomBytes(24).toString('hex') };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(s), { mode: 0o600 });
  return s;
}

async function startServer(): Promise<void> {
  const s = settings();
  const data = path.join(app.getPath('userData'), 'data');
  process.env.NODE_ENV = 'production';
  const { app: http } = await createApp({
    jwtSecret: s.jwtSecret, dataDir: data, uploadDir: path.join(data, 'uploads'), mongoUri: undefined, rateLimit: false, env: 'production',
    corsOrigin: [`http://127.0.0.1:${PORT_BASE}`],
  });
  // serve the built web app (SPA) from the same origin
  const dist = distDir();
  const express = (await import('express')).default;
  http.use(express.static(dist, { index: false }));
  http.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const srv = http.listen(PORT_BASE + i, '127.0.0.1', () => { server = srv; port = PORT_BASE + i; resolve(); });
        srv.once('error', reject);
      });
      break;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e; }
  }
  if (!server) throw new Error('No free local port for the SlideCraft server');
  // local account (created once, then logged in on every launch)
  const base = `http://127.0.0.1:${port}/api/auth`;
  const body = JSON.stringify({ email: 'local@slidecraft.desktop', password: s.password, name: L('Người dùng máy này', 'Local user') });
  let r = await fetch(`${base}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!r.ok) r = await fetch(`${base}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  token = r.ok ? ((await r.json()) as { token: string }).token : null;
}

function send(channel: string, ...args: unknown[]) { (BrowserWindow.getFocusedWindow() ?? mainWindow)?.webContents.send(channel, ...args); }
const nav = (p: string) => send('desktop:navigate', p);

async function openCodeFile() {
  const r = await dialog.showOpenDialog({ title: L('Mở file code thuyết trình', 'Open presentation code'), properties: ['openFile'], filters: [{ name: 'SlideCraft', extensions: ['json', 'md', 'markdown', 'html', 'htm', 'tsx', 'jsx', 'js', 'ts', 'txt'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  const text = fs.readFileSync(r.filePaths[0], 'utf8');
  send('desktop:open-code', text, path.basename(r.filePaths[0]));
}

async function openPptxFile() {
  const r = await dialog.showOpenDialog({ title: L('Mở file PowerPoint', 'Open PowerPoint file'), properties: ['openFile'], filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppsx', 'potx'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  const file = r.filePaths[0];
  if (fs.statSync(file).size > 200 * 1024 * 1024) { void dialog.showMessageBox({ type: 'warning', message: L('File lớn hơn 200 MB.', 'The file is larger than 200 MB.') }); return; }
  send('desktop:open-pptx', new Uint8Array(fs.readFileSync(file)), path.basename(file));
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    { label: L('Tệp', 'File'), submenu: [
      { label: L('Bài thuyết trình mới', 'New presentation'), accelerator: 'CmdOrCtrl+N', click: () => nav('/?new=1') },
      { label: L('Mở file code…', 'Open code file…'), accelerator: 'CmdOrCtrl+O', click: () => void openCodeFile() },
      { label: L('Mở file PowerPoint…', 'Open PowerPoint file…'), accelerator: 'CmdOrCtrl+Shift+O', click: () => void openPptxFile() },
      { label: L('Nhập code từ AI', 'Import AI code'), accelerator: 'CmdOrCtrl+I', click: () => nav('/import') },
      { type: 'separator' },
      { label: L('Bảng điều khiển', 'Dashboard'), click: () => nav('/dashboard') },
      { label: L('Mở thư mục dữ liệu', 'Open data folder'), click: () => void shell.openPath(app.getPath('userData')) },
      { type: 'separator' },
      { role: 'quit', label: L('Thoát', 'Quit') },
    ] },
    { label: L('Sửa', 'Edit'), submenu: [
      { role: 'undo', label: L('Hoàn tác', 'Undo') }, { role: 'redo', label: L('Làm lại', 'Redo') }, { type: 'separator' },
      { role: 'cut', label: L('Cắt', 'Cut') }, { role: 'copy', label: L('Sao chép', 'Copy') }, { role: 'paste', label: L('Dán', 'Paste') }, { role: 'selectAll', label: L('Chọn tất cả', 'Select all') },
    ] },
    { label: L('Xem', 'View'), submenu: [
      { role: 'reload', label: L('Tải lại', 'Reload') }, { role: 'toggleDevTools', label: L('Công cụ nhà phát triển', 'Developer tools') }, { type: 'separator' },
      { role: 'resetZoom', label: L('Cỡ chữ mặc định', 'Actual size') }, { role: 'zoomIn', label: L('Phóng to', 'Zoom in') }, { role: 'zoomOut', label: L('Thu nhỏ', 'Zoom out') }, { type: 'separator' },
      { role: 'togglefullscreen', label: L('Toàn màn hình', 'Full screen') },
    ] },
    { label: L('Trợ giúp', 'Help'), submenu: [
      { label: L('Trung tâm Prompt', 'Prompt Center'), click: () => nav('/prompts') },
      { label: L('Tài liệu', 'Documentation'), click: () => nav('/docs') },
      { label: L('Phím tắt', 'Keyboard shortcuts'), click: () => nav('/docs/shortcuts') },
      { type: 'separator' },
      { label: L('Giới thiệu SlideCraft', 'About SlideCraft'), click: () => void dialog.showMessageBox({ type: 'info', title: 'SlideCraft AI Studio', message: `SlideCraft AI Studio ${app.getVersion()}`, detail: L(`Dữ liệu được lưu tại:\n${app.getPath('userData')}`, `Your data is stored in:\n${app.getPath('userData')}`) }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function isAppUrl(u: string) { return u.startsWith(`http://127.0.0.1:${port}/`); }

function createWindow(url = `http://127.0.0.1:${port}/`, opts: Electron.BrowserWindowConstructorOptions = {}) {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640, show: false, backgroundColor: '#0c0c14', title: 'SlideCraft AI Studio',
    autoHideMenuBar: true, // menu bar hidden; press Alt to show it (shortcuts keep working)
    icon: path.join(HERE, 'icon.png'),
    webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    ...opts,
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (isAppUrl(u)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 800, autoHideMenuBar: true, webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true } } };
    if (/^https?:|^mailto:/.test(u)) void shell.openExternal(u);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, u) => { if (!isAppUrl(u)) { e.preventDefault(); if (/^https?:/.test(u)) void shell.openExternal(u); } });
  void win.loadURL(url);
  return win;
}

app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { server?.close(); });

app.whenReady().then(async () => {
  ipcMain.handle('desktop:token', () => token);
  ipcMain.handle('desktop:info', () => ({ version: app.getVersion(), dataDir: app.getPath('userData'), platform: process.platform }));
  ipcMain.handle('desktop:open-data-folder', () => shell.openPath(app.getPath('userData')));
  // downloads (exports) always ask where to save
  session.defaultSession.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ title: L('Lưu file', 'Save file'), defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  // clipboard access for the in-app "Paste" menu item
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'media'].includes(perm)));
  try {
    await startServer();
  } catch (e) {
    dialog.showErrorBox('SlideCraft', `${L('Không khởi động được máy chủ nội bộ', 'Could not start the local server')}:\n${(e as Error).message}`);
    app.quit();
    return;
  }
  buildMenu();
  mainWindow = createWindow();
});
