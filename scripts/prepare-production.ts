import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { owners } from "@/db/schema";

class SetupError extends Error {}
async function prepare() {
  if (process.env.HANSA_PUBLIC_SITE !== "true") throw new SetupError("This production setup requires HANSA_PUBLIC_SITE=true. Do not run it against the preview database.");
  const state = await db.execute<{ ownerTable: string | null; journal: string | null; existing: number }>(sql`
    select to_regclass('public.site_owners')::text as "ownerTable",
           to_regclass('drizzle.__drizzle_migrations')::text as journal,
           (select count(*)::int from pg_tables where schemaname = 'public' and tablename in
             ('site_owners','owner_sessions','site_settings','media','media_uploads','media_parts','inquiries')) as existing
  `);
  const before = state.rows[0];
  if (before.existing > 0 && !before.journal) throw new SetupError("This database already has app tables without a migration history. No data was changed. Use a new empty production database, or have a database administrator baseline/import the existing database safely.");
  const existingOwner = before.ownerTable ? (await db.select({ id: owners.id }).from(owners).where(eq(owners.id, "main")).limit(1))[0] : undefined;
  const password = process.env.HANSA_OWNER_PASSWORD;
  if (!existingOwner && (!password || password.length < 12 || password.length > 128)) throw new SetupError("Set the private HANSA_OWNER_PASSWORD environment variable to your own 12–128 character password in the hosting dashboard before deployment.");
  await migrate(db, { migrationsFolder: "./drizzle" });
  if (!existingOwner) {
    // Same salted scrypt format used by the editor login. Never print the password or hash.
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password!, salt, 64).toString("hex")}`;
    const created = await db.insert(owners).values({ id: "main", passwordHash }).onConflictDoNothing().returning({ id: owners.id });
    console.log(created.length ? "Production owner account securely created." : "Existing owner account preserved.");
  } else console.log("Existing owner password preserved; it was not reset.");
  console.log("Database migrations complete. The production service can now start.");
}
prepare().catch(error => {
  console.error(error instanceof SetupError ? error.message : "Production database preparation failed. Check database connectivity and migration logs. No credentials are printed by this script.");
  process.exitCode = 1;
}).finally(async () => { await pool.end(); });
