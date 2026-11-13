"use client";
import { useEffect, useRef, useState } from "react";
import type { SiteContent } from "@/lib/site-data";
import Website from "./website";
import { requestJson } from "@/lib/api-client";
export default function LiveWebsite({ initialContent }: { initialContent: SiteContent }) {
  const [content, setContent] = useState(initialContent);
  const fingerprint = useRef(JSON.stringify(initialContent));
  useEffect(() => {
    let disposed = false, busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (disposed || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const next = await requestJson<SiteContent>(`/api/site?live=${Date.now()}`, "GET", undefined, { signal: controller.signal });
        const nextFingerprint = JSON.stringify(next);
        if (!disposed && nextFingerprint !== fingerprint.current) {
          fingerprint.current = nextFingerprint; setContent(next);
          document.title = `${next.brandName} — ${next.heroTitle} ${next.heroAccent}`;
        }
      } catch { /* Keep the last good published content when offline. */ }
      finally { busy = false; }
    }
    const storage = (event: StorageEvent) => { if (event.key === "hansa.site.updated") void refresh(); };
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel("hansa-site"); channel.onmessage = () => { void refresh(); }; } catch { /* Focus + polling support older/restricted browsers. */ }
    window.addEventListener("hansa-site-published", refresh); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); window.addEventListener("storage", storage); document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(refresh, 6000);
    void refresh();
    return () => { disposed = true; controller.abort(); clearInterval(interval); channel?.close(); window.removeEventListener("hansa-site-published", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <Website content={content} />;
}
