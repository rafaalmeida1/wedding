import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const paymentStatus = pgEnum('payment_status', ['pending', 'approved', 'failed']);
// Métodos suportados pelo Mercado Pago Checkout Transparente:
// - card        → cartão de crédito
// - pix         → PIX
// - boleto      → boleto bancário
// - debit_caixa → cartão de débito virtual Caixa
export const paymentMethod = pgEnum('payment_method', [
  'card',
  'pix',
  'boleto',
  'debit_caixa',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    resetTokenHash: text('reset_token_hash'),
    resetExpires: timestamp('reset_expires', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
    usernameIdx: uniqueIndex('users_username_unique').on(t.username),
  }),
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedByTokenId: uuid('replaced_by_token_id'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
    hashIdx: uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash),
  }),
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    priceCents: integer('price_cents').notNull(),
    imageUrl: text('image_url').notNull(),
    stock: integer('stock').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('products_user_idx').on(t.userId),
    stockCheck: sql`CHECK (${t.stock} >= 0)`,
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    mpPaymentId: text('mp_payment_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    payerName: text('payer_name'),
    payerEmail: text('payer_email'),
    payerMessage: text('payer_message'),
    paymentMethod: paymentMethod('payment_method'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    mpPaymentIdx: uniqueIndex('payments_mp_payment_unique').on(t.mpPaymentId),
    productIdx: index('payments_product_idx').on(t.productId),
    userIdx: index('payments_user_idx').on(t.userId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
