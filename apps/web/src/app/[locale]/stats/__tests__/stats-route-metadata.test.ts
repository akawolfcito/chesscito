import { describe, expect, it, vi } from "vitest";

/**
 * `/stats` stays reachable — MiniPay §8 requires a stats page the reviewer can
 * open without a wallet. This pins the other half: it must not be indexable.
 *
 * The route is only imported for its `metadata`, so every data dependency is
 * stubbed. Importing the real aggregator would open a Supabase client at module
 * load for a test that asserts a static object.
 *
 * Spec: docs/specs/2026-07-30-stats-noindex-and-internal-gate.md §4.4
 */

vi.mock("@/lib/stats/public-aggregator", () => ({ getPublicStats: vi.fn() }));
vi.mock("@/components/stats/stats-page", () => ({ StatsPage: () => null }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));

describe("/stats route metadata", () => {
  it("tells crawlers not to index the page and not to follow it", async () => {
    const { metadata } = await import("../page");

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("keeps the human-facing title and description", async () => {
    // noindex is a crawler instruction, not a downgrade: the MiniPay reviewer
    // still lands on a page that says what it is.
    const { metadata } = await import("../page");

    expect(metadata.title).toBe("Platform Stats — Chesscito");
    expect(metadata.description).toBeTruthy();
  });
});
