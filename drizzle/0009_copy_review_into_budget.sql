-- The Review tab now edits the budget directly: carry over any re-forecast already entered.
INSERT INTO "budget_entries" ("user_id", "year", "month", "category_id", "planned_amount")
SELECT "user_id", "year", "month", "category_id", "amount" FROM "budget_review_entries"
ON CONFLICT ("user_id", "year", "month", "category_id")
DO UPDATE SET "planned_amount" = EXCLUDED."planned_amount", "updated_at" = now();
