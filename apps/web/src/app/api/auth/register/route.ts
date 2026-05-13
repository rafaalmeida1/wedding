import { mutateRegister } from '@/server/auth-mutations';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

function ctxFromReq(req: Request) {
  return {
    ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '0.0.0.0',
    ua: req.headers.get('user-agent') ?? '',
  };
}

export async function POST(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/auth/register', 30, 60);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const result = await mutateRegister(body, ctxFromReq(req));
  if (!result.ok) {
    return jsonErr(result.message, result.status);
  }
  return jsonOk(result.data, { status: 201 });
}
