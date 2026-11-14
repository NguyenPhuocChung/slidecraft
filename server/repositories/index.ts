import type { AppConfig } from '../config';
import { createFileRepository } from './file';
import { createMongoRepository } from './mongo';
import type { Repository } from './types';

export * from './types';

/** Driver selection: MONGODB_URI set → mongo, otherwise JSON files in DATA_DIR. */
export async function createRepository(cfg: Pick<AppConfig, 'mongoUri' | 'dataDir'>): Promise<Repository> {
  if (cfg.mongoUri) return createMongoRepository(cfg.mongoUri);
  return createFileRepository(cfg.dataDir);
}
