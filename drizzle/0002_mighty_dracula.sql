CREATE TABLE "casa_manual_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section" text NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "casa_manual_totals_unique_cell" UNIQUE("user_id","section","year")
);
--> statement-breakpoint
ALTER TABLE "casa_manual_totals" ADD CONSTRAINT "casa_manual_totals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "casa_manual_totals_user_idx" ON "casa_manual_totals" USING btree ("user_id");