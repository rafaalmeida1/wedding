import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { env } from '../env.js';

export const ACCESS_COOKIE = 'wg_access';
export const REFRESH_COOKIE = 'wg_refresh';

interface CookieOptions {
  maxAge: number;
}

function baseOptions({ maxAge }: CookieOptions) {
  // Front (Next) em um host e API em outro é cross-site para o navegador: precisa SameSite=None
  // quando Secure está ligado ou o Session cookie não vai no fetch com credentials.
  const sameSite = env.COOKIE_SECURE ? ('None' as const) : ('Lax' as const);
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
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
