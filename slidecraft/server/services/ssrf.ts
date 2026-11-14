/** Safe remote image fetch for export embedding: http(s) only, public IPs only, size/type limits. */
import dns from 'node:dns/promises';
import net from 'node:net';
import { HttpError } from '../middleware/errors';

export const MAX_PROXY_BYTES = 15 * 1024 * 1024;

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new HttpError(400, 'Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new HttpError(400, 'Only http(s) URLs are allowed');
  if (u.username || u.password) throw new HttpError(400, 'Credentials in URL are not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new HttpError(403, 'Blocked host');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new HttpError(502, 'Host could not be resolved'); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new HttpError(403, 'Blocked private or loopback address');
  return u;
}

export async function fetchPublicImage(raw: string): Promise<{ buf: Buffer; type: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'SlideCraft/1.0 image proxy', Accept: 'image/*' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = await assertPublicUrl(new URL(r.headers.get('location')!, url).toString()); continue; }
      if (!r.ok) throw new HttpError(502, `Upstream returned HTTP ${r.status}`);
      const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/')) throw new HttpError(415, 'Upstream content is not an image');
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len > MAX_PROXY_BYTES) throw new HttpError(413, 'Image too large');
      const reader = r.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (reader) for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_PROXY_BYTES) { ctrl.abort(); throw new HttpError(413, 'Image too large'); }
        chunks.push(value);
      }
      return { buf: Buffer.concat(chunks), type };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, (e as Error).name === 'AbortError' ? 'Upstream timeout' : `Fetch failed: ${(e as Error).message}`);
    } finally { clearTimeout(t); }
  }
  throw new HttpError(508, 'Too many redirects');
}
