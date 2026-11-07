import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { loadProject } from '@/services/storage/projectStorage';
import type { Slide } from '@/types/slide';
import { SlideCanvas } from '@/components/slide/SlideCanvas';

interface ProjectSlidePreviewProps {
  projectId: string;
  fallbackImage?: string;
}

export function ProjectSlidePreview({ projectId, fallbackImage }: ProjectSlidePreviewProps) {
  const [slide, setSlide] = useState<Slide | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(0.1);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const project = loadProject(projectId);
      setSlide(project?.slideDocument?.slides[0] ?? null);
      setLoadError(null);
    } catch (error) {
      setSlide(null);
      setLoadError(error instanceof Error ? error.message : 'Could not load slide preview.');
    }
  }, [projectId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !slide) return;

    const updateScale = () => {
      if (viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
      setScale(
        Math.min(
          viewport.clientWidth / slide.width,
          viewport.clientHeight / slide.height,
        ),
      );
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    updateScale();
    return () => observer.disconnect();
  }, [slide]);

  return (
    <div
      ref={viewportRef}
      className="flex aspect-video w-full items-center justify-center overflow-hidden bg-bg-tertiary"
      title={loadError ?? 'First slide preview'}
    >
      {slide ? (
        <SlideCanvas slide={slide} scale={scale} />
      ) : fallbackImage ? (
        <img src={fallbackImage} alt="Project first slide preview" className="h-full w-full object-cover" />
      ) : loadError ? (
        <span className="px-3 text-center text-xs text-red-300">Preview unavailable</span>
      ) : (
        <FolderOpen className="h-8 w-8 text-text-muted" aria-hidden="true" />
      )}
    </div>
  );
}
