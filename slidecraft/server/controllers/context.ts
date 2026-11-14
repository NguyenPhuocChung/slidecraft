import type { AppConfig } from '../config';
import type { Repository } from '../repositories/types';
export interface Ctx { repo: Repository; cfg: AppConfig }
