"use client";
import { ApiError, requestJson } from "./api-client";
import { formatBytes, identifyMedia, MAX_UPLOAD_BYTES, MEDIA_TYPES } from "./media-policy";
export type Asset = { id: string; filename: string; mime: string; url: string; size?: number; createdAt: string };
export type UploadProgress = { percent: number; message: string; loaded: number; total: number };
let activeUploads = 0;
const remembered = new Map<string, string>();
export const getActiveUploads = () => activeUploads;
export function setUploadActivity(delta: number) {
  activeUploads = Math.max(0, activeUploads + delta);
  window.dispatchEvent(new Event("hansa-upload-activity"));
}
export async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(new Error("File could not be read. Please select it again.")); reader.readAsArrayBuffer(blob); });
}
function remember(key: string, id: string | null) {
  if (id) remembered.set(key, id); else remembered.delete(key);
  try { if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key); } catch { /* In-memory resume works in restricted Safari frames. */ }
}
function rememberedId(key: string) { try { return remembered.get(key) || sessionStorage.getItem(key); } catch { return remembered.get(key); } }
function abortIfNeeded(signal: AbortSignal) { if (signal.aborted) throw new DOMException("Upload paused", "AbortError"); }
async function imageBlob(blob: Blob, output: string, always = false): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => { img.src = ""; reject(new Error("Image decoding timed out")); }, 30000);
      img.onload = () => { clearTimeout(timeout); resolve(img); };
      img.onerror = () => { clearTimeout(timeout); reject(new Error("Image format needs conversion")); };
      img.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image is empty");
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    if (!always && scale === 1 && blob.size <= 6 * 1024 * 1024) return blob;
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image optimisation is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const converted = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(result => result ? resolve(result) : reject(new Error("Image conversion failed")), output, .9));
    return always || converted.size < blob.size ? converted : blob;
  } finally { URL.revokeObjectURL(objectUrl); if (canvas) { canvas.width = 0; canvas.height = 0; } }
}
async function prepareFile(original: File, optimise: boolean, mode: "image" | "video" | "all", progress: (value: UploadProgress) => void): Promise<File> {
  const firstBytes = new Uint8Array(await blobBytes(original.slice(0, 128)));
  let mime = identifyMedia(firstBytes);
  if (original.size === 0) throw new ApiError("Please choose a non-empty file.", 400);
  if (!mime) mime = "application/octet-stream";
  if (mode === "image" && !mime.startsWith("image/")) throw new ApiError("Please choose a photo, not a video.", 415);
  if (mode === "video" && !mime.startsWith("video/")) throw new ApiError("Please choose a video, or paste a video link.", 415);
  let blob: Blob = original;
  let filename = original.name;
  if (mime === "image/heic") {
    progress({ percent: 0, message: "Converting iPhone photo to JPEG…", loaded: 0, total: original.size });
    try { blob = await imageBlob(original, "image/jpeg", true); }
    catch {
      try {
        const { default: convert } = await import("heic2any");
        const result = await convert({ blob: original, toType: "image/jpeg", quality: .9 });
        blob = Array.isArray(result) ? result[0] : result;
      } catch { throw new ApiError("This HEIC variant could not be converted. Export the photo as JPEG/PNG from Photos, then upload it.", 415); }
    }
    mime = "image/jpeg"; filename = filename.replace(/\.[^.]+$/, "") + ".jpg";
  }
  if (optimise && ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mime)) {
    progress({ percent: 0, message: "Preparing photo · transparency preserved for PNG…", loaded: 0, total: original.size });
    try { blob = await imageBlob(blob, mime === "image/png" ? "image/png" : "image/jpeg"); }
    catch { /* Memory-constrained devices can upload the original in small chunks. */ }
    if (blob !== original && blob.type) {
      mime = blob.type;
      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/avif" ? "avif" : "jpg";
      filename = filename.replace(/\.[^.]+$/, "") + "." + extension;
    }
  }
  if (mode !== "all" && !MEDIA_TYPES.includes(mime)) throw new ApiError("For a poster choose JPG, PNG, WebP, GIF or a converted iPhone photo. Other file types can be uploaded with Upload any file.", 415);
  if (blob.size > MAX_UPLOAD_BYTES) throw new ApiError("After optimisation, this file is still over this host’s 2 GB limit. Use a public link for a larger video.", 413);
  return new File([blob], filename, { type: mime, lastModified: original.lastModified });
}
async function sendPart(url: string, part: Blob, signal: AbortSignal, progress: (loaded: number) => void): Promise<void> {
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await blobBytes(part));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  await requestJson(url, "POST", { data: btoa(binary) }, { signal, timeoutMs: 90000 });
  progress(bytes.length);
}
type UploadJob = { id: string; chunkSize: number; received: number[]; status: string; filename?: string; url?: string; mime?: string; createdAt?: string; size?: number };
export async function uploadFile(original: File, options: { optimise?: boolean; mode?: "image" | "video" | "all"; signal: AbortSignal; onProgress: (value: UploadProgress) => void }): Promise<Asset> {
  const { signal, onProgress } = options;
  abortIfNeeded(signal);
  const file = await prepareFile(original, options.optimise !== false, options.mode || "all", onProgress);
  abortIfNeeded(signal);
  const head = new Uint8Array(await blobBytes(file.slice(0, 16384)));
  let hash = 2166136261; for (const byte of head) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  const key = `hansa.upload.v2:${file.name}:${file.size}:${file.lastModified}:${hash >>> 0}`;
  let job: UploadJob | undefined;
  const previous = rememberedId(key);
  if (previous) {
    try { job = await requestJson<UploadJob>(`/api/uploads/${previous}`); }
    catch (error) { if (error instanceof ApiError && error.status === 404) remember(key, null); else throw error; }
  }
  if (!job) { job = await requestJson<UploadJob>("/api/uploads", "POST", { filename: file.name, size: file.size }); remember(key, job.id); }
  if (job.status === "complete" && job.url && job.mime) { remember(key, null); return { id: job.id, filename: job.filename || file.name, mime: job.mime, url: job.url, size: file.size, createdAt: job.createdAt || new Date().toISOString() }; }
  const received = new Set(job.received);
  const totalParts = Math.ceil(file.size / job.chunkSize);
  let completeBytes = Array.from(received).reduce((sum, part) => sum + Math.min(job!.chunkSize, file.size - part * job!.chunkSize), 0);
  for (let part = 0; part < totalParts; part++) {
    abortIfNeeded(signal);
    if (received.has(part)) continue;
    const blob = file.slice(part * job.chunkSize, Math.min(file.size, (part + 1) * job.chunkSize));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await sendPart(`/api/uploads/${job.id}?part=${part}`, blob, signal, loaded => onProgress({ percent: Math.min(99, Math.round((completeBytes + loaded) / file.size * 100)), message: `${formatBytes(completeBytes + loaded)} / ${formatBytes(file.size)}${attempt ? " · retrying" : ""}`, loaded: completeBytes + loaded, total: file.size }));
        break;
      } catch (error) {
        if (signal.aborted || (error instanceof ApiError && error.status > 0 && error.status < 500 && ![408, 429].includes(error.status)) || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      }
    }
    completeBytes += blob.size;
  }
  abortIfNeeded(signal);
  onProgress({ percent: 99, message: "Saving your completed file…", loaded: file.size, total: file.size });
  const saved = await requestJson<Asset>(`/api/uploads/${job.id}`, "POST", {});
  remember(key, null);
  onProgress({ percent: 100, message: "File uploaded successfully", loaded: file.size, total: file.size });
  return saved;
}
