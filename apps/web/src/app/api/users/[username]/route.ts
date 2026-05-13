import { usernameSchema } from '@repo/shared/auth';
import type { PublicProduct } from '@repo/shared/products';
import { and, asc, eq, products, users } from '@repo/db';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { ensureRedis, getRedis, RedisKeys } from '@/server/redis';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

const usernameParam = z.object({ username: usernameSchema });

interface PublicCouple {
  username: string;
  name: string;
  avatarUrl: string | null;
}

type Ctx = { params: { username: string } };

export async function GET(req: Request, { params }: Ctx) {
  const limited = await rateLimitOrNull(req, '/api/users/username', 400, 60);
  if (limited) return limited;

  const parsed = usernameParam.safeParse({ username: params.username });
  if (!parsed.success) {
    return jsonErr('username inválido', 400);
  }
  const { username } = parsed.data;

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) return jsonErr('lista não encontrada', 404);

  const couple: PublicCouple = {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return jsonOk({ couple });
}
