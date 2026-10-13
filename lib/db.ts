import { Pool, PoolClient } from "pg";

// One shared Postgres connection pool. In development it is kept on globalThis
// so hot reloads don't open a new pool every time a file is saved.
const g = globalThis as { pool?: Pool };
export const db = g.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
g.pool = db;

// Runs several queries as one transaction: either all of them are saved or none.
export async function tx<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
