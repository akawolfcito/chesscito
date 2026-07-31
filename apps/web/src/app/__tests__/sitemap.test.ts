import { describe, expect, it } from "vitest";

import sitemap from "../sitemap";
import { routing } from "@/i18n/routing";

/**
 * `/stats` is a MiniPay §8 deliverable: it must stay REACHABLE without auth
 * (the listing checklist asks for a "public-or-shared stats page", and the
 * reviewer opens it by link). What it must NOT be is INDEXABLE — nobody asked
 * Google to carry retention curves and country splits into search results.
 *
 * Those are two different properties, and only the second one is a defect.
 * This suite pins the second: the sitemap does not advertise the page, while
 * the rest of the static surface stays exactly as it was.
 *
 * Spec: docs/specs/2026-07-30-stats-paid-export-x402.md §0
 */

/** Strip the origin + locale prefix so a URL can be compared as a path. */
function pathOf(url: string): string {
  const { pathname } = new URL(url);
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

describe("sitemap", () => {
  const entries = sitemap();
  const paths = new Set(entries.map((entry) => pathOf(entry.url)));

  it("does not list /stats", () => {
    expect(paths.has("/stats")).toBe(false);
  });

  it("does not reach /stats through the cross-locale alternates either", () => {
    // The alternates block is a second, independent list of URLs. Dropping the
    // path from STATIC_PATHS covers both, but only because alternates are
    // derived from it — assert it rather than trust it.
    const alternates = entries.flatMap((entry) =>
      Object.values(entry.alternates?.languages ?? {}),
    );
    expect(alternates.filter((url) => pathOf(String(url)) === "/stats")).toEqual([]);
  });

  it("still lists every other static route, in both locales", () => {
    for (const path of [
      "/exercises",
      "/arena",
      "/trophies",
      "/coach/history",
      "/about",
      "/support",
      "/privacy",
      "/terms",
    ]) {
      expect(paths, `${path} went missing`).toContain(path);
    }
    // One entry per (path, locale) pair — 8 paths survive the /stats removal
    // and the /why removal (that route is a 308 to a noindex root).
    expect(entries).toHaveLength(8 * routing.locales.length);
  });

  it("keeps /support, whose path contains no /stats substring by accident", () => {
    // Guards the lazy fix: a `filter(p => !p.includes("stat"))` would also
    // eat nothing today, but a sloppier one could. Exactness is the point.
    expect(paths).toContain("/support");
  });
});
