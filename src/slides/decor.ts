/** Decorative and 3D-like visuals as SVG strings (web render + rasterized PPTX export). */
import type { Theme } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { parseColor, withAlpha } from '@/utils/color';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
function shade(color: string, amt: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

export function decorSvg(kind: string, w: number, h: number, colorsIn: string[] | undefined, theme: Theme, seed = 7, uid = 'd'): string {
  const colors = (colorsIn?.length ? colorsIn : ['$primary', '$accent']).map((c) => resolveColor(c, theme, theme.colors.primary));
  const [c1, c2 = c1] = colors;
  const r = rng(seed);
  const id = `${uid}-${kind}`;
  let body = '';
  switch (kind) {
    case 'orb':
      body = `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c1}" stop-opacity="0.95"/><stop offset="0.55" stop-color="${c1}" stop-opacity="0.35"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="url(#${id})"/>`;
      break;
    case 'blob': {
      const n = 8, cx = w / 2, cy = h / 2;
      const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; const rr = 0.36 + r() * 0.14; return [cx + Math.cos(a) * w * rr, cy + Math.sin(a) * h * rr]; });
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < n; i++) { const p1 = pts[(i + 1) % n], p0 = pts[i]; const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; d += ` Q${p0[0]},${p0[1]} ${mx},${my}`; }
      body = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><path d="${d} Z" fill="url(#${id})"/>`;
      break;
    }
    case 'grid': {
      const step = Math.max(24, Math.round(Math.min(w, h) / 18));
      let lines = '';
      for (let x = step; x < w; x += step) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
      for (let y = step; y < h; y += step) lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
      body = `<g stroke="${c1}" stroke-width="1" opacity="0.6">${lines}</g>`;
      break;
    }
    case 'dots': {
      const step = Math.max(18, Math.round(Math.min(w, h) / 10));
      let dots = '';
      for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) dots += `<circle cx="${x}" cy="${y}" r="${step * 0.12}"/>`;
      body = `<g fill="${c1}">${dots}</g>`;
      break;
    }
    case 'waves': {
      let paths = '';
      for (let i = 0; i < 5; i++) {
        const y0 = h * (0.3 + i * 0.12), amp = h * 0.06;
        paths += `<path d="M0,${y0} C${w * 0.25},${y0 - amp} ${w * 0.5},${y0 + amp} ${w * 0.75},${y0} S${w},${y0 - amp} ${w},${y0}" stroke="${i % 2 ? c2 : c1}" stroke-width="${3 + i}" fill="none" opacity="${0.25 + i * 0.12}"/>`;
      }
      body = paths;
      break;
    }
    case 'rings': {
      let rings = '';
      for (let i = 1; i <= 6; i++) rings += `<circle cx="${w / 2}" cy="${h / 2}" r="${(Math.min(w, h) / 2) * (i / 6)}" stroke="${i % 2 ? c1 : c2}" stroke-width="2" fill="none" opacity="${1 - i * 0.12}"/>`;
      body = rings;
      break;
    }
    case 'lines': {
      let ls = '';
      for (let i = 0; i < 14; i++) { const x = (i / 14) * w * 1.4 - w * 0.2; ls += `<line x1="${x}" y1="${h}" x2="${x + w * 0.45}" y2="0" stroke="${c1}" stroke-width="2"/>`; }
      body = ls;
      break;
    }
    case 'mesh':
      body = `<defs><radialGradient id="${id}a" cx="15%" cy="20%" r="60%"><stop offset="0" stop-color="${c1}" stop-opacity="0.85"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient><radialGradient id="${id}b" cx="85%" cy="80%" r="65%"><stop offset="0" stop-color="${c2}" stop-opacity="0.8"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${id}a)"/><rect width="${w}" height="${h}" fill="url(#${id}b)"/>`;
      break;
    case 'corner': {
      const s = Math.min(w, h) * 0.08;
      body = `<g stroke="${c1}" stroke-width="3" fill="none"><path d="M0,${s} V0 H${s}"/><path d="M${w - s},0 H${w} V${s}"/><path d="M${w},${h - s} V${h} H${w - s}"/><path d="M${s},${h} H0 V${h - s}"/></g>`;
      break;
    }
    case 'noise': {
      let dots = '';
      for (let i = 0; i < 900; i++) dots += `<rect x="${(r() * w).toFixed(1)}" y="${(r() * h).toFixed(1)}" width="2" height="2" opacity="${(r() * 0.8).toFixed(2)}"/>`;
      body = `<g fill="${c1}">${dots}</g>`;
      break;
    }
    default:
      body = `<rect width="${w}" height="${h}" fill="${withAlpha(c1, 0.2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${body}</svg>`;
}

export function visual3dSvg(kind: string, w: number, h: number, colorsIn: string[] | undefined, items: string[] | undefined, theme: Theme, uid = 'v'): string {
  const colors = (colorsIn?.length ? colorsIn : ['$primary', '$accent', '$secondary']).map((c) => resolveColor(c, theme, theme.colors.primary));
  const font = `font-family="${esc(theme.fonts.body)}, Inter, sans-serif"`;
  const label = (x: number, y: number, t: string, size: number, color = theme.colors.text, anchor = 'start') => `<text x="${x}" y="${y}" ${font} font-size="${size}" font-weight="700" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`;
  let body = '';
  const id = `${uid}-${kind}`;
  switch (kind) {
    case 'cube': {
      const s = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2 + s * 0.15;
      const c = colors[0];
      body = `<polygon points="${cx},${cy - s} ${cx + s * 0.87},${cy - s * 0.5} ${cx},${cy} ${cx - s * 0.87},${cy - s * 0.5}" fill="${shade(c, 0.35)}"/>
<polygon points="${cx - s * 0.87},${cy - s * 0.5} ${cx},${cy} ${cx},${cy + s} ${cx - s * 0.87},${cy + s * 0.5}" fill="${c}"/>
<polygon points="${cx + s * 0.87},${cy - s * 0.5} ${cx},${cy} ${cx},${cy + s} ${cx + s * 0.87},${cy + s * 0.5}" fill="${shade(c, -0.3)}"/>`;
      break;
    }
    case 'isometricStack': case 'layers': {
      const n = Math.max(2, items?.length ?? 3);
      const s = Math.min(w * 0.38, h * 0.5), cx = w * (items?.length ? 0.38 : 0.5);
      const th = Math.min(h * 0.08, s * 0.18), gap = (h - s * 0.6 - th) / n;
      for (let i = n - 1; i >= 0; i--) {
        const y = h * 0.12 + i * gap + s * 0.25;
        const c = colors[i % colors.length];
        body += `<polygon points="${cx},${y - s * 0.25} ${cx + s},${y} ${cx},${y + s * 0.25} ${cx - s},${y}" fill="${shade(c, 0.25)}" opacity="0.96"/>
<polygon points="${cx - s},${y} ${cx},${y + s * 0.25} ${cx},${y + s * 0.25 + th} ${cx - s},${y + th}" fill="${c}"/>
<polygon points="${cx + s},${y} ${cx},${y + s * 0.25} ${cx},${y + s * 0.25 + th} ${cx + s},${y + th}" fill="${shade(c, -0.3)}"/>`;
        if (items?.[i]) body += `<line x1="${cx + s + 10}" y1="${y + th / 2}" x2="${cx + s + 50}" y2="${y + th / 2}" stroke="${c}" stroke-width="3"/>` + label(cx + s + 60, y + th / 2 + 10, items[i], Math.min(30, h / 16), theme.colors.text);
      }
      break;
    }
    case 'sphere': {
      const r = Math.min(w, h) * 0.42;
      body = `<defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${shade(colors[0], 0.6)}"/><stop offset="0.5" stop-color="${colors[0]}"/><stop offset="1" stop-color="${shade(colors[0], -0.55)}"/></radialGradient><radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="${w / 2}" cy="${h / 2 + r * 1.05}" rx="${r * 0.9}" ry="${r * 0.14}" fill="url(#${id}s)"/><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="url(#${id})"/>`;
      break;
    }
    case 'cylinder': case 'pillars': {
      const n = kind === 'pillars' ? Math.max(2, items?.length ?? 4) : 1;
      const cw = (w / n) * 0.62, ry = cw * 0.18;
      for (let i = 0; i < n; i++) {
        const c = colors[i % colors.length];
        const x = (w / n) * (i + 0.5);
        const hh = kind === 'pillars' ? (h * 0.75) * ((i + 1.5) / (n + 0.5)) : h * 0.72;
        const top = h - ry * 1.5 - hh;
        body += `<defs><linearGradient id="${id}${i}" x1="0" x2="1"><stop offset="0" stop-color="${shade(c, -0.25)}"/><stop offset="0.45" stop-color="${shade(c, 0.25)}"/><stop offset="1" stop-color="${shade(c, -0.4)}"/></linearGradient></defs>
<rect x="${x - cw / 2}" y="${top}" width="${cw}" height="${hh}" fill="url(#${id}${i})"/><ellipse cx="${x}" cy="${top + hh}" rx="${cw / 2}" ry="${ry}" fill="${shade(c, -0.4)}"/><ellipse cx="${x}" cy="${top}" rx="${cw / 2}" ry="${ry}" fill="${shade(c, 0.35)}"/>`;
        if (items?.[i]) body += label(x, top - ry - 14, items[i], Math.min(28, cw / 4), theme.colors.text, 'middle');
      }
      break;
    }
    default:
      body = '';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
