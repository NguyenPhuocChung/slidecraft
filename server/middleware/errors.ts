import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

/** Wrap async handlers so rejections reach the error handler. */
export const ah = <R extends Request = Request>(fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req as R, res, next).catch(next); };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  const e = err as { type?: string; status?: number; message?: string; code?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 25 MB)' });
  if (e?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Upload field must be "file"' });
  console.error('[slidecraft] unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}
