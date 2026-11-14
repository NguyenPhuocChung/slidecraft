/** JSON-file driver: one file per collection, in-memory cache, serialized atomic writes (tmp + rename). */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { BaseDoc, Collection, Filter, FindOptions, Repository } from './types';

function matches<T>(doc: T, filter: Filter<T>): boolean {
  return Object.entries(filter).every(([k, v]) => v === undefined || (doc as Record<string, unknown>)[k] === v);
}
function sortDocs<T>(docs: T[], opts?: FindOptions<T>): T[] {
  let out = docs;
  if (opts?.sort) {
    const { field, dir } = opts.sort;
    out = [...out].sort((a, b) => {
      const x = a[field] as unknown as string | number, y = b[field] as unknown as string | number;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  return opts?.limit ? out.slice(0, opts.limit) : out;
}

class FileCollection<T extends BaseDoc> implements Collection<T> {
  private docs: Map<string, T>;
  private writing: Promise<void> = Promise.resolve();
  constructor(private file: string) {
    this.docs = new Map();
    if (fsSync.existsSync(file)) {
      try {
        const arr = JSON.parse(fsSync.readFileSync(file, 'utf8')) as T[];
        arr.forEach((d) => this.docs.set(d.id, d));
      } catch (e) {
        throw new Error(`Corrupt data file ${file}: ${(e as Error).message}`);
      }
    }
  }
  private persist(): Promise<void> {
    const snapshot = JSON.stringify([...this.docs.values()]);
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, this.file);
    });
    return this.writing;
  }
  private clone(d: T): T { return structuredClone(d); }
  async find(filter: Filter<T>, opts?: FindOptions<T>) { return sortDocs([...this.docs.values()].filter((d) => matches(d, filter)), opts).map((d) => this.clone(d)); }
  async findOne(filter: Filter<T>) { for (const d of this.docs.values()) if (matches(d, filter)) return this.clone(d); return null; }
  async insert(doc: Omit<T, 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'createdAt' | 'updatedAt'>>) {
    const now = new Date().toISOString();
    const full = { createdAt: now, updatedAt: now, ...doc } as T;
    if (this.docs.has(full.id)) throw new Error(`Duplicate id ${full.id}`);
    this.docs.set(full.id, structuredClone(full));
    await this.persist();
    return this.clone(full);
  }
  async update(id: string, patch: Partial<T>) {
    const d = this.docs.get(id);
    if (!d) return null;
    const next = { ...d, ...structuredClone(patch), id, updatedAt: patch.updatedAt ?? new Date().toISOString() } as T;
    for (const [k, v] of Object.entries(next)) if (v === undefined) delete (next as Record<string, unknown>)[k];
    this.docs.set(id, next);
    await this.persist();
    return this.clone(next);
  }
  async delete(id: string) { const ok = this.docs.delete(id); if (ok) await this.persist(); return ok; }
  async deleteMany(filter: Filter<T>) {
    let n = 0;
    for (const [id, d] of this.docs) if (matches(d, filter)) { this.docs.delete(id); n++; }
    if (n) await this.persist();
    return n;
  }
  async count(filter: Filter<T>) { let n = 0; for (const d of this.docs.values()) if (matches(d, filter)) n++; return n; }
  flush() { return this.writing; }
}

export function createFileRepository(dataDir: string): Repository {
  fsSync.mkdirSync(dataDir, { recursive: true });
  const c = <T extends BaseDoc>(name: string) => new FileCollection<T>(path.join(dataDir, `${name}.json`));
  const cols = { users: c('users'), presentations: c('presentations'), versions: c('versions'), assets: c('assets'), exports: c('exports'), imports: c('imports') };
  return {
    driver: 'file',
    ...(cols as unknown as Omit<Repository, 'driver' | 'close'>),
    async close() { await Promise.all(Object.values(cols).map((x) => (x as FileCollection<BaseDoc>).flush())); },
  };
}
