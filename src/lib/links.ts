export function normalizePublicUrl(input: string, image = false): string {
  let value = input.trim();
  if (!value) return "";
  const iframe = value.match(/^<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (iframe) value = iframe[1].replace(/&amp;/g, "&");
  if (/^\/(?:api\/media\/[\da-f-]+|images\/[\w./-]+)(?:[?#].*)?$/i.test(value)) return value;
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^[a-z][a-z\d+.-]*:/i.test(value) && /^(?:localhost(?::\d+)?|[a-z\d-]+(?:\.[a-z\d-]+)+)(?:[/:?#]|$)/i.test(value)) value = `https://${value}`;
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`Please paste a valid ${image ? "public image" : "website or video"} link, or upload a file.`); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Only public http:// or https:// links are allowed. File paths and script links cannot be used.");
  if (image && ["www.dropbox.com", "dropbox.com"].includes(parsed.hostname)) { parsed.searchParams.delete("dl"); parsed.searchParams.set("raw", "1"); }
  if (image && parsed.hostname === "drive.google.com") {
    const id = parsed.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || parsed.searchParams.get("id");
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2400`;
  }
  return parsed.href;
}
export type VideoEmbed = { kind: "youtube" | "vimeo" | "file" | "external"; url: string };
export function getVideoEmbed(input: string): VideoEmbed | null {
  if (!input.trim()) return null;
  let url: string;
  try { url = normalizePublicUrl(input); } catch { return null; }
  if (/^\/api\/media\/[a-f0-9-]+(?:[?#]|$)/i.test(url) || /\.(mp4|webm|m4v|mov|ogv)([?#]|$)/i.test(url)) return { kind: "file", url };
  try {
    const u = new URL(url);
    if (/^\/api\/media\/[a-f0-9-]+$/i.test(u.pathname)) return { kind: "file", url };
    let id = "";
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(u.hostname)) id = u.searchParams.get("v") || u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1] || "";
    else if (["youtu.be", "www.youtu.be"].includes(u.hostname)) id = u.pathname.split("/")[1] || "";
    if (/^[\w-]{11}$/.test(id)) return { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1` };
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(u.hostname)) {
      const match = u.pathname.match(/\/(?:video\/)?(\d+)(?:\/([\w]+))?/);
      if (match) { const h = u.searchParams.get("h") || match[2]; return { kind: "vimeo", url: `https://player.vimeo.com/video/${match[1]}?autoplay=1${h ? `&h=${encodeURIComponent(h)}` : ""}` }; }
    }
    return { kind: "external", url };
  } catch { return null; }
}
