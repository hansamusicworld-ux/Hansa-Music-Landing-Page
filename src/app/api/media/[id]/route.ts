import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, mediaParts, mediaUploads } from "@/db/schema";
import { canDisplayInline, validMediaId } from "@/lib/media-policy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function serve(request: Request, { params }: Context) {
  const { id } = await params;
  if (!validMediaId(id)) return new Response("Not found", { status: 404 });
  const [asset] = await db.select({ filename: media.filename, mime: media.mime, chunked: media.chunked, size: sql<number>`case when ${media.chunked} then ${media.size} else octet_length(${media.data}) end` }).from(media).where(eq(media.id, id)).limit(1);
  if (!asset) return new Response("Not found", { status: 404 });
  const size = Number(asset.size);
  const asciiName = asset.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const attachment = !canDisplayInline(asset.mime) || new URL(request.url).searchParams.get("download") === "1";
  const headers: Record<string, string> = { "Content-Type": asset.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(asset.filename)}` };
  if (attachment) { headers["Content-Security-Policy"] = "sandbox; default-src 'none'"; headers["X-Frame-Options"] = "DENY"; }
  let start = 0, end = size - 1, status = 200;
  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const first = match[1] ? Number(match[1]) : null;
    const last = match[2] ? Number(match[2]) : null;
    if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last)) || (first === null && last === 0)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    start = first ?? Math.max(0, size - (last ?? 0));
    end = first !== null && last !== null ? Math.min(last, size - 1) : size - 1;
    if (start >= size || start < 0 || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(Math.max(0, end - start + 1));
  if (request.method === "HEAD" || size === 0) return new Response(null, { status, headers });
  if (!asset.chunked) {
    const [result] = await db.select({ data: sql<Buffer>`substring(${media.data} from ${start + 1} for ${end - start + 1})` }).from(media).where(eq(media.id, id));
    return new Response(new Uint8Array(result.data), { status, headers });
  }
  const [upload] = await db.select({ chunkSize: mediaUploads.chunkSize }).from(mediaUploads).where(eq(mediaUploads.id, id)).limit(1);
  if (!upload) return new Response("File unavailable", { status: 404 });
  let position = start, cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled) return;
      if (position > end) { controller.close(); return; }
      try {
        const part = Math.floor(position / upload.chunkSize);
        const [stored] = await db.select({ data: mediaParts.data }).from(mediaParts).where(and(eq(mediaParts.uploadId, id), eq(mediaParts.part, part))).limit(1);
        if (cancelled) return;
        if (!stored) throw new Error("File part unavailable");
        const offset = position % upload.chunkSize;
        const take = Math.min(stored.data.length - offset, end - position + 1);
        if (take <= 0) throw new Error("Invalid file part");
        controller.enqueue(new Uint8Array(stored.data.subarray(offset, offset + take)));
        position += take;
      } catch (error) { controller.error(error); }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { status, headers });
}
export async function GET(request: Request, context: Context) { return serve(request, context); }
export async function HEAD(request: Request, context: Context) { return serve(request, context); }
