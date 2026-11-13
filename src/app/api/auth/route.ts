import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { owners, sessions } from "@/db/schema";
import { getOwnerToken, hashPassword, hashToken, isOwner, newSession, ownerExists, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { errorResponse, rateLimited, sameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET(request: Request) {
  try { return Response.json({ configured: await ownerExists(), authenticated: await isOwner(request) }, { headers: noStore }); }
  catch { return errorResponse("The editor is temporarily unavailable. Please try again shortly.", 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const cookieOptions = { httpOnly: true, secure, sameSite: (secure ? "none" : "lax") as "none" | "lax", partitioned: secure, path: "/" };
  try {
    const body = await request.json();
    if (body.mode === "logout") {
      const tokens = [await getOwnerToken(request), (await cookies()).get(SESSION_COOKIE)?.value].filter((value): value is string => Boolean(value && /^[a-f0-9]{64}$/.test(value)));
      if (tokens.length) await db.delete(sessions).where(inArray(sessions.tokenHash, tokens.map(hashToken)));
      const response = NextResponse.json({ ok: true }, { headers: noStore });
      response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (rateLimited(request, "auth", 12)) return errorResponse("Too many attempts. Please wait 15 minutes before trying again.", 429);
    const password = body.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return errorResponse("Use a password with 8–128 characters.");
    if (body.mode === "setup") {
      if (process.env.HANSA_PUBLIC_SITE === "true") return errorResponse("Public-site owner setup is private. Sign in with the editor password configured during deployment.", 403);
      const created = await db.insert(owners).values({ id: "main", passwordHash: hashPassword(password) }).onConflictDoNothing().returning({ id: owners.id });
      if (!created.length) return errorResponse("An owner password is already set. Please sign in.", 409);
    } else if (body.mode === "login" || body.mode === "change") {
      const [owner] = await db.select().from(owners).where(eq(owners.id, "main")).limit(1);
      if (!owner || !verifyPassword(password, owner.passwordHash)) return errorResponse("That password isn’t correct. Please try again.", 401);
      if (body.mode === "change") {
        if (!(await isOwner(request))) return errorResponse("Please sign in again.", 401);
        if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) return errorResponse("Your new password must contain 8–128 characters.");
        await db.transaction(async tx => {
          await tx.update(owners).set({ passwordHash: hashPassword(body.newPassword) }).where(eq(owners.id, "main"));
          await tx.delete(sessions);
        });
      }
    } else return errorResponse("Invalid action.");
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    const token = await newSession();
    // A scoped session token allows Safari/private iframe editors to work when third-party cookies are blocked.
    const response = NextResponse.json({ ok: true, token }, { headers: noStore });
    response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 7 * 86400 });
    return response;
  } catch (error) {
    console.error("Owner authentication error", error);
    return errorResponse("Unable to sign in right now. Please try again.", 500);
  }
}
