import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { errorResponse, sameOrigin } from "@/lib/security";
import { cleanFilename, identifyMedia, LEGACY_UPLOAD_BYTES } from "@/lib/media-policy";
import { readLimitedBody, UploadError } from "@/lib/media-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in.", 401);
    const files = await db.select({ id: media.id, filename: media.filename, mime: media.mime, size: sql<number>`case when ${media.chunked} then ${media.size} else octet_length(${media.data}) end`, createdAt: media.createdAt }).from(media).orderBy(desc(media.createdAt)).limit(300);
    return Response.json(files.map(f => ({ ...f, size: Number(f.size), url: `/api/media/${f.id}` })), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return errorResponse("Media library load nahi hui. Please retry.", 503); }
}
// Backward-compatible multipart endpoint; the editor uses 1 MB resumable parts for every file.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Your session has expired. Please sign in again.", 401);
    const body = await readLimitedBody(request, LEGACY_UPLOAD_BYTES + 65536);
    const parsed = new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") || "" }, body: new Uint8Array(body) });
    const file = (await parsed.formData()).get("file");
    if (!(file instanceof File) || !file.size) return errorResponse("Please select a photo or video to upload.");
    if (file.size > LEGACY_UPLOAD_BYTES) return errorResponse("Use the resumable uploader for larger files.", 413);
    const data = Buffer.from(await file.arrayBuffer());
    const detected = identifyMedia(data);
    const mime = detected === "image/heic" ? "application/octet-stream" : detected || "application/octet-stream";
    const [saved] = await db.insert(media).values({ filename: cleanFilename(file.name), mime, data, size: file.size }).returning({ id: media.id, filename: media.filename, mime: media.mime, size: media.size, createdAt: media.createdAt });
    return Response.json({ ...saved, url: `/api/media/${saved.id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return errorResponse(error.message, error.status);
    console.error("Upload error", error);
    return errorResponse("Upload complete nahi hua. Please retry with the resumable uploader.", 503);
  }
}
