import type { Slide } from '@/types/slide';

export function SlideCanvas({ slide, scale }: { slide: Slide; scale: number }) {
  const background =
    slide.background?.color ??
    (slide.background as { color?: string } | undefined)?.color ??
    '#0E111B';

  return (
    <div
      className="relative shrink-0 overflow-hidden shadow-card"
      style={{ width: slide.width * scale, height: slide.height * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left overflow-hidden"
        style={{
          width: slide.width,
          height: slide.height,
          transform: `scale(${scale})`,
          background:
            slide.background?.type === 'gradient' && slide.background.gradient
              ? `linear-gradient(${slide.background.gradient.angle ?? 0}deg, ${slide.background.gradient.from}, ${slide.background.gradient.to})`
              : slide.background?.type === 'image' && slide.background.imageSrc
                ? `url("${slide.background.imageSrc}") center / cover`
                : background,
        }}
      >
        {slide.elements.map((element) => {
          if (element.type === 'shape') {
            return (
              <div
                key={element.id}
                style={{
                  position: 'absolute',
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  background: element.fill,
                  borderRadius:
                    element.shapeType === 'circle' || element.shapeType === 'ellipse'
                      ? '50%'
                      : element.borderRadius ?? 0,
                  borderStyle: element.stroke ? 'solid' : 'none',
                  borderColor: element.stroke,
                  borderWidth: element.strokeWidth ?? 0,
                }}
              />
            );
          }

          if (element.type === 'image') {
            return (
              <img
                key={element.id}
                src={element.src}
                alt={element.alt ?? ''}
                style={{
                  position: 'absolute',
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  objectFit: element.objectFit ?? 'cover',
                  borderRadius: element.borderRadius,
                }}
              />
            );
          }

          if (element.type === 'text') {
            return (
              <div
                key={element.id}
                style={{
                  position: 'absolute',
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  minHeight: element.height,
                  fontSize: element.fontSize ?? 18,
                  fontWeight: element.fontWeight || 400,
                  color: element.color || '#F7F7FC',
                  fontFamily: element.fontFamily || 'Inter, system-ui, sans-serif',
                  textAlign: element.textAlign || 'left',
                  lineHeight: element.lineHeight ?? 1.3,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {element.content || ''}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
