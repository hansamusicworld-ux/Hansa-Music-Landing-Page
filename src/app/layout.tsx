import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./reliability.css";
import "./publishing.css";
export const metadata: Metadata = {
  title: "Hansa Music — Desi roots. Global rhythms.",
  description: "Independent voices, authentic stories, and music that connects. Discover Hansa Music, Pandav Nagar, Delhi.",
  icons: { icon: "/images/hansa-logo.svg", apple: "/images/hansa-logo.svg" },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
