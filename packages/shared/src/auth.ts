import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3, 'username deve ter ao menos 3 caracteres')
  .max(32, 'username deve ter no máximo 32 caracteres')
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/i, 'apenas letras, números e hifens')
  .transform((v) => v.toLowerCase());

export const emailSchema = z.string().email('email inválido').max(160).toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'senha deve ter ao menos 8 caracteres')
  .max(128, 'senha muito longa');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, 'informe um nome').max(120),
  username: usernameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'senha obrigatória'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  username: usernameSchema.optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}
