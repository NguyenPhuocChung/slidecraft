/** SVG path geometry for each contract shape (web render). PPTX uses native presets. */
export function shapePath(kind: string, w: number, h: number, radius = 0): string {
  const r = Math.min(radius, w / 2, h / 2);
  const poly = (pts: [number, number][]) => 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z';
  const star = (n: number, inner: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const rr = i % 2 ? inner : 1;
      pts.push([w / 2 + (Math.cos(a) * w * rr) / 2, h / 2 + (Math.sin(a) * h * rr) / 2]);
    }
    return poly(pts);
  };
  const regular = (n: number) => poly(Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2] as [number, number]; }));
  switch (kind) {
    case 'rect': return r ? roundRect(w, h, r) : `M0,0 H${w} V${h} H0 Z`;
    case 'roundRect': return roundRect(w, h, r || Math.min(w, h) * 0.12);
    case 'pill': return roundRect(w, h, Math.min(w, h) / 2);
    case 'ellipse': return `M${w / 2},0 A${w / 2},${h / 2} 0 1,1 ${w / 2},${h} A${w / 2},${h / 2} 0 1,1 ${w / 2},0 Z`;
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'rightTriangle': return poly([[0, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon': return regular(5);
    case 'hexagon': return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case 'octagon': { const a = w * 0.29, b = h * 0.29; return poly([[a, 0], [w - a, 0], [w, b], [w, h - b], [w - a, h], [a, h], [0, h - b], [0, b]]); }
    case 'star5': return star(5, 0.42);
    case 'star8': return star(8, 0.62);
    case 'parallelogram': return poly([[w * 0.25, 0], [w, 0], [w * 0.75, h], [0, h]]);
    case 'trapezoid': return poly([[w * 0.2, 0], [w * 0.8, 0], [w, h], [0, h]]);
    case 'chevron': { const d = Math.min(h / 2, w * 0.4); return poly([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h], [d, h / 2]]); }
    case 'homePlate': { const d = Math.min(h / 2, w * 0.4); return poly([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h]]); }
    case 'arrowRight': { const d = Math.min(h * 0.5, w * 0.4); return poly([[0, h * 0.25], [w - d, h * 0.25], [w - d, 0], [w, h / 2], [w - d, h], [w - d, h * 0.75], [0, h * 0.75]]); }
    case 'arrowLeft': { const d = Math.min(h * 0.5, w * 0.4); return poly([[w, h * 0.25], [d, h * 0.25], [d, 0], [0, h / 2], [d, h], [d, h * 0.75], [w, h * 0.75]]); }
    case 'arrowUp': { const d = Math.min(w * 0.5, h * 0.4); return poly([[w * 0.25, h], [w * 0.25, d], [0, d], [w / 2, 0], [w, d], [w * 0.75, d], [w * 0.75, h]]); }
    case 'arrowDown': { const d = Math.min(w * 0.5, h * 0.4); return poly([[w * 0.25, 0], [w * 0.75, 0], [w * 0.75, h - d], [w, h - d], [w / 2, h], [0, h - d], [w * 0.25, h - d]]); }
    case 'heart': return `M${w / 2},${h * 0.3} C${w / 2},${h * 0.1} ${w * 0.1},0 ${w * 0.05},${h * 0.3} C0,${h * 0.55} ${w * 0.3},${h * 0.75} ${w / 2},${h} C${w * 0.7},${h * 0.75} ${w},${h * 0.55} ${w * 0.95},${h * 0.3} C${w * 0.9},0 ${w / 2},${h * 0.1} ${w / 2},${h * 0.3} Z`;
    case 'plus': { const a = w * 0.35, b = h * 0.35; return poly([[a, 0], [w - a, 0], [w - a, b], [w, b], [w, h - b], [w - a, h - b], [w - a, h], [a, h], [a, h - b], [0, h - b], [0, b], [a, b]]); }
    case 'ring': { const t = Math.min(w, h) * 0.2; return `M${w / 2},0 A${w / 2},${h / 2} 0 1,1 ${w / 2},${h} A${w / 2},${h / 2} 0 1,1 ${w / 2},0 Z M${w / 2},${t} A${w / 2 - t},${h / 2 - t} 0 1,0 ${w / 2},${h - t} A${w / 2 - t},${h / 2 - t} 0 1,0 ${w / 2},${t} Z`; }
    case 'blockArc': { const t = Math.min(w, h) * 0.22; return `M0,${h / 2} A${w / 2},${h / 2} 0 0,1 ${w},${h / 2} L${w - t},${h / 2} A${w / 2 - t},${h / 2 - t} 0 0,0 ${t},${h / 2} Z`; }
    case 'speechBubble': { const rr = Math.min(w, h) * 0.12; return `M${rr},0 H${w - rr} Q${w},0 ${w},${rr} V${h * 0.75 - rr} Q${w},${h * 0.75} ${w - rr},${h * 0.75} H${w * 0.4} L${w * 0.22},${h} L${w * 0.25},${h * 0.75} H${rr} Q0,${h * 0.75} 0,${h * 0.75 - rr} V${rr} Q0,0 ${rr},0 Z`; }
    case 'cloud': return `M${w * 0.25},${h * 0.85} C${w * 0.05},${h * 0.85} 0,${h * 0.6} ${w * 0.15},${h * 0.5} C${w * 0.1},${h * 0.25} ${w * 0.35},${h * 0.15} ${w * 0.45},${h * 0.28} C${w * 0.5},${h * 0.05} ${w * 0.85},${h * 0.05} ${w * 0.82},${h * 0.35} C${w},${h * 0.38} ${w},${h * 0.85} ${w * 0.78},${h * 0.85} Z`;
    case 'halfFrame': { const t = Math.min(w, h) * 0.18; return poly([[0, 0], [w, 0], [w - t, t], [t, t], [t, h - t], [0, h]]); }
    default: return `M0,0 H${w} V${h} H0 Z`;
  }
}
function roundRect(w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`;
}

/** CSS clip-path for image masks. */
export function maskClip(mask: string | undefined): string | undefined {
  switch (mask) {
    case 'circle': return 'ellipse(50% 50% at 50% 50%)';
    case 'arch': return 'inset(0 0 0 0 round 50% 50% 0 0 / 35% 35% 0 0)';
    case 'hexagon': return 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
    case 'diamond': return 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)';
    case 'blob': return 'polygon(30% 2%, 70% 0%, 95% 22%, 100% 60%, 84% 92%, 50% 100%, 14% 90%, 0% 58%, 6% 22%)';
    default: return undefined;
  }
}
