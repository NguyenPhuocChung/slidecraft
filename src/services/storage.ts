/**
 * Local-first project storage (IndexedDB via idb-keyval) with optional cloud sync.
 * Every save is written locally first, so refreshing the page never loses work
 * (Offline Draft Support); when the user is signed in and the API is reachable
 * the project is pushed to the server as well (Cloud Sync).
 */
import { createStore, del, get, set } from 'idb-keyval';
import type { Presentation } from '@/types/schema';
import { api, apiAvailable, auth } from './api';

export type ProjectStatus = 'draft' | 'exported' | 'shared' | 'archived';
export interface ProjectMeta {
  id: string;
  title: string;
  description?: string;
  theme: string;
  slideCount: number;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  exportedAt?: number;
  thumbnail?: string;
  starred?: boolean;
  cloudId?: string;
  cloudSyncedAt?: number;
  version: number;
}
export interface VersionEntry { id: string; createdAt: number; label: string; slideCount: number; data: Presentation }
export interface HistoryEntry { id: string; at: number; kind: 'export' | 'import'; format: string; detail: string; projectId?: string; ok: boolean }

const store = typeof indexedDB !== 'undefined' ? createStore('slidecraft', 'kv') : undefined;
const mem = new Map<string, unknown>();
async function kget<T>(k: string): Promise<T | undefined> { return store ? get<T>(k, store) : (mem.get(k) as T | undefined); }
async function kset(k: string, v: unknown) { if (store) await set(k, v, store); else mem.set(k, v); }
async function kdel(k: string) { if (store) await del(k, store); else mem.delete(k); }

const MAX_VERSIONS = 40;

export const storage = {
  async list(): Promise<ProjectMeta[]> {
    return (await kget<ProjectMeta[]>('projects')) ?? [];
  },
  async getMeta(id: string): Promise<ProjectMeta | undefined> {
    return (await this.list()).find((p) => p.id === id);
  },
  async load(id: string): Promise<Presentation | undefined> {
    return kget<Presentation>(`pres:${id}`);
  },
  async save(p: Presentation, extra: Partial<ProjectMeta> = {}): Promise<ProjectMeta> {
    const list = await this.list();
    const now = Date.now();
    const prev = list.find((m) => m.id === p.id);
    const meta: ProjectMeta = {
      id: p.id, title: p.title, description: p.description, theme: p.theme, slideCount: p.slides.length,
      status: prev?.status ?? 'draft', createdAt: prev?.createdAt ?? now, updatedAt: now, version: (prev?.version ?? 0) + 1,
      thumbnail: prev?.thumbnail, starred: prev?.starred, cloudId: prev?.cloudId, cloudSyncedAt: prev?.cloudSyncedAt, exportedAt: prev?.exportedAt, ...extra,
    };
    await kset(`pres:${p.id}`, p);
    await kset('projects', [meta, ...list.filter((m) => m.id !== p.id)]);
    return meta;
  },
  async updateMeta(id: string, patch: Partial<ProjectMeta>): Promise<void> {
    const list = await this.list();
    await kset('projects', list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  },
  async remove(id: string): Promise<void> {
    const list = await this.list();
    await kset('projects', list.filter((m) => m.id !== id));
    await kdel(`pres:${id}`);
    await kdel(`versions:${id}`);
  },
  async versions(id: string): Promise<VersionEntry[]> {
    return (await kget<VersionEntry[]>(`versions:${id}`)) ?? [];
  },
  async addVersion(p: Presentation, label: string): Promise<VersionEntry> {
    const list = await this.versions(p.id);
    const v: VersionEntry = { id: `v-${Date.now().toString(36)}`, createdAt: Date.now(), label, slideCount: p.slides.length, data: p };
    await kset(`versions:${p.id}`, [v, ...list].slice(0, MAX_VERSIONS));
    return v;
  },
  async history(): Promise<HistoryEntry[]> {
    return (await kget<HistoryEntry[]>('history')) ?? [];
  },
  async addHistory(e: Omit<HistoryEntry, 'id' | 'at'>): Promise<void> {
    const list = await this.history();
    await kset('history', [{ ...e, id: `h-${Date.now().toString(36)}`, at: Date.now() }, ...list].slice(0, 200));
  },
  async getPref<T>(k: string, fallback: T): Promise<T> {
    return (await kget<T>(`pref:${k}`)) ?? fallback;
  },
  async setPref(k: string, v: unknown) { await kset(`pref:${k}`, v); },
};

/* ------------------------------- Cloud sync ------------------------------- */
export interface CloudUser { id: string; email: string; name?: string }
export const cloud = {
  async enabled(): Promise<boolean> {
    return !!auth.token && (await apiAvailable());
  },
  /** Push a project; returns the server id. Errors are surfaced to the caller (save status). */
  async push(p: Presentation, meta: ProjectMeta, snapshot = false): Promise<string> {
    const body = { title: p.title, description: p.description, data: p, snapshot, thumbnail: meta.thumbnail };
    if (meta.cloudId) {
      try {
        await api.put(`/presentations/${meta.cloudId}`, body);
        return meta.cloudId;
      } catch (e) {
        if ((e as { status?: number }).status !== 404) throw e;
      }
    }
    const r = await api.post<{ id: string }>('/presentations', body);
    return r.id;
  },
};
