import PptxGenJS from 'pptxgenjs';
import type { SlideDocument } from '@/types/slide';
import {
  PPTX_WIDTH_IN,
  PPTX_HEIGHT_IN,
  PX_TO_PT,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
} from '@/types/slide';

function pxToIn(px: number, axis: 'x' | 'y'): number {
  if (axis === 'x') return (px / SLIDE_WIDTH) * PPTX_WIDTH_IN;
  return (px / SLIDE_HEIGHT) * PPTX_HEIGHT_IN;
}

/**
 * Export supported contract elements to native editable PPTX objects.
 * Does not flatten slides to screenshots.
 */
export async function exportToPptx(doc: SlideDocument, fileName: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: 'SLIDECRAFT_16x9',
    width: PPTX_WIDTH_IN,
    height: PPTX_HEIGHT_IN,
  });
  pptx.layout = 'SLIDECRAFT_16x9';

  for (const slide of doc.slides) {
    const s = pptx.addSlide();
    const bg = slide.background?.color ?? '#0E111B';
    s.background = { color: bg.replace('#', '') };

    // Sort by zIndex then document order
    const els = [...slide.elements].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );

    for (const el of els) {
      if (el.type === 'text') {
        s.addText(el.content || ' ', {
          x: pxToIn(el.x, 'x'),
          y: pxToIn(el.y, 'y'),
          w: pxToIn(el.width, 'x'),
          h: pxToIn(el.height, 'y'),
          fontSize: (el.fontSize ?? 24) * PX_TO_PT,
          fontFace: (el.fontFamily ?? 'Arial').split(',')[0].replace(/['"]/g, '').trim() || 'Arial',
          color: (el.color ?? '#F7F7FC').replace('#', ''),
          bold: Number(el.fontWeight) >= 600 || el.fontWeight === 'bold',
          align: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'right' : 'left',
          valign: 'top',
        });
      } else if (el.type === 'shape') {
        const shapeType =
          el.shapeType === 'circle' || el.shapeType === 'ellipse'
            ? pptx.ShapeType.ellipse
            : pptx.ShapeType.rect;
        s.addShape(shapeType, {
          x: pxToIn(el.x, 'x'),
          y: pxToIn(el.y, 'y'),
          w: pxToIn(el.width, 'x'),
          h: pxToIn(el.height, 'y'),
          fill: { color: (el.fill ?? '8B7CFF').replace('#', '') },
          line: el.stroke
            ? { color: el.stroke.replace('#', ''), width: el.strokeWidth ?? 1 }
            : { color: (el.fill ?? '8B7CFF').replace('#', ''), width: 0 },
        });
      } else if (el.type === 'image' && el.src) {
        // Remote URLs may fail CORS; data URLs and same-origin work best
        try {
          s.addImage({
            path: el.src,
            x: pxToIn(el.x, 'x'),
            y: pxToIn(el.y, 'y'),
            w: pxToIn(el.width, 'x'),
            h: pxToIn(el.height, 'y'),
          });
        } catch {
          // Skip images that cannot be embedded; reported in compatibility later
        }
      } else if (el.type === 'line') {
        s.addShape(pptx.ShapeType.line, {
          x: pxToIn(el.x, 'x'),
          y: pxToIn(el.y, 'y'),
          w: pxToIn(el.x2 - el.x, 'x'),
          h: pxToIn(el.y2 - el.y, 'y'),
          line: {
            color: (el.stroke ?? 'F7F7FC').replace('#', ''),
            width: el.strokeWidth ?? 2,
          },
        });
      }
      // unsupported / approximate elements are omitted from native objects
      // and listed in the compatibility report (already attached to the document)
    }
  }

  const safeName = fileName.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'presentation';
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}
