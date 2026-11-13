"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { formatBytes, mediaKind } from "@/lib/media-policy";
import type { WebsiteFile } from "@/lib/site-data";
export function downloadHref(url: string) { return url.startsWith("/api/media/") ? `${url}${url.includes("?") ? "&" : "?"}download=1` : url; }
export function FileDownload({ file, label = "Download" }: { file: Pick<WebsiteFile, "url" | "filename" | "size">; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!file.url.startsWith("/api/media/") || file.size > 64 * 1024 * 1024) return;
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(downloadHref(file.url), { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Download connection failed. Please retry from the original preview.");
      const blob = await response.blob(); const href = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = href; link.download = file.filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed."); }
    finally { setBusy(false); }
  }
  return <span className="file-download-wrap"><a className="text-link" href={downloadHref(file.url)} download={file.filename} onClick={busy ? event => event.preventDefault() : download} aria-busy={busy}><Icon name="download" size={16} />{busy ? "Preparing…" : label}</a>{error && <small role="alert">{error}</small>}</span>;
}
export function WebsiteFiles({ files }: { files: WebsiteFile[] }) {
  if (!files.length) return null;
  return <section className="section website-files container" id="downloads"><div className="section-heading"><div><p className="section-label"><span />FROM OUR STUDIO TO YOU</p><h2>Files & downloads.</h2><p>Posters, audio, press kits and more. Ready when you are.</p></div><span className="published-file-count">{files.length} {files.length === 1 ? "file" : "files"}</span></div><div className="public-file-grid">{files.map(file => <article className="public-file-card" key={file.id}><span className="public-file-icon"><Icon name={mediaKind(file.mime) === "audio" ? "music" : "download"} size={23} /></span><div className="public-file-info"><h3>{file.title}</h3><p>{file.filename} · {formatBytes(file.size)}</p>{mediaKind(file.mime) === "audio" && <audio src={file.url} controls preload="none" aria-label={file.title} />}</div><FileDownload file={file} /></article>)}</div></section>;
}
