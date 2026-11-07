import type {
  Slide,
  SlideDocument,
  CompatibilityReport,
  CompatibilityIssue,
} from '@/types/slide';
import type {
  TextElement,
  ShapeElement,
  ImageElement,
  SlideElement,
} from '@/types/element';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/slide';
import { generateId } from '@/lib/utils';

function attr(block: string, name: string): string | undefined {
  // 1. Quét prop trực tiếp: name="value", name={'value'}, name={123}
  const re = new RegExp(`${name}=\\{?["'\`]([^"'\`]+)["'\`]\\}?|${name}=\\{([^}]+)\\}`);
  const m = block.match(re);
  if (m?.[1] || m?.[2]) return (m[1] ?? m[2]).trim();

  // 2. Fallback: Quét thuộc tính nằm bên trong style={{ ... }}
  const styleMatch = block.match(/style=\s*\{\s*\{([^}]+)\}\s*\}/);
  if (styleMatch) {
    const styleContent = styleMatch[1];
    const altNames = [name];
    if (name === 'fill') altNames.push('background', 'backgroundColor', 'bg');
    if (name === 'color') altNames.push('textColor');
    if (name === 'borderRadius') altNames.push('border-radius');
    if (name === 'fontSize') altNames.push('font-size');
    if (name === 'fontWeight') altNames.push('font-weight');
    if (name === 'textAlign') altNames.push('text-align');

    for (const alt of altNames) {
      const styleRe = new RegExp(`${alt}\\s*:\\s*["'\`]([^"'\`]+)["'\`]|${alt}\\s*:\\s*([^,\\s}]+)`);
      const sm = styleContent.match(styleRe);
      if (sm?.[1] || sm?.[2]) return (sm[1] ?? sm[2]).trim();
    }
  }
  return undefined;
}

function numAttr(block: string, name: string, fallback: number): number {
  const v = attr(block, name);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function extractChildrenText(block: string): string {
  const m = block.match(/>([\s\S]*?)<\/SlideText>/);
  if (!m) return '';
  let text = m[1];
  // Chuyển thẻ <br/> thành xuống dòng
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Lọc bỏ các thẻ HTML khác nếu có
  text = text.replace(/<[^>]+>/g, '');
  // Bỏ bọc string JSX như {"text"} hoặc {`text`}
  text = text.replace(/\{['"`]([\s\S]*?)['"`]\}/g, '$1');
  text = text.replace(/\{\s*`([\s\S]*?)`\s*\}/g, '$1');
  return text.trim();
}

function parseSlideBlock(raw: string, index: number): Slide {
  const id = attr(raw, 'id') ?? generateId(`slide-${index}`);
  const background = attr(raw, 'background') ?? attr(raw, 'bg') ?? '#0E111B';

  const elements: SlideElement[] = [];
  const issues: CompatibilityIssue[] = [];

  // Quét các phần tử theo đúng thứ tự xuất hiện trong JSX
  const elemRe = /<(SlideText|SlideShape|SlideImage)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let em: RegExpExecArray | null;

  while ((em = elemRe.exec(raw))) {
    const tag = em[1];
    const open = em[2] ?? '';
    const full = em[0];

    if (tag === 'SlideText') {
      const body = em[3] ? extractChildrenText(full) : (attr(open, 'text') ?? '');
      const el: TextElement = {
        id: attr(open, 'id') ?? generateId('text'),
        type: 'text',
        x: numAttr(open, 'x', 0),
        y: numAttr(open, 'y', 0),
        width: numAttr(open, 'width', 400),
        height: numAttr(open, 'height', 60),
        content: body,
        fontSize: numAttr(open, 'fontSize', 24),
        fontWeight: attr(open, 'fontWeight') ?? 400,
        color: attr(open, 'color') ?? '#F7F7FC',
        fontFamily: attr(open, 'fontFamily') ?? 'Inter, sans-serif',
        textAlign: (attr(open, 'textAlign') as TextElement['textAlign']) ?? 'left',
        lineHeight: numAttr(open, 'lineHeight', 1.3),
        source: 'contract',
      };
      elements.push(el);
    } else if (tag === 'SlideShape') {
      const el: ShapeElement = {
        id: attr(open, 'id') ?? generateId('shape'),
        type: 'shape',
        shapeType: (attr(open, 'shapeType') as ShapeElement['shapeType']) ?? 'rectangle',
        x: numAttr(open, 'x', 0),
        y: numAttr(open, 'y', 0),
        width: numAttr(open, 'width', 200),
        height: numAttr(open, 'height', 200),
        fill: attr(open, 'fill') ?? attr(open, 'bg') ?? 'transparent',
        stroke: attr(open, 'stroke'),
        strokeWidth: numAttr(open, 'strokeWidth', 0),
        borderRadius: numAttr(open, 'borderRadius', 0),
        source: 'contract',
      };
      elements.push(el);
    } else if (tag === 'SlideImage') {
      const src = attr(open, 'src');
      if (!src) {
        issues.push({
          slideId: id,
          severity: 'warning',
          code: 'IMAGE_MISSING_SRC',
          message: 'SlideImage without src was skipped',
        });
        continue;
      }
      const el: ImageElement = {
        id: attr(open, 'id') ?? generateId('image'),
        type: 'image',
        src,
        x: numAttr(open, 'x', 0),
        y: numAttr(open, 'y', 0),
        width: numAttr(open, 'width', 400),
        height: numAttr(open, 'height', 300),
        objectFit: (attr(open, 'objectFit') as ImageElement['objectFit']) ?? 'cover',
        borderRadius: numAttr(open, 'borderRadius', 0),
        alt: attr(open, 'alt') ?? '',
        source: 'contract',
      };
      elements.push(el);
    }
  }

  return {
    id,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    background: { type: 'solid', color: background },
    elements,
    source: 'contract',
    hasUnsupportedContent: false,
  };
}

export function parseContractSlides(source: string): SlideDocument {
  const slides: Slide[] = [];
  const allIssues: CompatibilityIssue[] = [];

  const slideRe = /<Slide\b([^>]*)>([\s\S]*?)<\/Slide>/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = slideRe.exec(source))) {
    const openAttrs = m[1] ?? '';
    const body = m[2] ?? '';
    const combined = openAttrs + '>' + body;
    const slide = parseSlideBlock(combined, idx);
    slides.push(slide);
    idx += 1;
  }

  if (slides.length === 0) {
    const divRe = /<div[^>]*data-slide=["']true["'][^>]*>([\s\S]*?)<\/div>/gi;
    if (divRe.test(source)) {
      throw new Error(
        'Found data-slide markers but no PresentationDeck/Slide contract components.',
      );
    }
    throw new Error(
      'No <Slide> components found. Paste code that uses PresentationDeck and Slide.',
    );
  }

  const approximate = slides.reduce(
    (n, s) => n + s.elements.filter((e) => e.approximate).length,
    0,
  );
  const unsupported = slides.reduce(
    (n, s) => n + s.elements.filter((e) => e.type === 'unsupported').length,
    0,
  );

  const compatibility: CompatibilityReport = {
    generatedAt: new Date().toISOString(),
    fullyEditable: approximate === 0 && unsupported === 0,
    approximateElements: approximate,
    unsupportedElements: unsupported,
    issues: allIssues,
  };

  return {
    version: 1,
    slideWidth: SLIDE_WIDTH,
    slideHeight: SLIDE_HEIGHT,
    slides,
    compatibility,
  };
}