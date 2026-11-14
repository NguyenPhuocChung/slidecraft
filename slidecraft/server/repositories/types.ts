export interface BaseDoc { id: string; createdAt: string; updatedAt: string }

export interface User extends BaseDoc { email: string; name: string; passwordHash: string }
export type PresentationStatus = 'draft' | 'exported' | 'shared' | 'archived';
export type Visibility = 'private' | 'link' | 'public';
export interface PresentationDoc extends BaseDoc {
  owner: string;
  title: string;
  description?: string;
  data: unknown;
  theme?: string;
  slideCount: number;
  version: number;
  status: PresentationStatus;
  visibility: Visibility;
  shareId?: string;
  thumbnail?: string;
  exportedAt?: string;
  lastSnapshotAt?: string;
  /** status before archive, used by restore */
  prevStatus?: PresentationStatus;
}
export interface VersionDoc extends BaseDoc { presentationId: string; owner: string; version: number; title: string; slideCount: number; data: unknown; reason: string }
export interface AssetDoc extends BaseDoc { owner: string; name: string; mime: string; size: number; type: 'image' | 'svg' | 'video' | 'audio'; file: string; width?: number; height?: number }
export interface ExportDoc extends BaseDoc { owner: string; presentationId: string; format: string; profile?: string; warnings: string[] }
export interface ImportDoc extends BaseDoc { owner: string; format: string; slides: number; errors: number; warnings: number; title?: string }

export type Filter<T> = Partial<Record<keyof T, unknown>>;
export interface FindOptions<T> { sort?: { field: keyof T; dir: 1 | -1 }; limit?: number }

export interface Collection<T extends BaseDoc> {
  find(filter: Filter<T>, opts?: FindOptions<T>): Promise<T[]>;
  findOne(filter: Filter<T>): Promise<T | null>;
  insert(doc: Omit<T, 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'createdAt' | 'updatedAt'>>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  deleteMany(filter: Filter<T>): Promise<number>;
  count(filter: Filter<T>): Promise<number>;
}

export interface Repository {
  driver: 'file' | 'mongo';
  users: Collection<User>;
  presentations: Collection<PresentationDoc>;
  versions: Collection<VersionDoc>;
  assets: Collection<AssetDoc>;
  exports: Collection<ExportDoc>;
  imports: Collection<ImportDoc>;
  close(): Promise<void>;
}
