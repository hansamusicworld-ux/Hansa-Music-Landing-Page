"use client";

export const SESSION_KEY = "hansa.editor.session.v2";
let memoryToken: string | null = null;
let bridgePreferred = false;
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = "") { super(message); this.name = "ApiError"; }
}
export function storeSession(token: string | null) {
  memoryToken = token;
  try { if (token) sessionStorage.setItem(SESSION_KEY, token); else sessionStorage.removeItem(SESSION_KEY); } catch { /* Restricted browsers retain the in-memory session. */ }
}
export function getSessionToken(): string | null {
  if (memoryToken) return memoryToken;
  try { memoryToken = sessionStorage.getItem(SESSION_KEY); } catch { /* Cookie/memory fallback. */ }
  return memoryToken;
}
// Plain objects survive preview proxies that JSON-serialize request options; native Headers objects do not.
export function authHeaders(extra?: HeadersInit): Record<string, string> {
  const output: Record<string, string> = {};
  new Headers(extra).forEach((value, key) => { output[key] = value; });
  const token = getSessionToken();
  if (token) { output["X-Hansa-Session"] = token; output.Authorization = `Bearer ${token}`; }
  return output;
}
export async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: Record<string, unknown>;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new ApiError(response.status === 413 ? "This request is too large. Please use the resumable uploader." : "Preview connection did not return website data. Your edits are still safe.", response.status, "PREVIEW_RESPONSE"); }
  if (!response.ok) {
    const hostingBlocked = typeof data.message === "string" && /traffic.access.token|sandbox.*secured/i.test(data.message);
    throw new ApiError(hostingBlocked ? "The preview host blocked this request. Reconnecting through the editor…" : typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "Request failed. Please retry.", response.status, hostingBlocked ? "PREVIEW_ACCESS" : "");
  }
  return data as T;
}
type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; directOnly?: boolean };
export async function requestJson<T>(url: string, method = "GET", body?: unknown, options: RequestOptions = {}): Promise<T> {
  if (options.signal?.aborted) throw new DOMException("Upload paused", "AbortError");
  async function bridged(): Promise<T> {
    if (options.signal?.aborted) throw new DOMException("Upload paused", "AbortError");
    const { dispatchEditorRequest } = await import("@/app/editor-actions");
    const reply = await dispatchEditorRequest({ path: url, method, data: body, token: getSessionToken() || undefined });
    if (options.signal?.aborted) throw new DOMException("Upload paused", "AbortError");
    if (!reply.ok) throw new ApiError(reply.error || "Request failed. Please retry.", reply.status);
    const data = reply.data as T & { token?: string };
    if (url === "/api/auth" && typeof data?.token === "string") storeSession(data.token);
    return data;
  }
  if (bridgePreferred && !options.directOnly) return bridged();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, options.timeoutMs || 30000);
  try {
    const response = await fetch(url, { method, headers: authHeaders(body !== undefined ? { "Content-Type": "application/json" } : undefined), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: "include", cache: "no-store", signal: controller.signal });
    const data = await readResponse<T & { token?: string }>(response);
    if (url === "/api/auth" && typeof data?.token === "string") storeSession(data.token);
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException("Upload paused", "AbortError");
    const canBridge = !(error instanceof ApiError) || error.code.startsWith("PREVIEW_") || [403, 404, 405, 502, 504].includes(error.status);
    if (canBridge && !options.directOnly && navigator.onLine !== false) {
      try { const data = await bridged(); bridgePreferred = true; return data; }
      catch (fallbackError) { if (fallbackError instanceof ApiError) throw fallbackError; throw new ApiError("Preview connection could not be restored. Reload this editor inside the original preview; your draft has not been published.", 503, "PREVIEW_UNAVAILABLE"); }
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "Connection timed out. Your edits are safe—please retry." : "Connection interrupted. Your edits are safe; check the connection and retry.", controller.signal.aborted ? 408 : 0);
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}
export function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function announcePublication() {
  window.dispatchEvent(new Event("hansa-site-published"));
  try { localStorage.setItem("hansa.site.updated", String(Date.now())); } catch { /* Polling fallback. */ }
  try { const channel = new BroadcastChannel("hansa-site"); channel.postMessage("published"); channel.close(); } catch { /* Focus/polling fallback. */ }
}
