import type { Metadata } from "next";
import LiveWebsite from "@/components/live-website";
import { getSiteContent } from "@/lib/site";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: `${content.brandName} — ${content.heroTitle} ${content.heroAccent}`,
    description: content.heroDescription.replace(/\n/g, " "),
    openGraph: { title: content.brandName, description: content.heroDescription.replace(/\n/g, " "), type: "website" },
  };
}
export default async function Home() {
  return <LiveWebsite initialContent={await getSiteContent()} />;
}
