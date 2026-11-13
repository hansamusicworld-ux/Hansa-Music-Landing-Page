import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { db, pool } from "@/db";
import { owners } from "@/db/schema";
import { sql } from "drizzle-orm";

const suffix = randomBytes(6).toString("hex");
const name = `hansa_launch_check_${suffix}`;
const secret = randomBytes(24).toString("base64url");
const originalOwners = awaitOwners();
function awaitOwners() { return db.select().from(owners); }
const baseUrl = process.env.DATABASE_URL!;
const testUrl = new URL(baseUrl); testUrl.pathname = `/${name}`;
const runtime = resolve("node_modules/tsx/dist/cli.mjs");
function execute(script: string, password: string) {
  return spawnSync(process.execPath, [runtime, script], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60000,
    env: { ...process.env, DATABASE_URL: testUrl.href, HANSA_PUBLIC_SITE: "true", HANSA_OWNER_PASSWORD: password },
  });
}
async function main() {
  const beforeOwners = await originalOwners;
  let created = false;
  try {
    await db.execute(sql.raw(`create database "${name}"`)); created = true;
    const missing = execute("scripts/prepare-production.ts", "");
    if (missing.status === 0 || !missing.stderr.includes("HANSA_OWNER_PASSWORD")) throw new Error("Fresh production setup did not reject a missing owner secret.");
    console.log("PASS: Fresh production refuses to launch without a private owner password.");
    const prepared = execute("scripts/prepare-production.ts", secret);
    if (prepared.status !== 0) throw new Error(`Production preparation failed: ${prepared.stderr || prepared.stdout}`);
    console.log(prepared.stdout.trim());
    const verified = execute("scripts/verify-production-database.ts", secret);
    if (verified.status !== 0) throw new Error(`Production checks failed: ${verified.stderr || verified.stdout}`);
    console.log(verified.stdout.trim());
    const again = execute("scripts/prepare-production.ts", randomBytes(24).toString("base64url"));
    if (again.status !== 0 || !again.stdout.includes("password preserved")) throw new Error("Redeploy did not preserve the existing owner.");
    const verifiedAgain = execute("scripts/verify-production-database.ts", secret);
    if (verifiedAgain.status !== 0) throw new Error("Original production owner password failed after redeployment.");
    console.log("PASS: Repeated migrations are safe, and a changed environment value does not reset the owner password.");
    const afterOwners = await db.select().from(owners);
    if (JSON.stringify(beforeOwners) !== JSON.stringify(afterOwners)) throw new Error("Preview owner credentials changed unexpectedly.");
    console.log("PASS: Existing preview credentials were not modified.");
    console.log("ALL PRODUCTION BOOTSTRAP CHECKS PASSED (isolated database only; no external deployment performed).");
  } finally {
    if (created) await db.execute(sql.raw(`drop database if exists "${name}" with (force)`));
    await pool.end();
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Production validation failed."); process.exitCode = 1; });
