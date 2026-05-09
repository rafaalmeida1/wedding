import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { getCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type AuthUser,
} from '@repo/shared/auth';
import { publishEmailSend } from '../rabbitmq/publisher.js';
import { db } from '../services/db.js';
import { and, eq, refreshTokens, users } from '@repo/db';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/jwt.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '../services/cookies.js';
import { ensureRedis, redis, RedisKeys } from '../services/redis.js';
import { env } from '../env.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { verifyAccessToken } from '../services/jwt.js';

const app = new Hono<AuthContext>();

function toAuthUser(u: typeof users.$inferSelect): AuthUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    avatarUrl: u.avatarUrl,
  };
}

async function issueTokensFor(user: typeof users.$inferSelect, ctx: { ip: string; ua: string }) {
  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
  });
  const refresh = signRefreshToken({ sub: user.id, family: crypto.randomUUID() });
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refresh.token),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    ip: ctx.ip,
    userAgent: ctx.ua,
  });
  return { access, refresh };
}

app.post('/register', zValidator('json', registerSchema), async (c) => {
  const input = c.req.valid('json');
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    throw new HTTPException(409, { message: 'email já cadastrado' });
  }
  const usernameTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (usernameTaken.length > 0) {
    throw new HTTPException(409, { message: 'username indisponível' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      name: input.name,
      passwordHash,
    })
    .returning();
  if (!created) throw new HTTPException(500, { message: 'failed to create user' });

  const ip = c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const ua = c.req.header('user-agent') ?? '';
  const { access, refresh } = await issueTokensFor(created, { ip, ua });
  setAuthCookies(c, access.token, refresh.token);
  return c.json({ user: toAuthUser(created) }, 201);
});

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const input = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user) throw new HTTPException(401, { message: 'credenciais inválidas' });
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HTTPException(401, { message: 'credenciais inválidas' });

  const ip = c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const ua = c.req.header('user-agent') ?? '';
  const { access, refresh } = await issueTokensFor(user, { ip, ua });
  setAuthCookies(c, access.token, refresh.token);
  return c.json({ user: toAuthUser(user) });
});

app.post('/refresh', async (c) => {
  const refreshCookie = getCookie(c, REFRESH_COOKIE);
  if (!refreshCookie) throw new HTTPException(401, { message: 'no refresh token' });
  let payload;
  try {
    payload = verifyRefreshToken(refreshCookie);
  } catch {
    clearAuthCookies(c);
    throw new HTTPException(401, { message: 'invalid refresh token' });
  }

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(refreshCookie)))
    .limit(1);
  if (!stored || stored.revokedAt) {
    clearAuthCookies(c);
    throw new HTTPException(401, { message: 'refresh token revoked' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user) throw new HTTPException(401, { message: 'user not found' });

  const ip = c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const ua = c.req.header('user-agent') ?? '';
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
        ip,
        userAgent: ua,
      })
      .returning();
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId: created!.id })
      .where(eq(refreshTokens.id, stored.id));
  });

  setAuthCookies(c, newAccess.token, newRefresh.token);
  return c.json({ user: toAuthUser(user) });
});

app.post('/logout', async (c) => {
  const accessCookie = getCookie(c, ACCESS_COOKIE);
  const refreshCookie = getCookie(c, REFRESH_COOKIE);

  if (accessCookie) {
    try {
      const payload = verifyAccessToken(accessCookie);
      await ensureRedis().catch(() => null);
      const ttl = env.JWT_ACCESS_TTL_SECONDS;
      await redis
        .set(RedisKeys.tokenBlacklist(payload.jti), '1', 'EX', ttl)
        .catch(() => null);
    } catch {
      // token already invalid, no-op
    }
  }
  if (refreshCookie) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshCookie)));
  }
  clearAuthCookies(c);
  return c.json({ ok: true });
});

app.get('/me', requireAuth, async (c) => {
  const auth = c.get('user');
  const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1);
  if (!user) throw new HTTPException(404, { message: 'user not found' });
  return c.json({ user: toAuthUser(user) });
});

app.patch(
  '/profile',
  requireAuth,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const auth = c.get('user');
    const input = c.req.valid('json');

    if (input.username) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      if (taken && taken.id !== auth.sub) {
        throw new HTTPException(409, { message: 'username indisponível' });
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.sub))
      .returning();
    if (!updated) throw new HTTPException(404, { message: 'user not found' });
    return c.json({ user: toAuthUser(updated) });
  },
);

app.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Sempre retornamos OK para não vazar existência de e-mails.
  if (user) {
    const rawToken = crypto.randomUUID();
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(users)
      .set({ resetTokenHash: tokenHash, resetExpires: expires, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const link = `${env.APP_URL}/reset-password?token=${rawToken}`;
    try {
      await publishEmailSend({
        to: user.email,
        template: 'password-reset',
        data: { link, name: user.name },
      });
    } catch (err) {
      console.error('[forgot-password] failed to enqueue email', err);
    }
  }
  return c.json({ ok: true });
});

app.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const tokenHash = hashToken(token);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetTokenHash, tokenHash))
    .limit(1);
  if (!user || !user.resetExpires || user.resetExpires.getTime() < Date.now()) {
    throw new HTTPException(400, { message: 'token inválido ou expirado' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        resetTokenHash: null,
        resetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    // Revoga todos os refresh tokens existentes para forçar re-login
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, user.id)));
  });

  return c.json({ ok: true });
});

export default app;
