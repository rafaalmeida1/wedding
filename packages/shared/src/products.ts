import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().positive().max(100_000_000),
  imageUrl: z.string().url(),
  stock: z.number().int().min(0).max(1000).default(1),
});

export const productUpdateSchema = productCreateSchema.partial();

export const presignedUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024, 'imagem deve ter no máximo 8MB'),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string;
  stock: number;
  isOutOfStock: boolean;
}

export interface OwnerProduct extends PublicProduct {
  createdAt: string;
  updatedAt: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}
