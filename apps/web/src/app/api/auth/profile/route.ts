import { mutateProfile } from '@/server/auth-mutations';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';
import { getSessionUser } from '@/server/session';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/auth/profile', 60, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) {
    return jsonErr('unauthenticated', 401);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const result = await mutateProfile(body, auth.sub);
  if (!result.ok) {
    return jsonErr(result.message, result.status);
  }
  return jsonOk(result.data);
}
