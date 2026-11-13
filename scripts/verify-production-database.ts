import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { owners, sessions } from "@/db/schema";
import { GET as health } from "@/app/api/health/route";
import { POST as authenticate } from "@/app/api/auth/route";

async function verify() {
  if (!new URL(process.env.DATABASE_URL!).pathname.startsWith("/hansa_launch_check_")) throw new Error("This verification script only accepts an isolated test database.");
  const [owner] = await db.select().from(owners).where(eq(owners.id, "main"));
  if (!owner) throw new Error("Production owner is missing.");
  const [salt, hash] = owner.passwordHash.split(":");
  const expected = scryptSync(process.env.HANSA_OWNER_PASSWORD!, salt, 64).toString("hex");
  if (hash !== expected || owner.passwordHash === process.env.HANSA_OWNER_PASSWORD) throw new Error("Owner password hashing is invalid.");
  const count = await db.execute<{ count: number }>(sql`select count(*)::int as count from pg_tables where schemaname='public' and tablename in ('site_owners','owner_sessions','site_settings','media','media_uploads','media_parts','inquiries')`);
  if (count.rows[0].count !== 7) throw new Error("Not all application tables were migrated.");
  const ready = await health(); if (ready.status !== 200 || !(await ready.json()).ok) throw new Error("Production readiness check failed.");
  const login = await authenticate(new Request("https://hansa-test.example/api/auth", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://hansa-test.example" }, body: JSON.stringify({ mode: "login", password: process.env.HANSA_OWNER_PASSWORD }) }));
  const session = await login.json(); if (login.status !== 200 || typeof session.token !== "string" || session.token.length !== 64) throw new Error("Production owner cannot sign in using the configured password.");
  const attempt = await authenticate(new Request("https://hansa-test.example/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "setup", password: randomBytes(24).toString("base64url") }) }));
  if (attempt.status !== 403) throw new Error("Public first-come owner registration should be disabled in production.");
  await db.delete(sessions);
  console.log("PASS: Seven migrated tables, hashed owner password, actual login handler, ready healthcheck, and blocked public owner registration.");
}
verify().catch(error => { console.error(error instanceof Error ? error.message : "Production database check failed."); process.exitCode = 1; }).finally(async () => { await pool.end(); });
