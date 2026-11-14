import { memo } from 'react';
import type { Prim, Scene } from './scene';
import { wrapText } from './scene';
import { IconSvg } from '@/media/icons';

const fontFor = (s: Scene, f?: string) => (f === 'heading' ? s.fonts.heading : f === 'mono' ? s.fonts.mono : s.fonts.body);

function TextPrim({ p, scene }: { p: Extract<Prim, { k: 'text' }>; scene: Scene }) {
  const family = fontFor(scene, p.font);
  const lines = wrapText(p.text, p.w, p.size, family, p.weight ?? 400);
  const lh = p.size * (p.lineHeight ?? 1.2);
  const total = lines.length * lh;
  const y0 = p.valign === 'middle' ? p.y + (p.h - total) / 2 : p.valign === 'bottom' ? p.y + p.h - total : p.y;
  const anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
  const x = p.align === 'center' ? p.x + p.w / 2 : p.align === 'right' ? p.x + p.w : p.x;
  return (
    <text x={x} y={y0} fontFamily={`"${family}", Inter, sans-serif`} fontSize={p.size} fill={p.color} fontWeight={p.weight ?? 400} textAnchor={anchor} fontStyle={p.italic ? 'italic' : undefined} opacity={p.opacity}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? p.size * 0.92 + (lh - p.size) / 2 : lh}>{l}</tspan>
      ))}
    </text>
  );
}

function ShapeLabel({ x, y, w, h, text, color, size, bold, scene }: { x: number; y: number; w: number; h: number; text: string; color?: string; size?: number; bold?: boolean; scene: Scene }) {
  return <TextPrim scene={scene} p={{ k: 'text', x: x + 6, y, w: w - 12, h, text, size: size ?? 18, color: color ?? '#fff', weight: bold ? 700 : 500, align: 'center', valign: 'middle' }} />;
}

export const SceneSvg = memo(function SceneSvg({ scene, className }: { scene: Scene; className?: string }) {
  let markerId = 0;
  return (
    <svg viewBox={`0 0 ${Math.max(1, scene.w)} ${Math.max(1, scene.h)}`} width="100%" height="100%" className={className} style={{ overflow: 'visible', display: 'block' }}>
      {scene.prims.map((p, i) => {
        switch (p.k) {
          case 'rect':
            return (
              <g key={i} opacity={p.opacity}>
                {p.preset && p.preset !== 'rect' && p.preset !== 'roundRect' ? (
                  <polygon points={presetPoints(p.preset, p.x, p.y, p.w, p.h, p.flipH).map((q) => q.join(',')).join(' ')} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} />
                ) : (
                  <rect x={p.x} y={p.y} width={Math.max(0, p.w)} height={Math.max(0, p.h)} rx={p.r} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash ? '8 6' : undefined} />
                )}
                {p.text ? <ShapeLabel scene={scene} x={p.x + (p.preset === 'chevron' || p.preset === 'homePlate' ? p.h * 0.2 : 0)} y={p.y} w={p.w - (p.preset === 'chevron' ? p.h * 0.4 : p.preset === 'homePlate' ? p.h * 0.25 : 0)} h={p.h} text={p.text} color={p.textColor} size={p.fontSize} bold={p.bold} /> : null}
              </g>
            );
          case 'ellipse':
            return (
              <g key={i} opacity={p.opacity}>
                <ellipse cx={p.x + p.w / 2} cy={p.y + p.h / 2} rx={Math.max(0, p.w / 2)} ry={Math.max(0, p.h / 2)} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.sw} />
                {p.text ? <ShapeLabel scene={scene} x={p.x} y={p.y} w={p.w} h={p.h} text={p.text} color={p.textColor} size={p.fontSize} bold={p.bold} /> : null}
              </g>
            );
          case 'poly':
            return p.closed !== false && p.fill ? (
              <polygon key={i} points={p.pts.map((q) => q.join(',')).join(' ')} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity} strokeLinejoin="round" />
            ) : (
              <polyline key={i} points={p.pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={p.dash ? '10 8' : undefined} />
            );
          case 'line': {
            const mid = `scm-${i}-${markerId++}`;
            return (
              <g key={i} opacity={p.opacity}>
                {p.head === 'triangle' && (
                  <defs>
                    <marker id={mid} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 z" fill={p.stroke} />
                    </marker>
                  </defs>
                )}
                <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash ? '8 6' : undefined} markerEnd={p.head === 'triangle' ? `url(#${mid})` : undefined} strokeLinecap="round" />
              </g>
            );
          }
          case 'text':
            return <TextPrim key={i} p={p} scene={scene} />;
          case 'icon':
            return (
              <g key={i} transform={`translate(${p.x},${p.y})`} opacity={p.opacity}>
                <IconSvg name={p.name} size={Math.min(p.w, p.h)} color={p.color} />
              </g>
            );
          default:
            return null;
        }
      })}
    </svg>
  );
});

/** Polygon approximations of a few preset geometries used inside scenes. */
export function presetPoints(preset: string, x: number, y: number, w: number, h: number, flipH = false): [number, number][] {
  let pts: [number, number][];
  switch (preset) {
    case 'chevron': { const d = Math.min(h * 0.4, w * 0.3); pts = [[x, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x, y + h], [x + d, y + h / 2]]; break; }
    case 'homePlate': { const d = Math.min(h * 0.4, w * 0.3); pts = [[x, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x, y + h]]; break; }
    case 'triangle': pts = [[x + w / 2, y], [x + w, y + h], [x, y + h]]; break;
    case 'diamond': pts = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]; break;
    case 'hexagon': { const d = w * 0.25; pts = [[x + d, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x + d, y + h], [x, y + h / 2]]; break; }
    default: pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  if (flipH) pts = pts.map(([px, py]) => [x + w - (px - x), py]);
  return pts;
}
