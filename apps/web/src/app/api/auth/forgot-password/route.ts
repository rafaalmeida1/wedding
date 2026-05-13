import { mutateForgotPassword } from '@/server/auth-mutations';
import { jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/auth/forgot-password', 20, 60);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonOk({ ok: true });
  }
  await mutateForgotPassword(body);
  return jsonOk({ ok: true });
}
