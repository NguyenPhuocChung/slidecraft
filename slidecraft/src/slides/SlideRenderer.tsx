import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Presentation, Slide, SlideElement, Theme } from '@/types/schema';
import { getTheme } from '@/themes/themes';
import { useImageSrc } from '@/media/resolver';
import { backgroundCss, fontStack } from './css';
import { ElementContent, type RenderCtx } from './ElementView';

export function presentationTheme(p: Pick<Presentation, 'theme' | 'themeOverrides'>, slide?: Slide): Theme {
  if (slide?.theme && slide.theme !== p.theme) return getTheme(slide.theme);
  return getTheme(p.theme, p.themeOverrides);
}

export interface SlideRendererProps {
  slide: Slide;
  presentation: Pick<Presentation, 'theme' | 'themeOverrides' | 'size' | 'assets' | 'globalStyles'>;
  /** pixels per logical px */
  scale?: number;
  mode?: RenderCtx['mode'];
  editingId?: string | null;
  editableRef?: React.Ref<HTMLDivElement>;
  hiddenIds?: Set<string>;
  slideNumber?: number;
  /** extra props per element (editor hit testing) */
  elementAttrs?: (el: SlideElement) => Record<string, unknown>;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  rootRef?: React.Ref<HTMLDivElement>;
}

function Background({ slide, theme }: { slide: Slide; theme: Theme }) {
  const bg = slide.background ?? theme.background;
  const { src } = useImageSrc(bg?.type === 'image' ? bg.image : undefined, undefined, 16, 9);
  return <div style={{ position: 'absolute', inset: 0, ...backgroundCss(bg, theme, src ?? undefined) }} data-slide-bg />;
}

export const SlideRenderer = memo(function SlideRenderer({ slide, presentation, scale = 1, mode = 'thumb', editingId, editableRef, hiddenIds, slideNumber, elementAttrs, children, className, style, rootRef }: SlideRendererProps) {
  const theme = useMemo(() => presentationTheme(presentation, slide), [presentation, slide]);
  const { width: W, height: H } = presentation.size;
  const ctx: RenderCtx = { theme, assets: presentation.assets ?? [], mode, editingId, editableRef };
  const sorted = useMemo(() => [...slide.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)), [slide.elements]);
  const footer = presentation.globalStyles?.footer;
  return (
    <div className={className} style={{ width: W * scale, height: H * scale, position: 'relative', overflow: 'hidden', ...style }} data-slide-id={slide.id}>
      <div ref={rootRef} style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0, overflow: 'hidden', fontFamily: fontStack(theme.fonts.body), color: theme.colors.text }} data-slide-canvas data-theme-mode={theme.mode}>
        <Background slide={slide} theme={theme} />
        {sorted.map((el) => {
          if (el.visible === false && mode !== 'edit') return null;
          const hidden = hiddenIds?.has(el.id);
          return (
            <div
              key={el.id}
              data-el-id={el.id}
              data-el-type={el.type}
              style={{
                position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                opacity: hidden ? 0 : el.visible === false ? 0.25 : el.opacity ?? 1,
                zIndex: el.zIndex,
              }}
              {...(elementAttrs ? elementAttrs(el) : {})}
            >
              <div data-el-inner style={{ position: 'absolute', inset: 0 }}>
                {el.link && mode === 'present' ? (
                  <a href={el.link} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', inset: 0, display: 'block' }}><ElementContent el={el} ctx={ctx} /></a>
                ) : <ElementContent el={el} ctx={ctx} />}
              </div>
            </div>
          );
        })}
        {(presentation.globalStyles?.slideNumbers || footer) && (
          <div style={{ position: 'absolute', left: 48, right: 48, bottom: 28, display: 'flex', justifyContent: 'space-between', fontSize: 18, color: theme.colors.textMuted, zIndex: 9999, pointerEvents: 'none' }}>
            <span>{footer ?? ''}</span>
            <span>{presentation.globalStyles?.slideNumbers && slideNumber ? slideNumber : ''}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
});
