import { useMemo, useState } from 'react';
import { tr, trMsg } from '@/i18n';
import { Check, Sparkles } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { generateCandidates, textAmount, type AssistantAction, type Candidate } from '@/layouts/assistant';
import { SlideRenderer, presentationTheme } from '@/slides/SlideRenderer';
import { LAYOUTS } from '@/layouts/engine';
import { Badge, Button, cx, toast } from '@/components/ui';
import { MediaPicker } from './dialogs/MediaPicker';

const ACTIONS: { id: AssistantAction | 'image'; label: string }[] = [
  { id: 'suggest', label: 'Suggest better layout' }, { id: 'visual', label: 'Make more visual' }, { id: 'reduce', label: 'Reduce text' },
  { id: 'hierarchy', label: 'Improve hierarchy' }, { id: 'balance', label: 'Balance composition' }, { id: 'contrast', label: 'Improve contrast' },
  { id: 'image', label: 'Replace image' }, { id: 'infographic', label: 'Convert to infographic' }, { id: 'timeline', label: 'Convert to timeline' },
  { id: 'chart', label: 'Convert to chart' }, { id: 'alternative', label: 'Create alternative layout' },
];

export function LayoutAssistantPanel() {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const st = useEditor.getState;
  const [action, setAction] = useState<AssistantAction | null>(null);
  const [seed, setSeed] = useState(0);
  const [pickImage, setPickImage] = useState(false);
  const theme = useMemo(() => (slide ? presentationTheme(doc, slide) : null), [doc, slide]);
  const candidates: Candidate[] = useMemo(() => (slide && theme && action ? generateCandidates(action, slide, theme, doc.size) : []), [action, slide, theme, doc.size, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!slide || !theme) return null;
  const words = textAmount(slide).words;
  const apply = (c: Candidate) => {
    st().commit(`Assistant: ${c.title}`, (d) => { const i = d.slides.findIndex((s) => s.id === slide.id); d.slides[i] = { ...c.slide, id: slide.id } as never; });
    toast.success(tr('Applied “{name}”. Undo with Ctrl+Z.', { name: trMsg(c.title) }));
    setAction(null);
  };
  const img = slide.elements.find((e) => e.type === 'image');
  return (
    <div className="pb-10" data-testid="layout-panel">
      <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-800">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-brand-500" />{tr('Smart Layout Assistant')}</div>
        <p className="mb-2 text-[11px] text-ink-500">{tr('Previews only — your slide changes when you click')} <b>{tr('Apply')}</b>. {tr('Text is never deleted (reduced text moves to speaker notes).')}</p>
        <div className="mb-2 flex gap-1.5"><Badge>{tr('{n} words', { n: words })}</Badge>{slide.layout && <Badge tone="brand">{slide.layout}</Badge>}</div>
        <div className="flex flex-wrap gap-1">
          {ACTIONS.map((a) => (
            <button key={a.id} onClick={() => { if (a.id === 'image') { if (img) setPickImage(true); else toast.info(tr('This slide has no image. Try “Make more visual”.')); return; } setAction(a.id); setSeed((n) => n + 1); }} className={cx('rounded-full border px-2.5 py-1 text-[11px] font-medium transition', action === a.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300')} data-testid={`assist-${a.id}`}>{tr(a.label)}</button>
          ))}
        </div>
      </div>
      {action && (
        <div className="space-y-3 px-4 py-3">
          {!candidates.length && <p className="text-xs text-ink-400">{tr('No suitable alternatives for this content.')}</p>}
          {candidates.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700" data-testid="assist-candidate">
              <SlideRenderer slide={c.slide} presentation={doc} scale={270 / doc.size.width} mode="thumb" />
              <div className="flex items-start gap-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{trMsg(c.title)}</div>
                  <div className="text-[11px] text-ink-500">{trMsg(c.description)}</div>
                  {c.warnings?.map((w) => <div key={w} className="text-[11px] text-amber-600">{trMsg(w)}</div>)}
                </div>
                {c.slide !== slide && <Button size="sm" variant="primary" icon={<Check size={12} />} onClick={() => apply(c)} data-testid="assist-apply">{tr('Apply')}</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!action && (
        <div className="px-4 py-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr('Change layout (keeps content)')}</h4>
          <div className="grid grid-cols-2 gap-1">
            {LAYOUTS.map((l) => <button key={l.id} title={tr(l.description)} onClick={() => { st().applyLayout(slide.id, l.id); toast.success(`${tr('Layout')}: ${tr(l.name)}`); }} className={cx('truncate rounded-md px-2 py-1 text-left text-[11px] hover:bg-ink-100 dark:hover:bg-ink-800', slide.layout === l.id && 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200')}>{tr(l.name)}</button>)}
          </div>
        </div>
      )}
      <MediaPicker open={pickImage} onClose={() => setPickImage(false)} onPick={(ref) => { if (img) st().updateElements([img.id], (e) => { e.content = { ...ref }; }, 'Replace image'); setPickImage(false); }} />
    </div>
  );
}
