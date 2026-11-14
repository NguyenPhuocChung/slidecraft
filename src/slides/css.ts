import type { CSSProperties } from 'react';
import type { Background, Gradient, Style, Theme } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { withAlpha } from '@/utils/color';

export function gradientCss(g: Gradient | undefined, theme: Theme): string | undefined {
  if (!g?.stops?.length) return undefined;
  const stops = g.stops.map((s) => `${resolveColor(s.color, theme)} ${Math.round(s.offset * 100)}%`).join(', ');
  if (g.type === 'radial') return `radial-gradient(circle at 50% 50%, ${stops})`;
  return `linear-gradient(${(g.angle ?? 90) + 90}deg, ${stops})`;
}

export function shadowCss(s: Style['shadow'], theme: Theme): string | undefined {
  if (!s) return undefined;
  return `${s.x ?? 0}px ${s.y ?? 8}px ${s.blur ?? 24}px ${resolveColor(s.color ?? 'rgba(0,0,0,0.25)', theme)}`;
}

export function backgroundCss(bg: Background | undefined, theme: Theme, resolvedImage?: string): CSSProperties {
  const b = bg ?? theme.background;
  if (!b) return { background: theme.colors.background };
  switch (b.type) {
    case 'gradient':
      return { background: gradientCss(b.gradient, theme) ?? theme.colors.background };
    case 'image': {
      const layers: string[] = [];
      if (b.overlay) layers.push(`linear-gradient(${withAlpha(resolveColor(b.overlay.color, theme), b.overlay.opacity)}, ${withAlpha(resolveColor(b.overlay.color, theme), b.overlay.opacity)})`);
      if (resolvedImage) layers.push(`url("${resolvedImage.replace(/"/g, '%22')}")`);
      return { backgroundColor: resolveColor(b.color ?? '$primary', theme), backgroundImage: layers.join(', ') || undefined, backgroundSize: b.fit ?? 'cover', backgroundPosition: 'center' };
    }
    default:
      return { background: resolveColor(b.color, theme, theme.colors.background) };
  }
}

export function paddingCss(p: Style['padding']): string | undefined {
  if (p === undefined) return undefined;
  if (Array.isArray(p)) return p.map((v) => `${v}px`).join(' ');
  return `${p}px`;
}

export function fontStack(name: string): string {
  return `"${name}", "Be Vietnam Pro", Inter, "Segoe UI", Arial, sans-serif`;
}
