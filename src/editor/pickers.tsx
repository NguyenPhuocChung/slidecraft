/**
 * Visual pictograms + tile-grid pickers for shapes, charts, diagrams, infographics,
 * timelines, decor and 3D visuals. Used by the Insert bar and the Properties panel so
 * people recognise an option by its picture, not only by its (translated) name.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { tr, useT } from '@/i18n';
import { shapePath } from '@/slides/shapes';
import { CHART_TYPES, CHART_TYPE_IDS, DIAGRAM_KINDS, DIAGRAM_KIND_IDS, INFOGRAPHIC_KINDS, SHAPE_IDS, type ChartType, type DiagramKind } from '@/types/registry';
import { Popover, cx } from '@/components/ui';

/* ------------------------------ colours ------------------------------ */
const C1 = '#6366f1', C2 = '#f59e0b', C3 = '#10b981', C4 = '#ec4899', MUTE = 'currentColor';

/* ------------------------------ labels ------------------------------- */
export const SHAPE_LABELS: Record<string, string> = {
  rect: 'Rectangle', roundRect: 'Rounded rectangle', ellipse: 'Circle / ellipse', triangle: 'Triangle', rightTriangle: 'Right triangle', diamond: 'Diamond',
  pentagon: 'Pentagon', hexagon: 'Hexagon', octagon: 'Octagon', star5: '5-point star', star8: '8-point star', parallelogram: 'Parallelogram', trapezoid: 'Trapezoid',
  chevron: 'Chevron', homePlate: 'Pentagon arrow', arrowRight: 'Right arrow', arrowLeft: 'Left arrow', arrowUp: 'Up arrow', arrowDown: 'Down arrow', heart: 'Heart',
  plus: 'Plus sign', ring: 'Ring', blockArc: 'Arc', speechBubble: 'Speech bubble', cloud: 'Cloud', halfFrame: 'Half frame', pill: 'Pill',
};
export const DIAGRAM_LABELS: Record<string, string> = {
  process: 'Process steps', chevronProcess: 'Chevron steps', cycle: 'Cycle', pyramid: 'Pyramid', funnel: 'Funnel', flowchart: 'Flowchart', mindmap: 'Mind map',
  orgchart: 'Org chart', hierarchy: 'Hierarchy tree', swot: 'SWOT', comparison: 'Comparison', beforeAfter: 'Before / after', roadmap: 'Roadmap', venn: 'Venn',
  matrix: '2×2 matrix', hub: 'Hub & spokes', strategyMap: 'Strategy map', list: 'Block list',
};
export const INFOGRAPHIC_LABELS: Record<string, string> = {
  kpiGrid: 'KPI tiles', progressBars: 'Progress bars', statRings: 'Percentage rings', numberedList: 'Numbered list', iconList: 'Icon list', pictogram: 'Pictogram (icon ratio)', comparisonBars: 'Comparison bars',
};
export const TIMELINE_LABELS: Record<string, string> = { line: 'Simple line', milestones: 'Milestones', alternating: 'Alternating (above/below)' };
export const DECOR_LABELS: Record<string, string> = { blob: 'Blob', orb: 'Glow orb', grid: 'Grid', dots: 'Dots', waves: 'Waves', rings: 'Rings', lines: 'Lines', mesh: 'Mesh gradient', corner: 'Corner frame', noise: 'Grain texture' };
export const VISUAL3D_LABELS: Record<string, string> = { cube: 'Cube', isometricStack: 'Stacked layers', sphere: 'Sphere', cylinder: 'Cylinder', layers: 'Floating layers', pillars: 'Pillars' };
export const SMARTART_KINDS = ['list', 'cycle', 'hierarchy', 'matrix', 'pyramid', 'chevronProcess', 'venn', 'hub'] as const;

/* ---------------------------- pictograms ----------------------------- */
const Svg = ({ children, w = 48, h = 32 }: { children: ReactNode; w?: number; h?: number }) => (
  <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" aria-hidden className="block">{children}</svg>
);

export function ShapeGlyph({ kind, size = 32 }: { kind: string; size?: number }) {
  const w = kind === 'pill' || kind === 'arrowRight' || kind === 'arrowLeft' || kind === 'chevron' || kind === 'homePlate' || kind === 'parallelogram' || kind === 'trapezoid' ? 40 : 28;
  const h = kind === 'pill' ? 14 : kind === 'arrowUp' || kind === 'arrowDown' ? 30 : kind.startsWith('arrow') || kind === 'chevron' || kind === 'homePlate' ? 20 : 26;
  return (
    <svg viewBox="-2 -2 44 34" width={size * 1.4} height={size} aria-hidden className="block">
      <g transform={`translate(${(40 - w) / 2},${(30 - h) / 2})`}><path d={shapePath(kind, w, h, kind === 'roundRect' ? 6 : 0)} fill={C1} fillOpacity={0.85} stroke={C1} strokeWidth={1} fillRule="evenodd" /></g>
    </svg>
  );
}

export function ChartGlyph({ type }: { type: string }) {
  const axis = <path d="M6 4 V28 H44" stroke={MUTE} strokeOpacity={0.35} fill="none" />;
  switch (type) {
    case 'bar': return <Svg>{axis}<rect x="7" y="7" width="26" height="5" fill={C1} /><rect x="7" y="14" width="34" height="5" fill={C1} /><rect x="7" y="21" width="18" height="5" fill={C1} /></Svg>;
    case 'column': return <Svg>{axis}<rect x="10" y="16" width="5" height="12" fill={C1} /><rect x="16" y="12" width="5" height="16" fill={C2} /><rect x="25" y="10" width="5" height="18" fill={C1} /><rect x="31" y="5" width="5" height="23" fill={C2} /></Svg>;
    case 'stackedBar': return <Svg>{axis}{[10, 19, 28, 37].map((x, i) => <g key={x}><rect x={x} y={18 - i * 3} width="6" height={10 + i * 3} fill={C1} /><rect x={x} y={12 - i * 3} width="6" height="6" fill={C2} /></g>)}</Svg>;
    case 'line': return <Svg>{axis}<polyline points="8,24 16,18 24,20 32,10 42,6" fill="none" stroke={C1} strokeWidth="2.5" strokeLinejoin="round" />{[[8, 24], [16, 18], [24, 20], [32, 10], [42, 6]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.8" fill={C1} />)}</Svg>;
    case 'area': return <Svg>{axis}<path d="M7 27 L7 22 L16 16 L24 18 L33 9 L43 6 L43 27 Z" fill={C1} fillOpacity={0.45} stroke={C1} strokeWidth="1.5" /></Svg>;
    case 'pie': return <Svg><circle cx="24" cy="16" r="13" fill={C1} /><path d="M24 16 L24 3 A13 13 0 0 1 36.4 20 Z" fill={C2} /><path d="M24 16 L36.4 20 A13 13 0 0 1 22 28.9 Z" fill={C3} /></Svg>;
    case 'donut': return <Svg><circle cx="24" cy="16" r="10.5" fill="none" stroke={C1} strokeWidth="5" /><path d="M24 5.5 A10.5 10.5 0 0 1 34.3 18" fill="none" stroke={C2} strokeWidth="5" /></Svg>;
    case 'scatter': return <Svg>{axis}{[[11, 23], [15, 19], [19, 21], [23, 14], [28, 15], [32, 10], [38, 8], [41, 12]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill={C1} />)}</Svg>;
    case 'bubble': return <Svg>{axis}<circle cx="14" cy="20" r="4" fill={C1} fillOpacity={0.7} /><circle cx="26" cy="13" r="7" fill={C2} fillOpacity={0.7} /><circle cx="38" cy="20" r="3" fill={C3} fillOpacity={0.8} /></Svg>;
    case 'radar': return <Svg><polygon points="24,3 37,12 32,28 16,28 11,12" fill="none" stroke={MUTE} strokeOpacity={0.35} /><polygon points="24,7 34,13 29,24 18,26 15,13" fill={C1} fillOpacity={0.5} stroke={C1} /></Svg>;
    case 'waterfall': return <Svg>{axis}<rect x="8" y="14" width="5" height="14" fill={C1} /><rect x="15" y="8" width="5" height="6" fill={C3} /><rect x="22" y="8" width="5" height="9" fill={C4} /><rect x="29" y="11" width="5" height="4" fill={C4} /><rect x="36" y="11" width="5" height="17" fill={C1} /></Svg>;
    case 'funnel': return <Svg><rect x="6" y="3" width="36" height="6" rx="1" fill={C1} /><rect x="11" y="10.5" width="26" height="6" rx="1" fill={C1} fillOpacity={0.8} /><rect x="16" y="18" width="16" height="6" rx="1" fill={C1} fillOpacity={0.6} /><rect x="20" y="25.5" width="8" height="5" rx="1" fill={C2} /></Svg>;
    case 'combo': return <Svg>{axis}{[10, 18, 26, 34].map((x, i) => <rect key={x} x={x} y={20 - i * 3} width="6" height={8 + i * 3} fill={C1} fillOpacity={0.75} />)}<polyline points="13,14 21,11 29,12 37,5" fill="none" stroke={C2} strokeWidth="2.5" /></Svg>;
    case 'histogram': return <Svg>{axis}{[4, 9, 15, 19, 12, 6, 3].map((h, i) => <rect key={i} x={7 + i * 5.2} y={28 - h} width="5.2" height={h} fill={C1} stroke="#fff" strokeWidth=".6" />)}</Svg>;
    case 'treemap': return <Svg><rect x="4" y="3" width="22" height="26" fill={C1} /><rect x="27" y="3" width="17" height="14" fill={C2} /><rect x="27" y="18" width="9" height="11" fill={C3} /><rect x="37" y="18" width="7" height="11" fill={C4} /></Svg>;
    default: return <Svg>{axis}</Svg>;
  }
}

const box = (x: number, y: number, w: number, h: number, fill = C1, op = 1, k?: string | number) => <rect key={k ?? `${x},${y}`} x={x} y={y} width={w} height={h} rx="1.5" fill={fill} fillOpacity={op} />;
const line = (d: string, k?: string | number) => <path key={k ?? d} d={d} stroke={MUTE} strokeOpacity={0.5} strokeWidth="1.2" fill="none" />;

export function DiagramGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'process': return <Svg>{[3, 17, 31].map((x) => box(x, 11, 11, 10))}{line('M14 16 H17')}{line('M28 16 H31')}<path d="M16 14.5 L17.5 16 L16 17.5 M30 14.5 L31.5 16 L30 17.5" stroke={MUTE} strokeOpacity={0.6} fill="none" /></Svg>;
    case 'chevronProcess': return <Svg>{[2, 16, 30].map((x, i) => <path key={x} d={shapePath('chevron', 15, 12)} transform={`translate(${x},10)`} fill={i === 1 ? C2 : C1} />)}</Svg>;
    case 'cycle': return <Svg><circle cx="24" cy="16" r="10" fill="none" stroke={MUTE} strokeOpacity={0.4} strokeWidth="1.5" strokeDasharray="4 2" />{[[24, 6], [34, 16], [24, 26], [14, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={i % 2 ? C2 : C1} />)}</Svg>;
    case 'pyramid': return <Svg><path d="M24 3 L30 12 H18 Z" fill={C2} /><path d="M17 13.5 H31 L36 21 H12 Z" fill={C1} fillOpacity={0.8} /><path d="M11 22.5 H37 L42 30 H6 Z" fill={C1} /></Svg>;
    case 'funnel': return <Svg><path d="M5 3 H43 L38 11 H10 Z" fill={C1} /><path d="M11 12.5 H37 L33 20 H15 Z" fill={C1} fillOpacity={0.75} /><path d="M16 21.5 H32 L29 29 H19 Z" fill={C2} /></Svg>;
    case 'flowchart': return <Svg>{box(18, 2, 12, 6, C1, 1, 'a')}<path d="M24 12 L30 16 L24 20 L18 16 Z" fill={C2} />{box(4, 24, 12, 6, C1, 0.8, 'b')}{box(32, 24, 12, 6, C1, 0.8, 'c')}{line('M24 8 V12')}{line('M18 16 H10 V24')}{line('M30 16 H38 V24')}</Svg>;
    case 'mindmap': return <Svg>{[[8, 6], [40, 6], [8, 26], [40, 26]].map(([x, y], i) => <g key={i}>{line(`M24 16 L${x} ${y}`)}<circle cx={x} cy={y} r="3.5" fill={C2} /></g>)}<ellipse cx="24" cy="16" rx="8" ry="5" fill={C1} /></Svg>;
    case 'orgchart': case 'hierarchy': return <Svg>{box(18, 2, 12, 7, C1, 1, 'r')}{line('M24 9 V13 M10 13 H38 M10 13 V17 M24 13 V17 M38 13 V17')}{[4, 18, 32].map((x) => box(x, 17, 12, 6, kind === 'orgchart' ? C2 : C1, 0.8))}{kind === 'hierarchy' && <>{line('M10 23 V26', 'h1')}{box(5, 26, 10, 5, C1, 0.55, 'h2')}</>}</Svg>;
    case 'swot': return <Svg>{box(6, 2, 17, 13, C3)}{box(25, 2, 17, 13, C4)}{box(6, 17, 17, 13, C1)}{box(25, 17, 17, 13, C2)}</Svg>;
    case 'comparison': return <Svg>{box(4, 3, 18, 26, C1, 0.85)}{box(26, 3, 18, 26, C2, 0.85)}{[9, 14, 19].map((y) => <g key={y}><rect x="7" y={y} width="12" height="2" fill="#fff" /><rect x="29" y={y} width="12" height="2" fill="#fff" /></g>)}</Svg>;
    case 'beforeAfter': return <Svg>{box(3, 6, 17, 20, MUTE, 0.3)}{box(28, 6, 17, 20, C3)}<path d="M21.5 16 H27 M24.5 13 L27 16 L24.5 19" stroke={C1} strokeWidth="2" fill="none" /></Svg>;
    case 'roadmap': return <Svg><path d="M3 22 C14 22 14 10 24 10 S36 22 45 22" stroke={MUTE} strokeOpacity={0.45} strokeWidth="3" fill="none" />{[[6, 22, C3], [18, 13, C3], [30, 13, C2], [42, 22, MUTE]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r="3" fill={c as string} fillOpacity={c === MUTE ? 0.4 : 1} />)}</Svg>;
    case 'venn': return <Svg><circle cx="19" cy="13" r="9" fill={C1} fillOpacity={0.5} /><circle cx="29" cy="13" r="9" fill={C2} fillOpacity={0.5} /><circle cx="24" cy="21" r="9" fill={C3} fillOpacity={0.5} /></Svg>;
    case 'matrix': return <Svg>{line('M24 2 V30 M8 16 H40')}{box(10, 3, 12, 11, C3, 0.8)}{box(26, 3, 12, 11, C1, 0.8)}{box(10, 18, 12, 11, C1, 0.5)}{box(26, 18, 12, 11, C2, 0.6)}</Svg>;
    case 'hub': return <Svg>{[[8, 6], [40, 6], [8, 26], [40, 26], [24, 3]].map(([x, y], i) => <g key={i}>{line(`M24 17 L${x} ${y}`)}<circle cx={x} cy={y} r="3.2" fill={C2} /></g>)}<circle cx="24" cy="17" r="7" fill={C1} /></Svg>;
    case 'strategyMap': return <Svg>{[2, 10, 18, 26].map((y, i) => <g key={y}>{box(3, y, 8, 6, C1, 1 - i * 0.15)}{box(13, y, 14, 6, C2, 0.5)}{i < 2 && box(29, y, 14, 6, C2, 0.5)}</g>)}</Svg>;
    case 'list': return <Svg>{[3, 12, 21].map((y, i) => <g key={y}>{box(4, y, 10, 8, i === 1 ? C2 : C1)}{box(16, y, 28, 8, C1, 0.25)}</g>)}</Svg>;
    default: return <Svg>{box(8, 8, 32, 16)}</Svg>;
  }
}

export function InfographicGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'kpiGrid': return <Svg>{[[3, 3], [25, 3], [3, 17], [25, 17]].map(([x, y], i) => <g key={i}>{box(x, y, 20, 12, C1, 0.15)}<rect x={x + 3} y={y + 3} width="10" height="4" fill={i === 2 ? C4 : C1} /><rect x={x + 3} y={y + 8.5} width="13" height="1.5" fill={MUTE} fillOpacity={0.4} /></g>)}</Svg>;
    case 'progressBars': return <Svg>{[0.85, 0.6, 0.35].map((p, i) => <g key={i}>{box(4, 5 + i * 9, 40, 5, MUTE, 0.15)}{box(4, 5 + i * 9, 40 * p, 5, [C1, C2, C3][i])}</g>)}</Svg>;
    case 'statRings': return <Svg>{[9, 24, 39].map((x, i) => <g key={x}><circle cx={x} cy="16" r="6" fill="none" stroke={MUTE} strokeOpacity={0.2} strokeWidth="3" /><circle cx={x} cy="16" r="6" fill="none" stroke={[C1, C2, C3][i]} strokeWidth="3" strokeDasharray={`${[28, 33, 22][i]} 40`} transform={`rotate(-90 ${x} 16)`} /></g>)}</Svg>;
    case 'numberedList': return <Svg>{[3, 12, 21].map((y, i) => <g key={y}><text x="5" y={y + 7.5} fontSize="9" fontWeight="800" fill={C1}>{i + 1}</text>{box(14, y + 1, 28, 2.5, MUTE, 0.6)}{box(14, y + 5, 20, 2, MUTE, 0.3)}</g>)}</Svg>;
    case 'iconList': return <Svg>{[3, 12, 21].map((y, i) => <g key={y}><circle cx="8" cy={y + 4} r="4" fill={[C1, C2, C3][i]} />{box(15, y + 1, 26, 2.5, MUTE, 0.6)}{box(15, y + 5, 18, 2, MUTE, 0.3)}</g>)}</Svg>;
    case 'pictogram': return <Svg>{Array.from({ length: 10 }, (_, i) => <g key={i} transform={`translate(${4 + (i % 5) * 8.4},${i < 5 ? 3 : 17})`} fill={i < 7 ? C1 : MUTE} fillOpacity={i < 7 ? 1 : 0.25}><circle cx="3.5" cy="2.5" r="2.3" /><rect x="0.5" y="5.5" width="6" height="6" rx="2.5" /></g>)}</Svg>;
    case 'comparisonBars': return <Svg>{line('M24 2 V30')}{[0, 1, 2].map((i) => <g key={i}>{box(24 - [14, 10, 18][i], 4 + i * 9, [14, 10, 18][i], 6, C1)}{box(24, 4 + i * 9, [18, 12, 9][i], 6, C2)}</g>)}</Svg>;
    default: return <Svg>{box(8, 8, 32, 16)}</Svg>;
  }
}

export function TimelineGlyph({ style }: { style: string }) {
  const pts = [8, 19, 30, 41];
  if (style === 'line') return <Svg>{line('M3 16 H45')}{pts.map((x) => <circle key={x} cx={x} cy="16" r="2.5" fill={C1} />)}</Svg>;
  if (style === 'alternating') return <Svg>{line('M3 16 H45')}{pts.map((x, i) => <g key={x}><circle cx={x} cy="16" r="2.5" fill={C1} />{box(x - 5, i % 2 ? 21 : 4, 10, 6, i % 2 ? C2 : C1, 0.6)}</g>)}</Svg>;
  return <Svg><path d="M3 16 H45" stroke={C1} strokeOpacity={0.5} strokeWidth="3" />{pts.map((x, i) => <g key={x}><path d={`M${x} 16 V9`} stroke={MUTE} strokeOpacity={0.5} /><path d={`M${x - 3.5} 5 L${x} 1.5 L${x + 3.5} 5 L${x} 8.5 Z`} fill={i === 3 ? C2 : C1} />{box(x - 4.5, 20, 9, 2.5, MUTE, 0.5)}</g>)}</Svg>;
}

export function DecorGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'blob': return <Svg><path d="M14 6 C24 0 40 4 40 14 C42 24 30 30 20 28 C8 27 4 14 14 6 Z" fill={C1} fillOpacity={0.75} /></Svg>;
    case 'orb': return <Svg><defs><radialGradient id="pg-orb"><stop offset="0" stopColor={C4} /><stop offset="1" stopColor={C4} stopOpacity="0" /></radialGradient></defs><circle cx="24" cy="16" r="15" fill="url(#pg-orb)" /></Svg>;
    case 'grid': return <Svg>{[8, 16, 24, 32, 40].map((x) => line(`M${x} 2 V30`, `v${x}`))}{[8, 16, 24].map((y) => line(`M2 ${y} H46`, `h${y}`))}</Svg>;
    case 'dots': return <Svg>{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={6 + (i % 6) * 7.2} cy={6 + Math.floor(i / 6) * 6.6} r="1.4" fill={C1} />)}</Svg>;
    case 'waves': return <Svg>{[10, 17, 24].map((y, i) => <path key={y} d={`M2 ${y} q6 -5 11 0 t11 0 t11 0 t11 0`} stroke={[C1, C2, C3][i]} strokeWidth="2" fill="none" />)}</Svg>;
    case 'rings': return <Svg>{[4, 8, 12, 15].map((r) => <circle key={r} cx="24" cy="16" r={r} fill="none" stroke={C1} strokeOpacity={1 - r / 20} strokeWidth="1.5" />)}</Svg>;
    case 'lines': return <Svg>{[0, 6, 12, 18, 24, 30].map((x) => <path key={x} d={`M${x + 6} 30 L${x + 18} 2`} stroke={C1} strokeOpacity={0.6} strokeWidth="1.5" />)}</Svg>;
    case 'mesh': return <Svg><defs><linearGradient id="pg-mesh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C1} /><stop offset=".5" stopColor={C4} /><stop offset="1" stopColor={C2} /></linearGradient></defs><rect x="2" y="2" width="44" height="28" rx="4" fill="url(#pg-mesh)" /></Svg>;
    case 'corner': return <Svg><path d="M4 12 V4 H14 M34 4 H44 V12 M44 20 V28 H34 M14 28 H4 V20" stroke={C1} strokeWidth="2.5" fill="none" /></Svg>;
    case 'noise': return <Svg>{Array.from({ length: 60 }, (_, i) => <rect key={i} x={(i * 37) % 44 + 2} y={(i * 23) % 28 + 2} width="1.2" height="1.2" fill={MUTE} fillOpacity={0.5} />)}</Svg>;
    default: return <Svg>{box(8, 8, 32, 16)}</Svg>;
  }
}

export function Visual3DGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'cube': return <Svg><path d="M24 3 L36 9 L24 15 L12 9 Z" fill={C1} fillOpacity={0.6} /><path d="M12 9 L24 15 V29 L12 23 Z" fill={C1} /><path d="M36 9 L24 15 V29 L36 23 Z" fill={C1} fillOpacity={0.8} /></Svg>;
    case 'isometricStack': return <Svg>{[18, 11, 4].map((y, i) => <g key={y}><path d={`M24 ${y} L38 ${y + 5} L24 ${y + 10} L10 ${y + 5} Z`} fill={[C1, C2, C3][i]} /><path d={`M10 ${y + 5} V${y + 8} L24 ${y + 13} L38 ${y + 8} V${y + 5} L24 ${y + 10} Z`} fill={[C1, C2, C3][i]} fillOpacity={0.6} /></g>)}</Svg>;
    case 'sphere': return <Svg><defs><radialGradient id="pg-sph" cx=".35" cy=".35"><stop offset="0" stopColor="#c7d2fe" /><stop offset="1" stopColor={C1} /></radialGradient></defs><circle cx="24" cy="16" r="13" fill="url(#pg-sph)" /></Svg>;
    case 'cylinder': return <Svg><path d="M14 7 V25 A10 4 0 0 0 34 25 V7 Z" fill={C1} fillOpacity={0.85} /><ellipse cx="24" cy="7" rx="10" ry="4" fill={C1} fillOpacity={0.5} /></Svg>;
    case 'layers': return <Svg>{[20, 13, 6].map((y, i) => <path key={y} d={`M24 ${y} L40 ${y + 5} L24 ${y + 10} L8 ${y + 5} Z`} fill={[C1, C2, C3][i]} fillOpacity={0.8} />)}</Svg>;
    case 'pillars': return <Svg>{[[8, 14], [20, 8], [32, 3]].map(([x, y], i) => <g key={x}><rect x={x} y={y} width="8" height={30 - y} fill={[C1, C2, C3][i]} /><path d={`M${x} ${y} l3 -2 h8 l-3 2 Z`} fill={[C1, C2, C3][i]} fillOpacity={0.55} /><path d={`M${x + 8} ${y} l3 -2 V${28} l-3 2 Z`} fill={[C1, C2, C3][i]} fillOpacity={0.7} /></g>)}</Svg>;
    default: return <Svg>{box(8, 8, 32, 16)}</Svg>;
  }
}

/* ------------------------------ tile grid ----------------------------- */
export interface TileItem { id: string; label: string; hint?: string; glyph: ReactNode; badge?: string }

/** Grid of picture tiles. Each tile: pictogram + short name (+ hint as tooltip). */
export function TileGrid({ items, onPick, value, cols = 3, testPrefix }: { items: TileItem[]; onPick: (id: string) => void; value?: string; cols?: number; testPrefix?: string }) {
  const t = useT();
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onPick(it.id)} title={it.hint ? `${t(it.label)} — ${t(it.hint)}` : t(it.label)} data-testid={testPrefix ? `${testPrefix}-${it.id}` : undefined}
          className={cx('group flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10',
            value === it.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/15' : 'border-transparent')}>
          <span className="flex h-9 w-full items-center justify-center text-ink-500 dark:text-ink-300">{it.glyph}</span>
          <span className="line-clamp-2 text-[10.5px] leading-tight text-ink-700 dark:text-ink-200">{t(it.label)}</span>
          {it.badge && <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{t(it.badge)}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ item lists ---------------------------- */
export const shapeItems = (): TileItem[] => SHAPE_IDS.map((s) => ({ id: s, label: SHAPE_LABELS[s] ?? s, glyph: <ShapeGlyph kind={s} size={26} /> }));
export const chartItems = (): TileItem[] => CHART_TYPE_IDS.map((c) => ({ id: c, label: CHART_TYPES[c].label, hint: CHART_TYPES[c].use, glyph: <ChartGlyph type={c} /> }));
export const diagramItems = (ids: readonly string[] = DIAGRAM_KIND_IDS): TileItem[] => ids.map((d) => ({ id: d, label: DIAGRAM_LABELS[d] ?? d, hint: DIAGRAM_KINDS[d as DiagramKind], glyph: <DiagramGlyph kind={d} /> }));
export const infographicItems = (): TileItem[] => Object.keys(INFOGRAPHIC_KINDS).map((k) => ({ id: k, label: INFOGRAPHIC_LABELS[k] ?? k, hint: INFOGRAPHIC_KINDS[k as keyof typeof INFOGRAPHIC_KINDS], glyph: <InfographicGlyph kind={k} /> }));

/* --------------------------- dropdown pickers -------------------------- */
function PickerButton({ glyph, label, open, toggle, testId }: { glyph: ReactNode; label: string; open: boolean; toggle: () => void; testId?: string }) {
  return (
    <button type="button" onClick={toggle} data-testid={testId} className={cx('flex h-8 w-full min-w-[150px] items-center gap-2 rounded-lg border border-ink-200 bg-white px-1.5 text-left text-[12.5px] text-ink-800 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100', open && 'border-brand-500')}>
      <span className="flex h-6 w-9 shrink-0 items-center justify-center text-ink-500">{glyph}</span>
      <span className="flex-1 truncate">{label}</span>
      <ChevronDown size={13} className="text-ink-400" />
    </button>
  );
}

export function ChartTypePicker({ value, onChange, testId = 'chart-type-picker' }: { value: ChartType; onChange: (v: ChartType) => void; testId?: string }) {
  return (
    <div className="w-56">
      <Popover width={360} trigger={(open, toggle) => <PickerButton open={open} toggle={toggle} testId={testId} glyph={<ChartGlyph type={value} />} label={tr(CHART_TYPES[value]?.label ?? value)} />}>
        {(close) => <TileGrid items={chartItems()} value={value} cols={4} testPrefix="pick-chart" onPick={(id) => { onChange(id as ChartType); close(); }} />}
      </Popover>
    </div>
  );
}

export function ShapePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover width={340} trigger={(open, toggle) => <PickerButton open={open} toggle={toggle} testId="shape-picker" glyph={<ShapeGlyph kind={value} size={18} />} label={tr(SHAPE_LABELS[value] ?? value)} />}>
      {(close) => <TileGrid items={shapeItems()} value={value} cols={4} testPrefix="pick-shape" onPick={(id) => { onChange(id); close(); }} />}
    </Popover>
  );
}

export function DiagramKindPicker({ value, onChange, ids }: { value: string; onChange: (v: string) => void; ids?: readonly string[] }) {
  return (
    <Popover width={360} trigger={(open, toggle) => <PickerButton open={open} toggle={toggle} testId="diagram-picker" glyph={<DiagramGlyph kind={value} />} label={tr(DIAGRAM_LABELS[value] ?? value)} />}>
      {(close) => <TileGrid items={diagramItems(ids)} value={value} cols={4} testPrefix="pick-diagram" onPick={(id) => { onChange(id); close(); }} />}
    </Popover>
  );
}

export function InfographicKindPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover width={340} trigger={(open, toggle) => <PickerButton open={open} toggle={toggle} testId="infographic-picker" glyph={<InfographicGlyph kind={value} />} label={tr(INFOGRAPHIC_LABELS[value] ?? value)} />}>
      {(close) => <TileGrid items={infographicItems()} value={value} cols={3} testPrefix="pick-infographic" onPick={(id) => { onChange(id); close(); }} />}
    </Popover>
  );
}
