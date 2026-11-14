import { isDesktop } from '@/desktop';
import { Link } from 'react-router-dom';
import { tr } from '@/i18n';
import { Undo2, Redo2, ZoomIn, ZoomOut, Palette, Sparkles, Eye, Play, Download, Share2, Settings, Cloud, CloudOff, Check, Loader2, AlertTriangle, History, ShieldCheck, ChevronDown, Moon, Sun } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { useUiTheme } from '@/hooks/useUiTheme';
import { Button, IconButton, MenuButton, Popover, cx } from '@/components/ui';
import { LanguageSwitch } from '@/components/LanguageSwitch';

export interface TopBarActions { preview: () => void; present: (mode?: string) => void; exportOpen: () => void; share: () => void; settings: () => void; versions: () => void; quality: () => void }

function SaveStatus() {
  const s = useEditor((x) => x.saveStatus);
  const err = useEditor((x) => x.saveError);
  const meta = useEditor((x) => x.meta);
  const map = {
    saved: { icon: meta?.cloudId ? <Cloud size={13} /> : <Check size={13} />, text: meta?.cloudId ? (isDesktop ? tr('Saved to this computer') : tr('Saved to cloud')) : tr('Saved'), cls: 'text-ink-400' },
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: tr('Saving…'), cls: 'text-ink-400' },
    unsaved: { icon: <Loader2 size={13} className="opacity-40" />, text: tr('Unsaved changes'), cls: 'text-ink-400' },
    offline: { icon: <CloudOff size={13} />, text: tr('Saved locally'), cls: 'text-amber-600' },
    error: { icon: <AlertTriangle size={13} />, text: tr('Save failed'), cls: 'text-red-600' },
  }[s];
  return <span className={cx('flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px]', map.cls)} title={err ?? map.text} data-testid="save-status" data-status={s}>{map.icon}{map.text}</span>;
}

export function TopBar({ a }: { a: TopBarActions }) {
  const doc = useEditor((s) => s.doc)!;
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undoLabel = useEditor((s) => s.past[s.past.length - 1]?.label);
  const zoom = useEditor((s) => s.zoom);
  const fit = useEditor((s) => (s as unknown as { fitScale?: number }).fitScale ?? 0.5);
  const st = useEditor.getState;
  const ui = useUiTheme();
  const z = zoom || fit;
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-ink-200 bg-white px-2 dark:border-ink-800 dark:bg-ink-900">
      <Link to="/dashboard" className="mr-1 flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-ink-100 dark:hover:bg-ink-800" title={tr('Back to dashboard')}>
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="mr-2 hidden text-sm font-bold tracking-tight lg:inline">{tr('SlideCraft')}</span>
      </Link>
      <input className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-ink-200 focus:border-brand-500 dark:hover:border-ink-700" value={doc.title} onChange={(e) => st().transient((d) => { d.title = e.target.value; })} onFocus={() => st().beginTransient()} onBlur={() => st().endTransient('Rename')} aria-label={tr('Presentation title')} data-testid="title-input" />
      <SaveStatus />
      <div className="mx-2 h-6 w-px bg-ink-200 dark:bg-ink-800" />
      <IconButton title={`${tr('Undo')}${undoLabel ? `: ${tr(undoLabel)}` : ''} (Ctrl+Z)`} disabled={!canUndo} onClick={() => st().undo()} data-testid="undo"><Undo2 size={16} /></IconButton>
      <IconButton title={tr('Redo (Ctrl+Y)')} disabled={!canRedo} onClick={() => st().redo()} data-testid="redo"><Redo2 size={16} /></IconButton>
      <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-800" />
      <IconButton title={tr('Zoom out')} onClick={() => st().set({ zoom: Math.max(0.05, z / 1.2) })}><ZoomOut size={16} /></IconButton>
      <Popover width={150} trigger={(_o, t) => <button onClick={t} className="min-w-14 whitespace-nowrap rounded-md px-1.5 py-1 text-center text-xs tabular-nums hover:bg-ink-100 dark:hover:bg-ink-800" data-testid="zoom-level">{zoom ? `${Math.round(z * 100)}%` : tr('Fit')}</button>}>
        {(close) => <>{[0, 0.25, 0.5, 0.75, 1, 1.5, 2].map((v) => <MenuButton key={v} onClick={() => { st().set({ zoom: v }); close(); }}>{v === 0 ? tr('Fit to screen') : `${v * 100}%`}</MenuButton>)}</>}
      </Popover>
      <IconButton title={tr('Zoom in')} onClick={() => st().set({ zoom: Math.min(4, z * 1.2) })}><ZoomIn size={16} /></IconButton>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" icon={<Palette size={14} />} onClick={() => st().set({ leftTab: 'themes' })}>{tr('Theme')}</Button>
      <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={() => st().set({ rightTab: 'animate', timelineOpen: true })} data-testid="topbar-animation">{tr('Animation')}</Button>
      <IconButton title={tr('Quality check')} onClick={a.quality}><ShieldCheck size={16} /></IconButton>
      <IconButton title={tr('Version history')} onClick={a.versions}><History size={16} /></IconButton>
      <IconButton title={ui.mode === 'dark' ? tr('Light mode') : tr('Dark mode')} onClick={ui.toggle}>{ui.mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton>
      <LanguageSwitch compact />
      <IconButton title={tr('Settings & shortcuts')} onClick={a.settings} data-testid="settings"><Settings size={16} /></IconButton>
      <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-800" />
      <Button size="sm" icon={<Eye size={14} />} onClick={a.preview} data-testid="preview">{tr('Preview')}</Button>
      <div className="flex">
        <Button size="sm" variant="primary" className="rounded-r-none" icon={<Play size={14} />} onClick={() => a.present()} data-testid="present">{tr('Present')}</Button>
        <Popover align="right" width={220} trigger={(_o, t) => <Button size="sm" variant="primary" className="rounded-l-none border-l border-white/20 px-1.5" onClick={t} aria-label={tr('Presentation modes')}><ChevronDown size={14} /></Button>}>
          {(close) => <>
            <MenuButton onClick={() => { a.present('normal'); close(); }}>{tr('Present from current slide')}</MenuButton>
            <MenuButton onClick={() => { a.present('presenter'); close(); }}>{tr('Presenter view (notes, timer)')}</MenuButton>
            <MenuButton onClick={() => { a.present('audience'); close(); }}>{tr('Audience window')}</MenuButton>
            <MenuButton onClick={() => { a.present('rehearsal'); close(); }}>{tr('Rehearse timings')}</MenuButton>
          </>}
        </Popover>
      </div>
      <Button size="sm" icon={<Download size={14} />} onClick={a.exportOpen} data-testid="export">{tr('Export')}</Button>
      <Button size="sm" variant="ghost" icon={<Share2 size={14} />} onClick={a.share}>{tr('Share')}</Button>
    </header>
  );
}
