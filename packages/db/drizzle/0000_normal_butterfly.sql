CREATE TYPE "public"."payment_method" AS ENUM('card', 'pix');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_payment_intent" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payer_name" text,
	"payer_email" text,
	"payer_message" text,
	"payment_method" "payment_method",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"image_url" text NOT NULL,
	"stock" integer DEFAULT 1 NOT NULL,
	"stripe_price_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" uuid,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"reset_token_hash" text,
	"reset_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_intent_unique" ON "payments" USING btree ("stripe_payment_intent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_product_idx" ON "payments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_user_idx" ON "products" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" USING btree ("username");