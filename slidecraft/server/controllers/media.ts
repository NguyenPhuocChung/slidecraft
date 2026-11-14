import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errors';
import { configuredProviders, searchMedia, type Provider } from '../services/media';
import { fetchPublicImage } from '../services/ssrf';
import { aiProviders } from '../services/ai';
import { AiBody, MediaQuery } from '../validators/index';
import type { Ctx } from './context';

export function mediaController({ cfg }: Ctx) {
  return {
    async search(req: Request, res: Response) {
      const q = MediaQuery.parse(req.query);
      const out = await searchMedia(q.q, { orientation: q.orientation || undefined, provider: (q.provider || undefined) as Provider | undefined, page: q.page }, cfg.keys);
      res.json(out);
    },
    async providers(_req: Request, res: Response) {
      const conf = configuredProviders(cfg.keys);
      res.json({ providers: Object.entries(conf).map(([id, configured]) => ({ id, configured, requiresKey: ['unsplash', 'pexels', 'pixabay'].includes(id) })) });
    },
    async proxy(req: Request, res: Response) {
      const url = String(req.query.url ?? '');
      if (!url) throw new HttpError(400, 'Missing url');
      const { buf, type } = await fetchPublicImage(url);
      res.setHeader('Content-Type', type === 'image/svg+xml' ? 'image/svg+xml' : type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (type === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.send(buf);
    },
    async aiProviders(_req: Request, res: Response) {
      res.json({ providers: aiProviders().map(({ id, label, configured }) => ({ id, label, configured })) });
    },
    async aiGenerate(req: Request, res: Response) {
      const b = AiBody.parse(req.body);
      const available = aiProviders().filter((p) => p.configured && (!b.provider || p.id === b.provider));
      if (!available.length) return res.status(501).json({ error: 'AI provider not configured' });
      return res.status(501).json({ error: 'Integrated AI generation is not implemented in this version. Use the AI Prompt Center with any external AI and Code Import.', provider: available[0].id });
    },
  };
}
