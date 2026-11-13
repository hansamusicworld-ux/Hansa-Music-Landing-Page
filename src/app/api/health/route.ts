import { db } from "@/db";
import { owners } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    if (process.env.HANSA_PUBLIC_SITE === "true") {
      const [owner] = await db.select({ id: owners.id }).from(owners).where(eq(owners.id, "main")).limit(1);
      if (!owner) return Response.json({ ok: false, state: "owner_setup_required" }, { status: 503 });
      await db.execute(sql`select 1 from site_settings limit 1`);
      await db.execute(sql`select 1 from media_parts limit 1`);
    }
    return Response.json({ ok: true });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
