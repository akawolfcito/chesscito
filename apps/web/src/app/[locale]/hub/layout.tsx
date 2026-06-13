import type { Metadata } from "next";

/**
 * `/hub` is the kingdom launcher (the redesigned scaffold) — entry
 * point to PLAY (/arena), Practice pieces (/exercises), Trophies,
 * and PRO. The public landing at `/` is the indexable marketing
 * surface; `/hub` is the app shell, hidden from search engines so
 * the landing is the authoritative SEO target.
 */
export const metadata: Metadata = {
  title: "Chesscito",
  robots: { index: false, follow: false },
};

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
