// Small JSON-transportable parts also work inside restricted preview proxies.
export const UPLOAD_CHUNK_BYTES = 512 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const LEGACY_UPLOAD_BYTES = 32 * 1024 * 1024;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/bmp", "video/mp4", "video/webm", "video/quicktime", "video/ogg", "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/mp4"];
export function identifyMedia(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (ascii(0, 2) === "BM" && bytes.length >= 14) return "image/bmp";
  if (ascii(0, 4) === "RIFF") { if (ascii(8, 12) === "WEBP") return "image/webp"; if (ascii(8, 12) === "WAVE") return "audio/wav"; }
  if (ascii(0, 3) === "ID3" || (bytes.length >= 3 && bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0)) return "audio/mpeg";
  if (ascii(0, 4) === "fLaC") return "audio/flac";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12), compatible = ascii(8, Math.min(bytes.length, 64));
    if (/avif|avis/.test(compatible)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"].includes(brand)) return "image/heic";
    if (["M4A ", "M4B ", "M4P "].includes(brand)) return "audio/mp4";
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes.length >= 4 && [26, 69, 223, 163].every((byte, i) => bytes[i] === byte)) return "video/webm";
  if (ascii(0, 4) === "OggS") return /OpusHead|vorbis/.test(ascii(0, Math.min(128, bytes.length))) ? "audio/ogg" : "video/ogg";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (ascii(0, 2) === "PK") return "application/zip";
  return null;
}
export function mediaKind(mime: string): "image" | "video" | "audio" | "file" {
  if (!MEDIA_TYPES.includes(mime)) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}
export const canDisplayInline = (mime: string) => MEDIA_TYPES.includes(mime);
export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return bytes === 0 ? "0 B" : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
export function cleanFilename(name: string) { return name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 200) || "upload"; }
export const validMediaId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
