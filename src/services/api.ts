/** Thin REST client for the SlideCraft server (JWT bearer, JSON). */
const BASE = (import.meta.env?.VITE_API_URL as string | undefined) ?? '/api';
const TOKEN_KEY = 'slidecraft.token';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

export const auth = {
  get token(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set token(t: string | null) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

async function request<T>(method: string, path: string, body?: unknown, opts: { timeout?: number; raw?: boolean } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 15000);
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: ctrl.signal });
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok) {
      const j = ct.includes('json') ? await res.json().catch(() => ({})) : {};
      throw new ApiError((j as { error?: string }).error ?? `HTTP ${res.status}`, res.status, j);
    }
    if (opts.raw) return (await res.blob()) as unknown as T;
    if (!ct.includes('json')) throw new ApiError('API unavailable (non-JSON response)', 502);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError('Request timed out', 408);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown, o?: { timeout?: number }) => request<T>('POST', p, b, o),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
  blob: (p: string, b?: unknown) => request<Blob>(b === undefined ? 'GET' : 'POST', p, b, { raw: true, timeout: 120000 }),
};

let healthCache: { ok: boolean; at: number } | null = null;
export async function apiAvailable(): Promise<boolean> {
  if (healthCache && Date.now() - healthCache.at < 30000) return healthCache.ok;
  try {
    const r = await request<{ ok: boolean }>('GET', '/health', undefined, { timeout: 2500 });
    healthCache = { ok: !!r.ok, at: Date.now() };
  } catch {
    healthCache = { ok: false, at: Date.now() };
  }
  return healthCache.ok;
}
