import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { owners, sessions } from "@/db/schema";

export const SESSION_COOKIE = "hansa_owner";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, saved: string) {
  const [salt, digest] = saved.split(":");
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function getOwnerToken(request?: Request) {
  const source = request?.headers ?? await headers();
  const dedicated = source.get("x-hansa-session");
  if (dedicated && /^[a-f0-9]{64}$/i.test(dedicated)) return dedicated;
  const authorization = source.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
export async function isOwner(request?: Request) {
  const token = await getOwnerToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const [session] = await db.select({ tokenHash: sessions.tokenHash }).from(sessions).where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return Boolean(session);
}
export async function ownerExists() {
  const [owner] = await db.select({ id: owners.id }).from(owners).where(eq(owners.id, "main")).limit(1);
  return Boolean(owner);
}
export async function newSession() {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86400000) });
  return token;
}
