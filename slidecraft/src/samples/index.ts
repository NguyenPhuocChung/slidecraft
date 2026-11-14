import { academic } from './academic';
import { businessPitch } from './business-pitch';
import { dataReport } from './data-report';
import { marketing } from './marketing';
import { technology } from './technology';

export interface SampleInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  theme: string;
  slideCount: number;
  /** Raw SlideCraft contract object (schemaVersion "1.0") */
  data: Record<string, unknown>;
}

const make = (category: string, data: Record<string, unknown>): SampleInfo => ({
  id: String(data.id),
  title: String(data.title),
  description: String(data.description ?? ''),
  category,
  theme: String(data.theme),
  slideCount: (data.slides as unknown[]).length,
  data,
});

export const SAMPLES: SampleInfo[] = [
  make('Business Pitch Deck', businessPitch),
  make('Academic Presentation', academic),
  make('Technology Presentation', technology),
  make('Marketing Presentation', marketing),
  make('Data Report', dataReport),
];

export function sampleCode(id: string): string | undefined {
  const s = SAMPLES.find((x) => x.id === id);
  return s ? JSON.stringify(s.data, null, 2) : undefined;
}
