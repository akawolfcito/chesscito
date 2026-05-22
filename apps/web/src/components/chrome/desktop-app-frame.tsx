"use client";

import { usePathname } from "next/navigation";

/**
 * Pathname prefixes that opt into the desktop phone-bezel chrome. The
 * landing (`/`), share landing pages (`/share/*`), informational pages
 * (`/about`, `/support`, `/terms`, `/privacy`, `/why`), and `/dev/*`
 * fixture routes render without the frame — they are responsive
 * surfaces, not the mobile-first app shell.
 */
const APP_ROUTE_PREFIXES = [
  "/hub",
  "/exercises",
  "/arena",
  "/coach",
  "/trophies",
  "/victory",
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
