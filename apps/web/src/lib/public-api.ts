import 'server-only';
import { ApiError, serverRequest } from '@/lib/server-json';
import type { PublicProduct } from '@repo/shared';

export interface PublicCouple {
  username: string;
  name: string;
  avatarUrl: string | null;
}

export interface PublicListData {
  couple: PublicCouple;
  products: PublicProduct[];
}

export interface PublicGiftData {
  couple: { id: string; username: string; name: string };
  product: PublicProduct;
}

export async function getPublicList(username: string): Promise<PublicListData | null> {
  try {
    const [couple, products] = await Promise.all([
      serverRequest<{ couple: PublicCouple }>(`/api/users/${encodeURIComponent(username)}`),
      serverRequest<{ products: PublicProduct[] }>(
        `/api/users/${encodeURIComponent(username)}/products`,
      ),
    ]);
    return { couple: couple.couple, products: products.products };
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 404 || err.status === 400 || err.status === 422)
    )
      return null;
    throw err;
  }
}

export async function getPublicGift(
  username: string,
  id: string,
): Promise<PublicGiftData | null> {
  try {
    return await serverRequest<PublicGiftData>(
      `/api/users/${encodeURIComponent(username)}/products/${encodeURIComponent(id)}`,
    );
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 404 || err.status === 400 || err.status === 422)
    )
      return null;
    throw err;
  }
}
