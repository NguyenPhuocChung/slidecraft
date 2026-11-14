import type { Theme } from '@/types/schema';

type ThemeInput = Omit<Theme, 'fontScale' | 'spacing' | 'grid' | 'typography' | 'radius' | 'shadow' | 'decor' | 'colors' | 'fonts'> & {
  fonts: { heading: string; body: string; mono?: string };
  colors: Omit<Theme['colors'], 'textMuted' | 'border' | 'chart'> & Partial<Pick<Theme['colors'], 'textMuted' | 'border' | 'chart'>>;
  fontScale?: Partial<Theme['fontScale']>;
  spacing?: Partial<Theme['spacing']>;
  grid?: Partial<Theme['grid']>;
  typography?: Partial<Theme['typography']>;
  radius?: number;
  shadow?: Theme['shadow'];
  decor?: Theme['decor'];
};

const DEFAULT_SCALE: Theme['fontScale'] = { display: 120, h1: 80, h2: 56, h3: 40, body: 30, small: 24, caption: 20 };
const DEFAULT_TYPO: Theme['typography'] = { headingWeight: 700, bodyWeight: 400, headingLetterSpacing: -1, headingTransform: 'none', bodyLineHeight: 1.45, headingLineHeight: 1.08 };

function mix(hex: string, other: string, t: number): string {
  const a = hexToRgb(hex), b = hexToRgb(other);
  if (!a || !b) return hex;
  const r = Math.round(a.r + (b.r - a.r) * t), g = Math.round(a.g + (b.g - a.g) * t), bl = Math.round(a.b + (b.b - a.b) * t);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = hex.trim().replace('#', '');
  if (![3, 4, 6, 8].includes(m.length) || /[^0-9a-f]/i.test(m)) return null;
  const full = m.length <= 4 ? m.split('').map((c) => c + c).join('') : m;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1 };
}

function build(t: ThemeInput): Theme {
  const c = t.colors;
  return {
    ...t,
    colors: {
      ...c,
      textMuted: c.textMuted ?? mix(c.text, c.background, 0.42),
      border: c.border ?? mix(c.text, c.background, 0.85),
      chart: c.chart ?? [c.primary, c.accent, c.secondary, mix(c.primary, c.background, 0.45), mix(c.accent, c.background, 0.45), mix(c.text, c.background, 0.5)],
    },
    fonts: { heading: t.fonts.heading, body: t.fonts.body, mono: t.fonts.mono ?? 'JetBrains Mono' },
    fontScale: { ...DEFAULT_SCALE, ...t.fontScale },
    spacing: { unit: 8, margin: 120, ...t.spacing },
    grid: { columns: 12, gutter: 32, ...t.grid },
    typography: { ...DEFAULT_TYPO, ...t.typography },
    radius: t.radius ?? 16,
    shadow: t.shadow ?? 'soft',
    decor: t.decor ?? 'none',
  };
}

export const THEMES: Theme[] = [
  build({ id: 'apple-minimal', name: 'Apple Minimal', category: 'Minimal', mode: 'light', description: 'Generous whitespace, SF-like type, one accent.',
    colors: { primary: '#1d1d1f', secondary: '#6e6e73', accent: '#0071e3', background: '#ffffff', surface: '#f5f5f7', text: '#1d1d1f' },
    fonts: { heading: 'Inter', body: 'Inter' }, typography: { headingWeight: 700, headingLetterSpacing: -2.5 }, radius: 28, shadow: 'none' }),
  build({ id: 'swiss-design', name: 'Swiss Design', category: 'Editorial', mode: 'light', description: 'International typographic style, strict grid, red accent.',
    colors: { primary: '#111111', secondary: '#555555', accent: '#e30613', background: '#f4f1ea', surface: '#ffffff', text: '#111111' },
    fonts: { heading: 'Inter', body: 'Inter' }, typography: { headingWeight: 800, headingLetterSpacing: -3 }, radius: 0, shadow: 'none', decor: 'grid' }),
  build({ id: 'modern-corporate', name: 'Modern Corporate', category: 'Business', mode: 'light', description: 'Trustworthy navy and teal for business decks.',
    colors: { primary: '#0b3d91', secondary: '#1f6feb', accent: '#14b8a6', background: '#ffffff', surface: '#f1f5fb', text: '#0f172a' },
    fonts: { heading: 'Montserrat', body: 'Inter' }, radius: 14, decor: 'lines' }),
  build({ id: 'luxury-black-gold', name: 'Luxury Black & Gold', category: 'Premium', mode: 'dark', description: 'Deep black with champagne gold serif headlines.',
    colors: { primary: '#d4af6a', secondary: '#a8894e', accent: '#f2d9a0', background: '#0b0b0c', surface: '#161618', text: '#f5f1e8', textMuted: '#a49e92' },
    fonts: { heading: 'Playfair Display', body: 'Lora' }, typography: { headingWeight: 600, headingLetterSpacing: 0 }, radius: 4, shadow: 'strong', decor: 'frame' }),
  build({ id: 'editorial-magazine', name: 'Editorial Magazine', category: 'Editorial', mode: 'light', description: 'Serif display type, magazine rhythm, warm paper.',
    colors: { primary: '#1a1a1a', secondary: '#7a5c3e', accent: '#c2410c', background: '#faf7f2', surface: '#ffffff', text: '#1a1a1a' },
    fonts: { heading: 'DM Serif Display', body: 'Lora' }, typography: { headingWeight: 400, headingLetterSpacing: -1 }, radius: 2, shadow: 'none' }),
  build({ id: 'academic-research', name: 'Academic Research', category: 'Education', mode: 'light', description: 'Readable serif body, restrained blue, citation friendly.',
    colors: { primary: '#1e3a5f', secondary: '#4a6fa5', accent: '#b45309', background: '#fdfdfb', surface: '#f2f4f7', text: '#1f2937' },
    fonts: { heading: 'Source Serif 4', body: 'Source Sans 3' }, typography: { headingWeight: 700, headingLetterSpacing: -0.5 }, radius: 6, shadow: 'none', decor: 'lines' }),
  build({ id: 'startup-pitch', name: 'Startup Pitch Deck', category: 'Business', mode: 'light', description: 'Bold violet & coral, confident numbers.',
    colors: { primary: '#5b21b6', secondary: '#7c3aed', accent: '#fb7185', background: '#ffffff', surface: '#f5f3ff', text: '#1e1b4b' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' }, typography: { headingWeight: 700, headingLetterSpacing: -2 }, radius: 24, decor: 'orbs' }),
  build({ id: 'financial-report', name: 'Financial Report', category: 'Business', mode: 'light', description: 'Dense-data friendly, green/red semantics, crisp tables.',
    colors: { primary: '#0f3d3e', secondary: '#1f7a6d', accent: '#d97706', background: '#ffffff', surface: '#f3f6f6', text: '#111827', success: '#15803d', danger: '#b91c1c',
      chart: ['#0f3d3e', '#1f7a6d', '#5fb3a1', '#d97706', '#94a3b8', '#334155'] },
    fonts: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans' }, radius: 8, shadow: 'none' }),
  build({ id: 'tech-futuristic', name: 'Technology Futuristic', category: 'Technology', mode: 'dark', description: 'Neon cyan on deep space, grid and glow.',
    colors: { primary: '#22d3ee', secondary: '#818cf8', accent: '#a3e635', background: '#05070f', surface: '#0d1324', text: '#e6edf7', textMuted: '#8b98b0',
      chart: ['#22d3ee', '#818cf8', '#a3e635', '#f472b6', '#facc15', '#64748b'] },
    fonts: { heading: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' }, typography: { headingLetterSpacing: -1.5 }, radius: 14, shadow: 'medium', decor: 'grid' }),
  build({ id: 'glassmorphism', name: 'Glassmorphism', category: 'Creative', mode: 'dark', description: 'Frosted glass cards over vivid gradient.',
    colors: { primary: '#ffffff', secondary: '#c7d2fe', accent: '#f0abfc', background: '#1e1b4b', surface: 'rgba(255,255,255,0.12)', text: '#ffffff', textMuted: '#d4d4f7', border: 'rgba(255,255,255,0.28)',
      chart: ['#f0abfc', '#93c5fd', '#fde68a', '#a7f3d0', '#fca5a5', '#e0e7ff'] },
    fonts: { heading: 'Poppins', body: 'Poppins' }, radius: 28, shadow: 'medium', decor: 'mesh',
    background: { type: 'gradient', gradient: { type: 'linear', angle: 135, stops: [{ color: '#4338ca', offset: 0 }, { color: '#7e22ce', offset: 0.55 }, { color: '#db2777', offset: 1 }] } } }),
  build({ id: 'dark-premium', name: 'Dark Premium', category: 'Premium', mode: 'dark', description: 'Charcoal surfaces, soft violet accent, cinematic contrast.',
    colors: { primary: '#a78bfa', secondary: '#60a5fa', accent: '#f59e0b', background: '#0f0f14', surface: '#1a1a22', text: '#f4f4f6', textMuted: '#9b9bab' },
    fonts: { heading: 'Inter', body: 'Inter' }, typography: { headingLetterSpacing: -2 }, radius: 20, shadow: 'strong', decor: 'orbs' }),
  build({ id: 'minimal-white', name: 'Minimal White', category: 'Minimal', mode: 'light', description: 'Black on white, nothing extra.',
    colors: { primary: '#000000', secondary: '#404040', accent: '#000000', background: '#ffffff', surface: '#f6f6f6', text: '#0a0a0a' },
    fonts: { heading: 'Inter', body: 'Inter' }, typography: { headingWeight: 600, headingLetterSpacing: -1.5 }, radius: 0, shadow: 'none' }),
  build({ id: 'creative-gradient', name: 'Creative Gradient', category: 'Creative', mode: 'light', description: 'Playful sunset gradients and rounded shapes.',
    colors: { primary: '#ff5f6d', secondary: '#ffc371', accent: '#6c5ce7', background: '#fffaf5', surface: '#ffffff', text: '#2d1b2e' },
    fonts: { heading: 'Poppins', body: 'Poppins' }, typography: { headingWeight: 800, headingLetterSpacing: -2 }, radius: 32, decor: 'orbs' }),
  build({ id: 'education-modern', name: 'Education Modern', category: 'Education', mode: 'light', description: 'Friendly, high-legibility, cheerful accents.',
    colors: { primary: '#2563eb', secondary: '#16a34a', accent: '#f59e0b', background: '#fbfdff', surface: '#eef5ff', text: '#0f172a' },
    fonts: { heading: 'Be Vietnam Pro', body: 'Be Vietnam Pro' }, fontScale: { body: 32 }, radius: 20, decor: 'dots' }),
  build({ id: 'cinematic', name: 'Cinematic Presentation', category: 'Creative', mode: 'dark', description: 'Letterbox drama, huge type, full-bleed imagery.',
    colors: { primary: '#ffffff', secondary: '#d1d5db', accent: '#ef4444', background: '#000000', surface: '#111111', text: '#ffffff', textMuted: '#a3a3a3' },
    fonts: { heading: 'Bebas Neue', body: 'Inter' }, typography: { headingWeight: 400, headingLetterSpacing: 2, headingTransform: 'uppercase', headingLineHeight: 0.95 }, fontScale: { display: 180, h1: 110 }, radius: 0, shadow: 'strong', decor: 'noise' }),
  build({ id: 'government-professional', name: 'Government Professional', category: 'Business', mode: 'light', description: 'Formal, accessible, high contrast; red-gold civic accents.',
    colors: { primary: '#8b1a1a', secondary: '#1f2937', accent: '#b8860b', background: '#ffffff', surface: '#f7f5f0', text: '#111827' },
    fonts: { heading: 'Roboto Slab', body: 'Roboto' }, radius: 4, shadow: 'none', decor: 'frame' }),
  build({ id: 'medical-healthcare', name: 'Medical & Healthcare', category: 'Industry', mode: 'light', description: 'Clean clinical teal, calm and reassuring.',
    colors: { primary: '#0e7490', secondary: '#0891b2', accent: '#10b981', background: '#ffffff', surface: '#ecfeff', text: '#083344' },
    fonts: { heading: 'Nunito Sans', body: 'Nunito Sans' }, radius: 18, decor: 'dots' }),
  build({ id: 'marketing-campaign', name: 'Marketing Campaign', category: 'Creative', mode: 'light', description: 'Punchy magenta & lime, big imagery, bold claims.',
    colors: { primary: '#db2777', secondary: '#111827', accent: '#84cc16', background: '#ffffff', surface: '#fdf2f8', text: '#111827' },
    fonts: { heading: 'Montserrat', body: 'Inter' }, typography: { headingWeight: 900, headingLetterSpacing: -2 }, radius: 22, decor: 'orbs' }),
];

export const THEME_MAP: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
export const DEFAULT_THEME_ID = 'modern-corporate';

/** Every font referenced by a built-in theme (loaded from Google Fonts with Vietnamese subsets). */
export const THEME_FONTS = Array.from(new Set(THEMES.flatMap((t) => [t.fonts.heading, t.fonts.body, t.fonts.mono])));

export function getTheme(id?: string, overrides?: Partial<Theme>): Theme {
  const base = (id && THEME_MAP[id]) || THEME_MAP[DEFAULT_THEME_ID];
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
    fontScale: { ...base.fontScale, ...(overrides.fontScale ?? {}) },
    typography: { ...base.typography, ...(overrides.typography ?? {}) },
    spacing: { ...base.spacing, ...(overrides.spacing ?? {}) },
    grid: { ...base.grid, ...(overrides.grid ?? {}) },
  } as Theme;
}

export function registerCustomTheme(theme: Theme): void {
  const idx = THEMES.findIndex((t) => t.id === theme.id);
  if (idx >= 0) THEMES[idx] = theme;
  else THEMES.push(theme);
  THEME_MAP[theme.id] = theme;
}

export const THEME_TOKENS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textMuted', 'border', 'success', 'warning', 'danger'] as const;

/** Resolve "$primary", "$chart2", "$heading" etc. to concrete values. */
export function resolveColor(value: string | undefined, theme: Theme, fallback = 'transparent'): string {
  if (!value) return fallback;
  if (value.startsWith('$')) {
    const key = value.slice(1);
    const m = /^chart(\d+)$/.exec(key);
    if (m) return theme.colors.chart[(parseInt(m[1], 10) - 1) % theme.colors.chart.length] ?? fallback;
    const c = (theme.colors as unknown as Record<string, unknown>)[key];
    return typeof c === 'string' ? c : fallback;
  }
  return value;
}
export function resolveFont(value: string | undefined, theme: Theme, kind: 'heading' | 'body' | 'mono' = 'body'): string {
  if (!value) return theme.fonts[kind];
  if (value === '$heading') return theme.fonts.heading;
  if (value === '$body') return theme.fonts.body;
  if (value === '$mono') return theme.fonts.mono;
  return value;
}

export const SHADOWS: Record<Theme['shadow'], string> = {
  none: 'none',
  soft: '0 2px 6px rgba(15,23,42,0.06), 0 18px 40px -18px rgba(15,23,42,0.22)',
  medium: '0 4px 12px rgba(0,0,0,0.12), 0 24px 60px -20px rgba(0,0,0,0.35)',
  strong: '0 8px 24px rgba(0,0,0,0.3), 0 40px 90px -30px rgba(0,0,0,0.6)',
};

export { mix as mixColor };
