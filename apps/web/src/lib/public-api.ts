import { apiServer, ApiError } from '@/lib/api';
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
      apiServer<{ couple: PublicCouple }>(`/api/users/${username}`),
      apiServer<{ products: PublicProduct[] }>(`/api/users/${username}/products`),
    ]);
    return { couple: couple.data.couple, products: products.data.products };
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
    const { data } = await apiServer<PublicGiftData>(
      `/api/users/${username}/products/${id}`,
    );
    return data;
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 404 || err.status === 400 || err.status === 422)
    )
      return null;
    throw err;
  }
}
