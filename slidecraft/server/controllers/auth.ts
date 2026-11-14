import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errors';
import type { AuthedRequest } from '../middleware/auth';
import type { User } from '../repositories/types';
import { signToken } from '../services/jwt';
import { LoginBody, RegisterBody } from '../validators/index';
import type { Ctx } from './context';

export const publicUser = (u: User | Omit<User, 'passwordHash'>) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

export function authController({ repo, cfg }: Ctx) {
  return {
    async register(req: Request, res: Response) {
      const body = RegisterBody.parse(req.body);
      if (await repo.users.findOne({ email: body.email })) throw new HttpError(409, 'Email is already registered');
      const user = await repo.users.insert({ id: `usr_${crypto.randomUUID()}`, email: body.email, name: body.name, passwordHash: await bcrypt.hash(body.password, 11) });
      res.status(201).json({ token: signToken(cfg.jwtSecret, { sub: user.id, email: user.email }), user: publicUser(user) });
    },
    async login(req: Request, res: Response) {
      const body = LoginBody.parse(req.body);
      const user = await repo.users.findOne({ email: body.email });
      // constant-ish time: always compare against a hash
      const ok = await bcrypt.compare(body.password, user?.passwordHash ?? '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
      res.json({ token: signToken(cfg.jwtSecret, { sub: user.id, email: user.email }), user: publicUser(user) });
    },
    async me(req: Request, res: Response) {
      res.json({ user: publicUser((req as AuthedRequest).user) });
    },
  };
}
