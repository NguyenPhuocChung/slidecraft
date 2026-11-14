import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const VERSION = '1.0.0';

let generatedSecret: string | null = null;

export interface AppConfig {
  port: number;
  env: string;
  jwtSecret: string;
  mongoUri?: string;
  dataDir: string;
  uploadDir: string;
  corsOrigin: string[];
  rateLimit: boolean;
  keys: { unsplash?: string; pexels?: string; pixabay?: string };
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = process.env.NODE_ENV ?? 'development';
  let jwtSecret = overrides.jwtSecret ?? process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (env === 'production') throw new Error('JWT_SECRET is required in production. Refusing to start.');
    generatedSecret ??= crypto.randomBytes(48).toString('hex');
    if (env !== 'test') console.warn('[slidecraft] JWT_SECRET not set — using a random development secret (tokens reset on restart).');
    jwtSecret = generatedSecret;
  }
  return {
    port: Number(process.env.PORT ?? 4000),
    env,
    jwtSecret,
    mongoUri: process.env.MONGODB_URI || undefined,
    dataDir: path.resolve(process.env.DATA_DIR ?? path.join(SERVER_DIR, 'data')),
    uploadDir: path.resolve(process.env.UPLOAD_DIR ?? path.join(SERVER_DIR, 'uploads')),
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    rateLimit: env !== 'test',
    keys: { unsplash: process.env.UNSPLASH_ACCESS_KEY || undefined, pexels: process.env.PEXELS_API_KEY || undefined, pixabay: process.env.PIXABAY_API_KEY || undefined },
    ...overrides,
  };
}
