import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;

// Don't crash at import time — the setup wizard needs to load before the
// database is configured. Any code that uses `db` will get a clear error
// if POSTGRES_URL is missing.
let db: PostgresJsDatabase<typeof schema>;

// In dev, Next.js hot-reloads route modules on every save without tearing down
// the previous module instance — a plain `postgres(connectionString)` at module
// scope would open a brand new connection pool on every single reload and never
// close the old one, eventually exhausting Postgres's max_connections. Caching
// the client on `globalThis` makes it survive HMR and reuse the same pool.
declare global {
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

if (connectionString) {
  const client =
    process.env.NODE_ENV === "production"
      ? postgres(connectionString, { max: 10 })
      : (global.__pgClient ??= postgres(connectionString, { max: 10 }));
  db = drizzle(client, { schema });
} else {
  // Proxy that throws a helpful message on any property access / method call
  db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
    get(_, prop) {
      if (prop === "then" || prop === Symbol.toPrimitive) return undefined;
      throw new Error(
        "POSTGRES_URL is not set. Check your .env file.\n" +
          "For local dev: docker compose up -d (then use the default URL in env.example)"
      );
    },
  });
}

export { db };
