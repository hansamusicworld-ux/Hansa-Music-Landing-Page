"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { ApiError } from "@/lib/api-client";
import { normalizePublicUrl } from "@/lib/links";
import { setUploadActivity, uploadFile, type Asset, type UploadProgress } from "@/lib/media-upload";
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif";
const VIDEO_ACCEPT = "video/*,.mp4,.mov,.m4v,.webm,.ogv";
function useUploadTask(onUpload: (asset: Asset) => void, mode: "image" | "video" | "all", optimise = true) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const retryFiles = useRef<File[]>([]);
  const busyRef = useRef(false);
  useEffect(() => () => { controller.current?.abort(); }, []);
  async function run(files: File[]) {
    if (!files.length || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setUploadActivity(1);
    controller.current = new AbortController();
    const failed: File[] = [], messages: string[] = [];
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress({ percent: 0, message: `Preparing ${file.name}…`, loaded: 0, total: file.size });
        try {
          const asset = await uploadFile(file, { mode, optimise, signal: controller.current.signal, onProgress: value => setProgress({ ...value, message: `${files.length > 1 ? `${index + 1}/${files.length} · ` : ""}${value.message}` }) });
          onUpload(asset);
        } catch (reason) {
          if (reason instanceof Error && reason.name === "AbortError") { failed.push(...files.slice(index)); messages.push("Upload paused. Resume to continue from received parts."); break; }
          failed.push(file);
          messages.push(`${file.name}: ${reason instanceof Error ? reason.message : "Upload failed. Please retry."}`);
          if (reason instanceof ApiError && reason.status === 401) { failed.push(...files.slice(index + 1)); window.dispatchEvent(new Event("hansa-session-expired")); break; }
        }
      }
      retryFiles.current = failed;
      setError(messages.join("\n"));
    } finally { busyRef.current = false; setBusy(false); setUploadActivity(-1); }
  }
  return { run, busy, error, progress, retry: () => run(retryFiles.current), pause: () => controller.current?.abort() };
}
function UploadStatus({ task }: { task: ReturnType<typeof useUploadTask> }) {
  return <>{task.progress && <div className={`upload-progress ${task.busy ? "active" : ""}`} role="status"><div><span>{task.progress.message}</span>{task.busy && <button type="button" onClick={task.pause}>Pause</button>}</div><progress value={task.progress.percent} max={100} aria-label="Upload progress" /></div>}{task.error && <div className="upload-error" role="alert"><p>{task.error}</p><button type="button" className="text-link" onClick={task.retry} disabled={task.busy}><Icon name="refresh" size={14} />Retry / resume upload</button></div>}</>;
}
export function UploadButton({ onUpload, children, video = false, multiple = false, all = false }: { onUpload: (asset: Asset) => void; children?: ReactNode; video?: boolean; multiple?: boolean; all?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const task = useUploadTask(onUpload, all ? "all" : video ? "video" : "image");
  return <div className="upload-button-wrap"><input ref={ref} type="file" multiple={multiple} accept={all ? undefined : video ? VIDEO_ACCEPT : IMAGE_ACCEPT} hidden onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; void task.run(files); }} /><button type="button" className="button button-outline" disabled={task.busy} onClick={() => ref.current?.click()}><Icon name="upload" size={15} />{task.busy ? "Uploading…" : children || (video ? "Upload a video" : "Upload image")}</button><UploadStatus task={task} /></div>;
}
export function ImageUpload({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState(value);
  const [linkError, setLinkError] = useState("");
  const [broken, setBroken] = useState(false);
  const [optimise, setOptimise] = useState(true);
  const task = useUploadTask(asset => { setLink(asset.url); setBroken(false); onChange(asset.url); }, "image", optimise);
  useEffect(() => { setLink(value); setBroken(false); }, [value]);
  function applyLink() {
    try { const next = normalizePublicUrl(link, true); setLink(next); setLinkError(""); setBroken(false); if (next !== value) onChange(next); }
    catch (error) { setLinkError(error instanceof Error ? error.message : "Please check this image link."); }
  }
  return <div className={`image-upload ${compact ? "compact" : ""}`}><span className="upload-field-label">{label}</span><input ref={input} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; void task.run(files); }} /><div className={`image-dropzone ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); if (!task.busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) void task.run([e.dataTransfer.files[0]]); }}>{value && !broken ? <img src={value} alt={`${label} preview`} onError={() => setBroken(true)} /> : <div className="upload-placeholder"><Icon name="image" size={35} /><span>{broken ? "Image link could not be previewed" : "Your image goes here"}</span></div>}<div className="upload-overlay"><button type="button" className="button button-outline" disabled={task.busy} onClick={() => input.current?.click()}><Icon name="upload" size={15} />{task.busy ? "Uploading…" : value ? "Change image" : "Choose image"}</button><span>PNG · JPEG · WebP · GIF · AVIF · iPhone HEIC</span><span>Any image dimensions · large files upload in small parts</span></div></div><label className="upload-optimise"><input type="checkbox" checked={optimise} onChange={e => setOptimise(e.target.checked)} disabled={task.busy} /><span>Optimise large photos <small>Uncheck to keep original resolution. PNG stays transparent.</small></span></label><UploadStatus task={task} /><label className="image-url-label">Or paste a public image link<div className="image-link-row"><input aria-label={`${label} image link`} value={link} disabled={task.busy} onChange={e => setLink(e.target.value)} onBlur={applyLink} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} placeholder="Paste image, public Drive or Dropbox link…" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><button type="button" className="button button-outline" disabled={task.busy} onClick={applyLink}>Apply link</button></div></label>{(linkError || broken) && <p className="inline-error" role="alert">{linkError || "Use a direct/public image link, or upload the photo. Private album/page links may not display."}</p>}</div>;
}
