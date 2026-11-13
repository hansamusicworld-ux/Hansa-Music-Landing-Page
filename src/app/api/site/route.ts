import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { validateContent } from "@/lib/site-data";
import { getSiteSnapshot, siteRevision } from "@/lib/site";
import { errorResponse, sameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache" };
export async function GET(request: Request) {
  try {
    const snapshot = await getSiteSnapshot();
    return Response.json(new URL(request.url).searchParams.get("format") === "snapshot" ? snapshot : snapshot.content, { headers: { ...noStore, "X-Hansa-Revision": snapshot.revision } });
  } catch { return errorResponse("Saved content could not be read. Your editor draft is safe; retry the connection.", 503); }
}
async function commit(request: Request) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Session expire ho gaya. Sign in again; your unsaved changes are safe.", 401);
    let content;
    try {
      const body = await request.json();
      content = validateContent(body && typeof body === "object" && "content" in body ? body.content : body);
    } catch (error) { return errorResponse(error instanceof Error ? error.message : "Please check your website content."); }
    const updatedAt = new Date();
    const [stored] = await db.insert(siteSettings).values({ id: "main", content, updatedAt }).onConflictDoUpdate({ target: siteSettings.id, set: { content, updatedAt } }).returning();
    revalidatePath("/", "page");
    const revision = siteRevision(stored.content, stored.updatedAt);
    return Response.json({ ok: true, content: stored.content, revision, updatedAt: stored.updatedAt.toISOString(), storage: "postgresql" }, { headers: { ...noStore, "X-Hansa-Revision": revision } });
  } catch (error) {
    console.error("Saving website failed", error instanceof Error ? error.message : error);
    return errorResponse("Changes publish nahi hue. Your draft is safe—please retry.", 503);
  }
}
export async function POST(request: Request) { return commit(request); }
export async function PUT(request: Request) { return commit(request); }
