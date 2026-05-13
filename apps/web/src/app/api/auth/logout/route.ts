import { mutateLogout } from '@/server/auth-mutations';
import { jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/auth/logout', 60, 60);
  if (limited) return limited;
  const result = await mutateLogout();
  return jsonOk(result);
}
