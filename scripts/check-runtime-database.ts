import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { owners } from "@/db/schema";

async function check() {
  const tables = await db.execute<{ count: number }>(sql`select count(*)::int as count from pg_tables where schemaname='public' and tablename in ('site_owners','owner_sessions','site_settings','media','media_uploads','media_parts','inquiries')`);
  if (tables.rows[0].count !== 7) throw new Error("Application tables are not ready.");
  const [owner] = await db.select({ id: owners.id }).from(owners).where(eq(owners.id, "main")).limit(1);
  if (!owner) throw new Error("Owner setup is not complete.");
  console.log("Runtime database verified: application tables and the owner account are ready.");
}
check().catch(() => {
  console.error("The runtime DATABASE_URL is not ready. Check connectivity and permissions. DATABASE_URL and optional DIRECT_DATABASE_URL must point to the same prepared database. No credentials are printed.");
  process.exitCode = 1;
}).finally(async () => { await pool.end(); });
