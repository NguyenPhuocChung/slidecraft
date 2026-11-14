/** MongoDB driver (Mongoose). Selected when MONGODB_URI is set. */
import mongoose, { type Model } from 'mongoose';
import { getModels } from '../models/index';
import type { BaseDoc, Collection, Filter, FindOptions, Repository } from './types';

function clean<T>(d: unknown): T {
  if (!d) return d as T;
  const { _id, ...rest } = d as Record<string, unknown>;
  void _id;
  return rest as T;
}

class MongoCollection<T extends BaseDoc> implements Collection<T> {
  constructor(private m: Model<unknown>) {}
  private f(filter: Filter<T>) { return Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined)); }
  async find(filter: Filter<T>, opts?: FindOptions<T>) {
    let q = this.m.find(this.f(filter)).lean();
    if (opts?.sort) q = q.sort({ [opts.sort.field as string]: opts.sort.dir });
    if (opts?.limit) q = q.limit(opts.limit);
    return (await q).map((d) => clean<T>(d));
  }
  async findOne(filter: Filter<T>) { return clean<T>(await this.m.findOne(this.f(filter)).lean()) ?? null; }
  async insert(doc: Omit<T, 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'createdAt' | 'updatedAt'>>) {
    const now = new Date().toISOString();
    const full = { createdAt: now, updatedAt: now, ...doc };
    await this.m.create(full);
    return full as T;
  }
  async update(id: string, patch: Partial<T>) {
    const set: Record<string, unknown> = {}, unset: Record<string, 1> = {};
    for (const [k, v] of Object.entries({ ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() })) { if (k === 'id') continue; if (v === undefined) unset[k] = 1; else set[k] = v; }
    const r = await this.m.findOneAndUpdate({ id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true }).lean();
    return r ? clean<T>(r) : null;
  }
  async delete(id: string) { return (await this.m.deleteOne({ id })).deletedCount > 0; }
  async deleteMany(filter: Filter<T>) { return (await this.m.deleteMany(this.f(filter))).deletedCount ?? 0; }
  async count(filter: Filter<T>) { return this.m.countDocuments(this.f(filter)); }
}

export async function createMongoRepository(uri: string): Promise<Repository> {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const m = getModels(conn) as unknown as Record<string, Model<unknown>>;
  const col = (k: string) => new MongoCollection<BaseDoc>(m[k]) as unknown as Collection<never>;
  return {
    driver: 'mongo',
    users: col('users'), presentations: col('presentations'), versions: col('versions'), assets: col('assets'), exports: col('exports'), imports: col('imports'),
    async close() { await conn.close(); },
  };
}
