"use client";
import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api-client";
import { Icon } from "./icons";
export function SessionUnlock({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await requestJson("/api/auth", "POST", { mode: "login", password }); onSuccess(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="session-unlock"><span className="confirmation-icon"><Icon name="lock" size={24} /></span><h2>Your changes are safe.</h2><p>Session expire ho gaya hai. Apna existing password daalein—sign in ke baad pending changes save ho jayenge.</p><form onSubmit={submit}><label className="studio-field"><span>Editor password</span><input type="password" autoComplete="current-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in & continue"}<Icon name="arrowRight" size={16} /></button></form><small>Works even when your browser blocks third-party cookies.</small></div>;
}
