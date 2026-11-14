import { useMemo } from 'react';
import type { Presentation } from '@/types/schema';
import { SAMPLES, type SampleInfo } from '@/samples';
import { importPresentation } from '@/code-parser';
import { saveNewProject } from '@/services/projects';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { uid } from '@/utils/id';
import { tr } from '@/i18n';

const cache = new Map<string, Presentation>();
export function normalizedSample(s: SampleInfo): Presentation | undefined {
  if (cache.has(s.id)) return cache.get(s.id);
  const { presentation } = importPresentation(JSON.stringify(s.data));
  if (presentation) cache.set(s.id, presentation);
  return presentation;
}

export async function openSampleAsProject(id: string): Promise<Presentation> {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(tr('Unknown template'));
  const { presentation, analysis } = importPresentation(JSON.stringify(s.data));
  if (!presentation) throw new Error(analysis.report.issues.find((i) => i.severity === 'error')?.message ?? tr('Template could not be built'));
  return saveNewProject({ ...presentation, id: uid('pres') }, `From template: ${s.title}`);
}

export function SampleThumb({ sample, width, slideIndex = 0 }: { sample: SampleInfo; width: number; slideIndex?: number }) {
  const p = useMemo(() => normalizedSample(sample), [sample]);
  if (!p || !width) return <div style={{ width, height: (width * 9) / 16 }} className="bg-ink-100 dark:bg-ink-800" />;
  return <SlideRenderer slide={p.slides[slideIndex] ?? p.slides[0]} presentation={p} scale={width / p.size.width} mode="thumb" />;
}
