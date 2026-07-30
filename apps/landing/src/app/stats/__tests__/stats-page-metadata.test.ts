import { describe, expect, it } from "vitest";

import { metadata } from "../page";

/**
 * The landing `/stats` page is the index of the two dashboards (Learn and
 * Play). It survives — MiniPay wants those pages reachable — but it must not
 * be indexable either.
 *
 * It is not in the landing sitemap, yet the landing itself IS indexed and links
 * here (`landing-page.tsx`). Without noindex on this page, the crawler arrives
 * through that link and then follows the two outbound buttons into the
 * dashboards. `follow: false` closes that second hop.
 *
 * Spec: docs/specs/2026-07-30-stats-paid-export-x402.md §0
 */
describe("landing /stats metadata", () => {
  it("is noindex, nofollow", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("still names itself for anyone who opens the link", () => {
    expect(metadata.title).toBe("Stats — Chesscito");
  });
});
