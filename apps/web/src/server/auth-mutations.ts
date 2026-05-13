import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { and, eq, refreshTokens, users } from '@repo/db';
import type { AuthUser } from '@repo/shared/auth';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from '@repo/shared/auth';
import { emailSendSchema } from '@repo/shared/events';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearCookieOptions,
} from './auth-cookies';
import {
  hashPassword,
  issueTokensFor,
  toAuthUser,
  verifyPassword,
} from './auth-service';
import { getDb } from './db';
import { getEnv } from './env';
import { renderEmailTemplate } from './email-templates';
import { sendEmailTransactional } from './email';
import { hashToken, verifyAccessToken } from './jwt';
import { ensureRedis, getRedis, RedisKeys } from './redis';
import {
  clearAuthCookiesResponse,
  rotateRefreshToken,
  setAuthCookiesInJar,
} from './session';

export type AuthMutationError = { ok: false; status: number; message: string };
export type AuthMutationOk<T> = { ok: true; data: T };

export async function mutateLogin(
  body: unknown,
  ctx: { ip: string; ua: string },
): Promise<AuthMutationOk<{ user: AuthUser }> | AuthMutationError> {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, message: 'validação falhou' };
  }
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user) {
    return { ok: false, status: 401, message: 'credenciais inválidas' };
  }
  const match = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!match) {
    return { ok: false, status: 401, message: 'credenciais inválidas' };
  }
  const { access, refresh } = await issueTokensFor(user, ctx);
  setAuthCookiesInJar(access.token, refresh.token);
  return { ok: true, data: { user: toAuthUser(user) } };
}

export async function mutateRegister(
  body: unknown,
  ctx: { ip: string; ua: string },
): Promise<AuthMutationOk<{ user: AuthUser }> | AuthMutationError> {
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, message: 'validação falhou' };
  }
  const input = parsed.data;
  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, status: 409, message: 'email já cadastrado' };
  }
  const usernameTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (usernameTaken.length > 0) {
    return { ok: false, status: 409, message: 'username indisponível' };
  }
  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      name: input.name,
      passwordHash,
    })
    .returning();
  if (!created) {
    return { ok: false, status: 500, message: 'failed to create user' };
  }
  const { access, refresh } = await issueTokensFor(created, ctx);
  setAuthCookiesInJar(access.token, refresh.token);
  return { ok: true, data: { user: toAuthUser(created) } };
}

export async function mutateLogout(): Promise<{ ok: true }> {
  const env = getEnv();
  const jar = cookies();
  const accessCookie = jar.get(ACCESS_COOKIE)?.value;
  const refreshCookie = jar.get(REFRESH_COOKIE)?.value;

  if (accessCookie) {
    try {
      const payload = verifyAccessToken(accessCookie);
      await ensureRedis().catch(() => null);
      await getRedis()
        .set(RedisKeys.tokenBlacklist(payload.jti), '1', 'EX', env.JWT_ACCESS_TTL_SECONDS)
        .catch(() => null);
    } catch {
      /* ignore */
    }
  }
  if (refreshCookie) {
    const db = getDb();
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshCookie)));
  }
  jar.set(ACCESS_COOKIE, '', clearCookieOptions());
  jar.set(REFRESH_COOKIE, '', clearCookieOptions());
  return { ok: true };
}

export async function mutateRefresh(
  ctx: { ip: string; ua: string },
): Promise<AuthMutationOk<{ user: AuthUser }> | AuthMutationError> {
  const refreshCookie = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshCookie) {
    return { ok: false, status: 401, message: 'no refresh token' };
  }
  const rotated = await rotateRefreshToken(refreshCookie, ctx);
  if (!rotated.ok) {
    clearAuthCookiesResponse();
    return { ok: false, status: 401, message: 'invalid refresh token' };
  }
  setAuthCookiesInJar(rotated.access, rotated.refresh);
  let accessPayload;
  try {
    accessPayload = verifyAccessToken(rotated.access);
  } catch {
    return { ok: false, status: 401, message: 'invalid token' };
  }
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, accessPayload.sub)).limit(1);
  if (!user) return { ok: false, status: 401, message: 'user not found' };
  return { ok: true, data: { user: toAuthUser(user) } };
}

export async function mutateMe(): Promise<AuthMutationOk<{ user: AuthUser }> | AuthMutationError> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) {
    return { ok: false, status: 401, message: 'unauthenticated' };
  }
  let sub: string;
  try {
    const payload = verifyAccessToken(token);
    await ensureRedis().catch(() => null);
    const blacklisted = await getRedis().get(RedisKeys.tokenBlacklist(payload.jti)).catch(() => null);
    if (blacklisted) {
      return { ok: false, status: 401, message: 'unauthenticated' };
    }
    sub = payload.sub;
  } catch {
    return { ok: false, status: 401, message: 'unauthenticated' };
  }
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1);
  if (!user) return { ok: false, status: 404, message: 'user not found' };
  return { ok: true, data: { user: toAuthUser(user) } };
}

export async function mutateProfile(
  body: unknown,
  sub: string,
): Promise<AuthMutationOk<{ user: AuthUser }> | AuthMutationError> {
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, message: 'validação falhou' };
  }
  const input = parsed.data;
  const db = getDb();
  if (input.username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);
    if (taken && taken.id !== sub) {
      return { ok: false, status: 409, message: 'username indisponível' };
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
    .where(eq(users.id, sub))
    .returning();
  if (!updated) return { ok: false, status: 404, message: 'user not found' };
  return { ok: true, data: { user: toAuthUser(updated) } };
}

export async function mutateForgotPassword(body: unknown): Promise<{ ok: true }> {
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: true };
  }
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user) {
    const rawToken = crypto.randomUUID();
    const tHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(users)
      .set({ resetTokenHash: tHash, resetExpires: expires, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    const env = getEnv();
    const link = `${env.APP_URL}/reset-password?token=${rawToken}`;
    const payload = emailSendSchema.parse({
      to: user.email,
      template: 'password-reset',
      data: { link, name: user.name },
    });
    const rendered = renderEmailTemplate(payload);
    try {
      await sendEmailTransactional({
        to: payload.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (err) {
      console.error('[forgot-password] email failed', err);
    }
  }
  return { ok: true };
}

export async function mutateResetPassword(
  body: unknown,
): Promise<AuthMutationOk<{ ok: true }> | AuthMutationError> {
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, message: 'validação falhou' };
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetTokenHash, tokenHash))
    .limit(1);
  if (!user || !user.resetExpires || user.resetExpires.getTime() < Date.now()) {
    return { ok: false, status: 400, message: 'token inválido ou expirado' };
  }
  const ph = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: ph,
        resetTokenHash: null,
        resetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, user.id)));
  });
  return { ok: true, data: { ok: true } };
}
