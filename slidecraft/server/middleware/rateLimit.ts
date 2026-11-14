import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

const pass: RequestHandler = (_req, _res, next) => next();
const make = (enabled: boolean, windowMs: number, limit: number): RequestHandler => enabled
  ? rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests, please slow down.' } })
  : pass;

export const limiters = (enabled: boolean) => ({
  auth: make(enabled, 15 * 60 * 1000, 20),
  api: make(enabled, 15 * 60 * 1000, 600),
  media: make(enabled, 60 * 1000, 60),
});
