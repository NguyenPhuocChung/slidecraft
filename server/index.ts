import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { loadConfig, SERVER_DIR, type AppConfig } from './config';
import { errorHandler } from './middleware/errors';
import { createRepository, type Repository } from './repositories/index';
import { apiRouter } from './routes/index';

export interface AppHandle { app: Express; repo: Repository; cfg: AppConfig }

/** Build the Express app (no listen) — used by tests and by `start()`. */
export async function createApp(overrides: Partial<AppConfig> = {}): Promise<AppHandle> {
  const cfg = loadConfig(overrides);
  const repo = await createRepository(cfg);
  fs.mkdirSync(cfg.uploadDir, { recursive: true });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use('/api', cors({ origin: cfg.corsOrigin, credentials: false, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', apiRouter({ repo, cfg }));
  const dist = path.resolve(SERVER_DIR, '../dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return { app, repo, cfg };
}

export async function start() {
  const { app, repo, cfg } = await createApp();
  const server = app.listen(cfg.port, () => {
    console.log(`[slidecraft] API listening on http://localhost:${cfg.port} — storage driver: ${repo.driver}${repo.driver === 'file' ? ` (${cfg.dataDir})` : ' (MongoDB)'}`);
  });
  const stop = async () => { server.close(); await repo.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (!process.versions.electron && import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().catch((e) => { console.error('[slidecraft] failed to start:', e.message); process.exit(1); });
}
