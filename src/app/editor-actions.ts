"use server";
import { headers } from "next/headers";

type EditorRequest = { path: string; method: string; data?: unknown; token?: string };
type EditorReply = { ok: boolean; status: number; data?: unknown; error?: string };
// Same authenticated handlers, transported through Next's current-page Server Action endpoint.
// No hosting token is exposed, no arbitrary URL is fetched, and every write still checks the owner session.
export async function dispatchEditorRequest(input: EditorRequest): Promise<EditorReply> {
  try {
    if (!input || typeof input.path !== "string" || input.path.length > 4096 || !input.path.startsWith("/api/")) return { ok: false, status: 400, error: "Invalid editor request." };
    const url = new URL(input.path, "http://hansa.internal");
    if (url.origin !== "http://hansa.internal") return { ok: false, status: 400, error: "Invalid request path." };
    const method = input.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return { ok: false, status: 405, error: "Unsupported editor action." };
    const incoming = await headers();
    const forwarded: Record<string, string> = { "Content-Type": "application/json" };
    if (input.token && /^[a-f0-9]{64}$/i.test(input.token)) forwarded["X-Hansa-Session"] = input.token;
    const ip = incoming.get("x-forwarded-for") || incoming.get("x-real-ip");
    if (ip) forwarded["x-forwarded-for"] = ip;
    // Next Server Actions already enforce the browser-origin check. This request is internal, not a network proxy.
    const request = new Request(url, { method, headers: forwarded, body: method === "GET" ? undefined : JSON.stringify(input.data ?? {}) });
    let response: Response;
    if (url.pathname === "/api/site") {
      const route = await import("./api/site/route");
      response = method === "GET" ? await route.GET(request) : ["POST", "PUT"].includes(method) ? await route.POST(request) : new Response(null, { status: 405 });
    } else if (url.pathname === "/api/auth") {
      const route = await import("./api/auth/route");
      response = method === "GET" ? await route.GET(request) : method === "POST" ? await route.POST(request) : new Response(null, { status: 405 });
    } else if (url.pathname === "/api/media" && method === "GET") {
      response = await (await import("./api/media/route")).GET(request);
    } else if (url.pathname === "/api/uploads" && method === "POST") {
      response = await (await import("./api/uploads/route")).POST(request);
    } else if (/^\/api\/uploads\/[a-f0-9-]{36}$/i.test(url.pathname)) {
      const route = await import("./api/uploads/[id]/route");
      const context = { params: Promise.resolve({ id: url.pathname.split("/").pop()! }) };
      response = method === "GET" ? await route.GET(request, context) : method === "POST" ? await route.POST(request, context) : method === "DELETE" ? await route.DELETE(request, context) : new Response(null, { status: 405 });
    } else if (url.pathname === "/api/inquiries") {
      const route = await import("./api/inquiries/route");
      response = method === "GET" ? await route.GET(request) : method === "POST" ? await route.POST(request) : method === "PATCH" ? await route.PATCH(request) : method === "DELETE" ? await route.DELETE(request) : new Response(null, { status: 405 });
    } else return { ok: false, status: 404, error: "Unknown editor action." };
    const data = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, status: response.status, data } : { ok: false, status: response.status, error: data.error || "The request could not be completed." };
  } catch (error) {
    console.error("Editor transport error", error instanceof Error ? error.message : "unknown");
    return { ok: false, status: 503, error: "Editor connection is temporarily unavailable. Your changes have not been published; please retry." };
  }
}
