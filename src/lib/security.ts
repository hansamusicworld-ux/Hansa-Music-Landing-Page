const globalLimits = globalThis as typeof globalThis & { __hansaLimits?: Map<string, { count: number; reset: number }> };
const limits = globalLimits.__hansaLimits ?? new Map<string, { count: number; reset: number }>();
globalLimits.__hansaLimits = limits;

export function rateLimited(request: Request, action: string, max = 8, duration = 15 * 60 * 1000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const key = `${action}:${ip}`;
  const now = Date.now();
  if (limits.size > 5000) for (const [k, v] of limits) if (v.reset < now) limits.delete(k);
  const entry = limits.get(key);
  if (!entry || entry.reset < now) { limits.set(key, { count: 1, reset: now + duration }); return false; }
  entry.count++;
  return entry.count > max;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    return host === new URL(request.url).host || host === request.headers.get("host") || host === forwarded;
  } catch { return false; }
}
export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
