import type { CSSProperties } from 'react';
import type { Paragraph, Run, SlideElement, Theme } from '@/types/schema';
import { resolveColor, resolveFont } from '@/themes/themes';
import { fontStack, gradientCss, paddingCss } from './css';

export function textDefaults(el: SlideElement, theme: Theme) {
  const isHeading = el.type === 'heading';
  const s = el.style ?? {};
  return {
    fontSize: s.fontSize ?? (isHeading ? theme.fontScale.h2 : el.type === 'shape' ? 26 : theme.fontScale.body),
    fontFamily: resolveFont(s.fontFamily, theme, isHeading ? 'heading' : 'body'),
    fontWeight: s.fontWeight ?? (isHeading ? theme.typography.headingWeight : theme.typography.bodyWeight),
    color: resolveColor(s.color, theme, el.type === 'shape' ? '#ffffff' : theme.colors.text),
    lineHeight: s.lineHeight ?? (isHeading ? theme.typography.headingLineHeight : theme.typography.bodyLineHeight),
    letterSpacing: s.letterSpacing ?? (isHeading ? theme.typography.headingLetterSpacing * ((s.fontSize ?? theme.fontScale.h2) / 80) : 0),
    textTransform: s.textTransform ?? (isHeading && theme.typography.headingTransform === 'uppercase' ? 'uppercase' : undefined),
  };
}

export function runStyle(r: Run, theme: Theme): CSSProperties {
  return {
    fontWeight: r.bold ? 700 : undefined,
    fontStyle: r.italic ? 'italic' : undefined,
    textDecoration: [r.underline ? 'underline' : '', r.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
    color: r.color ? resolveColor(r.color, theme) : undefined,
    background: r.highlight ? resolveColor(r.highlight, theme) : r.code ? 'rgba(127,127,127,0.16)' : undefined,
    fontFamily: r.code ? fontStack(theme.fonts.mono) : r.fontFamily ? fontStack(resolveFont(r.fontFamily, theme)) : undefined,
    fontSize: r.fontSize ? `${r.fontSize}px` : r.code ? '0.9em' : undefined,
    padding: r.code ? '0 0.25em' : undefined,
    borderRadius: r.code ? '0.2em' : undefined,
    verticalAlign: r.superscript ? 'super' : r.subscript ? 'sub' : undefined,
  };
}

export function ParagraphsView({ paragraphs, el, theme, editableRef }: { paragraphs: Paragraph[]; el: SlideElement; theme: Theme; editableRef?: React.Ref<HTMLDivElement> }) {
  const s = el.style ?? {};
  const d = textDefaults(el, theme);
  const counters: number[] = [];
  const gradient = s.textGradient ? gradientCss(s.textGradient, theme) : undefined;
  const base: CSSProperties = {
    fontFamily: fontStack(d.fontFamily), fontSize: d.fontSize, fontWeight: d.fontWeight as CSSProperties['fontWeight'], color: d.color, lineHeight: d.lineHeight,
    letterSpacing: d.letterSpacing ? `${d.letterSpacing}px` : undefined, textAlign: s.align ?? undefined, textTransform: d.textTransform as CSSProperties['textTransform'],
    fontStyle: s.italic ? 'italic' : undefined, textDecoration: s.underline ? 'underline' : undefined,
    textShadow: s.textShadow ? `${s.textShadow.x ?? 0}px ${s.textShadow.y ?? 2}px ${s.textShadow.blur ?? 8}px ${resolveColor(s.textShadow.color ?? 'rgba(0,0,0,.4)', theme)}` : undefined,
    ...(gradient ? { backgroundImage: gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}),
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'normal',
  };
  return (
    <div ref={editableRef} style={base} data-text-root>
      {paragraphs.map((p, i) => {
        const level = p.level ?? 0;
        if (!p.list) counters.length = 0;
        let marker: string | null = null;
        if (p.list === 'number') {
          counters[level] = (counters[level] ?? 0) + 1;
          counters.length = level + 1;
          marker = `${counters[level]}.`;
        } else if (p.list === 'bullet') marker = level % 2 ? '◦' : '•';
        const empty = p.runs.every((r) => !r.text);
        return (
          <div
            key={i}
            data-p={i}
            data-list={p.list}
            data-level={level || undefined}
            style={{
              display: marker ? 'flex' : 'block', gap: marker ? '0.55em' : undefined, paddingLeft: marker ? `${level * 1.2}em` : undefined,
              marginBottom: i < paragraphs.length - 1 ? s.paragraphSpacing ?? 0 : 0, textAlign: p.align ?? undefined,
            }}
          >
            {marker && (
              <span contentEditable={false} style={{ color: p.list === 'bullet' ? resolveColor('$accent', theme) : undefined, fontWeight: p.list === 'number' ? 700 : 400, flex: 'none', minWidth: p.list === 'number' ? '1.3em' : '0.6em', userSelect: 'none' }}>
                {marker}
              </span>
            )}
            <span style={{ flex: marker ? 1 : undefined }}>
              {empty ? '​' : p.runs.map((r, j) => (r.link ? (
                <a key={j} href={r.link} target="_blank" rel="noopener noreferrer" style={{ ...runStyle(r, theme), color: runStyle(r, theme).color ?? 'inherit' }} onClick={(e) => { if (!(e.currentTarget.closest('[data-present]'))) e.preventDefault(); }}>{r.text}</a>
              ) : (
                <span key={j} style={runStyle(r, theme)}>{r.text}</span>
              )))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function textBoxStyle(el: SlideElement): CSSProperties {
  const s = el.style ?? {};
  const v = s.verticalAlign ?? (el.type === 'shape' ? 'middle' : 'top');
  return {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    justifyContent: v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start',
    padding: paddingCss(s.padding) ?? (el.type === 'shape' ? '12px 20px' : undefined),
    overflow: 'visible',
  };
}
