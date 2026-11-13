"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./modal";
import Website from "./website";
import { Icon } from "./icons";
import type { SiteContent } from "@/lib/site-data";
export function EditorPreview({ published, draft, dirty, revision, section, onClose, onRefresh }: { published: SiteContent; draft: SiteContent; dirty: boolean; revision: string; section: string; onClose: () => void; onRefresh: () => Promise<unknown> }) {
  const [showDraft, setShowDraft] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!dirty) setShowDraft(false); }, [dirty]);
  useEffect(() => {
    const timer = setTimeout(() => { if (section && section !== "home") ref.current?.querySelector(`#${section}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }, 200);
    return () => clearTimeout(timer);
  }, [section]);
  async function refresh() { setRefreshing(true); setError(""); try { await onRefresh(); } catch { setError("Live data could not be reloaded. Last verified version is still shown."); } finally { setRefreshing(false); } }
  return <Modal label="Website live preview" onClose={onClose} className="editor-preview-modal"><div className="editor-preview-bar"><div><Icon name={showDraft ? "edit" : "checkCircle"} size={19} /><span><strong>{showDraft ? "Draft preview — not yet published" : "Saved website preview"}</strong><small>{showDraft ? "These edits may still need saving." : revision ? `Verified version ${revision.slice(-8)}` : "Showing the latest version read from the server."}</small></span></div><div className="preview-bar-actions">{dirty && <button className="button button-outline" onClick={() => setShowDraft(!showDraft)}>{showDraft ? "Show published" : "See unsaved draft"}</button>}<button className="button button-outline" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={15} />{refreshing ? "Refreshing…" : "Refresh live"}</button></div></div>{error && <p className="preview-connection-error" role="alert">{error}</p>}<div className="editor-preview-content" ref={ref}><Website content={showDraft ? draft : published} embeddedPreview /></div></Modal>;
}
