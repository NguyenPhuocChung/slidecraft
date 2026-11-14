import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp, type AppHandle } from '../index';

export async function makeApp(): Promise<AppHandle & { dir: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidecraft-test-'));
  const h = await createApp({ dataDir: path.join(dir, 'data'), uploadDir: path.join(dir, 'uploads'), mongoUri: undefined, rateLimit: false, jwtSecret: 'test-secret-'.padEnd(40, 'x'), keys: {} });
  return { ...h, dir };
}
let n = 0;
export async function register(app: AppHandle['app'], name = 'User') {
  const email = `u${Date.now()}${n++}@example.com`;
  const r = await request(app).post('/api/auth/register').send({ email, password: 'password123', name });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return { token: r.body.token as string, user: r.body.user, email };
}
export const deck = (title = 'Deck', slides = 2) => ({ schemaVersion: '1.0', title, theme: 'modern-corporate', slides: Array.from({ length: slides }, (_, i) => ({ id: `s${i + 1}`, elements: [] })) });
