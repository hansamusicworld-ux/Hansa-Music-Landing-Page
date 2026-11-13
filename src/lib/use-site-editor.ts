"use client";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { ApiError, announcePublication, requestJson } from "./api-client";
import { canonicalContent } from "./content-version";
import { validateContent, type SiteContent } from "./site-data";
const DRAFT_KEY = "hansa.pending-draft.v2";
export function useSiteEditor(initial: SiteContent, enabled: boolean) {
  const [draft, setDraftState] = useState(initial);
  const [published, setPublished] = useState(initial);
  const [receipt, setReceipt] = useState("");
  const [dirty, setDirtyState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [recovered, setRecovered] = useState<SiteContent | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const latest = useRef(initial), changed = useRef(false), revision = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const failedRevision = useRef<number | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const removeDraft = useCallback(() => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Private mode */ } }, []);
  const setDirty = useCallback((value: boolean) => { changed.current = value; setDirtyState(value); if (!value) removeDraft(); }, [removeDraft]);
  const setDraft = useCallback((action: SetStateAction<SiteContent>) => {
    const value = typeof action === "function" ? action(latest.current) : action;
    latest.current = value; revision.current++; changed.current = true;
    setDraftState(value); setDirtyState(true); setError(""); setErrorStatus(0); failedRevision.current = null;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch { /* Saving to server still works with storage blocked. */ }
  }, []);
  const loadContent = useCallback((value: SiteContent) => {
    setPublished(value);
    if (changed.current) return;
    latest.current = value; setDraftState(value);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    try {
      const pending = sessionStorage.getItem(DRAFT_KEY);
      if (pending) { const value = JSON.parse(pending) as SiteContent; if (value && typeof value.brandName === "string" && Array.isArray(value.releases) && Array.isArray(value.gallery) && JSON.stringify(value) !== JSON.stringify(latest.current)) setRecovered(value); else removeDraft(); }
    } catch { /* Unreadable drafts never replace server content. */ }
  }, [enabled, removeDraft]);
  const refreshPublished = useCallback(async () => {
    const snapshot = await requestJson<{ content: SiteContent; revision: string }>(`/api/site?format=snapshot&fresh=${Date.now()}`);
    setPublished(snapshot.content);
    setReceipt(snapshot.revision);
    return snapshot.content;
  }, []);
  const save = useCallback(async (force = false): Promise<boolean> => {
    if (inFlight.current) {
      const pending = inFlight.current;
      await pending;
      if (inFlight.current === pending) inFlight.current = null;
      return save(force);
    }
    if (!changed.current && !force) return true;
    const version = revision.current;
    let content: SiteContent;
    try { content = validateContent(latest.current); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Please check your inputs."); setErrorStatus(400); failedRevision.current = version; return false; }
    const task = (async () => {
      setSaving(true); setError(""); setErrorStatus(0);
      try {
        const result = await requestJson<{ content: SiteContent; updatedAt: string; revision: string }>("/api/site", "POST", { content });
        if (!result?.revision || !result.content) throw new ApiError("Save was not confirmed by the server. Please retry.", 503);
        const snapshot = await requestJson<{ content: SiteContent; revision: string }>(`/api/site?format=snapshot&verify=${Date.now()}`);
        if (snapshot.revision !== result.revision || canonicalContent(snapshot.content) !== canonicalContent(result.content)) throw new ApiError("The live version could not be verified, or another edit arrived. Your draft is safe—please save again.", 409);
        announcePublication();
        if (!alive.current) return true;
        setPublished(snapshot.content);
        setReceipt(result.revision);
        setLastSaved(new Date(result.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        failedRevision.current = null;
        // Never overwrite edits made while this request was in flight.
        if (revision.current === version) { latest.current = result.content; setDraftState(result.content); changed.current = false; setDirtyState(false); removeDraft(); }
        return true;
      } catch (reason) {
        if (alive.current) { setError(reason instanceof Error ? reason.message : "Save failed. Please retry."); setErrorStatus(reason instanceof ApiError ? reason.status : 0); failedRevision.current = version; }
        return false;
      } finally { if (alive.current) setSaving(false); }
    })();
    inFlight.current = task;
    let ok: boolean;
    try { ok = await task; } finally { if (inFlight.current === task) inFlight.current = null; }
    if (ok && changed.current && revision.current !== version) return save();
    return ok;
  }, [removeDraft]);
  useEffect(() => {
    if (!enabled || !dirty || saving || failedRevision.current === revision.current) return;
    const timer = setTimeout(() => { void save(); }, 1100);
    return () => clearTimeout(timer);
  }, [enabled, dirty, draft, saving, retryTick, save]);
  useEffect(() => {
    const online = () => { failedRevision.current = null; setRetryTick(value => value + 1); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const restoreDraft = () => { if (recovered) setDraft(recovered); setRecovered(null); };
  const discardRecovery = () => { setRecovered(null); removeDraft(); };
  const retry = () => { failedRevision.current = null; setRetryTick(value => value + 1); void save(); };
  return { draft, setDraft, published, receipt, refreshPublished, dirty, setDirty, saving, lastSaved, setLastSaved, save, error, errorStatus, loadContent, recovered, restoreDraft, discardRecovery, retry };
}
