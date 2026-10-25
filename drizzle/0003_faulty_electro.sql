CREATE TABLE "budget_opening_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_opening_balance_unique_cell" UNIQUE("user_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "budget_opening_balance" ADD CONSTRAINT "budget_opening_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_opening_balance_user_idx" ON "budget_opening_balance" USING btree ("user_id");