import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { defaultContent, type SiteContent } from "./site-data";
import { canonicalContent } from "./content-version";
export function siteRevision(content: SiteContent, updatedAt?: Date) {
  return `${updatedAt ? updatedAt.getTime().toString(36) : "starter"}-${createHash("sha256").update(canonicalContent(content)).digest("hex").slice(0, 16)}`;
}
export async function getSiteSnapshot() {
  const [site] = await db.select().from(siteSettings).where(eq(siteSettings.id, "main")).limit(1);
  const content: SiteContent = site ? { ...defaultContent, ...site.content } : structuredClone(defaultContent);
  return { content, revision: siteRevision(content, site?.updatedAt), updatedAt: site?.updatedAt.toISOString() || null, storage: "postgresql" as const };
}
export async function getSiteContent(strict = false): Promise<SiteContent> {
  try { return (await getSiteSnapshot()).content; }
  catch (error) {
    console.error("Website content unavailable.", error instanceof Error ? error.message : error);
    if (strict) throw error;
    return structuredClone(defaultContent);
  }
}
