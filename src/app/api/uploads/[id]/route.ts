import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, mediaParts, mediaUploads } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { identifyMedia, UPLOAD_CHUNK_BYTES, validMediaId } from "@/lib/media-policy";
import { readLimitedBody, UploadError } from "@/lib/media-server";
import { errorResponse, sameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof UploadError) return errorResponse(error.message, error.status);
  console.error("Resumable upload error", error);
  return errorResponse("Upload interrupted. Please retry; received parts are kept for 24 hours.", 503);
}
export async function GET(request: Request, context: Context) {
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in again.", 401);
    const { id } = await context.params;
    if (!validMediaId(id)) return errorResponse("Upload not found.", 404);
    const [upload] = await db.select().from(mediaUploads).where(eq(mediaUploads.id, id)).limit(1);
    if (!upload || (upload.status !== "complete" && upload.expiresAt < new Date())) return errorResponse("Upload expired. Select the file again to restart.", 404);
    const parts = await db.select({ part: mediaParts.part }).from(mediaParts).where(eq(mediaParts.uploadId, id)).orderBy(asc(mediaParts.part));
    return Response.json({ id, filename: upload.filename, size: upload.totalSize, chunkSize: upload.chunkSize, status: upload.status, received: parts.map(p => p.part), ...(upload.status === "complete" ? { url: `/api/media/${id}`, mime: upload.mime, createdAt: upload.createdAt.toISOString() } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, context: Context) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in again, then retry the upload.", 401);
    const { id } = await context.params;
    const partText = new URL(request.url).searchParams.get("part");
    if (!validMediaId(id) || !partText || !/^\d+$/.test(partText)) return errorResponse("Invalid upload part.");
    const part = Number(partText);
    if (!Number.isSafeInteger(part)) return errorResponse("Invalid upload part.");
    let data: Buffer;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const raw = await readLimitedBody(request, 1500000);
      let json: { data?: unknown };
      try { json = JSON.parse(raw.toString("utf8")); } catch { throw new UploadError("Invalid upload part."); }
      if (typeof json.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(json.data)) throw new UploadError("Invalid encoded upload part.");
      data = Buffer.from(json.data, "base64");
      if (data.length > Math.max(UPLOAD_CHUNK_BYTES, 1024 * 1024)) throw new UploadError("Upload part is too large.", 413);
    } else data = await readLimitedBody(request, Math.max(UPLOAD_CHUNK_BYTES, 1024 * 1024));
    await db.transaction(async tx => {
      const [upload] = await tx.select().from(mediaUploads).where(eq(mediaUploads.id, id)).for("update");
      if (!upload || upload.expiresAt < new Date()) throw new UploadError("Upload expired. Select the file again to restart.", 404);
      if (upload.status !== "pending") throw new UploadError("This upload is already complete.", 409);
      const totalParts = Math.ceil(upload.totalSize / upload.chunkSize);
      if (part < 0 || part >= totalParts) throw new UploadError("Invalid upload part number.");
      const expected = Math.min(upload.chunkSize, upload.totalSize - part * upload.chunkSize);
      if (data.length !== expected) throw new UploadError("Incomplete upload part. Please retry.");
      if (part === 0) {
        const detected = identifyMedia(data);
        const mime = detected === "image/heic" ? "application/octet-stream" : detected || "application/octet-stream";
        await tx.update(mediaUploads).set({ mime }).where(eq(mediaUploads.id, id));
      }
      await tx.insert(mediaParts).values({ uploadId: id, part, size: data.length, data }).onConflictDoUpdate({ target: [mediaParts.uploadId, mediaParts.part], set: { size: data.length, data } });
    });
    return Response.json({ ok: true, part }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  if (new URL(request.url).searchParams.has("part")) return PUT(request, context);
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in again, then retry the upload.", 401);
    const { id } = await context.params;
    if (!validMediaId(id)) return errorResponse("Invalid upload.");
    const asset = await db.transaction(async tx => {
      const [upload] = await tx.select().from(mediaUploads).where(eq(mediaUploads.id, id)).for("update");
      if (!upload) throw new UploadError("Upload not found.", 404);
      if (upload.status !== "complete" && upload.expiresAt < new Date()) throw new UploadError("Upload expired. Select the file again.", 404);
      const [totals] = await tx.select({ parts: count(), bytes: sql<string>`coalesce(sum(${mediaParts.size}), 0)` }).from(mediaParts).where(eq(mediaParts.uploadId, id));
      if (!upload.mime || totals.parts !== Math.ceil(upload.totalSize / upload.chunkSize) || Number(totals.bytes) !== upload.totalSize) throw new UploadError("Some upload parts are missing. Retry to resume from the last completed part.", 409);
      const [saved] = await tx.insert(media).values({ id, filename: upload.filename, mime: upload.mime, data: Buffer.alloc(0), size: upload.totalSize, chunked: true }).onConflictDoUpdate({ target: media.id, set: { filename: upload.filename } }).returning({ id: media.id, filename: media.filename, mime: media.mime, size: media.size, createdAt: media.createdAt });
      await tx.update(mediaUploads).set({ status: "complete" }).where(eq(mediaUploads.id, id));
      return saved;
    });
    return Response.json({ ...asset, url: `/api/media/${asset.id}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  try {
    if (!(await isOwner(request))) return errorResponse("Please sign in.", 401);
    const { id } = await context.params;
    if (!validMediaId(id)) return errorResponse("Invalid upload.");
    await db.delete(mediaUploads).where(and(eq(mediaUploads.id, id), eq(mediaUploads.status, "pending")));
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
