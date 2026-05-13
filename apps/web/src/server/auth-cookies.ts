import { getEnv } from './env';

export const ACCESS_COOKIE = 'wg_access';
export const REFRESH_COOKIE = 'wg_refresh';

/** Opções compatíveis com `cookies().set` do Next.js. */
function baseCookieOptions(maxAge: number) {
  const env = getEnv();
  const sameSite = env.COOKIE_SECURE ? ('none' as const) : ('lax' as const);
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    maxAge,
  } as const;
}

export function accessCookieOptions() {
  return baseCookieOptions(getEnv().JWT_ACCESS_TTL_SECONDS);
}

export function refreshCookieOptions() {
  return baseCookieOptions(getEnv().JWT_REFRESH_TTL_SECONDS);
}

export function clearCookieOptions() {
  const env = getEnv();
  return {
    path: '/',
    maxAge: 0,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  } as const;
}
