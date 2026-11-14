import jwt from 'jsonwebtoken';

export interface TokenPayload { sub: string; email: string }
export function signToken(secret: string, p: TokenPayload): string {
  return jwt.sign(p, secret, { algorithm: 'HS256', expiresIn: '7d' });
}
export function verifyToken(secret: string, token: string): TokenPayload {
  const d = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (typeof d.sub !== 'string') throw new Error('bad token');
  return { sub: d.sub, email: String(d.email ?? '') };
}
