import type { Metadata } from "next";
import Studio from "@/components/studio";
import { getSiteContent } from "@/lib/site";
import "./studio.css";
import "./guide.css";
import { getDeploymentInfo } from "@/lib/deployment-info";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Creator Studio — Hansa Music", robots: { index: false, follow: false } };
export default async function StudioPage() {
  return <Studio initialContent={await getSiteContent()} deployment={getDeploymentInfo()} />;
}
