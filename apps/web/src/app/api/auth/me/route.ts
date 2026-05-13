import { mutateMe } from '@/server/auth-mutations';
import { jsonErr, jsonOk } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  const result = await mutateMe();
  if (!result.ok) {
    return jsonErr(result.message, result.status);
  }
  return jsonOk(result.data);
}
