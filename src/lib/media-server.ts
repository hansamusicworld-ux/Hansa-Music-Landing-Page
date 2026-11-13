export class UploadError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readLimitedBody(request: Request, max: number): Promise<Buffer> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > max) throw new UploadError("Upload part is too large. Please retry with the resumable uploader.", 413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) { await reader.cancel(); throw new UploadError("Upload part is too large.", 413); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}
