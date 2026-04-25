import type { Metadata } from "next";

/**
 * `/hub` is the canonical play-hub URL going forward. The public
 * landing at `/` is the indexable marketing surface; `/hub` is the
 * app, hidden from search engines so the landing is the authoritative
 * SEO target.
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
