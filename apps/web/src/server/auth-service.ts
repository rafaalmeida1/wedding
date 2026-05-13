import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { and, eq, refreshTokens, users } from '@repo/db';
import type { AuthUser } from '@repo/shared/auth';
import { getDb } from './db';
import { getEnv } from './env';
import { hashToken, signAccessToken, signRefreshToken } from './jwt';

type UserRow = typeof users.$inferSelect;

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    avatarUrl: u.avatarUrl,
  };
}

export async function issueTokensFor(user: UserRow, ctx: { ip: string; ua: string }) {
  const env = getEnv();
  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
  });
  const refresh = signRefreshToken({ sub: user.id, family: crypto.randomUUID() });
  const db = getDb();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refresh.token),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    ip: ctx.ip,
    userAgent: ctx.ua,
  });
  return { access, refresh };
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
