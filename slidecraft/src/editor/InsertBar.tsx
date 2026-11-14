import type { ReactNode } from 'react';
import { tr } from '@/i18n';
import { Type, Heading1, Square, Image as ImageIcon, Smile, Table2, BarChart3, Workflow, Clock, LayoutGrid, Sigma, Code2, Film, Music, Sparkles, Box, Minus, MoveRight, List as ListIcon, Shapes } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { CHART_TYPES, CHART_TYPE_IDS, DECOR_KINDS, DIAGRAM_KINDS, DIAGRAM_KIND_IDS, INFOGRAPHIC_KINDS, INFOGRAPHIC_KIND_IDS, SHAPE_IDS, TIMELINE_STYLES, VISUAL3D_KINDS } from '@/types/registry';
import { Popover, MenuButton, cx } from '@/components/ui';
import { makeElement } from './insert';

function Tool({ icon, label, onClick, menu, testId }: { icon: ReactNode; label: string; onClick?: () => void; menu?: { id: string; label: string; hint?: string }[]; testId?: string }) {
  const add = (sub?: string) => {
    const st = useEditor.getState();
    if (!st.doc) return;
    st.addElement(makeElement(label === 'Media' ? sub!.split(':')[0] : kindOf(label), label === 'Media' ? sub!.split(':')[1] : sub, st.doc.size));
  };
  const btn = (open: boolean, toggle?: () => void) => (
    <button title={tr(label)} onClick={() => (menu ? toggle?.() : onClick ? onClick() : add())} data-testid={testId} className={cx('flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white', open && 'bg-ink-100 dark:bg-ink-800')}>
      {icon}<span>{tr(label)}</span>
    </button>
  );
  if (!menu) return btn(false);
  return (
    <Popover width={240} trigger={(open, toggle) => btn(open, toggle)}>
      {(close) => <div className="max-h-[60vh] overflow-y-auto">{menu.map((m) => <MenuButton key={m.id} onClick={() => { add(m.id); close(); }} testId={`insert-${kindOf(label)}-${m.id}`}><span className="block">{tr(m.label)}</span>{m.hint && <span className="block text-[10px] text-ink-400">{tr(m.hint)}</span>}</MenuButton>)}</div>}
    </Popover>
  );
}
const kindOf = (label: string) => ({ Heading: 'heading', Text: 'text', Bullets: 'bullets', Shape: 'shape', Line: 'line', Arrow: 'arrow', Image: 'image', Icon: 'icon', Table: 'table', Chart: 'chart', Diagram: 'diagram', SmartArt: 'smartart', Timeline: 'timeline', Infographic: 'infographic', Formula: 'formula', Code: 'code', Decor: 'decorative', '3D': 'visual3d' } as Record<string, string>)[label] ?? 'text';

export function InsertBar({ onPickImage }: { onPickImage: () => void }) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-ink-200 bg-white px-2 py-1 dark:border-ink-800 dark:bg-ink-900" data-testid="insert-bar">
      <Tool icon={<Heading1 size={16} />} label="Heading" testId="insert-heading" />
      <Tool icon={<Type size={16} />} label="Text" testId="insert-text" />
      <Tool icon={<ListIcon size={16} />} label="Bullets" />
      <Tool icon={<Square size={16} />} label="Shape" menu={SHAPE_IDS.map((s) => ({ id: s, label: s }))} testId="insert-shape" />
      <Tool icon={<Minus size={16} />} label="Line" />
      <Tool icon={<MoveRight size={16} />} label="Arrow" />
      <span className="mx-1 h-8 w-px bg-ink-200 dark:bg-ink-800" />
      <Tool icon={<ImageIcon size={16} />} label="Image" onClick={onPickImage} testId="insert-image" />
      <Tool icon={<Smile size={16} />} label="Icon" menu={['star', 'rocket', 'target', 'users', 'lightbulb', 'shield-check', 'chart-line', 'globe', 'zap', 'heart', 'check', 'trophy'].map((s) => ({ id: s, label: s }))} />
      <Tool icon={<Table2 size={16} />} label="Table" testId="insert-table" />
      <Tool icon={<BarChart3 size={16} />} label="Chart" menu={CHART_TYPE_IDS.map((c) => ({ id: c, label: CHART_TYPES[c].label, hint: CHART_TYPES[c].use }))} testId="insert-chart" />
      <Tool icon={<Workflow size={16} />} label="Diagram" menu={DIAGRAM_KIND_IDS.map((d) => ({ id: d, label: d, hint: DIAGRAM_KINDS[d] }))} testId="insert-diagram" />
      <Tool icon={<Shapes size={16} />} label="SmartArt" menu={(['list', 'cycle', 'hierarchy', 'matrix', 'pyramid', 'chevronProcess', 'venn', 'hub'] as const).map((d) => ({ id: d, label: d }))} />
      <Tool icon={<Clock size={16} />} label="Timeline" menu={TIMELINE_STYLES.map((s) => ({ id: s, label: s }))} />
      <Tool icon={<LayoutGrid size={16} />} label="Infographic" menu={INFOGRAPHIC_KIND_IDS.map((k) => ({ id: k, label: k, hint: INFOGRAPHIC_KINDS[k] }))} />
      <span className="mx-1 h-8 w-px bg-ink-200 dark:bg-ink-800" />
      <Tool icon={<Sigma size={16} />} label="Formula" menu={[{ id: 'E = mc^2', label: 'E = mc²' }, { id: '\\int_a^b f(x)\\,dx = F(b) - F(a)', label: 'Integral' }, { id: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', label: 'Quadratic formula' }, { id: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', label: 'Sum' }, { id: 'P(A\\mid B) = \\frac{P(B\\mid A)P(A)}{P(B)}', label: 'Bayes' }]} />
      <Tool icon={<Code2 size={16} />} label="Code" />
      <Tool icon={<Film size={16} />} label="Media" menu={[{ id: 'video:', label: 'Video (YouTube / MP4 URL)' }, { id: 'audio:', label: 'Audio (MP3 URL)' }]} />
      <Tool icon={<Sparkles size={16} />} label="Decor" menu={DECOR_KINDS.map((k) => ({ id: k, label: k }))} />
      <Tool icon={<Box size={16} />} label="3D" menu={VISUAL3D_KINDS.map((k) => ({ id: k, label: k }))} />
      <Music size={0} className="hidden" />
    </div>
  );
}
