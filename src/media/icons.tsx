import { ICON_DATA } from './icon-data';

export const ICON_ALIASES: Record<string, string> = {
  'alert-triangle': 'triangle-alert', warning: 'triangle-alert', alert: 'triangle-alert', 'bar-chart': 'chart-bar', 'bar-chart-2': 'chart-column', 'bar-chart-3': 'chart-column',
  chart: 'chart-column', 'pie-chart': 'chart-pie', 'line-chart': 'chart-line', analytics: 'chart-line', home: 'house', 'check-circle': 'circle-check', 'check-circle-2': 'circle-check-big',
  'help-circle': 'circle-question-mark', help: 'circle-question-mark', question: 'circle-question-mark', edit: 'square-pen', filter: 'funnel', fingerprint: 'fingerprint-pattern', music: 'music-2', smile: 'laugh',
  train: 'train-front', 'trash-2': 'trash', delete: 'trash', 'wand-2': 'wand', magic: 'wand', 'x-circle': 'circle-x', 'shield-alert': 'shield-x', 'code-2': 'code-xml', 'building-2': 'building',
  money: 'banknote', cash: 'banknote', growth: 'trending-up', decline: 'trending-down', idea: 'lightbulb', team: 'users', people: 'users', person: 'user', security: 'shield-check', ai: 'brain', robot: 'bot',
  settings2: 'settings', gear: 'cog', world: 'globe', earth: 'earth', email: 'mail', location: 'map-pin', time: 'clock', date: 'calendar', goal: 'target', success: 'trophy', rocket: 'rocket', cloud: 'cloud',
  doc: 'file-text', document: 'file-text', education: 'graduation-cap', health: 'heart-pulse', medical: 'stethoscope', science: 'flask-conical', energy: 'zap', eco: 'leaf', environment: 'leaf', data: 'database',
  github: 'git-branch', checklist: 'list-checks', 'thumbs-up': 'thumbs-up', star: 'star', speed: 'gauge', layout: 'layout-grid', process: 'route', waves: 'wind',
};

export const ICON_NAMES = Object.keys(ICON_DATA).sort();

export function resolveIconName(name: string | undefined): string | null {
  if (!name) return null;
  const n = String(name).trim().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
  if (ICON_DATA[n]) return n;
  if (ICON_ALIASES[n] && ICON_DATA[ICON_ALIASES[n]]) return ICON_ALIASES[n];
  const stripped = n.replace(/-(icon|outline|solid)$/, '');
  if (ICON_DATA[stripped]) return stripped;
  return null;
}

/** SVG string for an icon (used by PPTX/PNG export and inline SVG). */
export function iconSvgString(name: string, color = '#000000', strokeWidth = 2, size = 24): string {
  const key = resolveIconName(name) ?? 'circle-question-mark';
  const nodes = ICON_DATA[key] ?? [];
  const inner = nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${String(v)}"`).join(' ')}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function IconSvg({ name, size = 24, color = 'currentColor', strokeWidth = 2 }: { name: string; size?: number; color?: string; strokeWidth?: number }) {
  const key = resolveIconName(name) ?? 'circle-question-mark';
  const nodes = ICON_DATA[key] ?? [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
      {nodes.map(([tag, attrs], i) => {
        const Tag = tag as 'path';
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}
