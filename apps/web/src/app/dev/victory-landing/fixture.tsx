"use client";

import {
  VictoryLandingCard,
  type VictoryLandingInfo,
} from "@/components/victory/victory-landing-card";

export type Variant = "easy" | "medium" | "hard";

const VARIANT_DATA: Record<Variant, VictoryLandingInfo> = {
  easy: {
    id: "1",
    moves: 18,
    timeMs: 72_000,
    difficulty: "Easy",
    difficultyRaw: 1,
  },
  medium: {
    id: "42",
    moves: 24,
    timeMs: 192_000,
    difficulty: "Medium",
    difficultyRaw: 2,
  },
  hard: {
    id: "777",
    moves: 51,
    timeMs: 540_000,
    difficulty: "Hard",
    difficultyRaw: 3,
  },
};

/**
 * VR fixture for `/victory/[id]` — the public challenge landing.
 *
 * The real page is a server component that fetches victory data from
 * the Celo chain via viem at request time. That makes Playwright VR
 * coverage flaky (network-dependent, requires a live token ID, and
 * RPC variability can swing layout in ways that aren't visual
 * regressions). This fixture sidesteps the chain read by feeding
 * `VictoryLandingCard` static `VictoryLandingInfo` payloads for the
 * three difficulty tiers — same component the production page
 * mounts, so any drift in the shell is caught by the snapshots.
 */
export function VictoryLandingFixture({ variant }: { variant: Variant }) {
  return <VictoryLandingCard v={VARIANT_DATA[variant]} />;
}
