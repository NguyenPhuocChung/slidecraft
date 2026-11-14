import type { PresentationDoc } from '../repositories/types';

/** Server-side export of a stored presentation as SlideCraft contract JSON (re-importable). */
export function toContractJson(p: PresentationDoc): Record<string, unknown> {
  const data = (p.data && typeof p.data === 'object' ? structuredClone(p.data) : {}) as Record<string, unknown>;
  return { schemaVersion: '1.0', ...data, title: data.title ?? p.title, metadata: { ...((data.metadata as object) ?? {}), exportedFrom: 'SlideCraft AI Studio', exportedAt: new Date().toISOString(), serverVersion: p.version } };
}
