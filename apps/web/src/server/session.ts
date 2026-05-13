import { cookies } from 'next/headers';
import { eq, refreshTokens, users } from '@repo/db';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from './auth-cookies';
import { getDb } from './db';
import { getEnv } from './env';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from './jwt';
import { ensureRedis, getRedis, RedisKeys } from './redis';

export async function getSessionUser(): Promise<AccessTokenPayload | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    await ensureRedis().catch(() => null);
    const blacklisted = await getRedis()
      .get(RedisKeys.tokenBlacklist(payload.jti))
      .catch(() => null);
    if (blacklisted) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<AccessTokenPayload | Response> {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}

export function clearAuthCookiesResponse() {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, '', clearCookieOptions());
  jar.set(REFRESH_COOKIE, '', clearCookieOptions());
}

export async function rotateRefreshToken(
  refreshCookie: string,
  ctx: { ip: string; ua: string } = { ip: '0.0.0.0', ua: '' },
): Promise<
  | { ok: true; access: string; refresh: string }
  | { ok: false }
> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshCookie);
  } catch {
    return { ok: false };
  }

  const db = getDb();
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(refreshCookie)))
    .limit(1);
  if (!stored || stored.revokedAt) {
    return { ok: false };
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user) return { ok: false };

  const env = getEnv();
  const newAccess = signAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
  });
  const newRefresh = signRefreshToken({ sub: user.id, family: payload.family });

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: hashToken(newRefresh.token),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
        ip: ctx.ip,
        userAgent: ctx.ua,
      })
      .returning();
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId: created!.id })
      .where(eq(refreshTokens.id, stored.id));
  });

  return { ok: true, access: newAccess.token, refresh: newRefresh.token };
}

export function setAuthCookiesInJar(access: string, refresh: string) {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, access, accessCookieOptions());
  jar.set(REFRESH_COOKIE, refresh, refreshCookieOptions());
}
