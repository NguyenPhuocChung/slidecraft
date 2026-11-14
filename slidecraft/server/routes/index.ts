import { Router } from 'express';
import multer from 'multer';
import { authController } from '../controllers/auth';
import { assetController } from '../controllers/assets';
import type { Ctx } from '../controllers/context';
import { mediaController } from '../controllers/media';
import { presentationController } from '../controllers/presentations';
import { requireAuth } from '../middleware/auth';
import { ah } from '../middleware/errors';
import { limiters } from '../middleware/rateLimit';
import { VERSION } from '../config';

export function apiRouter(ctx: Ctx): Router {
  const r = Router();
  const lim = limiters(ctx.cfg.rateLimit);
  const auth = requireAuth(ctx.repo, ctx.cfg.jwtSecret);
  const a = authController(ctx), p = presentationController(ctx), as = assetController(ctx), m = mediaController(ctx);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

  r.get('/health', (_req, res) => { res.json({ ok: true, driver: ctx.repo.driver, version: VERSION }); });
  r.use(lim.api);

  r.post('/auth/register', lim.auth, ah(a.register));
  r.post('/auth/login', lim.auth, ah(a.login));
  r.get('/auth/me', auth, ah(a.me));

  r.get('/share/:shareId', ah(p.publicShare));

  r.get('/presentations', auth, ah(p.list));
  r.post('/presentations', auth, ah(p.create));
  r.get('/presentations/:id', auth, ah(p.get));
  r.put('/presentations/:id', auth, ah(p.save));
  r.patch('/presentations/:id', auth, ah(p.patch));
  r.delete('/presentations/:id', auth, ah(p.remove));
  r.post('/presentations/:id/restore', auth, ah(p.restore));
  r.post('/presentations/:id/duplicate', auth, ah(p.duplicate));
  r.get('/presentations/:id/versions', auth, ah(p.versions));
  r.get('/presentations/:id/versions/:versionId', auth, ah(p.version));
  r.post('/presentations/:id/versions/:versionId/restore', auth, ah(p.restoreVersion));
  r.post('/presentations/:id/share', auth, ah(p.share));
  r.get('/presentations/:id/export/json', auth, ah(p.exportJson));
  r.post('/presentations/:id/exports', auth, ah(p.addExport));
  r.get('/presentations/:id/exports', auth, ah(p.listExports));
  r.post('/imports', auth, ah(p.addImport));
  r.get('/imports', auth, ah(p.listImports));

  r.post('/assets', auth, upload.single('file'), ah(as.upload));
  r.get('/assets', auth, ah(as.list));
  r.get('/assets/:id/file', auth, ah(as.file));
  r.delete('/assets/:id', auth, ah(as.remove));

  r.get('/media/providers', ah(m.providers));
  r.get('/media/search', lim.media, ah(m.search));
  r.get('/media/proxy', lim.media, ah(m.proxy));

  r.get('/ai/providers', ah(m.aiProviders));
  r.post('/ai/generate', auth, ah(m.aiGenerate));

  r.use((_req, res) => { res.status(404).json({ error: 'API route not found' }); });
  return r;
}
