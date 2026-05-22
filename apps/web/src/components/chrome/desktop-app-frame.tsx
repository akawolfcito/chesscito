"use client";

import { createContext, useContext, useState } from "react";
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
 * Exposes the frame inner DOM node to descendants that render via
 * portal (sheets, dialogs). Consumers pass the node to Radix's
 * `Portal container` prop so portaled content stays inside the bezel
 * on desktop instead of escaping to `document.body`. Returns `null`
 * when no frame is mounted (landing, `/share/*`, `/dev/*`) — Radix
 * falls back to body portal naturally.
 */
const DesktopAppFrameContext = createContext<HTMLDivElement | null>(null);

export function useDesktopAppFrameContainer(): HTMLDivElement | null {
  return useContext(DesktopAppFrameContext);
}

/**
 * Wraps app routes in a phone-bezel chrome on desktop (≥ 768px). Mobile
 * viewports pass through untouched so MiniPay and any other WebView
 * keeps the existing layout. The bezel itself is CSS-only — see
 * `.desktop-app-frame` rules in globals.css.
 *
 * Captures the `.desktop-app-frame-inner` element into state via a
 * callback ref so the context value updates on mount (a plain ref
 * would never trigger a re-render and consumers would always see
 * `null`). The desktop frame ancestor has `transform: translateZ(0)`
 * at ≥768px, which makes `position: fixed` descendants contained by
 * the frame — sheets portaled here render inside the bezel without
 * any extra CSS work.
 */
export function DesktopAppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  if (!isAppRoute(pathname)) return <>{children}</>;
  return (
    <DesktopAppFrameContext.Provider value={container}>
      <div className="desktop-app-frame-shell">
        <div className="desktop-app-frame" aria-hidden={false}>
          <div
            ref={setContainer}
            className="desktop-app-frame-inner"
          >
            {children}
          </div>
        </div>
      </div>
    </DesktopAppFrameContext.Provider>
  );
}
