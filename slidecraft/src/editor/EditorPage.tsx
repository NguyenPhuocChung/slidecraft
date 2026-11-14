import { useCallback, useEffect, useMemo, useState } from 'react';
import { tr } from '@/i18n';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, LayoutTemplate, ListTree, Palette, Images, FolderOpen, GalleryVerticalEnd } from 'lucide-react';
import { useEditor, flushSave } from '@/stores/editor';
import { useLang } from '@/i18n';
import { storage } from '@/services/storage';
import { useFonts } from '@/hooks/useFonts';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';
import { presentationTheme } from '@/slides/SlideRenderer';
import { Canvas } from '@/canvas/Canvas';
import { Tabs, cx } from '@/components/ui';
import { AnimationPanel } from '@/animation/AnimationPanel';
import { AnimationTimeline } from '@/animation/Timeline';
import { TransitionPanel } from '@/transitions/TransitionPanel';
import { PreviewModal } from '@/presentation/PreviewModal';
import { QualityPanel } from './QualityPanel';
import { SlidesPanel } from './SlidesPanel';
import { AssetsPanel, LayersPanel, MediaPanel, OutlinePanel, TemplatesPanel, ThemesPanel } from './LeftPanels';
import { PropertiesPanel } from './properties/PropertiesPanel';
import { LayoutAssistantPanel } from './LayoutAssistantPanel';
import { TopBar } from './TopBar';
import { InsertBar } from './InsertBar';
import { ChartDataEditor } from './dialogs/ChartDataEditor';
import { MediaPicker } from './dialogs/MediaPicker';
import { SettingsDialog, ShareDialog, VersionsDialog } from './dialogs/EditorDialogs';
import { ExportDialog } from './dialogs/ExportDialog';

const LEFT_TABS = [
  { id: 'slides', label: 'Slides', icon: GalleryVerticalEnd }, { id: 'outline', label: 'Outline', icon: ListTree }, { id: 'assets', label: 'Assets (rail)', icon: FolderOpen },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate }, { id: 'themes', label: 'Themes', icon: Palette }, { id: 'media', label: 'Media (rail)', icon: Images }, { id: 'layers', label: 'Layers', icon: Layers },
] as const;

export default function EditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const doc = useEditor((s) => s.doc);
  const leftTab = useEditor((s) => s.leftTab);
  const rightTab = useEditor((s) => s.rightTab);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const lang = useLang((s) => s.lang);
  /** short UI labels: Vietnamese abbreviation, English original */
  const short = (key: string, en: string) => (lang === 'en' ? en : tr(key));
  const [notFound, setNotFound] = useState(false);
  const [chartId, setChartId] = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<string | 'new' | null>(null);
  const [dialog, setDialog] = useState<null | 'export' | 'share' | 'settings' | 'versions'>(null);
  const [preview, setPreview] = useState(false);
  const st = useEditor.getState;

  useEffect(() => {
    let alive = true;
    const cur = useEditor.getState().doc;
    if (cur?.id === id) return;
    void (async () => {
      const p = await storage.load(id!);
      if (!alive) return;
      if (!p) { setNotFound(true); return; }
      useEditor.getState().load(p, (await storage.getMeta(id!)) ?? null);
    })();
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (useEditor.getState().saveStatus === 'unsaved' || useEditor.getState().saveStatus === 'saving') { flushSave(); e.preventDefault(); } };
    window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('beforeunload', before); flushSave(); };
  }, []);
  const theme = useMemo(() => (doc ? presentationTheme(doc) : null), [doc]);
  const fonts = useMemo(() => {
    if (!doc || !theme) return [];
    const f = new Set<string>([theme.fonts.heading, theme.fonts.body, theme.fonts.mono]);
    doc.slides.forEach((s) => { if (s.theme) { const t = presentationTheme(doc, s); f.add(t.fonts.heading); f.add(t.fonts.body); } s.elements.forEach((e) => { if (e.style?.fontFamily) f.add(e.style.fontFamily); }); });
    return [...f];
  }, [doc, theme]);
  useFonts(fonts);
  useEffect(() => { if (doc) document.title = `${doc.title} — SlideCraft`; }, [doc]);

  const present = useCallback((mode = 'normal') => {
    const s = st();
    if (!s.doc) return;
    flushSave();
    const visible = s.doc.slides.filter((x) => !x.hidden);
    const startIdx = Math.max(0, visible.findIndex((x) => x.id === s.currentSlideId));
    if (mode === 'presenter') { window.open(`/present/${s.doc.id}?mode=audience&start=${startIdx}`, `audience-${s.doc.id}`); nav(`/present/${s.doc.id}?mode=presenter&start=${startIdx}`); return; }
    if (mode === 'audience') { window.open(`/present/${s.doc.id}?mode=audience&start=${startIdx}`, `audience-${s.doc.id}`); return; }
    nav(`/present/${s.doc.id}?mode=${mode}&start=${startIdx}`);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, [nav, st]);
  const handlers = useMemo(() => ({ present: () => present(), save: () => { void st().save({ snapshot: true, label: tr('Manual save') }); } }), [present, st]);
  useEditorShortcuts(handlers);

  if (notFound) return <div className="flex h-full flex-col items-center justify-center gap-3"><p className="text-ink-500">{tr('This presentation was not found on this device.')}</p><button className="text-brand-600 underline" onClick={() => nav('/dashboard')}>{tr('Go to dashboard')}</button></div>;
  if (!doc || doc.id !== id) return <div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;
  const currentIndex = doc.slides.findIndex((s) => s.id === currentSlideId);

  return (
    <div key={lang} className="flex h-full flex-col overflow-hidden bg-white text-ink-900 dark:bg-ink-900 dark:text-ink-100" data-testid="editor">
      <TopBar a={{ preview: () => setPreview(true), present, exportOpen: () => setDialog('export'), share: () => setDialog('share'), settings: () => setDialog('settings'), versions: () => setDialog('versions'), quality: () => st().set({ rightTab: 'quality' }) }} />
      <InsertBar onPickImage={() => setImageTarget('new')} />
      <div className="flex min-h-0 flex-1">
        {/* Left */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-ink-200 bg-ink-50/60 py-2 dark:border-ink-800 dark:bg-ink-950/40">
          {LEFT_TABS.map((t) => (
            <button key={t.id} title={t.label} onClick={() => st().set({ leftTab: t.id })} className={cx('flex w-12 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9.5px] font-medium', leftTab === t.id ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-800 dark:text-brand-300' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')} data-testid={`left-${t.id}`}>
              <t.icon size={17} />{short(t.label, t.label.replace(/ \(rail\)$/, ''))}
            </button>
          ))}
        </nav>
        <aside className="w-[260px] shrink-0 border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          {leftTab === 'slides' && <SlidesPanel />}
          {leftTab === 'outline' && <OutlinePanel />}
          {leftTab === 'assets' && <AssetsPanel />}
          {leftTab === 'templates' && <TemplatesPanel />}
          {leftTab === 'themes' && <ThemesPanel />}
          {leftTab === 'media' && <MediaPanel />}
          {leftTab === 'layers' && <LayersPanel />}
        </aside>
        {/* Center */}
        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas onOpenChartEditor={setChartId} onReplaceImage={(eid) => setImageTarget(eid)} />
          {timelineOpen && <AnimationTimeline />}
          <div className="flex h-7 shrink-0 items-center gap-3 border-t border-ink-200 px-3 text-[11px] text-ink-500 dark:border-ink-800">
            <span>{tr('Slide {n} of {total}', { n: currentIndex + 1, total: doc.slides.length })}</span>
            <span>{doc.size.width}×{doc.size.height} · {doc.aspectRatio}</span>
            <span>{tr('Theme')}: {tr(theme?.name ?? '')}</span>
            <div className="flex-1" />
            <button className="hover:text-ink-800 dark:hover:text-ink-200" onClick={() => st().set({ timelineOpen: !timelineOpen })}>{timelineOpen ? tr('Hide timeline') : tr('Show timeline')}</button>
          </div>
        </main>
        {/* Right */}
        <aside className="flex w-[316px] shrink-0 flex-col border-l border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <div className="p-2"><Tabs value={rightTab as 'design'} onChange={(v) => st().set({ rightTab: v })} tabs={[{ id: 'design', label: <span className="-mx-1 whitespace-nowrap text-[11px]">{tr('Design')}</span>, title: tr('Design') }, { id: 'animate', label: <span className="-mx-1 whitespace-nowrap text-[11px]">{tr('Animate')}</span>, title: tr('Animate') }, { id: 'transition', label: <span className="-mx-1 whitespace-nowrap text-[11px]">{short('Transition (tab)', 'Transition')}</span>, title: tr('Transition') }, { id: 'layout', label: <span className="-mx-1 whitespace-nowrap text-[11px]">{tr('Layout')}</span>, title: tr('Layout') }, { id: 'quality', label: <span className="-mx-1 whitespace-nowrap text-[11px]">{short('Quality (tab)', 'Quality')}</span>, title: tr('Quality') }] as unknown as { id: 'design'; label: string }[]} /></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === 'design' && <PropertiesPanel onOpenChartEditor={setChartId} onReplaceImage={(eid) => setImageTarget(eid)} />}
            {rightTab === 'animate' && <AnimationPanel />}
            {rightTab === 'transition' && <TransitionPanel />}
            {rightTab === 'layout' && <LayoutAssistantPanel />}
            {rightTab === 'quality' && <QualityPanel />}
          </div>
        </aside>
      </div>
      <ChartDataEditor elementId={chartId} onClose={() => setChartId(null)} />
      <MediaPicker open={imageTarget !== null} onClose={() => setImageTarget(null)} title={imageTarget === 'new' ? tr('Insert image') : tr('Replace image')} onPick={(ref) => {
        const s = st();
        if (imageTarget === 'new') s.addElement({ type: 'image', x: (doc.size.width - 800) / 2, y: (doc.size.height - 500) / 2, width: 800, height: 500, content: ref });
        else if (imageTarget) s.updateElements([imageTarget], (e) => { e.content = { ...ref }; }, 'Replace image');
        setImageTarget(null);
      }} />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} />
      <VersionsDialog open={dialog === 'versions'} onClose={() => setDialog(null)} />
      <ShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} />
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {preview && <PreviewModal startIndex={Math.max(0, currentIndex)} onClose={() => setPreview(false)} />}
    </div>
  );
}
