import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import { deck, makeApp, register } from './helpers';
import { mediaCache } from '../services/media';
import { isPrivateIp } from '../services/ssrf';
import { createFileRepository } from '../repositories/file';

let h: Awaited<ReturnType<typeof makeApp>>;
beforeAll(async () => { h = await makeApp(); });
afterAll(async () => { await h.repo.close(); fs.rmSync(h.dir, { recursive: true, force: true }); });
afterEach(() => { vi.unstubAllGlobals(); });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('health', () => {
  it('reports driver', async () => {
    const r = await request(h.app).get('/api/health');
    expect(r.body).toMatchObject({ ok: true, driver: 'file' });
  });
});

describe('auth', () => {
  it('registers, logs in, returns me, never leaks hash', async () => {
    const email = `a${Date.now()}@example.com`;
    const reg = await request(h.app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ann' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toEqual({ id: expect.any(String), email, name: 'Ann', createdAt: expect.any(String) });
    expect(JSON.stringify(reg.body)).not.toContain('passwordHash');
    expect((await request(h.app).post('/api/auth/register').send({ email, password: 'password123', name: 'Ann' })).status).toBe(409);
    const login = await request(h.app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    expect((await request(h.app).post('/api/auth/login').send({ email, password: 'wrongpass1' })).status).toBe(401);
    const me = await request(h.app).get('/api/auth/me').set(bearer(login.body.token));
    expect(me.body.user.email).toBe(email);
    expect((await request(h.app).get('/api/auth/me')).status).toBe(401);
    expect((await request(h.app).get('/api/auth/me').set(bearer('garbage'))).status).toBe(401);
  });
  it('validates input', async () => {
    const r = await request(h.app).post('/api/auth/register').send({ email: 'bad', password: '1', name: '' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Invalid request');
  });
});

describe('presentations', () => {
  it('CRUD, versioning, restore, duplicate, soft/hard delete', async () => {
    const { token } = await register(h.app);
    const c = await request(h.app).post('/api/presentations').set(bearer(token)).send({ title: 'Q3 Review', data: deck('Q3 Review', 3) });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ title: 'Q3 Review', slideCount: 3, version: 1, status: 'draft', visibility: 'private', theme: 'modern-corporate' });
    const id = c.body.id;
    expect((await request(h.app).post('/api/presentations').set(bearer(token)).send({ title: 'x', data: { slides: 'no' } })).status).toBe(400);

    const list = await request(h.app).get('/api/presentations').set(bearer(token));
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].data).toBeUndefined();

    // save without snapshot (within 5 min) then forced snapshot
    const s1 = await request(h.app).put(`/api/presentations/${id}`).set(bearer(token)).send({ data: deck('Q3 Review', 4) });
    expect(s1.body).toMatchObject({ version: 2, slideCount: 4, versionCreated: null });
    const s2 = await request(h.app).put(`/api/presentations/${id}`).set(bearer(token)).send({ data: deck('Q3 Review', 5), snapshot: true, baseVersion: 2 });
    expect(s2.body.version).toBe(3);
    expect(s2.body.versionCreated).toEqual(expect.any(String));
    expect((await request(h.app).put(`/api/presentations/${id}`).set(bearer(token)).send({ data: deck(), baseVersion: 1 })).status).toBe(409);

    const vs = await request(h.app).get(`/api/presentations/${id}/versions`).set(bearer(token));
    expect(vs.body.items).toHaveLength(2);
    const created = vs.body.items.find((v: { reason: string }) => v.reason === 'created');
    expect(created.slideCount).toBe(3);
    const one = await request(h.app).get(`/api/presentations/${id}/versions/${created.id}`).set(bearer(token));
    expect(one.body.data.slides).toHaveLength(3);
    const rv = await request(h.app).post(`/api/presentations/${id}/versions/${created.id}/restore`).set(bearer(token));
    expect(rv.body.slideCount).toBe(3);
    expect(rv.body.version).toBe(4);

    const pt = await request(h.app).patch(`/api/presentations/${id}`).set(bearer(token)).send({ title: 'Renamed' });
    expect(pt.body.title).toBe('Renamed');

    const dup = await request(h.app).post(`/api/presentations/${id}/duplicate`).set(bearer(token));
    expect(dup.status).toBe(201);
    expect(dup.body.title).toBe('Renamed (copy)');
    expect(dup.body.id).not.toBe(id);

    const del = await request(h.app).delete(`/api/presentations/${id}`).set(bearer(token));
    expect(del.body.deleted).toBe('soft');
    expect((await request(h.app).get('/api/presentations').set(bearer(token))).body.total).toBe(1);
    expect((await request(h.app).get('/api/presentations?status=archived').set(bearer(token))).body.total).toBe(1);
    const res = await request(h.app).post(`/api/presentations/${id}/restore`).set(bearer(token));
    expect(res.body.status).toBe('draft');

    const q = await request(h.app).get('/api/presentations?q=copy').set(bearer(token));
    expect(q.body.items.map((i: { id: string }) => i.id)).toEqual([dup.body.id]);

    // export + import history
    const ex = await request(h.app).post(`/api/presentations/${id}/exports`).set(bearer(token)).send({ format: 'pptx', profile: 'editable', warnings: ['Blur In exported as Fade'] });
    expect(ex.status).toBe(201);
    expect((await request(h.app).get(`/api/presentations/${id}`).set(bearer(token))).body.status).toBe('exported');
    expect((await request(h.app).get(`/api/presentations/${id}/exports`).set(bearer(token))).body.items).toHaveLength(1);
    expect((await request(h.app).post('/api/imports').set(bearer(token)).send({ format: 'json', slides: 10, errors: 0, warnings: 2 })).status).toBe(201);
    expect((await request(h.app).get('/api/imports').set(bearer(token))).body.items).toHaveLength(1);
    const json = await request(h.app).get(`/api/presentations/${id}/export/json`).set(bearer(token));
    expect(json.body.schemaVersion).toBe('1.0');

    const hard = await request(h.app).delete(`/api/presentations/${id}?hard=true`).set(bearer(token));
    expect(hard.body.deleted).toBe('hard');
    expect((await request(h.app).get(`/api/presentations/${id}`).set(bearer(token))).status).toBe(404);
    expect(await h.repo.versions.count({ presentationId: id })).toBe(0);
  });

  it('keeps at most 50 versions', async () => {
    const { token } = await register(h.app);
    const c = await request(h.app).post('/api/presentations').set(bearer(token)).send({ data: deck() });
    for (let i = 0; i < 53; i++) await request(h.app).put(`/api/presentations/${c.body.id}`).set(bearer(token)).send({ data: deck(), snapshot: true });
    expect(await h.repo.versions.count({ presentationId: c.body.id })).toBe(50);
  });

  it('isolates owners', async () => {
    const a = await register(h.app, 'A');
    const b = await register(h.app, 'B');
    const c = await request(h.app).post('/api/presentations').set(bearer(a.token)).send({ title: 'Secret', data: deck() });
    const id = c.body.id;
    for (const [m, path] of [['get', `/api/presentations/${id}`], ['put', `/api/presentations/${id}`], ['patch', `/api/presentations/${id}`], ['delete', `/api/presentations/${id}`], ['post', `/api/presentations/${id}/duplicate`], ['get', `/api/presentations/${id}/versions`]] as const) {
      const r = await request(h.app)[m](path).set(bearer(b.token)).send({ data: deck(), title: 'hack' });
      expect(r.status, `${m} ${path}`).toBe(404);
    }
    expect((await request(h.app).get('/api/presentations').set(bearer(b.token))).body.total).toBe(0);
  });

  it('share links: public read-only, private hidden', async () => {
    const { token } = await register(h.app);
    const c = await request(h.app).post('/api/presentations').set(bearer(token)).send({ title: 'Public', data: deck() });
    const s = await request(h.app).post(`/api/presentations/${c.body.id}/share`).set(bearer(token)).send({ visibility: 'link' });
    expect(s.body.shareId).toEqual(expect.any(String));
    const pub = await request(h.app).get(`/api/share/${s.body.shareId}`);
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ title: 'Public', readOnly: true });
    expect(pub.body.owner).toBeUndefined();
    expect((await request(h.app).get(`/api/presentations/${c.body.id}`).set(bearer(token))).body.status).toBe('shared');
    await request(h.app).post(`/api/presentations/${c.body.id}/share`).set(bearer(token)).send({ visibility: 'private' });
    expect((await request(h.app).get(`/api/share/${s.body.shareId}`)).status).toBe(404);
  });
});

describe('assets', () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 64, 0, 0, 0, 32]), Buffer.alloc(40)]);
  it('accepts a real PNG and serves it with safe headers', async () => {
    const { token } = await register(h.app);
    const up = await request(h.app).post('/api/assets').set(bearer(token)).attach('file', PNG, { filename: 'pic.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ type: 'image', mime: 'image/png', width: 64, height: 32, url: `/api/assets/${up.body.id}/file` });
    const f = await request(h.app).get(up.body.url).set(bearer(token));
    expect(f.headers['content-type']).toBe('image/png');
    expect(f.headers['x-content-type-options']).toBe('nosniff');
    const other = await register(h.app);
    expect((await request(h.app).get(up.body.url).set(bearer(other.token))).status).toBe(404);
    expect((await request(h.app).get('/api/assets').set(bearer(token))).body.items).toHaveLength(1);
    expect((await request(h.app).delete(`/api/assets/${up.body.id}`).set(bearer(token))).body.ok).toBe(true);
  });
  it('rejects fake PNG, malicious SVG and unsupported types', async () => {
    const { token } = await register(h.app);
    const fake = await request(h.app).post('/api/assets').set(bearer(token)).attach('file', Buffer.from('<html>not an image</html>'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    const svg = await request(h.app).post('/api/assets').set(bearer(token)).attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(422);
    const okSvg = await request(h.app).post('/api/assets').set(bearer(token)).attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>'), { filename: 'ok.svg', contentType: 'image/svg+xml' });
    expect(okSvg.status).toBe(201);
    const f = await request(h.app).get(okSvg.body.url).set(bearer(token));
    expect(f.headers['content-security-policy']).toContain("default-src 'none'");
    const exe = await request(h.app).post('/api/assets').set(bearer(token)).attach('file', Buffer.from('MZ....'), { filename: 'x.exe', contentType: 'application/x-msdownload' });
    expect(exe.status).toBe(415);
  });
});

describe('media', () => {
  it('lists providers (keyless ones configured)', async () => {
    const r = await request(h.app).get('/api/media/providers');
    const map = Object.fromEntries(r.body.providers.map((p: { id: string; configured: boolean }) => [p.id, p.configured]));
    expect(map).toEqual({ unsplash: false, pexels: false, pixabay: false, openverse: true, wikimedia: true });
  });
  it('degrades gracefully with no keys and no network', async () => {
    mediaCache.clear();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const r = await request(h.app).get('/api/media/search?q=solar%20panels');
    expect(r.status).toBe(200);
    expect(r.body.results).toEqual([]);
    expect(r.body.errors).toEqual(['openverse: network down', 'wikimedia: network down']);
  });
  it('normalizes Openverse results', async () => {
    mediaCache.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 'abc', url: 'https://img.example/a.jpg', thumbnail: 'https://img.example/t.jpg', width: 1600, height: 900, title: 'Solar', creator: 'Jane', source: 'flickr', license: 'by', license_version: '2.0', foreign_landing_url: 'https://flickr.com/x' }] }), { headers: { 'content-type': 'application/json' } })));
    const r = await request(h.app).get('/api/media/search?q=solar&orientation=landscape');
    expect(r.body.results[0]).toEqual({ id: 'openverse-abc', provider: 'openverse', url: 'https://img.example/a.jpg', thumb: 'https://img.example/t.jpg', width: 1600, height: 900, alt: 'Solar', credit: 'Jane via flickr', license: 'CC BY 2.0', sourceUrl: 'https://flickr.com/x' });
  });
  it('proxy blocks localhost, private IPs and non-http schemes', async () => {
    for (const u of ['http://localhost:4000/api/health', 'http://127.0.0.1/', 'http://10.0.0.5/x.png', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'file:///etc/passwd', 'http://192.168.1.1/a.png']) {
      const r = await request(h.app).get(`/api/media/proxy?url=${encodeURIComponent(u)}`);
      expect([400, 403], u).toContain(r.status);
    }
    expect(isPrivateIp('172.20.1.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
  });
});

describe('ai', () => {
  it('returns 501 when no provider is configured', async () => {
    const { token } = await register(h.app);
    const r = await request(h.app).post('/api/ai/generate').set(bearer(token)).send({ task: 'summarize', input: 'hello' });
    expect(r.status).toBe(501);
    expect(r.body.error).toBe('AI provider not configured');
  });
});

describe('file driver', () => {
  it('persists across instances (atomic writes)', async () => {
    const dir = `${h.dir}/persist`;
    const r1 = createFileRepository(dir);
    await r1.users.insert({ id: 'u1', email: 'a@b.c', name: 'A', passwordHash: 'x' });
    await r1.users.update('u1', { name: 'B' });
    await r1.close();
    const r2 = createFileRepository(dir);
    expect((await r2.users.findOne({ id: 'u1' }))?.name).toBe('B');
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
  });
});
