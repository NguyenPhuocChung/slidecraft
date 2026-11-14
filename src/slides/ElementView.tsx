import { memo, useMemo, type CSSProperties } from 'react';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import type { Asset, Paragraph, SlideElement, Theme } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { buildChartScene } from '@/charts/chartScene';
import { buildDiagramScene, buildInfographicScene, buildTimelineScene } from '@/charts/diagramScene';
import { SceneSvg } from '@/charts/SceneSvg';
import { IconSvg } from '@/media/icons';
import { useImageSrc, useMediaStore } from '@/media/resolver';
import { sanitizeSvg, isSafeUrl } from '@/code-parser/security';
import { withAlpha } from '@/utils/color';
import { fontStack, gradientCss, shadowCss } from './css';
import { decorSvg, visual3dSvg } from './decor';
import { maskClip, shapePath } from './shapes';
import { ParagraphsView, textBoxStyle } from './TextBlock';

export interface RenderCtx {
  theme: Theme;
  assets: Asset[];
  mode: 'edit' | 'thumb' | 'present' | 'export';
  editingId?: string | null;
  editableRef?: React.Ref<HTMLDivElement>;
  slideHeading?: string;
}

const ImageView = memo(function ImageView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const s = el.style ?? {};
  const { src, loading, credit } = useImageSrc(el.content, ctx.assets, el.width, el.height);
  const markBroken = useMediaStore((st) => st.markBroken);
  const radius = s.mask && s.mask !== 'none' && s.mask !== 'rounded' ? 0 : s.radius ?? 0;
  const frame: CSSProperties = {
    position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: s.mask === 'rounded' ? Math.min(el.width, el.height) * 0.12 : radius,
    clipPath: maskClip(s.mask), boxShadow: shadowCss(s.shadow, ctx.theme),
    border: s.stroke?.width ? `${s.stroke.width}px solid ${resolveColor(s.stroke.color ?? '$border', ctx.theme)}` : undefined,
    background: src ? undefined : `linear-gradient(135deg, ${withAlpha(ctx.theme.colors.primary, 0.85)}, ${withAlpha(ctx.theme.colors.accent, 0.75)})`,
  };
  const crop = s.crop;
  const imgStyle: CSSProperties = crop
    ? { position: 'absolute', width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${(-crop.x / crop.width) * 100}%`, top: `${(-crop.y / crop.height) * 100}%`, objectFit: 'fill' }
    : { width: '100%', height: '100%', objectFit: s.fit ?? 'cover', objectPosition: `${(s.focalX ?? 0.5) * 100}% ${(s.focalY ?? 0.5) * 100}%` };
  imgStyle.transform = [s.flipH ? 'scaleX(-1)' : '', s.flipV ? 'scaleY(-1)' : ''].join(' ') || undefined;
  imgStyle.filter = [s.grayscale ? 'grayscale(1)' : '', s.brightness !== undefined ? `brightness(${s.brightness})` : ''].join(' ') || undefined;
  return (
    <div style={frame}>
      {src ? (
        <img src={src} alt={el.content?.alt ?? el.alt ?? ''} draggable={false} referrerPolicy="no-referrer" style={imgStyle} onError={() => markBroken(src)} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', padding: 24, textAlign: 'center', fontFamily: fontStack(ctx.theme.fonts.body) }} data-image-placeholder>
          <IconSvg name="image" size={Math.min(96, Math.max(28, Math.min(el.width, el.height) * 0.18))} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
          {Math.min(el.width, el.height) > 140 && (
            <div style={{ fontSize: Math.max(14, Math.min(26, el.width / 22)), opacity: 0.92, lineHeight: 1.3, maxWidth: '90%' }}>
              {loading ? 'Finding image…' : el.content?.query ? `“${el.content.query}”` : el.content?.alt ?? 'Image unavailable'}
            </div>
          )}
        </div>
      )}
      {s.overlay && <div style={{ position: 'absolute', inset: 0, background: withAlpha(resolveColor(s.overlay.color, ctx.theme), s.overlay.opacity) }} />}
      {credit && ctx.mode !== 'thumb' && el.width > 360 && <div style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,.6)', fontFamily: 'Inter, sans-serif' }}>{credit}</div>}
    </div>
  );
});

function ShapeView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const s = el.style ?? {};
  const kind = el.content?.shape ?? 'rect';
  const gid = `g-${el.id}`;
  const fill = s.gradient ? `url(#${gid})` : resolveColor(s.fill, ctx.theme, kind === 'rect' && !s.fill && s.stroke ? 'none' : ctx.theme.colors.primary);
  const sw = s.stroke?.width ?? 0;
  const d = shapePath(kind, Math.max(1, el.width - sw), Math.max(1, el.height - sw), s.radius ?? 0);
  const glass = !!s.blur;
  const paragraphs: Paragraph[] | undefined = el.content?.paragraphs;
  return (
    <>
      {glass && <div style={{ position: 'absolute', inset: 0, borderRadius: s.radius ?? 0, backdropFilter: `blur(${s.blur}px)`, WebkitBackdropFilter: `blur(${s.blur}px)` }} />}
      <svg width="100%" height="100%" viewBox={`${-sw / 2} ${-sw / 2} ${el.width} ${el.height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: s.shadow ? `drop-shadow(${shadowCss(s.shadow, ctx.theme)})` : undefined }}>
        {s.gradient && (
          <defs>
            {s.gradient.type === 'radial' ? (
              <radialGradient id={gid}>{s.gradient.stops.map((st, i) => <stop key={i} offset={st.offset} stopColor={resolveColor(st.color, ctx.theme)} />)}</radialGradient>
            ) : (
              <linearGradient id={gid} gradientTransform={`rotate(${s.gradient.angle ?? 0} .5 .5)`}>{s.gradient.stops.map((st, i) => <stop key={i} offset={st.offset} stopColor={resolveColor(st.color, ctx.theme)} />)}</linearGradient>
            )}
          </defs>
        )}
        <path d={d} fill={fill} fillRule="evenodd" stroke={sw ? resolveColor(s.stroke?.color ?? '$border', ctx.theme) : undefined} strokeWidth={sw || undefined} strokeDasharray={s.stroke?.dash === 'dash' ? `${sw * 4} ${sw * 3}` : s.stroke?.dash === 'dot' ? `${sw} ${sw * 2}` : undefined} vectorEffect="non-scaling-stroke" />
      </svg>
      {paragraphs && (
        <div style={textBoxStyle(el)}>
          <ParagraphsView paragraphs={paragraphs} el={{ ...el, style: { align: 'center', ...s } }} theme={ctx.theme} editableRef={ctx.editingId === el.id ? ctx.editableRef : undefined} />
        </div>
      )}
    </>
  );
}

function LineView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const s = el.style ?? {};
  const c = el.content ?? {};
  const color = resolveColor(s.stroke?.color ?? '$text', ctx.theme);
  const w = s.stroke?.width ?? 4;
  const x1 = c.x1 - el.x, y1 = c.y1 - el.y, x2 = c.x2 - el.x, y2 = c.y2 - el.y;
  const mk = (kind?: string) => (kind && kind !== 'none' ? kind : null);
  const head = mk(s.headEnd), tail = mk(s.headStart);
  const id = `m-${el.id}`;
  const marker = (k: string, mid: string) => (
    <marker id={mid} viewBox="0 0 10 10" refX={k === 'oval' || k === 'diamond' ? 5 : 8} refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      {k === 'oval' ? <circle cx="5" cy="5" r="4" fill={color} /> : k === 'diamond' ? <path d="M5,0 L10,5 L5,10 L0,5 z" fill={color} /> : k === 'arrow' ? <path d="M0,0 L10,5 L0,10" fill="none" stroke={color} strokeWidth="2" /> : <path d="M0,0 L10,5 L0,10 z" fill={color} />}
    </marker>
  );
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        {head && marker(head, `${id}-e`)}
        {tail && marker(tail, `${id}-s`)}
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={s.stroke?.dash === 'dash' ? `${w * 3} ${w * 2}` : s.stroke?.dash === 'dot' ? `${w} ${w * 1.6}` : undefined} markerEnd={head ? `url(#${id}-e)` : undefined} markerStart={tail ? `url(#${id}-s)` : undefined} data-line-path />
    </svg>
  );
}

function TableView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const s = el.style ?? {};
  const c = el.content ?? { rows: [] };
  const t = ctx.theme;
  const rows: string[][] = c.rows ?? [];
  const totalW = (c.columnWidths as number[] | undefined)?.reduce((a: number, b: number) => a + b, 0);
  const fs = s.fontSize ?? Math.max(14, Math.min(26, el.height / Math.max(1, rows.length) / 2.4));
  const headerFill = resolveColor(s.fill ?? '$primary', t);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: s.radius ?? 12, fontFamily: fontStack(t.fonts.body), fontSize: fs, color: t.colors.text, background: t.colors.background, border: `1px solid ${t.colors.border}` }}>
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {totalW ? <colgroup>{(c.columnWidths as number[]).map((wv: number, i: number) => <col key={i} style={{ width: `${(wv / totalW) * 100}%` }} />)}</colgroup> : null}
        <tbody>
          {rows.map((r, ri) => {
            const isHeader = c.header !== false && ri === 0;
            const hl = (c.highlightRows as number[] | undefined)?.includes(ri);
            return (
              <tr key={ri} style={{ background: isHeader ? headerFill : hl ? withAlpha(t.colors.accent, 0.16) : ri % 2 === 0 ? t.colors.surface : t.colors.background }}>
                {r.map((cell, ci) => {
                  const Tag = isHeader ? 'th' : 'td';
                  const num = /^[-+]?[$€£¥₫]?[\d.,]+%?[KMB]?$/.test(String(cell).trim());
                  return (
                    <Tag key={ci} style={{ padding: `${fs * 0.35}px ${fs * 0.7}px`, textAlign: s.align ?? (num && !isHeader ? 'right' : 'left'), fontWeight: isHeader || (c.firstColumn && ci === 0) || hl ? 700 : 400, color: isHeader ? resolveColor(s.color ?? '#ffffff', t) : undefined, borderBottom: `1px solid ${t.colors.border}`, overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
                      {String(cell)}
                    </Tag>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormulaView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const html = useMemo(() => {
    try { return katex.renderToString(String(el.content?.latex ?? ''), { displayMode: el.content?.display !== false, throwOnError: false, output: 'html', trust: false, strict: 'ignore' }); } catch (e) { return `<span style="color:#dc2626">${(e as Error).message}</span>`; }
  }, [el.content?.latex, el.content?.display]);
  const s = el.style ?? {};
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center', fontSize: s.fontSize ?? 48, color: resolveColor(s.color ?? '$text', ctx.theme), overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const CODE_THEME = {
  dark: { bg: '#0d1117', fg: '#e6edf3', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff', comment: '#8b949e', title: '#d2a8ff', attr: '#79c0ff', built_in: '#ffa657', literal: '#79c0ff', type: '#ffa657', meta: '#8b949e', variable: '#ffa657', params: '#e6edf3' },
  light: { bg: '#f6f8fa', fg: '#24292f', keyword: '#cf222e', string: '#0a3069', number: '#0550ae', comment: '#6e7781', title: '#8250df', attr: '#0550ae', built_in: '#953800', literal: '#0550ae', type: '#953800', meta: '#6e7781', variable: '#953800', params: '#24292f' },
};
function CodeView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const c = el.content ?? {};
  const s = el.style ?? {};
  const dark = s.variant ? s.variant !== 'light' : true;
  const pal = dark ? CODE_THEME.dark : CODE_THEME.light;
  const html = useMemo(() => {
    const code = String(c.code ?? '');
    try {
      return c.language && hljs.getLanguage(c.language) ? hljs.highlight(code, { language: c.language }).value : hljs.highlightAuto(code).value;
    } catch { return code.replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m]!); }
  }, [c.code, c.language]);
  const lines = html.split('\n');
  const fs = s.fontSize ?? 22;
  const css = Object.entries(pal).filter(([k]) => !['bg', 'fg'].includes(k)).map(([k, v]) => `[data-code="${el.id}"] .hljs-${k}{color:${v}}`).join('');
  return (
    <div data-code={el.id} style={{ position: 'absolute', inset: 0, background: pal.bg, color: pal.fg, borderRadius: s.radius ?? 16, overflow: 'hidden', fontFamily: fontStack(ctx.theme.fonts.mono), fontSize: fs, lineHeight: 1.55, boxShadow: shadowCss(s.shadow, ctx.theme) }}>
      <style>{css}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${fs * 0.6}px ${fs}px`, borderBottom: `1px solid ${dark ? '#30363d' : '#d0d7de'}` }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((col) => <span key={col} style={{ width: fs * 0.55, height: fs * 0.55, borderRadius: 99, background: col }} />)}
        <span style={{ marginLeft: 12, opacity: 0.7, fontSize: fs * 0.75 }}>{c.title ?? c.language ?? 'code'}</span>
      </div>
      <pre style={{ margin: 0, padding: `${fs * 0.7}px ${fs}px`, whiteSpace: 'pre', overflow: 'hidden' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', background: (c.highlightLines as number[] | undefined)?.includes(i + 1) ? (dark ? 'rgba(56,139,253,0.18)' : 'rgba(84,174,255,0.2)') : undefined }}>
            {c.showLineNumbers && <span style={{ width: `${String(lines.length).length + 1.5}ch`, opacity: 0.4, flex: 'none', textAlign: 'right', paddingRight: '1.2ch', userSelect: 'none' }}>{i + 1}</span>}
            <span dangerouslySetInnerHTML={{ __html: l || ' ' }} />
          </div>
        ))}
      </pre>
    </div>
  );
}

function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return m ? m[1] : null;
}
function MediaView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const c = el.content ?? {};
  const src = String(c.src ?? '');
  const interactive = ctx.mode === 'present';
  if (!isSafeUrl(src, 'media')) return <div style={{ position: 'absolute', inset: 0, background: '#111', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Blocked media URL</div>;
  if (el.type === 'audio') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderRadius: 999, background: ctx.theme.colors.surface, border: `2px solid ${ctx.theme.colors.border}` }}>
        <IconSvg name="headphones" size={Math.min(48, el.height * 0.5)} color={ctx.theme.colors.primary} />
        {interactive ? <audio src={src} controls={c.controls !== false} autoPlay={c.autoplay} loop={c.loop} style={{ flex: 1 }} /> : <span style={{ fontFamily: fontStack(ctx.theme.fonts.body), fontSize: Math.min(26, el.height * 0.3), color: ctx.theme.colors.text }}>{c.title ?? 'Audio'}</span>}
      </div>
    );
  }
  const yt = youtubeId(src);
  if (yt) {
    return interactive ? (
      <iframe title={c.title ?? 'video'} src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0${c.autoplay ? '&autoplay=1&mute=1' : ''}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: el.style?.radius ?? 0 }} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
    ) : (
      <div style={{ position: 'absolute', inset: 0, borderRadius: el.style?.radius ?? 0, overflow: 'hidden', background: `#000 url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg) center/cover` }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 96, height: 68, borderRadius: 18, background: '#ff0033', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconSvg name="play" size={36} color="#fff" /></div></div>
      </div>
    );
  }
  return <video src={src} poster={c.poster} controls={interactive && c.controls !== false} autoPlay={interactive && c.autoplay} loop={c.loop} muted={c.muted ?? c.autoplay} playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.style?.radius ?? 0, background: '#000' }} />;
}

function SvgMarkup({ markup }: { markup: string }) {
  const safe = useMemo(() => sanitizeSvg(markup), [markup]);
  return <div style={{ position: 'absolute', inset: 0 }} className="[&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: safe }} />;
}

export function ElementContent({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  const t = ctx.theme;
  switch (el.type) {
    case 'text': case 'heading': case 'paragraph': case 'richText': {
      const s = el.style ?? {};
      return (
        <div style={{ ...textBoxStyle(el), background: s.gradient ? gradientCss(s.gradient, t) : s.fill ? resolveColor(s.fill, t) : undefined, borderRadius: s.radius, boxShadow: shadowCss(s.shadow, t), border: s.stroke?.width ? `${s.stroke.width}px solid ${resolveColor(s.stroke.color ?? '$border', t)}` : undefined }}>
          <ParagraphsView paragraphs={el.content?.paragraphs ?? []} el={el} theme={t} editableRef={ctx.editingId === el.id ? ctx.editableRef : undefined} />
        </div>
      );
    }
    case 'image': return <ImageView el={el} ctx={ctx} />;
    case 'shape': return <ShapeView el={el} ctx={ctx} />;
    case 'line': case 'arrow': return <LineView el={el} ctx={ctx} />;
    case 'table': return <TableView el={el} ctx={ctx} />;
    case 'chart': return <ChartView el={el} theme={t} />;
    case 'diagram': case 'smartart': return <SceneMemo el={el} theme={t} kind="diagram" />;
    case 'timeline': return <SceneMemo el={el} theme={t} kind="timeline" />;
    case 'infographic': return <SceneMemo el={el} theme={t} kind="infographic" />;
    case 'formula': return <FormulaView el={el} ctx={ctx} />;
    case 'code': return <CodeView el={el} ctx={ctx} />;
    case 'video': case 'audio': return <MediaView el={el} ctx={ctx} />;
    case 'icon': {
      const s = el.style ?? {};
      const size = Math.min(el.width, el.height);
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.fill ? resolveColor(s.fill, t) : undefined, borderRadius: s.radius ?? (s.fill ? size : 0) }}>
          <IconSvg name={el.content?.name ?? 'circle'} size={s.fill ? size * 0.56 : size} color={resolveColor(s.color ?? '$primary', t)} strokeWidth={s.strokeWidth ?? 2} />
        </div>
      );
    }
    case 'svg': return <SvgMarkup markup={String(el.content?.markup ?? '')} />;
    case 'decorative': return <RawSvg html={decorSvg(el.content?.kind, Math.round(el.width), Math.round(el.height), el.content?.colors, t, el.content?.seed ?? 7, el.id)} />;
    case 'visual3d': return <RawSvg html={visual3dSvg(el.content?.kind, Math.round(el.width), Math.round(el.height), el.content?.colors, el.content?.items, t, el.id)} />;
    case 'group': return (
      <>
        {(el.content?.children as SlideElement[] | undefined ?? []).map((c) => (
          <div key={c.id} style={{ position: 'absolute', left: c.x, top: c.y, width: c.width, height: c.height, transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined, opacity: c.opacity, zIndex: c.zIndex }}>
            <ElementContent el={c} ctx={ctx} />
          </div>
        ))}
      </>
    );
    default:
      return null;
  }
}

const RawSvg = memo(function RawSvg({ html }: { html: string }) {
  return <div style={{ position: 'absolute', inset: 0 }} className="[&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: html }} />;
});

const ChartView = memo(function ChartView({ el, theme }: { el: SlideElement; theme: Theme }) {
  const scene = useMemo(() => buildChartScene(el.content, theme, el.width, el.height), [el.content, theme, el.width, el.height]);
  return <div style={{ position: 'absolute', inset: 0 }}><SceneSvg scene={scene} /></div>;
});
const SceneMemo = memo(function SceneMemo({ el, theme, kind }: { el: SlideElement; theme: Theme; kind: 'diagram' | 'timeline' | 'infographic' }) {
  const scene = useMemo(() => (kind === 'diagram' ? buildDiagramScene(el.content, theme, el.width, el.height) : kind === 'timeline' ? buildTimelineScene(el.content, theme, el.width, el.height) : buildInfographicScene(el.content, theme, el.width, el.height)), [el.content, theme, el.width, el.height, kind]);
  return <div style={{ position: 'absolute', inset: 0 }}><SceneSvg scene={scene} /></div>;
});
