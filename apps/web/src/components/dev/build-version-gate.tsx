"use client";

import { usePathname } from "next/navigation";

import { BuildVersion } from "@/components/dev/build-version";
import { routing } from "@/i18n/routing";

/**
 * Pathname allowlist for the visible build-identity pill. The pill used
 * to render on every route via the root template — it blocked the menu
 * area in MiniPay/mobile play sessions. Restricting it to the app root keeps
 * the affordance discoverable for smoke-testers without obstructing
 * gameplay or content surfaces. `/dev/*` keeps the pill for QA fixtures
 * since those routes only exist in local + preview builds.
 */
export function shouldShowVersionPill(pathname: string): boolean {
  if (pathname === "/") return true;
  if (routing.locales.some((locale) => pathname === `/${locale}`)) return true;
  if (pathname === "/hub") return true;
  if (pathname === "/dev") return true;
  if (pathname.startsWith("/dev/")) return true;
  return false;
}

/**
 * Client gate that renders the build-version pill only on allowlisted
 * routes (canonical/legacy Hub roots + `/dev/*`).
 */
export function BuildVersionGate() {
  const pathname = usePathname() ?? "";
  if (!shouldShowVersionPill(pathname)) return null;
  return <BuildVersion />;
}
