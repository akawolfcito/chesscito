import type { Metadata } from "next";

/**
 * `/hub` is a temporary compatibility alias for the canonical app root.
 * Keep the legacy segment out of search results even if the route-level
 * fallback renders before the config redirect in an unusual runtime.
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
