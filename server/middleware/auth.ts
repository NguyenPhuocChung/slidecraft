import type { NextFunction, Request, Response } from 'express';
import type { Repository, User } from '../repositories/types';
import { verifyToken } from '../services/jwt';
import { HttpError } from './errors';

export interface AuthedRequest extends Request { user: Omit<User, 'passwordHash'> }

export function requireAuth(repo: Repository, secret: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const h = req.headers.authorization ?? '';
      const m = /^Bearer\s+(.+)$/i.exec(h);
      if (!m) throw new HttpError(401, 'Authentication required');
      let payload;
      try { payload = verifyToken(secret, m[1]); } catch { throw new HttpError(401, 'Invalid or expired token'); }
      const user = await repo.users.findOne({ id: payload.sub });
      if (!user) throw new HttpError(401, 'User no longer exists');
      const { passwordHash, ...safe } = user;
      void passwordHash;
      (req as AuthedRequest).user = safe;
      next();
    } catch (e) { next(e); }
  };
}
