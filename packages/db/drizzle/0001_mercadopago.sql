-- Migra de Stripe para Mercado Pago.
--   * adiciona valores 'boleto' e 'debit_caixa' ao enum payment_method
--   * renomeia payments.stripe_payment_intent → mp_payment_id (e o índice único)
--   * remove products.stripe_price_id (não usado pelo Mercado Pago)

ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'boleto';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'debit_caixa';--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "stripe_payment_intent" TO "mp_payment_id";--> statement-breakpoint
ALTER INDEX "payments_intent_unique" RENAME TO "payments_mp_payment_unique";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "stripe_price_id";
