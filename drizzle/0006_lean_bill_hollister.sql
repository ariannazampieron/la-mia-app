CREATE TABLE "tax_due_amounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tax_due_amounts_unique_year" UNIQUE("user_id","year")
);
--> statement-breakpoint
ALTER TABLE "tax_due_amounts" ADD CONSTRAINT "tax_due_amounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tax_due_amounts_user_idx" ON "tax_due_amounts" USING btree ("user_id");