import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { Type, Heading1, Square, Image as ImageIcon, Smile, Table2, BarChart3, Workflow, Clock, LayoutGrid, Sigma, Code2, Film, Music, Sparkles, Box, Minus, MoveRight, List as ListIcon, Shapes } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { DECOR_KINDS, TIMELINE_STYLES, VISUAL3D_KINDS } from '@/types/registry';
import { IconSvg } from '@/media/icons';
import { Popover, cx } from '@/components/ui';
import { makeElement } from './insert';
import { DECOR_LABELS, DecorGlyph, SMARTART_KINDS, TIMELINE_LABELS, TileGrid, TimelineGlyph, VISUAL3D_LABELS, Visual3DGlyph, chartItems, diagramItems, infographicItems, shapeItems, type TileItem } from './pickers';

const ICONS: [string, string][] = [['star', 'Star'], ['rocket', 'Rocket'], ['target', 'Target'], ['users', 'People'], ['lightbulb', 'Idea'], ['shield-check', 'Security'], ['chart-line', 'Growth chart'], ['globe', 'Globe'], ['zap', 'Lightning'], ['heart', 'Heart'], ['check', 'Check mark'], ['trophy', 'Trophy'], ['clock', 'Clock'], ['mail', 'Email'], ['phone', 'Phone'], ['map-pin', 'Location'], ['calendar', 'Calendar'], ['dollar-sign', 'Money'], ['settings', 'Settings'], ['book-open', 'Book'], ['graduation-cap', 'Education'], ['leaf', 'Nature'], ['home', 'Home'], ['smile', 'Smile']];
const FORMULAS: { id: string; label: string; preview: string }[] = [
  { id: 'E = mc^2', label: 'E = mc²', preview: 'E=mc²' },
  { id: '\\int_a^b f(x)\\,dx = F(b) - F(a)', label: 'Integral', preview: '∫f(x)dx' },
  { id: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', label: 'Quadratic formula', preview: '−b±√Δ' },
  { id: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', label: 'Sum', preview: 'Σ i' },
  { id: 'P(A\\mid B) = \\frac{P(B\\mid A)P(A)}{P(B)}', label: 'Bayes', preview: 'P(A|B)' },
];

const kindOf = (label: string) => ({ Heading: 'heading', Text: 'text', Bullets: 'bullets', Shape: 'shape', Line: 'line', Arrow: 'arrow', Image: 'image', Icon: 'icon', Table: 'table', Chart: 'chart', Diagram: 'diagram', SmartArt: 'smartart', Timeline: 'timeline', Infographic: 'infographic', Formula: 'formula', Code: 'code', Decor: 'decorative', '3D': 'visual3d' } as Record<string, string>)[label] ?? 'text';

function insert(kind: string, sub?: string) {
  const st = useEditor.getState();
  if (!st.doc) return;
  st.addElement(makeElement(kind, sub, st.doc.size));
}

function Tool({ icon, label, hint, onClick, tiles, cols = 3, width = 300, testId }: { icon: ReactNode; label: string; hint?: string; onClick?: () => void; tiles?: TileItem[]; cols?: number; width?: number; testId?: string }) {
  const t = useT();
  const kind = kindOf(label);
  const btn = (open: boolean, toggle?: () => void) => (
    <button title={hint ? `${t(label)} — ${t(hint)}` : t(label)} onClick={() => (tiles ? toggle?.() : onClick ? onClick() : insert(kind))} data-testid={testId} className={cx('flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white', open && 'bg-ink-100 dark:bg-ink-800')}>
      {icon}<span className="whitespace-nowrap">{t(label)}</span>
    </button>
  );
  if (!tiles) return btn(false);
  return (
    <Popover width={width} trigger={(open, toggle) => btn(open, toggle)}>
      {(close) => (
        <div>
          <div className="px-1.5 pb-1.5 pt-0.5 text-[11px] font-semibold text-ink-500">{t('Choose {what} to insert', { what: t(label).toLowerCase() })}</div>
          <TileGrid items={tiles} cols={cols} testPrefix={`insert-${kind}`} onPick={(id) => { if (label === 'Media') { const [k, s] = id.split(':'); insert(k, s || undefined); } else insert(kind, id); close(); }} />
        </div>
      )}
    </Popover>
  );
}

const textGlyph = (s: string) => <span className="font-serif text-[15px] font-semibold text-brand-600 dark:text-brand-300">{s}</span>;

export function InsertBar({ onPickImage }: { onPickImage: () => void }) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-ink-200 bg-white px-2 py-1 dark:border-ink-800 dark:bg-ink-900" data-testid="insert-bar">
      <Tool icon={<Heading1 size={16} />} label="Heading" hint="Large title text" testId="insert-heading" />
      <Tool icon={<Type size={16} />} label="Text" hint="A paragraph of text" testId="insert-text" />
      <Tool icon={<ListIcon size={16} />} label="Bullets" hint="A bulleted list" />
      <Tool icon={<Square size={16} />} label="Shape" tiles={shapeItems()} cols={4} width={340} testId="insert-shape" />
      <Tool icon={<Minus size={16} />} label="Line" hint="A straight line" />
      <Tool icon={<MoveRight size={16} />} label="Arrow" hint="A line with an arrow head" />
      <span className="mx-1 h-8 w-px bg-ink-200 dark:bg-ink-800" />
      <Tool icon={<ImageIcon size={16} />} label="Image" hint="Upload or search for a picture" onClick={onPickImage} testId="insert-image" />
      <Tool icon={<Smile size={16} />} label="Icon" tiles={ICONS.map(([id, label]) => ({ id, label, glyph: <span className="text-brand-600 dark:text-brand-300"><IconSvg name={id} size={22} /></span> }))} cols={4} width={320} />
      <Tool icon={<Table2 size={16} />} label="Table" hint="Rows and columns" testId="insert-table" />
      <Tool icon={<BarChart3 size={16} />} label="Chart" tiles={chartItems()} cols={4} width={380} testId="insert-chart" />
      <Tool icon={<Workflow size={16} />} label="Diagram" tiles={diagramItems()} cols={4} width={380} testId="insert-diagram" />
      <Tool icon={<Shapes size={16} />} label="SmartArt" tiles={diagramItems(SMARTART_KINDS)} cols={4} width={360} />
      <Tool icon={<Clock size={16} />} label="Timeline" tiles={TIMELINE_STYLES.map((s) => ({ id: s, label: TIMELINE_LABELS[s] ?? s, glyph: <TimelineGlyph style={s} /> }))} cols={3} width={300} />
      <Tool icon={<LayoutGrid size={16} />} label="Infographic" tiles={infographicItems()} cols={3} width={330} />
      <span className="mx-1 h-8 w-px bg-ink-200 dark:bg-ink-800" />
      <Tool icon={<Sigma size={16} />} label="Formula" tiles={FORMULAS.map((f) => ({ id: f.id, label: f.label, glyph: textGlyph(f.preview) }))} cols={3} width={300} />
      <Tool icon={<Code2 size={16} />} label="Code" hint="A block of program code" />
      <Tool icon={<Film size={16} />} label="Media" tiles={[{ id: 'video:', label: 'Video (YouTube / MP4 URL)', glyph: <Film size={22} className="text-brand-600" /> }, { id: 'audio:', label: 'Audio (MP3 URL)', glyph: <Music size={22} className="text-brand-600" /> }]} cols={2} width={260} />
      <Tool icon={<Sparkles size={16} />} label="Decor" tiles={DECOR_KINDS.map((k) => ({ id: k, label: DECOR_LABELS[k] ?? k, glyph: <DecorGlyph kind={k} /> }))} cols={4} width={340} />
      <Tool icon={<Box size={16} />} label="3D" tiles={VISUAL3D_KINDS.map((k) => ({ id: k, label: VISUAL3D_LABELS[k] ?? k, glyph: <Visual3DGlyph kind={k} /> }))} cols={3} width={300} />
    </div>
  );
}

