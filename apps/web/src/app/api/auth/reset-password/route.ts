import { mutateResetPassword } from '@/server/auth-mutations';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/auth/reset-password', 20, 60);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const result = await mutateResetPassword(body);
  if (!result.ok) {
    return jsonErr(result.message, result.status);
  }
  return jsonOk(result.data);
}
