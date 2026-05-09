import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { env } from '../env.js';

export const ACCESS_COOKIE = 'wg_access';
export const REFRESH_COOKIE = 'wg_refresh';

interface CookieOptions {
  maxAge: number;
}

function baseOptions({ maxAge }: CookieOptions) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'Strict' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge,
  };
}

export function setAuthCookies(c: Context, accessToken: string, refreshToken: string) {
  setCookie(c, ACCESS_COOKIE, accessToken, baseOptions({ maxAge: env.JWT_ACCESS_TTL_SECONDS }));
  setCookie(
    c,
    REFRESH_COOKIE,
    refreshToken,
    baseOptions({ maxAge: env.JWT_REFRESH_TTL_SECONDS }),
  );
}

export function clearAuthCookies(c: Context) {
  deleteCookie(c, ACCESS_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
  deleteCookie(c, REFRESH_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
}
