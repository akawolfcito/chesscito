"use client";

import { usePathname } from "next/navigation";

/**
 * Pathname prefixes that opt into the desktop phone-bezel chrome. The
 * landing (`/`), share landing pages (`/share/*`), and `/dev/*` fixture
 * routes render without the frame — they are full-width responsive
 * surfaces, not the mobile-first app shell.
 *
 * Informational pages (`/about`, `/support`, `/why`, `/terms`,
 * `/privacy`) are framed too: they already render at 390 px via
 * `<LegalPageShell>`, so the frame reuses their natural width and
 * preserves the "you're inside the game world" continuity from the
 * landing → hub journey.
 */
const APP_ROUTE_PREFIXES = [
  "/hub",
  "/exercises",
  "/arena",
  "/coach",
  "/trophies",
  "/victory",
  "/about",
  "/support",
  "/why",
  "/terms",
  "/privacy",
] as const;

export function isAppRoute(pathname: string): boolean {
  for (const prefix of APP_ROUTE_PREFIXES) {
    if (pathname === prefix) return true;
    if (pathname.startsWith(prefix + "/")) return true;
  }
  return false;
}

/**
 * Wraps app routes in a phone-bezel chrome on desktop (≥ 768px). Mobile
 * viewports pass through untouched so MiniPay and any other WebView
 * keeps the existing layout. The bezel itself is CSS-only — see
 * `.desktop-app-frame` rules in globals.css.
 */
export function DesktopAppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (!isAppRoute(pathname)) return <>{children}</>;
  return (
    <div className="desktop-app-frame-shell">
      <div className="desktop-app-frame" aria-hidden={false}>
        <div className="desktop-app-frame-inner">{children}</div>
      </div>
    </div>
  );
}
