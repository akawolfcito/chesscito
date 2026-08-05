import { describe, expect, it, vi } from "vitest";

// The page now reaches the aggregator, which reaches `lib/supabase/server` and
// its `server-only` import. That package throwing outside a Server Component is
// exactly its job, so it is stubbed here rather than worked around in the page.
vi.mock("server-only", () => ({}));

import sitemap from "../../sitemap";
import { metadata } from "../page";

/**
 * `/stats` is a DELIVERABLE of the MiniPay listing (§8): public, no wallet, no
 * auth. It must also stay out of search results — and the way to reconcile
 * those is `noindex` plus absence from the sitemap, NOT a gate. Gating it or
 * moving it to admin would break the listing.
 *
 * ⚠️ Reachable ≠ indexable. That distinction is the whole fix here.
 *
 * `follow: false` is load-bearing: the landing IS indexed and links here, so a
 * crawler arrives through that link and would otherwise follow the outbound
 * ones onward.
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

  it("declares ONE canonical URL, unprefixed by locale", () => {
    // There is no /en/stats and no /es/stats: two indexable URLs for the same
    // content is one more than the listing can declare.
    expect(metadata.alternates?.canonical).toBe("https://www.chesscito.com/stats");
    expect(String(metadata.alternates?.canonical)).not.toMatch(/\/(en|es)\/stats/);
  });

  it("is absent from the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((u) => u.includes("/stats"))).toBe(false);
  });

  it("declares no locale alternates", () => {
    // A hreflang pair would re-announce the two URLs the canonical just denied.
    expect(metadata.alternates?.languages).toBeUndefined();
  });
});
