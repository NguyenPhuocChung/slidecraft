import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { HttpError, notFound } from '../middleware/errors';
import type { AssetDoc } from '../repositories/types';
import { ALLOWED, imageSize, magicMatches, svgIsSafe } from '../services/fileCheck';
import type { Ctx } from './context';

const view = (a: AssetDoc) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, type: a.type, width: a.width, height: a.height, url: `/api/assets/${a.id}/file`, createdAt: a.createdAt });

export function assetController({ repo, cfg }: Ctx) {
  const uid = (req: Request) => (req as AuthedRequest).user.id;
  async function own(req: Request) {
    const a = await repo.assets.findOne({ id: String(req.params.id) });
    if (!a || a.owner !== uid(req)) throw notFound('Asset');
    return a;
  }
  return {
    async upload(req: Request, res: Response) {
      const f = (req as Request & { file?: { buffer: Buffer; mimetype: string; originalname: string; size: number } }).file;
      if (!f) throw new HttpError(400, 'No file uploaded (multipart field "file")');
      const mime = f.mimetype.toLowerCase();
      const allowed = ALLOWED[mime];
      if (!allowed) throw new HttpError(415, `Unsupported file type ${mime}`);
      if (!magicMatches(mime, f.buffer)) throw new HttpError(415, 'File content does not match its declared type');
      if (allowed.kind === 'svg' && !svgIsSafe(f.buffer.toString('utf8'))) throw new HttpError(422, 'SVG contains scripts, event handlers or external references and was rejected');
      const owner = uid(req);
      const id = `ast_${crypto.randomUUID()}`;
      const dir = path.join(cfg.uploadDir, owner.replace(/[^\w-]/g, ''));
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${id}.${allowed.ext}`);
      await fs.writeFile(file, f.buffer);
      const name = path.basename(f.originalname).replace(/[^\w.\- ()À-ỹ]+/g, '_').slice(0, 120) || `${id}.${allowed.ext}`;
      const a = await repo.assets.insert({ id, owner, name, mime, size: f.size, type: allowed.kind, file: path.relative(cfg.uploadDir, file), ...imageSize(mime, f.buffer) });
      res.status(201).json(view(a));
    },
    async list(req: Request, res: Response) {
      const items = await repo.assets.find({ owner: uid(req), ...(req.query.type ? { type: String(req.query.type) } : {}) }, { sort: { field: 'createdAt', dir: -1 } });
      res.json({ items: items.map(view) });
    },
    async file(req: Request, res: Response) {
      const a = await own(req);
      const abs = path.resolve(cfg.uploadDir, a.file);
      if (!abs.startsWith(path.resolve(cfg.uploadDir) + path.sep)) throw notFound('Asset');
      res.setHeader('Content-Type', a.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (a.mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.send(await fs.readFile(abs).catch(() => { throw notFound('Asset file'); }));
    },
    async remove(req: Request, res: Response) {
      const a = await own(req);
      await fs.rm(path.resolve(cfg.uploadDir, a.file), { force: true });
      await repo.assets.delete(a.id);
      res.json({ ok: true });
    },
  };
}
