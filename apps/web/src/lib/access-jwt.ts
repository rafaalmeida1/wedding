import 'server-only';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

/** Mesmo nome que `ACCESS_COOKIE` no servidor (`auth-cookies.ts`). */
export const WG_ACCESS_COOKIE = 'wg_access';

interface AccessLikePayload {
  sub?: unknown;
}

/**
 * Lê o JWT do cookie httpOnly no próprio Next (upload em Server Action sem round-trip HTTP).
 */
export function resolveSessionUserIdFromCookie(): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 16) return null;

  let token: string | undefined;
  try {
    token = cookies().get(WG_ACCESS_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, secret) as AccessLikePayload;
    return typeof decoded.sub === 'string' && decoded.sub.length > 0 ? decoded.sub : null;
  } catch {
    return null;
  }
}
