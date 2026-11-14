CREATE TABLE "budget_review_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_review_entries_unique_cell" UNIQUE("user_id","year","month","category_id")
);
--> statement-breakpoint
ALTER TABLE "budget_review_entries" ADD CONSTRAINT "budget_review_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_review_entries" ADD CONSTRAINT "budget_review_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_review_entries_user_year_idx" ON "budget_review_entries" USING btree ("user_id","year");