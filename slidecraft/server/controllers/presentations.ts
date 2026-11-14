import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { HttpError, notFound } from '../middleware/errors';
import type { PresentationDoc, PresentationStatus, VersionDoc } from '../repositories/types';
import { CreatePresentationBody, ExportBody, ImportBody, ListQuery, PatchPresentationBody, SavePresentationBody, ShareBody } from '../validators/index';
import { toContractJson } from '../exporters/json';
import type { Ctx } from './context';

const SNAPSHOT_INTERVAL = 5 * 60 * 1000;
export const MAX_VERSIONS = 50;

type Data = { slides?: unknown[]; theme?: unknown; title?: unknown };
const meta = (data: unknown) => {
  const d = data as Data;
  return { slideCount: Array.isArray(d.slides) ? d.slides.length : 0, theme: typeof d.theme === 'string' ? d.theme : undefined };
};
export const listItem = (p: PresentationDoc) => ({
  id: p.id, title: p.title, description: p.description, theme: p.theme, slideCount: p.slideCount, version: p.version, status: p.status,
  visibility: p.visibility, shareId: p.shareId, thumbnail: p.thumbnail, createdAt: p.createdAt, updatedAt: p.updatedAt, exportedAt: p.exportedAt,
});
export const fullItem = (p: PresentationDoc) => ({ ...listItem(p), data: p.data });
const versionItem = (v: VersionDoc) => ({ id: v.id, presentationId: v.presentationId, version: v.version, title: v.title, slideCount: v.slideCount, reason: v.reason, createdAt: v.createdAt });
const uid = (req: Request) => (req as AuthedRequest).user.id;
const param = (req: Request, k: string) => String(req.params[k]);

export function presentationController({ repo }: Ctx) {
  async function own(req: Request): Promise<PresentationDoc> {
    const p = await repo.presentations.findOne({ id: param(req, 'id') });
    if (!p || p.owner !== uid(req)) throw notFound('Presentation'); // never reveal others' ids
    return p;
  }
  async function snapshot(p: PresentationDoc, reason: string) {
    const v = await repo.versions.insert({ id: `ver_${crypto.randomUUID()}`, presentationId: p.id, owner: p.owner, version: p.version, title: p.title, slideCount: p.slideCount, data: p.data, reason });
    const all = await repo.versions.find({ presentationId: p.id }, { sort: { field: 'createdAt', dir: -1 } });
    for (const old of all.slice(MAX_VERSIONS)) await repo.versions.delete(old.id);
    return v;
  }

  return {
    async list(req: Request, res: Response) {
      const q = ListQuery.parse(req.query);
      let items = await repo.presentations.find({ owner: uid(req), ...(q.status && q.status !== 'all' ? { status: q.status } : {}) });
      if (!q.status) items = items.filter((p) => p.status !== 'archived');
      if (q.q) { const s = q.q.toLowerCase(); items = items.filter((p) => p.title.toLowerCase().includes(s) || (p.description ?? '').toLowerCase().includes(s)); }
      const sort = q.sort ?? 'updated';
      items.sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)));
      const total = items.length;
      res.json({ items: items.slice(0, q.limit ?? 100).map(listItem), total });
    },
    async create(req: Request, res: Response) {
      const b = CreatePresentationBody.parse(req.body);
      const title = b.title ?? (typeof (b.data as Data).title === 'string' ? String((b.data as Data).title) : 'Untitled presentation');
      const p = await repo.presentations.insert({
        id: `prs_${crypto.randomUUID()}`, owner: uid(req), title, description: b.description, data: b.data, ...meta(b.data), version: 1,
        status: 'draft', visibility: 'private', thumbnail: b.thumbnail, lastSnapshotAt: new Date().toISOString(),
      });
      await snapshot(p, 'created');
      res.status(201).json(fullItem(p));
    },
    async get(req: Request, res: Response) { res.json(fullItem(await own(req))); },
    async save(req: Request, res: Response) {
      const p = await own(req);
      const b = SavePresentationBody.parse(req.body);
      if (b.baseVersion !== undefined && b.baseVersion !== p.version) throw new HttpError(409, 'Version conflict: the presentation was changed elsewhere', { currentVersion: p.version });
      const now = new Date();
      const due = b.snapshot || !p.lastSnapshotAt || now.getTime() - new Date(p.lastSnapshotAt).getTime() >= SNAPSHOT_INTERVAL;
      const updated = (await repo.presentations.update(p.id, {
        data: b.data, ...meta(b.data), title: b.title ?? p.title, description: b.description ?? p.description, version: p.version + 1,
        ...(b.thumbnail ? { thumbnail: b.thumbnail } : {}), ...(due ? { lastSnapshotAt: now.toISOString() } : {}),
      }))!;
      let versionCreated: string | undefined;
      if (due) versionCreated = (await snapshot(updated, b.snapshot ? 'manual' : 'autosave')).id;
      res.json({ ...listItem(updated), versionCreated: versionCreated ?? null });
    },
    async patch(req: Request, res: Response) {
      const p = await own(req);
      const b = PatchPresentationBody.parse(req.body);
      const patch: Partial<PresentationDoc> = { ...b };
      if (b.status === 'archived' && p.status !== 'archived') patch.prevStatus = p.status;
      res.json(listItem((await repo.presentations.update(p.id, patch))!));
    },
    async remove(req: Request, res: Response) {
      const p = await own(req);
      if (req.query.hard === 'true') {
        await repo.versions.deleteMany({ presentationId: p.id });
        await repo.exports.deleteMany({ presentationId: p.id });
        await repo.presentations.delete(p.id);
        return res.json({ ok: true, deleted: 'hard' });
      }
      const u = await repo.presentations.update(p.id, { status: 'archived', prevStatus: p.status === 'archived' ? p.prevStatus : p.status });
      res.json({ ok: true, deleted: 'soft', item: listItem(u!) });
    },
    async restore(req: Request, res: Response) {
      const p = await own(req);
      const status: PresentationStatus = p.status === 'archived' ? p.prevStatus && p.prevStatus !== 'archived' ? p.prevStatus : 'draft' : p.status;
      res.json(listItem((await repo.presentations.update(p.id, { status, prevStatus: undefined }))!));
    },
    async duplicate(req: Request, res: Response) {
      const p = await own(req);
      const data = structuredClone(p.data) as Record<string, unknown>;
      const title = `${p.title} (copy)`;
      if (data && typeof data === 'object') { data.title = title; if ('id' in data) data.id = `pres-${crypto.randomUUID().slice(0, 8)}`; }
      const copy = await repo.presentations.insert({
        id: `prs_${crypto.randomUUID()}`, owner: p.owner, title, description: p.description, data, theme: p.theme, slideCount: p.slideCount, version: 1,
        status: 'draft', visibility: 'private', thumbnail: p.thumbnail, lastSnapshotAt: new Date().toISOString(),
      });
      await snapshot(copy, 'duplicated');
      res.status(201).json(fullItem(copy));
    },
    async versions(req: Request, res: Response) {
      const p = await own(req);
      const vs = await repo.versions.find({ presentationId: p.id }, { sort: { field: 'createdAt', dir: -1 } });
      res.json({ items: vs.map(versionItem) });
    },
    async version(req: Request, res: Response) {
      const p = await own(req);
      const v = await repo.versions.findOne({ id: param(req, 'versionId') });
      if (!v || v.presentationId !== p.id) throw notFound('Version');
      res.json({ ...versionItem(v), data: v.data });
    },
    async restoreVersion(req: Request, res: Response) {
      const p = await own(req);
      const v = await repo.versions.findOne({ id: param(req, 'versionId') });
      if (!v || v.presentationId !== p.id) throw notFound('Version');
      await snapshot(p, 'before-restore');
      const u = (await repo.presentations.update(p.id, { data: v.data, ...meta(v.data), title: v.title, version: p.version + 1, lastSnapshotAt: new Date().toISOString() }))!;
      await snapshot(u, `restored-from-v${v.version}`);
      res.json(fullItem(u));
    },
    async share(req: Request, res: Response) {
      const p = await own(req);
      const { visibility } = ShareBody.parse(req.body);
      const shareId = visibility === 'private' ? p.shareId : p.shareId ?? crypto.randomBytes(12).toString('base64url');
      const status: PresentationStatus = p.status === 'archived' ? 'archived' : visibility !== 'private' ? 'shared' : p.status === 'shared' ? (p.exportedAt ? 'exported' : 'draft') : p.status;
      const u = (await repo.presentations.update(p.id, { visibility, shareId, status }))!;
      res.json({ shareId: visibility === 'private' ? null : u.shareId, visibility, url: visibility === 'private' ? null : `/share/${u.shareId}` });
    },
    async publicShare(req: Request, res: Response) {
      const p = await repo.presentations.findOne({ shareId: param(req, 'shareId') });
      if (!p || p.visibility === 'private' || p.status === 'archived') throw notFound('Shared presentation');
      res.json({ id: p.id, title: p.title, description: p.description, slideCount: p.slideCount, updatedAt: p.updatedAt, readOnly: true, data: p.data });
    },
    async exportJson(req: Request, res: Response) {
      const p = await own(req);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(p.title.replace(/[\\/:*?"<>|]+/g, '') || 'presentation')}.slidecraft.json"`);
      res.json(toContractJson(p));
    },
    async addExport(req: Request, res: Response) {
      const p = await own(req);
      const b = ExportBody.parse(req.body);
      const rec = await repo.exports.insert({ id: `exp_${crypto.randomUUID()}`, owner: p.owner, presentationId: p.id, format: b.format, profile: b.profile, warnings: b.warnings ?? [] });
      await repo.presentations.update(p.id, { exportedAt: rec.createdAt, ...(p.status === 'draft' ? { status: 'exported' as const } : {}), updatedAt: p.updatedAt });
      res.status(201).json(rec);
    },
    async listExports(req: Request, res: Response) {
      const p = await own(req);
      res.json({ items: await repo.exports.find({ presentationId: p.id }, { sort: { field: 'createdAt', dir: -1 }, limit: 100 }) });
    },
    async addImport(req: Request, res: Response) {
      const b = ImportBody.parse(req.body);
      res.status(201).json(await repo.imports.insert({ id: `imp_${crypto.randomUUID()}`, owner: uid(req), ...b }));
    },
    async listImports(req: Request, res: Response) {
      res.json({ items: await repo.imports.find({ owner: uid(req) }, { sort: { field: 'createdAt', dir: -1 }, limit: 100 }) });
    },
  };
}
