-- "TOOL" becomes "TOOL LAVORO" (keeping its transactions and budget), plus a new "TOOL PERSONALI".
UPDATE "categories" SET "name" = 'TOOL LAVORO' WHERE "name" = 'TOOL' AND "type" = 'expense';
--> statement-breakpoint
INSERT INTO "categories" ("user_id", "name", "type")
SELECT c."user_id", 'TOOL PERSONALI', 'expense'
FROM "categories" c
WHERE c."name" = 'TOOL LAVORO' AND c."type" = 'expense'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" c2
    WHERE c2."user_id" = c."user_id" AND c2."name" = 'TOOL PERSONALI' AND c2."type" = 'expense'
  );
