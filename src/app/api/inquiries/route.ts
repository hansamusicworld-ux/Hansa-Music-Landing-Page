import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { errorResponse, rateLimited, sameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await isOwner(request))) return errorResponse("Please sign in to view enquiries.", 401);
  return Response.json(await db.select().from(inquiries).orderBy(desc(inquiries.createdAt)).limit(200));
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("This request is not allowed.", 403);
  if (rateLimited(request, "inquiry", 6)) return errorResponse("You’ve sent several messages. Please try again in 15 minutes.", 429);
  try {
    const body = await request.json();
    if (body.website) return Response.json({ ok: true });
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const interest = typeof body.interest === "string" ? body.interest : "General enquiry";
    if (name.length < 2 || name.length > 100) return errorResponse("Please enter your name (2–100 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return errorResponse("Please enter a valid email address.");
    if (phone.length > 30 || (phone && !/^[+\d\s()-]{6,30}$/.test(phone))) return errorResponse("Please check your phone number.");
    if (message.length < 10 || message.length > 4000) return errorResponse("Tell us a little more (10–4,000 characters).");
    if (!["Music collaboration", "Music production", "Video production", "General enquiry"].includes(interest)) return errorResponse("Please choose a valid enquiry type.");
    await db.insert(inquiries).values({ name, email, phone, interest, message });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Enquiry error", error);
    return errorResponse("We couldn’t send your message. Please try again.", 500);
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request) || !(await isOwner(request))) return errorResponse("Please sign in.", 401);
  try {
    const { id, isRead } = await request.json();
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || typeof isRead !== "boolean") return errorResponse("Invalid enquiry.");
    const [updated] = await db.update(inquiries).set({ isRead }).where(eq(inquiries.id, id)).returning({ id: inquiries.id });
    return updated ? Response.json({ ok: true }) : errorResponse("Enquiry not found.", 404);
  } catch { return errorResponse("Could not update this enquiry.", 500); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request) || !(await isOwner(request))) return errorResponse("Please sign in.", 401);
  try {
    const { id } = await request.json();
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("Invalid enquiry.");
    const [deleted] = await db.delete(inquiries).where(eq(inquiries.id, id)).returning({ id: inquiries.id });
    return deleted ? Response.json({ ok: true }) : errorResponse("Enquiry not found.", 404);
  } catch { return errorResponse("Could not delete this enquiry.", 500); }
}
