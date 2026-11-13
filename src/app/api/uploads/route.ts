import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { mediaUploads } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { cleanFilename, MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES } from "@/lib/media-policy";
import { errorResponse, sameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in again before uploading. Your changes are safe.", 401);
    const body = await request.json();
    if (typeof body.filename !== "string" || !Number.isSafeInteger(body.size) || body.size < 1) return errorResponse("Choose a non-empty file to upload.");
    if (body.size > MAX_UPLOAD_BYTES) return errorResponse("This host supports up to 2 GB per file. Optimise a larger photo or paste a link for a larger video.", 413);
    await db.delete(mediaUploads).where(and(eq(mediaUploads.status, "pending"), lt(mediaUploads.expiresAt, new Date())));
    const [upload] = await db.insert(mediaUploads).values({ filename: cleanFilename(body.filename), totalSize: body.size, chunkSize: UPLOAD_CHUNK_BYTES, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).returning({ id: mediaUploads.id });
    return Response.json({ id: upload.id, chunkSize: UPLOAD_CHUNK_BYTES, received: [], status: "pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Start upload error", error); return errorResponse("Upload start nahi hua. Please retry.", 503); }
}
