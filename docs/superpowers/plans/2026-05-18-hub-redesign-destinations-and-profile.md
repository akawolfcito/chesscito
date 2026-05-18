# Hub Redesign — Destinations & Profile · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship SPEC 1 (Hub redesign + Profile modal + Claim Queue + V2 retirement + anchor cleanup) as a series of atomic commits, TDD throughout, with no regression to the existing `/exercises` or `/arena` flows.

**Architecture:** Pure helpers under `lib/{hub,profile,claims}`. Hooks under `hooks/use-*`. Components under `components/{profile,hub}`. One new API route at `/api/profile/stats`. Hub composition swaps to a 3-column rails layout (LEARN/UNLOCK) with a contextual amber Hero CTA and a calm blue Arena secondary CTA. V2 canary is deleted entirely. Anchor asset cleanup ships as 2 commits (asset prep → atomic switchover) to avoid blanking the surface mid-deploy.

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript · wagmi 2 · Vitest + RTL · Playwright · Tailwind · Supabase cache layer · MiniPay-first 390px viewport.

**Source spec:** `docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md` (commit `437e031`)
**Red-team report:** `docs/reviews/2026-05-18-spec-1-hub-redesign-red-team.md`

---

## File structure (locked decisions)

### New files

```
apps/web/src/
├── lib/
│   ├── hub/
│   │   └── hero-cta.ts                          # getHeroContextAction — pure helper
│   ├── profile/
│   │   ├── compute-tier.ts                      # Apprentice → ... → Grandmaster + Visitor
│   │   └── display-name.ts                      # Precedence: custom > Talent > truncated
│   └── claims/
│       └── queue.ts                             # computePendingClaims + dedup invariants
├── hooks/
│   ├── use-profile-stats.ts
│   ├── use-claim-queue.ts
│   ├── use-display-name.ts
│   └── use-hub-onboarding.ts
├── app/api/profile/stats/
│   └── route.ts                                 # GET ?address=0x...
└── components/
    ├── profile/
    │   ├── profile-sheet.tsx                    # Composite modal
    │   ├── profile-banner.tsx                   # Avatar+name+tier+wallet+XP
    │   ├── pending-claims.tsx                   # Individual claims only in v1
    │   ├── general-stats.tsx                    # 3×2 grid
    │   ├── tier-badge.tsx                       # Red shield + XP
    │   └── display-name-dialog.tsx              # Name edit dialog
    └── hub/
        ├── secondary-cta.tsx                    # Small blue Arena link
        ├── onboarding-card.tsx                  # First-launch card (ssr:false)
        └── settings-sheet-stub.tsx              # v1 stub (version + disabled toggles)
```

### Modified files

- `apps/web/src/components/hub/hub-scaffold.tsx`  — rails reframe, hero+secondary CTA, onboarding mount
- `apps/web/src/components/hub/hub-scaffold-client.tsx` — wire new sheets, claim queue, profile sheet routing
- `apps/web/src/app/hub/page.tsx` — extend `parseInitialSheet`, drop V2 routing
- `apps/web/src/app/trophies/page.tsx` — visual port to candy aesthetic (not a redirect)
- `apps/web/src/components/exercises/persistent-dock.tsx` — 5-slot taxonomy: Home/Pieces/Shop/Board/Settings
- `apps/web/src/components/kingdom/kingdom-anchor.tsx` — `HERO_ASSET_BASE` → portal-centered
- `apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx` — all 7 splash-loading occurrences
- `apps/web/src/app/globals.css` — delete background+opacity rules (D13); add tier/secondary/label-track styles; candy port for /trophies
- `apps/web/src/lib/content/editorial.ts` — new copy blocks
- `apps/web/src/lib/telemetry.ts` — no body change; events are by-convention strings (no schema enforcement)
- `apps/web/src/lib/feature-flags.ts` — remove V2 flag + resolveHubVariant

### Deleted files (V2 retirement, D15)

- `apps/web/src/components/hub/hub-scaffold-v2-client.tsx`
- `apps/web/src/components/hub/__tests__/hub-scaffold-v2.test.tsx`
- (verify with `grep -r "hub-v2\|HUB_V2\|hub-scaffold-v2"` after deletion — must be zero)

### Generated assets

- `apps/web/public/art/scene-rooted/portal-centered.avif`
- `apps/web/public/art/scene-rooted/portal-centered.webp`

---

## Phase 0 — Foundation cleanup (clears noise; no user-visible changes except V2)

### Task 0.1 — Retire V2 canary

**Files:**
- Delete: `apps/web/src/components/hub/hub-scaffold-v2-client.tsx`
- Delete: `apps/web/src/components/hub/__tests__/hub-scaffold-v2.test.tsx`
- Modify: `apps/web/src/lib/feature-flags.ts` (remove `HUB_V2_DEFAULT` + `resolveHubVariant`)
- Modify: `apps/web/src/app/hub/page.tsx` (drop V2 branch)

- [ ] **Step 1: Verify zero external dependencies on V2 before deletion**

Run: `grep -rn "hub-scaffold-v2\|HUB_V2_DEFAULT\|resolveHubVariant\|HubScaffoldV2Client" apps/web/src --include="*.ts" --include="*.tsx"`
Expected: matches limited to the files being deleted/modified (no surprise consumers).

- [ ] **Step 2: Delete V2 component + test files**

```bash
rm apps/web/src/components/hub/hub-scaffold-v2-client.tsx
rm apps/web/src/components/hub/__tests__/hub-scaffold-v2.test.tsx
# If a presentational hub-scaffold-v2.tsx exists as a separate file, delete it too.
# Verify with: ls apps/web/src/components/hub/hub-scaffold-v2*
```

- [ ] **Step 3: Simplify `lib/feature-flags.ts` to an empty named-exports module (kept for future flags)**

```ts
// apps/web/src/lib/feature-flags.ts
/** Hub-related runtime flags. Currently empty after V2 canary retirement
 *  (see docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md §D15). */
export {};
```

- [ ] **Step 4: Simplify `app/hub/page.tsx` — render `HubScaffoldClient` unconditionally**

Open `apps/web/src/app/hub/page.tsx`. Remove imports of `HubScaffoldV2Client`, `HUB_V2_DEFAULT`, `resolveHubVariant`. Remove the `hub` field from `SearchParams`. Replace the conditional return with the V1-only path:

```ts
// after parseInitialSheet resolution:
return <HubScaffoldClient initialSheet={initialSheet} />;
```

- [ ] **Step 5: Run tests + grep**

```bash
pnpm --filter web test --run components/hub  # confirm no V2 test fails to compile
grep -rn "hub-v2\|HUB_V2\|hub-scaffold-v2\|HubScaffoldV2" apps/web/src
```
Expected: tests pass (V2 test gone); grep returns 0 matches.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/components/hub apps/web/src/lib/feature-flags.ts apps/web/src/app/hub/page.tsx
git commit -m "$(cat <<'EOF'
chore(hub): retire V2 canary scaffold (SPEC 1 D15)

V2 had structurally diverged from the V1 direction this spec extends.
Unshipping halves the implementation surface for SPEC 1 and removes
the parity bug risk at flag-flip time.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 0.2 — Editorial copy blocks

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

- [ ] **Step 1: Append copy blocks (alphabetical by name where possible)**

Open `apps/web/src/lib/content/editorial.ts`. Append (do not replace existing exports):

```ts
export const PROFILE_COPY = {
  pageTitle: "Profile",
  pendingClaimsHeader: "Pending claims",
  generalStatsHeader: "General stats",
  walletLabel: "Wallet",
  networkLabel: "Network",
  disconnect: "Disconnect wallet",
  manage: "Manage",
  refreshAria: "Refresh pending claims",
} as const;

export const DISPLAY_NAME_COPY = {
  dialogTitle: "Choose your name",
  placeholder: "Up to 20 characters",
  save: "Save",
  cancel: "Cancel",
  visitor: "Visitor",
} as const;

export const TIER_LABELS = {
  visitor: "Visitor",
  apprentice: "Apprentice",
  trainee: "Trainee",
  knight: "Knight",
  wizard: "Wizard",
  grandmaster: "Grandmaster",
} as const;

export const TIER_THRESHOLDS = {
  trainee: 25,
  knight: 75,
  wizard: 200,
  grandmaster: 500,
} as const;

export const CLAIM_COPY = {
  kinds: {
    badge: "{name} badge",
    score: "Save score · {points} pts",
    victoryNft: "Mint your victory · {difficulty}",
  },
  claimVerb: "Claim",
  costGasOnly: "gas only",
  costEstimateUsd: "~${amount}",
  inFlightLabel: "In flight — reconnect to verify",
  refreshAria: "Refresh",
  emptyAria: "No pending claims",
} as const;

export const HERO_CTA_COPY = {
  newPlayer: {
    label: "START WITH PIECES",
    sub: "learn the rook first",
    variant: "amber" as const,
  },
  dailyPending: {
    label: "PLAY TODAY'S TACTIC",
    sub: "today's tactic awaits",
    variant: "blue" as const,
  },
  defaultCaughtUp: {
    label: "CONTINUE TRAINING",
    sub: "tap a tile to pick",
    variant: "amber" as const,
  },
} as const;

export const SECONDARY_CTA_COPY = {
  arena: {
    label: "Enter Arena",
    ariaLabel: "Enter Arena — full chess vs AI",
  },
} as const;

export const HUB_ONBOARDING_COPY = {
  title: "Welcome to Chesscito",
  body: "Train your brain with chess puzzles. Master one piece at a time. Graduate to Arena when ready.",
  dismissLabel: "Got it",
} as const;

export const LEADERBOARD_COPY_V2 = {
  tabs: {
    puzzlesWeek: "Puzzles this week",
    arenaWins: "Arena wins",
  },
} as const;

export const PRO_DROP_COPY = {
  /** OPERATIONAL: update this constant in the same commit as the on-chain
   *  shop catalog item update. See SPEC 1 §D12 P1-11. */
  current: "Knight's Tour",
  activeLabel: "PRO · {puzzle} — solve the board",
  inactiveLabel: "Unlock {puzzle} + monthly puzzles",
} as const;

export const SETTINGS_STUB_COPY = {
  title: "Settings",
  comingSoonTooltip: "Coming soon",
  versionChipLabel: "Build {sha}",
  themeToggleLabel: "Theme",
  hapticsToggleLabel: "Haptics",
  languageToggleLabel: "Language",
} as const;

export const HUB_RAIL_COPY = {
  learnLabel: "LEARN",
  unlockLabel: "UNLOCK",
  tiles: {
    daily: "Daily",
    mate: "Mate K+R",
    labyrinth: "Labyrinth",
    proDrop: "PRO",
    shop: "Shop",
    badges: "Badges",
  },
} as const;
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "feat(editorial): add hub redesign + profile copy blocks (SPEC 1)

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 1 — Pure helpers (TDD)

### Task 1.1 — `getHeroContextAction` helper

**Files:**
- Create: `apps/web/src/lib/hub/hero-cta.ts`
- Create: `apps/web/src/lib/hub/__tests__/hero-cta.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/hub/__tests__/hero-cta.test.ts
import { describe, it, expect } from "vitest";
import { getHeroContextAction } from "@/lib/hub/hero-cta";

describe("getHeroContextAction", () => {
  const baseLoaded = {
    isLoading: false,
    exercisesCompletedCount: 0,
    dailyHistoryCount: 0,
    isDailyCompletedToday: false,
  };

  it("returns 'default' while signals are still loading", () => {
    const result = getHeroContextAction({ ...baseLoaded, isLoading: true });
    expect(result.variant).toBe("default");
  });

  it("returns 'new-player' when no exercises done AND no daily history", () => {
    const result = getHeroContextAction(baseLoaded);
    expect(result.variant).toBe("new-player");
    expect(result.destination).toBe("/exercises?piece=rook");
  });

  it("returns 'daily-pending' when daily not solved today", () => {
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 5,
      dailyHistoryCount: 3,
      isDailyCompletedToday: false,
    });
    expect(result.variant).toBe("daily-pending");
    expect(result.destination).toBe("/exercises?slot=daily");
  });

  it("returns 'default' when daily solved and exercises done", () => {
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 5,
      dailyHistoryCount: 3,
      isDailyCompletedToday: true,
    });
    expect(result.variant).toBe("default");
  });

  it("prioritizes new-player over daily-pending", () => {
    // edge case: no exercises but daily history exists (shouldn't happen, but defensive)
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 0,
      dailyHistoryCount: 5,
      isDailyCompletedToday: false,
    });
    // dailyHistoryCount > 0 means user has been playing daily → not "new"
    expect(result.variant).toBe("daily-pending");
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run lib/hub/__tests__/hero-cta.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/hub/hero-cta'`.

- [ ] **Step 3: Implement minimal helper**

```ts
// apps/web/src/lib/hub/hero-cta.ts
import { HERO_CTA_COPY } from "@/lib/content/editorial";

export type HeroVariant = "new-player" | "daily-pending" | "default";

export type HeroContextState = {
  isLoading: boolean;
  exercisesCompletedCount: number;
  dailyHistoryCount: number;
  isDailyCompletedToday: boolean;
};

export type HeroCTA = {
  variant: HeroVariant;
  label: string;
  sub: string;
  destination: string | null; // null = no nav (default state highlights LEARN rail)
  color: "amber" | "blue";
};

const FALLBACK_DEFAULT: HeroCTA = {
  variant: "default",
  label: HERO_CTA_COPY.defaultCaughtUp.label,
  sub: HERO_CTA_COPY.defaultCaughtUp.sub,
  destination: null,
  color: "amber",
};

export function getHeroContextAction(state: HeroContextState): HeroCTA {
  // Loading state: never flash new-player while data is hydrating (P1-7)
  if (state.isLoading) return FALLBACK_DEFAULT;

  // new-player: 0 exercises AND 0 daily history (genuinely never played)
  if (state.exercisesCompletedCount === 0 && state.dailyHistoryCount === 0) {
    return {
      variant: "new-player",
      label: HERO_CTA_COPY.newPlayer.label,
      sub: HERO_CTA_COPY.newPlayer.sub,
      destination: "/exercises?piece=rook",
      color: "amber",
    };
  }

  // daily-pending: today's daily not solved
  if (!state.isDailyCompletedToday) {
    return {
      variant: "daily-pending",
      label: HERO_CTA_COPY.dailyPending.label,
      sub: HERO_CTA_COPY.dailyPending.sub,
      destination: "/exercises?slot=daily",
      color: "blue",
    };
  }

  return FALLBACK_DEFAULT;
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run lib/hub/__tests__/hero-cta.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hub/
git commit -m "feat(hub): add getHeroContextAction helper for contextual Hero CTA

Separate from lib/game/context-action.ts (P0-1). Domain: HUB hero state
(3 variants: new-player, daily-pending, default). Loading state renders
default to avoid mid-load flicker (P1-7).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 1.2 — `computeTier` helper

**Files:**
- Create: `apps/web/src/lib/profile/compute-tier.ts`
- Create: `apps/web/src/lib/profile/__tests__/compute-tier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/profile/__tests__/compute-tier.test.ts
import { describe, it, expect } from "vitest";
import { computeTier } from "@/lib/profile/compute-tier";

describe("computeTier", () => {
  const baseStats = {
    puzzlesSolved: 0,
    piecesMastered: 0,
    arenaWins: 0,
    daysStreak: 0,
    address: "0x1234" as `0x${string}`,
  };

  it("returns Visitor when address is undefined", () => {
    const result = computeTier({ ...baseStats, address: undefined });
    expect(result.tier).toBe("visitor");
    expect(result.title).toBe("Visitor");
    expect(result.xp).toBe(0);
  });

  it("returns Apprentice at 0 puzzles solved with address present", () => {
    const result = computeTier(baseStats);
    expect(result.tier).toBe("apprentice");
    expect(result.title).toBe("Apprentice");
  });

  it("returns Trainee at 25 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 25 });
    expect(result.tier).toBe("trainee");
  });

  it("returns Knight at 75 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 75 });
    expect(result.tier).toBe("knight");
  });

  it("returns Wizard at 200 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 200 });
    expect(result.tier).toBe("wizard");
  });

  it("returns Grandmaster at 500 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 500 });
    expect(result.tier).toBe("grandmaster");
  });

  it("XP scales with all 4 inputs (puzzles × 10 + pieces × 25 + arena × 15 + streak × 5)", () => {
    const result = computeTier({
      ...baseStats,
      puzzlesSolved: 50,   // 500
      piecesMastered: 3,    // 75
      arenaWins: 12,        // 180
      daysStreak: 14,       // 70
    });
    expect(result.xp).toBe(825);
  });

  it("handles negative or NaN inputs as 0 (defensive)", () => {
    const result = computeTier({
      ...baseStats,
      puzzlesSolved: -5,
      piecesMastered: NaN,
    });
    expect(result.xp).toBe(0);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run lib/profile/__tests__/compute-tier.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement helper**

```ts
// apps/web/src/lib/profile/compute-tier.ts
import { TIER_LABELS, TIER_THRESHOLDS } from "@/lib/content/editorial";

export type TierKey = keyof typeof TIER_LABELS;

export type TierStats = {
  address: `0x${string}` | undefined;
  puzzlesSolved: number;
  piecesMastered: number;
  arenaWins: number;
  daysStreak: number;
};

export type TierResult = {
  tier: TierKey;
  title: string;
  xp: number;
};

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

export function computeTier(stats: TierStats): TierResult {
  if (!stats.address) {
    return { tier: "visitor", title: TIER_LABELS.visitor, xp: 0 };
  }

  const xp =
    safe(stats.puzzlesSolved) * 10 +
    safe(stats.piecesMastered) * 25 +
    safe(stats.arenaWins) * 15 +
    safe(stats.daysStreak) * 5;

  const puzzles = safe(stats.puzzlesSolved);

  let tier: TierKey = "apprentice";
  if (puzzles >= TIER_THRESHOLDS.grandmaster) tier = "grandmaster";
  else if (puzzles >= TIER_THRESHOLDS.wizard) tier = "wizard";
  else if (puzzles >= TIER_THRESHOLDS.knight) tier = "knight";
  else if (puzzles >= TIER_THRESHOLDS.trainee) tier = "trainee";

  return { tier, title: TIER_LABELS[tier], xp };
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run lib/profile/__tests__/compute-tier.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/profile/
git commit -m "feat(profile): add computeTier helper

5 tiers (Apprentice → Grandmaster) keyed off puzzles solved, plus
Visitor for wallet-disconnected. XP composite of 4 input dimensions.
Defensive against negative/NaN inputs.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 1.3 — `resolveDisplayName` helper

**Files:**
- Create: `apps/web/src/lib/profile/display-name.ts`
- Create: `apps/web/src/lib/profile/__tests__/display-name.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/profile/__tests__/display-name.test.ts
import { describe, it, expect } from "vitest";
import { resolveDisplayName, truncateWallet } from "@/lib/profile/display-name";

describe("truncateWallet", () => {
  it("returns short form with ellipsis", () => {
    expect(truncateWallet("0x0924abcdef1234567890abcdef1234567890eba4")).toBe("0x0924…eba4");
  });
  it("returns empty string when address is undefined", () => {
    expect(truncateWallet(undefined)).toBe("");
  });
});

describe("resolveDisplayName", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("returns custom name when present", () => {
    expect(resolveDisplayName({ address: wallet, customName: "Akawolf" })).toBe("Akawolf");
  });

  it("returns Talent Protocol name when no custom", () => {
    expect(
      resolveDisplayName({ address: wallet, talentProtocolName: "wolfcito.eth" }),
    ).toBe("wolfcito.eth");
  });

  it("custom name takes precedence over Talent Protocol", () => {
    expect(
      resolveDisplayName({
        address: wallet,
        customName: "Akawolf",
        talentProtocolName: "wolfcito.eth",
      }),
    ).toBe("Akawolf");
  });

  it("falls back to truncated wallet", () => {
    expect(resolveDisplayName({ address: wallet })).toBe("0x0924…eba4");
  });

  it("returns Visitor when address is undefined", () => {
    expect(resolveDisplayName({ address: undefined })).toBe("Visitor");
  });

  it("trims custom name and rejects empty string", () => {
    expect(resolveDisplayName({ address: wallet, customName: "  " })).toBe("0x0924…eba4");
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run lib/profile/__tests__/display-name.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement helper**

```ts
// apps/web/src/lib/profile/display-name.ts
import { DISPLAY_NAME_COPY } from "@/lib/content/editorial";

export function truncateWallet(address: `0x${string}` | undefined): string {
  if (!address) return "";
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type ResolveDisplayNameArgs = {
  address: `0x${string}` | undefined;
  customName?: string;
  talentProtocolName?: string;
};

export function resolveDisplayName(args: ResolveDisplayNameArgs): string {
  if (!args.address) return DISPLAY_NAME_COPY.visitor;
  const trimmedCustom = args.customName?.trim();
  if (trimmedCustom) return trimmedCustom;
  const trimmedTalent = args.talentProtocolName?.trim();
  if (trimmedTalent) return trimmedTalent;
  return truncateWallet(args.address);
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run lib/profile/__tests__/display-name.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/profile/display-name.ts apps/web/src/lib/profile/__tests__/display-name.test.ts
git commit -m "feat(profile): add resolveDisplayName helper

Precedence: custom > Talent Protocol > truncated wallet > 'Visitor'.
Trims+rejects empty custom names. Defensive against undefined address.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 1.4 — `computePendingClaims` helper

**Files:**
- Create: `apps/web/src/lib/claims/queue.ts`
- Create: `apps/web/src/lib/claims/__tests__/queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/claims/__tests__/queue.test.ts
import { describe, it, expect } from "vitest";
import { computePendingClaims, type ClaimQueueState } from "@/lib/claims/queue";

const baseState: ClaimQueueState = {
  address: "0x1234" as `0x${string}`,
  // Badge thresholds met locally:
  localBadgesEarned: [],
  // Badge mints already on chain:
  badgesOnChain: [],
  // Local scores ready to push:
  localScoresPending: [],
  // Optimistic removals (claims confirmed by user, not yet on chain):
  optimisticRemoved: new Set<string>(),
  // Victory NFTs waiting:
  victoryPending: [],
};

describe("computePendingClaims", () => {
  it("returns empty array when nothing is pending", () => {
    expect(computePendingClaims(baseState)).toEqual([]);
  });

  it("emits a badge claim when threshold met but not on-chain", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      badgesOnChain: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "badge", id: "badge-1", costGasOnly: true });
  });

  it("DOES NOT emit a badge claim when chain says claimed (chain dominates)", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      badgesOnChain: [1n],
    });
    expect(result).toEqual([]);
  });

  it("emits a score claim for each locally pending score", () => {
    const result = computePendingClaims({
      ...baseState,
      localScoresPending: [{ scoreKey: "rook-l3", points: 540 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "score", id: "score-rook-l3", costGasOnly: true });
  });

  it("emits a victory-nft claim for each victory pending under 24h", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const result = computePendingClaims({
      ...baseState,
      victoryPending: [{ txHash: "0xabc", difficulty: 3, mintedAt: nowSec - 60 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "victory-nft", costGasOnly: false });
  });

  it("DROPS victory-nft claim older than 24h", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const result = computePendingClaims({
      ...baseState,
      victoryPending: [{ txHash: "0xabc", difficulty: 3, mintedAt: nowSec - 25 * 3600 }],
    });
    expect(result).toEqual([]);
  });

  it("excludes optimistically removed entries", () => {
    const result = computePendingClaims({
      ...baseState,
      localBadgesEarned: [1n],
      optimisticRemoved: new Set(["badge-1"]),
    });
    expect(result).toEqual([]);
  });

  it("returns empty list when address is undefined (cannot claim without wallet)", () => {
    const result = computePendingClaims({
      ...baseState,
      address: undefined,
      localBadgesEarned: [1n],
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run lib/claims/__tests__/queue.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement helper**

```ts
// apps/web/src/lib/claims/queue.ts

export type ClaimKind = "badge" | "score" | "victory-nft";

export type LocalScorePending = { scoreKey: string; points: number };
export type VictoryPending = { txHash: string; difficulty: number; mintedAt: number };

export type ClaimQueueState = {
  address: `0x${string}` | undefined;
  localBadgesEarned: bigint[];
  badgesOnChain: bigint[];
  localScoresPending: LocalScorePending[];
  victoryPending: VictoryPending[];
  optimisticRemoved: Set<string>;
};

export type Claim =
  | {
      id: string;
      kind: "badge";
      badgeId: bigint;
      costGasOnly: true;
    }
  | {
      id: string;
      kind: "score";
      scoreKey: string;
      points: number;
      costGasOnly: true;
    }
  | {
      id: string;
      kind: "victory-nft";
      txHash: string;
      difficulty: number;
      costGasOnly: false;
    };

const VICTORY_WINDOW_SEC = 24 * 60 * 60;

export function computePendingClaims(state: ClaimQueueState): Claim[] {
  if (!state.address) return [];

  const claims: Claim[] = [];
  const onChainSet = new Set(state.badgesOnChain.map((b) => b.toString()));

  for (const badgeId of state.localBadgesEarned) {
    const id = `badge-${badgeId.toString()}`;
    if (onChainSet.has(badgeId.toString())) continue;        // chain dominates
    if (state.optimisticRemoved.has(id)) continue;
    claims.push({ id, kind: "badge", badgeId, costGasOnly: true });
  }

  for (const score of state.localScoresPending) {
    const id = `score-${score.scoreKey}`;
    if (state.optimisticRemoved.has(id)) continue;
    claims.push({ id, kind: "score", scoreKey: score.scoreKey, points: score.points, costGasOnly: true });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  for (const victory of state.victoryPending) {
    const id = `victory-${victory.txHash}`;
    if (state.optimisticRemoved.has(id)) continue;
    if (nowSec - victory.mintedAt > VICTORY_WINDOW_SEC) continue; // 24h window
    claims.push({
      id,
      kind: "victory-nft",
      txHash: victory.txHash,
      difficulty: victory.difficulty,
      costGasOnly: false,
    });
  }

  return claims;
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run lib/claims/__tests__/queue.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/claims/
git commit -m "feat(claims): add computePendingClaims with dedup invariants

Three claim kinds (badge, score, victory-nft) with these invariants
(SPEC 1 D10, P1-4 resolution):
- Chain dominates (badge already minted → no claim row).
- Optimistic-removed entries excluded (post-confirm rows disappear
  before chain refetch).
- Victory-NFT pending entries auto-expire at 24h.
- Empty list when no wallet.

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 2 — Data layer

### Task 2.1 — `/api/profile/stats` API route

**Files:**
- Create: `apps/web/src/app/api/profile/stats/route.ts`
- Create: `apps/web/src/app/api/profile/stats/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/api/profile/stats/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/profile/stats/route";

// Minimal mock helpers — assume there are utilities at lib/supabase/queries.ts
// for trophies/arenaWins/NFTs. If not, see Step 3 implementation notes.
vi.mock("@/lib/supabase/queries", () => ({
  getProfileStats: vi.fn(async (address: string) => ({
    trophies: 12,
    arenaWins: 5,
    nftsMinted: 4,
    dailyStreak: 14,
    puzzlesSolved: 87,
  })),
}));

function makeRequest(url: string) {
  return new Request(url);
}

describe("GET /api/profile/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when address param missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/profile/stats"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when address is malformed", async () => {
    const res = await GET(makeRequest("http://localhost/api/profile/stats?address=notahex"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with stats payload for valid address", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/profile/stats?address=0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      trophies: 12,
      arenaWins: 5,
      nftsMinted: 4,
      dailyStreak: 14,
      puzzlesSolved: 87,
    });
  });

  it("sets no-store cache header (per-user data)", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/profile/stats?address=0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
```

- [ ] **Step 2: Run test (expect failure — route missing)**

```bash
pnpm --filter web test --run app/api/profile/stats
```
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// apps/web/src/app/api/profile/stats/route.ts
import { NextResponse } from "next/server";
import { getProfileStats } from "@/lib/supabase/queries";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "missing address param" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: "malformed address" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const stats = await getProfileStats(address.toLowerCase() as `0x${string}`);
    return NextResponse.json(stats, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[/api/profile/stats] failed", error);
    return NextResponse.json(
      { error: "internal" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
```

> **Implementation note for `getProfileStats`:** if `apps/web/src/lib/supabase/queries.ts` does not already export this, add it as a new named export that wraps existing per-stat queries (trophies via scoreboard cache, arena wins + nfts via victory_events cache, daily streak from `lib/daily/progress.ts` server-side variant if available else 0, puzzles solved as sum of exercise + daily + mate aggregates). Each field defaults to 0 on lookup failure (don't blank the profile because one query failed).

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run app/api/profile/stats
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Manual smoke**

```bash
pnpm --filter web dev
# in another terminal:
curl -i 'http://localhost:3000/api/profile/stats?address=0x0924abcdef1234567890abcdef1234567890eba4'
```
Expected: 200 JSON with stats fields; `Cache-Control: no-store`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/profile/stats/ apps/web/src/lib/supabase/queries.ts
git commit -m "feat(api): add /api/profile/stats endpoint

Per-user aggregate (no cache; address validated). Returns trophies +
arenaWins + nftsMinted + dailyStreak + puzzlesSolved. Each field
defaults to 0 on per-source failure so a single bad query doesn't
blank the Profile modal. (SPEC 1 P1-5)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2.2 — `useProfileStats` hook

**Files:**
- Create: `apps/web/src/hooks/use-profile-stats.ts`
- Create: `apps/web/src/hooks/__tests__/use-profile-stats.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/hooks/__tests__/use-profile-stats.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProfileStats } from "@/hooks/use-profile-stats";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("useProfileStats", () => {
  it("returns null stats when address is undefined", () => {
    const { result } = renderHook(() => useProfileStats(undefined));
    expect(result.current.stats).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches stats when address is present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ trophies: 12, arenaWins: 5, nftsMinted: 4, dailyStreak: 14, puzzlesSolved: 87 }),
    } as Response);

    const { result } = renderHook(() => useProfileStats("0x0924abcdef1234567890abcdef1234567890eba4"));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toMatchObject({ trophies: 12 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/profile/stats?address=0x0924"),
      expect.any(Object),
    );
  });

  it("captures error on non-OK response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
    const { result } = renderHook(() => useProfileStats("0x0924abcdef1234567890abcdef1234567890eba4"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.stats).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run hooks/__tests__/use-profile-stats.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement hook**

```ts
// apps/web/src/hooks/use-profile-stats.ts
import { useEffect, useState } from "react";

export type ProfileStats = {
  trophies: number;
  arenaWins: number;
  nftsMinted: number;
  dailyStreak: number;
  puzzlesSolved: number;
};

type State = {
  stats: ProfileStats | null;
  isLoading: boolean;
  error: Error | null;
};

const INITIAL: State = { stats: null, isLoading: false, error: null };

export function useProfileStats(address: `0x${string}` | undefined): State & { refetch: () => void } {
  const [state, setState] = useState<State>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setState(INITIAL);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fetch(`/api/profile/stats?address=${address}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ stats: null, isLoading: false, error: new Error(`HTTP ${res.status}`) });
          return;
        }
        const json = (await res.json()) as ProfileStats;
        setState({ stats: json, isLoading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ stats: null, isLoading: false, error: error as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  return { ...state, refetch: () => setTick((n) => n + 1) };
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run hooks/__tests__/use-profile-stats.test.tsx
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-profile-stats.ts apps/web/src/hooks/__tests__/use-profile-stats.test.tsx
git commit -m "feat(hooks): add useProfileStats fetching from /api/profile/stats

Per-user data, no caching client-side. Returns refetch handle so the
Profile sheet can manually refresh on open (D10 dedup invariants).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2.3 — `useClaimQueue` hook

**Files:**
- Create: `apps/web/src/hooks/use-claim-queue.ts`
- Create: `apps/web/src/hooks/__tests__/use-claim-queue.test.tsx`

- [ ] **Step 1: Write the failing test (focused on the optimistic-remove + in-flight flow)**

```tsx
// apps/web/src/hooks/__tests__/use-claim-queue.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useClaimQueue } from "@/hooks/use-claim-queue";

// Mock the underlying claim sources so the hook is testable in isolation
vi.mock("@/lib/claims/sources", () => ({
  readClaimSources: vi.fn(async () => ({
    localBadgesEarned: [1n],
    badgesOnChain: [],
    localScoresPending: [{ scoreKey: "rook-l3", points: 540 }],
    victoryPending: [],
  })),
}));

vi.mock("@/lib/claims/actions", () => ({
  performClaim: vi.fn(async () => ({ ok: true, txHash: "0xabc" })),
}));

describe("useClaimQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty claims when address is undefined", async () => {
    const { result } = renderHook(() => useClaimQueue(undefined));
    expect(result.current.claims).toEqual([]);
  });

  it("computes claims when address is set", async () => {
    const { result } = renderHook(() =>
      useClaimQueue("0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    await waitFor(() => expect(result.current.claims.length).toBe(2));
  });

  it("optimistically removes a claim after claimOne resolves", async () => {
    const { result } = renderHook(() =>
      useClaimQueue("0x0924abcdef1234567890abcdef1234567890eba4"),
    );
    await waitFor(() => expect(result.current.claims.length).toBe(2));

    await act(async () => {
      await result.current.claimOne(result.current.claims[0]);
    });

    expect(result.current.claims).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run hooks/__tests__/use-claim-queue.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement the hook + the two thin source/action modules it depends on**

Create `apps/web/src/lib/claims/sources.ts`:

```ts
// apps/web/src/lib/claims/sources.ts
import { readContract } from "@wagmi/core";
import { wagmiConfig } from "@/lib/wagmi/config"; // assume existing config
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { dequeuePendingTx, readDisplayedShields } from "@/lib/shop/shield-storage";

/** Aggregates the raw inputs that computePendingClaims needs.
 *  Server/client agnostic — caller decides where to invoke. */
export async function readClaimSources(address: `0x${string}`) {
  const badgesAddress = getBadgesAddress();

  // Local badges earned: persisted by the exercises flow when a piece arc
  // crosses the badge threshold; key shape is `chesscito:badge-earned:{id}`.
  const localBadgesEarned: bigint[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:badge-earned:")) continue;
      const idStr = key.replace("chesscito:badge-earned:", "");
      try {
        localBadgesEarned.push(BigInt(idStr));
      } catch { /* skip */ }
    }
  }

  // On-chain badges: read claimedBadges for the address.
  let badgesOnChain: bigint[] = [];
  try {
    if (badgesAddress) {
      const result = (await readContract(wagmiConfig, {
        abi: badgesAbi,
        address: badgesAddress,
        functionName: "claimedBadges",
        args: [address],
      })) as bigint[];
      badgesOnChain = result ?? [];
    }
  } catch { /* tolerate failure → empty list (chain-says-claimed dominates only when readable) */ }

  // Local scores pending: existing shield-storage exposes a similar pattern.
  // Here we read keys `chesscito:score-pending:{key}` → JSON { points }.
  const localScoresPending: { scoreKey: string; points: number }[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:score-pending:")) continue;
      try {
        const value = window.localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value) as { points: number };
        localScoresPending.push({ scoreKey: key.replace("chesscito:score-pending:", ""), points: parsed.points });
      } catch { /* skip */ }
    }
  }

  // Victory NFTs pending: localStorage keys `chesscito:victory-pending:{txHash}` → { difficulty, mintedAt }
  const victoryPending: { txHash: string; difficulty: number; mintedAt: number }[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:victory-pending:")) continue;
      try {
        const value = window.localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value) as { difficulty: number; mintedAt: number };
        victoryPending.push({
          txHash: key.replace("chesscito:victory-pending:", ""),
          difficulty: parsed.difficulty,
          mintedAt: parsed.mintedAt,
        });
      } catch { /* skip */ }
    }
  }

  return { localBadgesEarned, badgesOnChain, localScoresPending, victoryPending };
}
```

Create `apps/web/src/lib/claims/actions.ts` (thin wrapper around existing badge/score/victory flows):

```ts
// apps/web/src/lib/claims/actions.ts
import type { Claim } from "@/lib/claims/queue";

export type PerformClaimResult =
  | { ok: true; txHash: `0x${string}` }
  | { ok: false; error: Error };

/** Dispatch a claim to its respective on-chain flow. The actual write
 *  paths already exist (badges, scoreboard, victory mint) — this is a
 *  router so <PendingClaims> doesn't need to know the kinds. Wire each
 *  branch to the existing flow during integration (Task 4.2). */
export async function performClaim(claim: Claim): Promise<PerformClaimResult> {
  switch (claim.kind) {
    case "badge":
      throw new Error("performClaim badge: wire to existing badge.claim flow in Task 4.2");
    case "score":
      throw new Error("performClaim score: wire to existing scoreboard.save flow in Task 4.2");
    case "victory-nft":
      throw new Error("performClaim victory-nft: route to /victory/{txHash} mint flow in Task 4.2");
  }
}
```

Create `apps/web/src/hooks/use-claim-queue.ts`:

```ts
// apps/web/src/hooks/use-claim-queue.ts
import { useEffect, useState, useCallback } from "react";
import { computePendingClaims, type Claim, type ClaimQueueState } from "@/lib/claims/queue";
import { readClaimSources } from "@/lib/claims/sources";
import { performClaim } from "@/lib/claims/actions";

type HookState = {
  claims: Claim[];
  isLoading: boolean;
  isClaiming: boolean;
  inFlight: Set<string>;
  error: Error | null;
};

const INITIAL: HookState = {
  claims: [],
  isLoading: false,
  isClaiming: false,
  inFlight: new Set(),
  error: null,
};

export function useClaimQueue(address: `0x${string}` | undefined) {
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(new Set());
  const [state, setState] = useState<HookState>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setState(INITIAL);
      setOptimisticRemoved(new Set());
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    readClaimSources(address)
      .then((sources) => {
        if (cancelled) return;
        const queueState: ClaimQueueState = {
          address,
          ...sources,
          optimisticRemoved,
        };
        setState({
          claims: computePendingClaims(queueState),
          isLoading: false,
          isClaiming: false,
          inFlight: new Set(),
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ ...INITIAL, error: error as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick, optimisticRemoved]);

  const claimOne = useCallback(async (claim: Claim) => {
    setState((s) => ({ ...s, isClaiming: true, inFlight: new Set([...s.inFlight, claim.id]) }));
    try {
      const result = await performClaim(claim);
      if (result.ok) {
        setOptimisticRemoved((prev) => new Set([...prev, claim.id]));
      }
      setState((s) => {
        const inFlight = new Set(s.inFlight);
        inFlight.delete(claim.id);
        return { ...s, isClaiming: false, inFlight };
      });
      return result;
    } catch (error) {
      setState((s) => {
        const inFlight = new Set(s.inFlight);
        inFlight.delete(claim.id);
        return { ...s, isClaiming: false, inFlight, error: error as Error };
      });
      return { ok: false as const, error: error as Error };
    }
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { ...state, claimOne, refresh };
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run hooks/__tests__/use-claim-queue.test.tsx
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-claim-queue.ts apps/web/src/hooks/__tests__/use-claim-queue.test.tsx apps/web/src/lib/claims/sources.ts apps/web/src/lib/claims/actions.ts
git commit -m "feat(hooks): add useClaimQueue with optimistic remove + in-flight tracking

Reads sources from on-chain + localStorage, computes via queue.ts
helper, exposes claimOne() that optimistically marks the claim as
removed on success. inFlight set tracks per-claim tx pending state.
performClaim() actions are stubbed for now — wired during Profile
sheet integration (Task 4.2).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2.4 — `useDisplayName` hook

**Files:**
- Create: `apps/web/src/hooks/use-display-name.ts`
- Create: `apps/web/src/hooks/__tests__/use-display-name.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/hooks/__tests__/use-display-name.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDisplayName, displayNameStorageKey } from "@/hooks/use-display-name";

beforeEach(() => { window.localStorage.clear(); });

describe("useDisplayName", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("falls back to truncated wallet", () => {
    const { result } = renderHook(() => useDisplayName(wallet));
    expect(result.current.name).toBe("0x0924…eba4");
  });

  it("returns persisted custom name", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet));
    expect(result.current.name).toBe("Akawolf");
  });

  it("persists name on setName", () => {
    const { result } = renderHook(() => useDisplayName(wallet));
    act(() => result.current.setName("Wolfcito"));
    expect(result.current.name).toBe("Wolfcito");
    expect(window.localStorage.getItem(displayNameStorageKey(wallet))).toBe("Wolfcito");
  });

  it("clears name when given empty string", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet));
    act(() => result.current.setName(""));
    expect(result.current.name).toBe("0x0924…eba4");
  });

  it("returns Visitor when wallet is undefined", () => {
    const { result } = renderHook(() => useDisplayName(undefined));
    expect(result.current.name).toBe("Visitor");
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run hooks/__tests__/use-display-name.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement hook**

```ts
// apps/web/src/hooks/use-display-name.ts
import { useCallback, useEffect, useState } from "react";
import { resolveDisplayName } from "@/lib/profile/display-name";

const KEY_PREFIX = "chesscito:display-name:";

export const displayNameStorageKey = (address: `0x${string}`): string =>
  `${KEY_PREFIX}${address.toLowerCase()}`;

export function useDisplayName(address: `0x${string}` | undefined) {
  const [customName, setCustomName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!address) {
      setCustomName(undefined);
      return;
    }
    try {
      const stored = window.localStorage.getItem(displayNameStorageKey(address));
      setCustomName(stored ?? undefined);
    } catch {
      setCustomName(undefined);
    }
  }, [address]);

  const setName = useCallback(
    (newName: string) => {
      if (!address) return;
      const trimmed = newName.trim();
      try {
        if (trimmed) {
          window.localStorage.setItem(displayNameStorageKey(address), trimmed);
          setCustomName(trimmed);
        } else {
          window.localStorage.removeItem(displayNameStorageKey(address));
          setCustomName(undefined);
        }
      } catch {
        /* swallow */
      }
    },
    [address],
  );

  return {
    name: resolveDisplayName({ address, customName }),
    setName,
  };
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run hooks/__tests__/use-display-name.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-display-name.ts apps/web/src/hooks/__tests__/use-display-name.test.tsx
git commit -m "feat(hooks): add useDisplayName backed by localStorage

Per-address storage key, trim+empty-clears. v1 has no Talent Protocol
integration plumbed (passthrough is supported by resolveDisplayName
but not wired here); SPEC 2 introduces SIWE for cross-device sync.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2.5 — `useHubOnboarding` hook

**Files:**
- Create: `apps/web/src/hooks/use-hub-onboarding.ts`
- Create: `apps/web/src/hooks/__tests__/use-hub-onboarding.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/hooks/__tests__/use-hub-onboarding.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHubOnboarding, HUB_ONBOARDING_KEY } from "@/hooks/use-hub-onboarding";

beforeEach(() => { window.localStorage.clear(); });

describe("useHubOnboarding", () => {
  it("hasSeenOnboarding=false on first visit", () => {
    const { result } = renderHook(() => useHubOnboarding());
    expect(result.current.hasSeenOnboarding).toBe(false);
  });

  it("hasSeenOnboarding=true when storage flag set", () => {
    window.localStorage.setItem(HUB_ONBOARDING_KEY, "true");
    const { result } = renderHook(() => useHubOnboarding());
    expect(result.current.hasSeenOnboarding).toBe(true);
  });

  it("dismiss() persists the flag", () => {
    const { result } = renderHook(() => useHubOnboarding());
    act(() => result.current.dismiss());
    expect(result.current.hasSeenOnboarding).toBe(true);
    expect(window.localStorage.getItem(HUB_ONBOARDING_KEY)).toBe("true");
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter web test --run hooks/__tests__/use-hub-onboarding.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement hook**

```ts
// apps/web/src/hooks/use-hub-onboarding.ts
import { useCallback, useEffect, useState } from "react";

export const HUB_ONBOARDING_KEY = "chesscito:hub-onboarded:v1";

export function useHubOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    try {
      setHasSeenOnboarding(window.localStorage.getItem(HUB_ONBOARDING_KEY) === "true");
    } catch {
      setHasSeenOnboarding(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(HUB_ONBOARDING_KEY, "true");
      setHasSeenOnboarding(true);
    } catch {
      /* swallow */
    }
  }, []);

  return { hasSeenOnboarding, dismiss };
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter web test --run hooks/__tests__/use-hub-onboarding.test.tsx
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-hub-onboarding.ts apps/web/src/hooks/__tests__/use-hub-onboarding.test.tsx
git commit -m "feat(hooks): add useHubOnboarding for first-launch card

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 3 — Leaf components

> **Convention for this phase:** each component gets a test file + a commit. Tests use `@testing-library/react`. Components are pure-presentational where possible (no wagmi/router inside leaf components — pass data + handlers as props).

### Task 3.1 — `<TierBadge>`

**Files:**
- Create: `apps/web/src/components/profile/tier-badge.tsx`
- Create: `apps/web/src/components/profile/__tests__/tier-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "@/components/profile/tier-badge";

describe("<TierBadge>", () => {
  it("renders tier title + xp value", () => {
    render(<TierBadge tier="knight" title="Knight" xp={247} />);
    expect(screen.getByText("Knight")).toBeInTheDocument();
    expect(screen.getByText("247")).toBeInTheDocument();
  });

  it("renders Visitor variant with 0 XP without crash", () => {
    render(<TierBadge tier="visitor" title="Visitor" xp={0} />);
    expect(screen.getByText("Visitor")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect failure), implement, re-run**

```tsx
// apps/web/src/components/profile/tier-badge.tsx
import type { TierKey } from "@/lib/profile/compute-tier";

type Props = {
  tier: TierKey;
  title: string;
  xp: number;
};

export function TierBadge({ tier, title, xp }: Props) {
  return (
    <div
      className="profile-tier-badge"
      data-tier={tier}
      aria-label={`Tier ${title}, ${xp} XP`}
    >
      <span className="profile-tier-badge-title">{title}</span>
      <strong className="profile-tier-badge-xp">{xp}</strong>
    </div>
  );
}
```

Add minimal styling block to `globals.css` (`@layer components`, candy palette — red gradient on the badge with gold border per the mockup):

```css
/* === profile tier badge === */
.profile-tier-badge {
  display: inline-flex; flex-direction: column; align-items: center;
  background: linear-gradient(180deg, #cf2d2d, #7a1818);
  color: #fff; padding: 4px 8px 6px; border: 2px solid #f4d97a;
  border-radius: 0 0 10px 10px; line-height: 1.1;
  text-shadow: 0 1px 0 rgba(0,0,0,.4);
  font-family: var(--font-game-display);
}
.profile-tier-badge-title { font-size: 9px; font-weight: 800; }
.profile-tier-badge-xp { font-size: 14px; font-weight: 800; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/tier-badge.tsx apps/web/src/components/profile/__tests__/tier-badge.test.tsx apps/web/src/app/globals.css
git commit -m "feat(profile): add TierBadge primitive

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3.2 — `<DisplayNameDialog>`

**Files:**
- Create: `apps/web/src/components/profile/display-name-dialog.tsx`
- Create: `apps/web/src/components/profile/__tests__/display-name-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";

describe("<DisplayNameDialog>", () => {
  it("renders input pre-filled with current name", () => {
    render(
      <DisplayNameDialog open initialValue="Akawolf" onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByDisplayValue("Akawolf")).toBeInTheDocument();
  });

  it("calls onSave with trimmed value when Save tapped", () => {
    const onSave = vi.fn();
    render(<DisplayNameDialog open initialValue="" onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Wolfcito  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("Wolfcito");
  });

  it("calls onCancel when Cancel tapped", () => {
    const onCancel = vi.fn();
    render(<DisplayNameDialog open initialValue="x" onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("enforces 20-character max", () => {
    render(<DisplayNameDialog open initialValue="" onSave={() => {}} onCancel={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.maxLength).toBe(20);
  });
});
```

- [ ] **Step 2: Run test, implement, re-run**

```tsx
// apps/web/src/components/profile/display-name-dialog.tsx
"use client";
import { useState, useEffect } from "react";
import { DISPLAY_NAME_COPY } from "@/lib/content/editorial";

type Props = {
  open: boolean;
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
};

export function DisplayNameDialog({ open, initialValue, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div role="dialog" aria-label={DISPLAY_NAME_COPY.dialogTitle} className="profile-name-dialog">
      <div className="profile-name-dialog-card">
        <h3 className="profile-name-dialog-title">{DISPLAY_NAME_COPY.dialogTitle}</h3>
        <input
          type="text"
          value={value}
          maxLength={20}
          placeholder={DISPLAY_NAME_COPY.placeholder}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="profile-name-dialog-input"
        />
        <div className="profile-name-dialog-actions">
          <button type="button" onClick={onCancel} className="profile-name-dialog-cancel">
            {DISPLAY_NAME_COPY.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(value.trim())}
            className="profile-name-dialog-save"
          >
            {DISPLAY_NAME_COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Add styling block to `globals.css` (scrim + card + input + buttons — keep minimal, follow existing dialog tokens).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/display-name-dialog.tsx apps/web/src/components/profile/__tests__/display-name-dialog.test.tsx apps/web/src/app/globals.css
git commit -m "feat(profile): add DisplayNameDialog (max 20 chars, trims on save)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3.3 — `<SecondaryCta>`

**Files:**
- Create: `apps/web/src/components/hub/secondary-cta.tsx`
- Create: `apps/web/src/components/hub/__tests__/secondary-cta.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecondaryCta } from "@/components/hub/secondary-cta";

describe("<SecondaryCta>", () => {
  it("renders with the Arena label by default", () => {
    render(<SecondaryCta onPress={() => {}} />);
    expect(screen.getByRole("button", { name: /enter arena/i })).toBeInTheDocument();
  });

  it("fires onPress on tap", () => {
    const onPress = vi.fn();
    render(<SecondaryCta onPress={onPress} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/hub/secondary-cta.tsx
"use client";
import { SECONDARY_CTA_COPY } from "@/lib/content/editorial";

type Props = { onPress: () => void };

export function SecondaryCta({ onPress }: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={SECONDARY_CTA_COPY.arena.ariaLabel}
      className="hub-secondary-cta"
    >
      {SECONDARY_CTA_COPY.arena.label} <span aria-hidden="true">→</span>
    </button>
  );
}
```

Add styling — calm blue, half-height of hero, no candy gradient (per D5):

```css
.hub-secondary-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: .35rem;
  width: 92%; padding: .35rem .5rem;
  background: rgba(50,90,150,.85); color: #dceeff;
  border: 1.5px solid rgba(20,40,80,.7); border-radius: 12px;
  font-size: .8125rem; font-weight: 700;
  text-shadow: 0 1px 0 rgba(0,0,0,.3);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hub/secondary-cta.tsx apps/web/src/components/hub/__tests__/secondary-cta.test.tsx apps/web/src/app/globals.css
git commit -m "feat(hub): add SecondaryCta — calm Arena link below Hero (D5)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3.4 — `<SettingsSheetStub>`

**Files:**
- Create: `apps/web/src/components/hub/settings-sheet-stub.tsx`
- Create: `apps/web/src/components/hub/__tests__/settings-sheet-stub.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsSheetStub } from "@/components/hub/settings-sheet-stub";

describe("<SettingsSheetStub>", () => {
  it("renders Settings header + version chip", () => {
    render(<SettingsSheetStub buildSha="abc123f" />);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123f/i)).toBeInTheDocument();
  });

  it("renders disabled toggles with Coming soon tooltip", () => {
    render(<SettingsSheetStub buildSha="abc123f" />);
    const themeToggle = screen.getByRole("button", { name: /theme/i });
    expect(themeToggle).toBeDisabled();
    expect(themeToggle).toHaveAttribute("title", expect.stringMatching(/coming soon/i));
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/hub/settings-sheet-stub.tsx
"use client";
import { SETTINGS_STUB_COPY } from "@/lib/content/editorial";

type Props = { buildSha: string };

function DisabledToggle({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title={SETTINGS_STUB_COPY.comingSoonTooltip}
      className="settings-toggle settings-toggle--disabled"
    >
      {label}
    </button>
  );
}

export function SettingsSheetStub({ buildSha }: Props) {
  return (
    <div className="settings-stub">
      <h2 className="settings-stub-title">{SETTINGS_STUB_COPY.title}</h2>
      <div className="settings-stub-version">
        {SETTINGS_STUB_COPY.versionChipLabel.replace("{sha}", buildSha)}
      </div>
      <div className="settings-stub-toggles">
        <DisabledToggle label={SETTINGS_STUB_COPY.themeToggleLabel} />
        <DisabledToggle label={SETTINGS_STUB_COPY.hapticsToggleLabel} />
        <DisabledToggle label={SETTINGS_STUB_COPY.languageToggleLabel} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hub/settings-sheet-stub.tsx apps/web/src/components/hub/__tests__/settings-sheet-stub.test.tsx apps/web/src/app/globals.css
git commit -m "feat(hub): add SettingsSheetStub (v1 placeholder)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3.5 — `<HubOnboardingCard>`

**Files:**
- Create: `apps/web/src/components/hub/onboarding-card.tsx`
- Create: `apps/web/src/components/hub/__tests__/onboarding-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HubOnboardingCard } from "@/components/hub/onboarding-card";

describe("<HubOnboardingCard>", () => {
  it("renders title + body + dismiss", () => {
    render(<HubOnboardingCard onDismiss={() => {}} />);
    expect(screen.getByText(/welcome to chesscito/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /got it/i })).toBeInTheDocument();
  });

  it("fires onDismiss on click", () => {
    const onDismiss = vi.fn();
    render(<HubOnboardingCard onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/hub/onboarding-card.tsx
"use client";
import { HUB_ONBOARDING_COPY } from "@/lib/content/editorial";

type Props = { onDismiss: () => void };

export function HubOnboardingCard({ onDismiss }: Props) {
  return (
    <aside className="hub-onboarding-card" role="region" aria-label={HUB_ONBOARDING_COPY.title}>
      <h3 className="hub-onboarding-card-title">{HUB_ONBOARDING_COPY.title}</h3>
      <p className="hub-onboarding-card-body">{HUB_ONBOARDING_COPY.body}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="hub-onboarding-card-dismiss"
      >
        {HUB_ONBOARDING_COPY.dismissLabel}
      </button>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hub/onboarding-card.tsx apps/web/src/components/hub/__tests__/onboarding-card.test.tsx apps/web/src/app/globals.css
git commit -m "feat(hub): add HubOnboardingCard (single dismiss, no tap-outside)

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 4 — Profile composites

### Task 4.1 — `<ProfileBanner>`

**Files:**
- Create: `apps/web/src/components/profile/profile-banner.tsx`
- Create: `apps/web/src/components/profile/__tests__/profile-banner.test.tsx`

- [ ] **Step 1: Write the failing test (focuses on the integration: tier + name + pen affordance)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileBanner } from "@/components/profile/profile-banner";

describe("<ProfileBanner>", () => {
  it("renders display name, tier title, wallet, xp", () => {
    render(
      <ProfileBanner
        displayName="Akawolf"
        tierTitle="Knight"
        tierKey="knight"
        xp={247}
        truncatedWallet="0x0924…eba4"
        onEditName={() => {}}
      />,
    );
    expect(screen.getByText("Akawolf")).toBeInTheDocument();
    expect(screen.getByText("Knight")).toBeInTheDocument();
    expect(screen.getByText("0x0924…eba4")).toBeInTheDocument();
    expect(screen.getByText("247")).toBeInTheDocument();
  });

  it("fires onEditName when pen icon tapped", () => {
    const onEditName = vi.fn();
    render(
      <ProfileBanner
        displayName="Akawolf"
        tierTitle="Knight"
        tierKey="knight"
        xp={247}
        truncatedWallet="0x0924…eba4"
        onEditName={onEditName}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit display name/i }));
    expect(onEditName).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/profile/profile-banner.tsx
"use client";
import { TierBadge } from "@/components/profile/tier-badge";
import type { TierKey } from "@/lib/profile/compute-tier";

type Props = {
  displayName: string;
  tierTitle: string;
  tierKey: TierKey;
  xp: number;
  truncatedWallet: string;
  onEditName: () => void;
};

export function ProfileBanner({
  displayName, tierTitle, tierKey, xp, truncatedWallet, onEditName,
}: Props) {
  return (
    <header className="profile-banner">
      <div className="profile-banner-avatar-wrap">
        {/* placeholder avatar; SPEC 2 ships picker */}
        <span className="profile-banner-avatar" aria-hidden="true">🧙</span>
      </div>
      <div className="profile-banner-meta">
        <div className="profile-banner-name-row">
          <span className="profile-banner-name">{displayName}</span>
          <button
            type="button"
            onClick={onEditName}
            aria-label="Edit display name"
            className="profile-banner-edit-pen"
          >
            ✏️
          </button>
        </div>
        <div className="profile-banner-tier-row">
          <span className="profile-banner-tier-title">{tierTitle}</span>
        </div>
        <div className="profile-banner-wallet">{truncatedWallet}</div>
      </div>
      <div className="profile-banner-badge-slot">
        <TierBadge tier={tierKey} title={tierTitle} xp={xp} />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/profile-banner.tsx apps/web/src/components/profile/__tests__/profile-banner.test.tsx apps/web/src/app/globals.css
git commit -m "feat(profile): add ProfileBanner (avatar+name+tier+wallet+xp)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4.2 — `<PendingClaims>` + wire `performClaim` to real flows

**Files:**
- Create: `apps/web/src/components/profile/pending-claims.tsx`
- Create: `apps/web/src/components/profile/__tests__/pending-claims.test.tsx`
- Modify: `apps/web/src/lib/claims/actions.ts` (wire to real flows)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PendingClaims } from "@/components/profile/pending-claims";
import type { Claim } from "@/lib/claims/queue";

const sampleClaims: Claim[] = [
  { id: "badge-1", kind: "badge", badgeId: 1n, costGasOnly: true },
  { id: "score-rook-l3", kind: "score", scoreKey: "rook-l3", points: 540, costGasOnly: true },
];

describe("<PendingClaims>", () => {
  it("does not render the section at all when claims is empty", () => {
    const { container } = render(
      <PendingClaims claims={[]} inFlight={new Set()} onClaim={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per claim (no Claim All in v1)", () => {
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getAllByRole("button", { name: /^claim$/i })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /claim all/i })).not.toBeInTheDocument();
  });

  it("fires onClaim with claim object when row CTA tapped", () => {
    const onClaim = vi.fn();
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={onClaim} onRefresh={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^claim$/i })[0]);
    expect(onClaim).toHaveBeenCalledWith(sampleClaims[0]);
  });

  it("shows in-flight label when claim id is in inFlight set", () => {
    render(
      <PendingClaims
        claims={sampleClaims}
        inFlight={new Set([sampleClaims[0].id])}
        onClaim={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/in flight/i)).toBeInTheDocument();
  });

  it("fires onRefresh when refresh button tapped", () => {
    const onRefresh = vi.fn();
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={vi.fn()} onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/profile/pending-claims.tsx
"use client";
import type { Claim } from "@/lib/claims/queue";
import { CLAIM_COPY, PROFILE_COPY } from "@/lib/content/editorial";

type Props = {
  claims: Claim[];
  inFlight: Set<string>;
  onClaim: (claim: Claim) => void;
  onRefresh: () => void;
};

function labelFor(claim: Claim): string {
  switch (claim.kind) {
    case "badge":
      return CLAIM_COPY.kinds.badge.replace("{name}", `#${claim.badgeId.toString()}`);
    case "score":
      return CLAIM_COPY.kinds.score
        .replace("{points}", String(claim.points));
    case "victory-nft":
      return CLAIM_COPY.kinds.victoryNft.replace("{difficulty}", String(claim.difficulty));
  }
}

function costFor(claim: Claim): string {
  return claim.costGasOnly ? CLAIM_COPY.costGasOnly : CLAIM_COPY.costEstimateUsd.replace("{amount}", "0.02");
}

export function PendingClaims({ claims, inFlight, onClaim, onRefresh }: Props) {
  if (claims.length === 0) return null;

  return (
    <section className="profile-pending-claims" aria-label={PROFILE_COPY.pendingClaimsHeader}>
      <div className="profile-pending-claims-header">
        <h3>{PROFILE_COPY.pendingClaimsHeader} ({claims.length})</h3>
        <button
          type="button"
          onClick={onRefresh}
          aria-label={PROFILE_COPY.refreshAria}
          className="profile-pending-claims-refresh"
        >
          ↻
        </button>
      </div>
      <ul className="profile-pending-claims-list">
        {claims.map((claim) => {
          const isInFlight = inFlight.has(claim.id);
          return (
            <li key={claim.id} className="profile-claim-row">
              <span className="profile-claim-label">{labelFor(claim)}</span>
              <span className="profile-claim-cost">{costFor(claim)}</span>
              {isInFlight ? (
                <span className="profile-claim-inflight">{CLAIM_COPY.inFlightLabel}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onClaim(claim)}
                  className="profile-claim-cta"
                >
                  {CLAIM_COPY.claimVerb}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Wire `performClaim` to real on-chain flows**

Open `apps/web/src/lib/claims/actions.ts` and replace the stubs with calls to the existing wagmi write flows. **Implementation note for the agent:** read `apps/web/src/components/exercises/exercises-screen.tsx` for how `claimBadgeSigned` and `submitScoreSigned` are called today, and `apps/web/src/app/arena/page.tsx` for how victory mint is invoked. Re-use those helpers (do not duplicate). For victory-nft, route to `/victory/{txHash}` if a mint page exists, or open the existing victory mint sheet — pick whichever path is currently used post-arena-win.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test --run components/profile/__tests__/pending-claims.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/profile/pending-claims.tsx apps/web/src/components/profile/__tests__/pending-claims.test.tsx apps/web/src/lib/claims/actions.ts apps/web/src/app/globals.css
git commit -m "feat(profile): add PendingClaims component, wire claim actions

Individual claims only in v1 (no Claim All). performClaim now routes
to existing badge/scoreboard/victory flows.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4.3 — `<GeneralStats>`

**Files:**
- Create: `apps/web/src/components/profile/general-stats.tsx`
- Create: `apps/web/src/components/profile/__tests__/general-stats.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStats } from "@/components/profile/general-stats";

describe("<GeneralStats>", () => {
  it("always renders 6 stat cells, even at 0", () => {
    render(
      <GeneralStats
        piecesMastered={0} piecesTotal={6}
        dailyStreak={0} puzzlesSolved={0}
        arenaWins={0} trophies={0} nftsMinted={0}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("formats Pieces Mastered as X/6", () => {
    render(
      <GeneralStats
        piecesMastered={3} piecesTotal={6}
        dailyStreak={14} puzzlesSolved={87}
        arenaWins={12} trophies={12} nftsMinted={4}
      />,
    );
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/web/src/components/profile/general-stats.tsx
"use client";
import { PROFILE_COPY } from "@/lib/content/editorial";

type Props = {
  piecesMastered: number; piecesTotal: number;
  dailyStreak: number;
  puzzlesSolved: number;
  arenaWins: number;
  trophies: number;
  nftsMinted: number;
};

export function GeneralStats(p: Props) {
  const cells = [
    { ico: "♟️", label: "Pieces Mastered", value: `${p.piecesMastered} / ${p.piecesTotal}` },
    { ico: "🔥", label: "Daily Streak", value: String(p.dailyStreak) },
    { ico: "🧩", label: "Puzzles Solved", value: String(p.puzzlesSolved) },
    { ico: "⚔️", label: "Arena Wins", value: String(p.arenaWins) },
    { ico: "🏆", label: "Trophies", value: String(p.trophies) },
    { ico: "💎", label: "NFTs Minted", value: String(p.nftsMinted) },
  ];

  return (
    <section className="profile-stats" aria-label={PROFILE_COPY.generalStatsHeader}>
      <h3 className="profile-stats-header">{PROFILE_COPY.generalStatsHeader}</h3>
      <ul className="profile-stats-grid">
        {cells.map((c) => (
          <li key={c.label} className="profile-stat-cell">
            <span aria-hidden="true">{c.ico}</span>
            <span className="profile-stat-cell-label">{c.label}</span>
            <strong className="profile-stat-cell-value">{c.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/general-stats.tsx apps/web/src/components/profile/__tests__/general-stats.test.tsx apps/web/src/app/globals.css
git commit -m "feat(profile): add GeneralStats 6-cell grid

Always renders even at 0 (consistent profile shape per P2-4).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4.4 — `<ProfileSheet>` composite (the actual modal)

**Files:**
- Create: `apps/web/src/components/profile/profile-sheet.tsx`
- Create: `apps/web/src/components/profile/__tests__/profile-sheet.test.tsx`

- [ ] **Step 1: Write the failing test (integration: dialog opens, contains banner + claims + stats + pro + wallet sections)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSheet } from "@/components/profile/profile-sheet";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x0924abcdef1234567890abcdef1234567890eba4", isConnected: true }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
vi.mock("@/hooks/use-profile-stats", () => ({
  useProfileStats: () => ({
    stats: { trophies: 12, arenaWins: 5, nftsMinted: 4, dailyStreak: 14, puzzlesSolved: 87 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-claim-queue", () => ({
  useClaimQueue: () => ({ claims: [], inFlight: new Set(), claimOne: vi.fn(), refresh: vi.fn(), isLoading: false }),
}));
vi.mock("@/hooks/use-display-name", () => ({
  useDisplayName: () => ({ name: "Akawolf", setName: vi.fn() }),
}));

describe("<ProfileSheet>", () => {
  it("renders banner, stats section, wallet/network rows, disconnect link", () => {
    render(<ProfileSheet open onOpenChange={() => {}} />);
    expect(screen.getByText("Akawolf")).toBeInTheDocument();
    expect(screen.getByText(/general stats/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it("does not render Pending Claims section when claims empty", () => {
    render(<ProfileSheet open onOpenChange={() => {}} />);
    expect(screen.queryByText(/pending claims/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement (composition of all the leaves)**

```tsx
// apps/web/src/components/profile/profile-sheet.tsx
"use client";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PendingClaims } from "@/components/profile/pending-claims";
import { GeneralStats } from "@/components/profile/general-stats";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { useClaimQueue } from "@/hooks/use-claim-queue";
import { useDisplayName } from "@/hooks/use-display-name";
import { computeTier } from "@/lib/profile/compute-tier";
import { truncateWallet } from "@/lib/profile/display-name";
import { PROFILE_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ProfileSheet({ open, onOpenChange }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { name, setName } = useDisplayName(address);
  const { stats, refetch } = useProfileStats(address);
  const { claims, inFlight, claimOne, refresh } = useClaimQueue(address);

  const [editing, setEditing] = useState(false);

  const tier = computeTier({
    address,
    puzzlesSolved: stats?.puzzlesSolved ?? 0,
    piecesMastered: 0, // wired in integration when piece progress aggregator lands
    arenaWins: stats?.arenaWins ?? 0,
    daysStreak: stats?.dailyStreak ?? 0,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          track("profile_opened");
          refetch();
          refresh();
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="profile-sheet mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{PROFILE_COPY.pageTitle}</SheetTitle>
          <SheetDescription>Profile and claims</SheetDescription>
        </SheetHeader>

        <ProfileBanner
          displayName={name}
          tierTitle={tier.title}
          tierKey={tier.tier}
          xp={tier.xp}
          truncatedWallet={truncateWallet(address)}
          onEditName={() => setEditing(true)}
        />

        <DisplayNameDialog
          open={editing}
          initialValue={name === "Visitor" ? "" : name}
          onSave={(v) => { setName(v); setEditing(false); track("profile_name_edited"); }}
          onCancel={() => setEditing(false)}
        />

        <PendingClaims
          claims={claims}
          inFlight={inFlight}
          onClaim={(c) => { track("claim_attempted", { kind: c.kind }); void claimOne(c); }}
          onRefresh={() => { track("profile_refresh_tapped"); refresh(); }}
        />

        <GeneralStats
          piecesMastered={0}
          piecesTotal={6}
          dailyStreak={stats?.dailyStreak ?? 0}
          puzzlesSolved={stats?.puzzlesSolved ?? 0}
          arenaWins={stats?.arenaWins ?? 0}
          trophies={stats?.trophies ?? 0}
          nftsMinted={stats?.nftsMinted ?? 0}
        />

        <div className="profile-utility-row">
          <div className="profile-utility-card">
            <span>{PROFILE_COPY.walletLabel}</span>
            <span>{truncateWallet(address)}</span>
          </div>
          <div className="profile-utility-card">
            <span>{PROFILE_COPY.networkLabel}</span>
            <span>Celo</span>
          </div>
        </div>

        {isConnected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="profile-disconnect-link"
          >
            {PROFILE_COPY.disconnect}
          </button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test --run components/profile
```
Expected: ALL pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/profile/profile-sheet.tsx apps/web/src/components/profile/__tests__/profile-sheet.test.tsx
git commit -m "feat(profile): add ProfileSheet composite

Composes ProfileBanner + PendingClaims + GeneralStats + Wallet/Network
rows + Disconnect. Wired to useProfileStats / useClaimQueue / useDisplayName.
Telemetry fires on open + name edit + claim attempt + refresh.

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 5 — Hub integration

### Task 5.1 — Extend `parseInitialSheet` in `app/hub/page.tsx`

**Files:**
- Modify: `apps/web/src/app/hub/page.tsx`

- [ ] **Step 1: Add the three new sheet values**

```ts
type HubInitialSheet = "shop" | "pro" | "badges" | "trophies" | "profile" | "settings";

function parseInitialSheet(value: string | undefined): HubInitialSheet | undefined {
  if (
    value === "shop" || value === "pro" || value === "badges" ||
    value === "trophies" || value === "profile" || value === "settings"
  ) return value;
  return undefined;
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter web test --run app/hub
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/hub/page.tsx
git commit -m "feat(hub): extend parseInitialSheet for trophies/profile/settings

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5.2 — Persistent dock taxonomy: Home/Pieces/Shop/Board/Settings

**Files:**
- Modify: `apps/web/src/components/exercises/persistent-dock.tsx`

- [ ] **Step 1: Read the current dock and identify the 5 slots**

Open the file. Today's slots include Badges, Shop, Free Play, Leaderboard, Invite (per project memory). Replace with:

1. **Home** → `/hub` (active when on hub)
2. **Pieces** → `/exercises`
3. **Shop** → opens `?sheet=shop` (or routes to `/hub?sheet=shop` if not on hub)
4. **Board** → `/leaderboard` (or `?sheet=leaderboard` later)
5. **Settings** → `?sheet=settings`

Remove Trophies, Badges, Invite, Free Play. Use icons from the existing CandyIcon set.

- [ ] **Step 2: Update tests in `__tests__/persistent-dock.test.tsx` for the new 5 slots**

```tsx
// snippet
it("renders exactly 5 dock slots in v1 taxonomy", () => {
  // ...
  expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /pieces/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /shop/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /board/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /trophies/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run all dock-related tests**

```bash
pnpm --filter web test --run exercises/__tests__/persistent-dock
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/exercises/persistent-dock.tsx apps/web/src/components/exercises/__tests__/persistent-dock.test.tsx
git commit -m "refactor(dock): 5-slot taxonomy Home/Pieces/Shop/Board/Settings

Profile is the avatar HUD chip, not the dock. Trophies via HUD chip
and standalone /trophies page. (SPEC 1 D7)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5.3 — `<HubScaffold>` rails reframe + Hero CTA wiring

**Files:**
- Modify: `apps/web/src/components/hub/hub-scaffold.tsx`
- Modify: `apps/web/src/components/hub/__tests__/hub-scaffold.test.tsx`

- [ ] **Step 1: Update tests first**

Add tests for:
- LEFT rail header reads "LEARN"
- RIGHT rail header reads "UNLOCK"
- Hero CTA renders amber by default; blue when daily-pending; respects the contextual label
- Secondary CTA "Enter Arena" is always present below Hero

- [ ] **Step 2: Add props to `<HubScaffold>`**

Add to props:
```ts
heroCta: {
  label: string;
  sub: string;
  color: "amber" | "blue";
  ariaLabel: string;
  onPress: () => void;
};
onArenaPress: () => void;
showOnboarding?: boolean;
onOnboardingDismiss?: () => void;
```

- [ ] **Step 3: In the JSX, replace the LEFT rail label "Practice Pieces" with "LEARN", RIGHT rail label "UNLOCK". Replace the current Hero composition with a single styled button using the new `heroCta` shape. Add `<SecondaryCta onPress={onArenaPress} />` immediately under Hero. Mount the Onboarding card when `showOnboarding` true (use dynamic import with ssr:false at the integration layer in Task 5.5).**

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test --run components/hub/__tests__/hub-scaffold
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hub/hub-scaffold.tsx apps/web/src/components/hub/__tests__/hub-scaffold.test.tsx apps/web/src/app/globals.css
git commit -m "feat(hub): rails reframe (LEARN/UNLOCK) + contextual Hero CTA

HubScaffold now accepts heroCta + onArenaPress props. Removes
'Practice Pieces' title in favor of LEARN rail header. Adds Secondary
CTA slot below Hero (D5).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5.4 — `<HubScaffold>` onboarding card mount

**Files:**
- Modify: `apps/web/src/components/hub/hub-scaffold.tsx`

- [ ] **Step 1: Add onboarding card mount between HUD header and Body**

```tsx
{showOnboarding ? (
  <HubOnboardingCard onDismiss={onOnboardingDismiss ?? (() => {})} />
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/hub/hub-scaffold.tsx
git commit -m "feat(hub): mount HubOnboardingCard inline between HUD and Body

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5.5 — `<HubScaffoldClient>` integration: wire new sheets + Hero CTA + claim queue

**Files:**
- Modify: `apps/web/src/components/hub/hub-scaffold-client.tsx`

- [ ] **Step 1: Import the new pieces**

```ts
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { getHeroContextAction, type HeroCTA } from "@/lib/hub/hero-cta";
import { useClaimQueue } from "@/hooks/use-claim-queue";
import { useHubOnboarding } from "@/hooks/use-hub-onboarding";
import { isCompletedToday, getDailyHistoryCount } from "@/lib/daily/progress";
import { getExercisesCompletedCount } from "@/lib/game/exercise-progress"; // exists or add tiny helper
import { ProfileSheet } from "@/components/profile/profile-sheet";
import { SettingsSheetStub } from "@/components/hub/settings-sheet-stub";

const HubOnboardingCard = dynamic(
  () => import("@/components/hub/onboarding-card").then((m) => m.HubOnboardingCard),
  { ssr: false },
);
```

- [ ] **Step 2: Compute the Hero state**

```ts
const { address } = useAccount();
const exercisesCompletedCount = getExercisesCompletedCount();
const dailyHistoryCount = getDailyHistoryCount();
const dailyDoneToday = isCompletedToday();
const isLoadingSignals = false; // localStorage reads are sync; flag here if any future signal is async

const hero: HeroCTA = getHeroContextAction({
  isLoading: isLoadingSignals,
  exercisesCompletedCount,
  dailyHistoryCount,
  isDailyCompletedToday: dailyDoneToday,
});
```

- [ ] **Step 3: Wire onboarding + Profile sheet + Settings stub sheet**

```tsx
const { hasSeenOnboarding, dismiss } = useHubOnboarding();
const [profileOpen, setProfileOpen] = useState(initialSheet === "profile");
const [settingsOpen, setSettingsOpen] = useState(initialSheet === "settings");
const claimQueue = useClaimQueue(address);

const router = useRouter();
const handleHeroPress = () => {
  track("hero_cta_clicked", { variant: hero.variant });
  if (hero.destination) router.push(hero.destination);
};
const handleArenaPress = () => {
  track("secondary_arena_clicked");
  router.push("/arena");
};
```

- [ ] **Step 4: Pass into `<HubScaffold>`**

```tsx
<HubScaffold
  // …existing props…
  heroCta={{
    label: hero.label,
    sub: hero.sub,
    color: hero.color,
    ariaLabel: hero.label,
    onPress: handleHeroPress,
  }}
  onArenaPress={handleArenaPress}
  showOnboarding={!hasSeenOnboarding}
  onOnboardingDismiss={() => { dismiss(); track("hub_onboarding_dismissed"); }}
  notifDotCount={claimQueue.claims.length}
  onAvatarTap={() => setProfileOpen(true)}
/>

<ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
  <SheetContent side="bottom" className="settings-sheet">
    <SettingsSheetStub buildSha={process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"} />
  </SheetContent>
</Sheet>
```

- [ ] **Step 5: Run integration tests**

```bash
pnpm --filter web test --run components/hub
```

- [ ] **Step 6: Manual smoke**

```bash
pnpm --filter web dev
# open http://localhost:3000/hub on a 390px viewport
# verify:
# - hero amber + sub-copy reflects state
# - secondary Arena button below hero
# - dock has 5 slots (Home/Pieces/Shop/Board/Settings)
# - tap avatar → Profile sheet opens
# - tap Settings dock slot → SettingsSheetStub opens
# - first visit shows onboarding; dismiss + reload → stays hidden
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hub/hub-scaffold-client.tsx
git commit -m "feat(hub): wire Hero CTA, Profile sheet, Settings stub, onboarding

HubScaffoldClient now computes contextual Hero state via
getHeroContextAction, mounts ProfileSheet/SettingsSheetStub/Onboarding,
and surfaces avatar notif-dot from claim queue length.

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 6 — Trophies page candy port

### Task 6.1 — Port `/trophies` page to candy aesthetic

**Files:**
- Modify: `apps/web/src/app/trophies/page.tsx`
- Modify: `apps/web/src/app/globals.css` (add `.trophies-candy-page` rules matching `sheet-bg-hub` palette)

- [ ] **Step 1: Replace the current wrapper classes with candy palette tokens (tree band + cream wash). Keep the back button + header structure; only the visual treatment changes. Body stays `<TrophiesBody>`.**

- [ ] **Step 2: Add an E2E smoke check**

```ts
// e2e/trophies-candy.spec.ts
import { test, expect } from "@playwright/test";

test("trophies page renders with candy palette + back button", async ({ page }) => {
  await page.goto("/trophies");
  await expect(page.getByRole("link", { name: /back to hub/i })).toBeVisible();
  await expect(page.locator(".trophies-candy-page")).toBeVisible();
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/trophies/page.tsx apps/web/src/app/globals.css e2e/trophies-candy.spec.ts
git commit -m "feat(trophies): port standalone page to candy aesthetic (D8)

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 7 — Anchor atomic fix (D13)

> **This phase MUST ship as 2 separate commits. Do not combine.**

### Task 7.1 — Asset prep (Commit 1)

**Files:**
- Create: `apps/web/public/art/scene-rooted/portal-centered.avif`
- Create: `apps/web/public/art/scene-rooted/portal-centered.webp`

- [ ] **Step 1: Generate the AVIF + WebP companions from portal-centered.png**

```bash
# from repo root, using sharp via npx (or substitute squoosh-cli / your usual pipeline)
npx sharp-cli@2 -i apps/web/public/art/scene-rooted/portal-centered.png -o apps/web/public/art/scene-rooted/portal-centered.avif -f avif
npx sharp-cli@2 -i apps/web/public/art/scene-rooted/portal-centered.png -o apps/web/public/art/scene-rooted/portal-centered.webp -f webp
```

Verify both files exist and are non-empty:
```bash
ls -la apps/web/public/art/scene-rooted/portal-centered.*
```

- [ ] **Step 2: Smoke that the assets are served**

```bash
pnpm --filter web dev
curl -I http://localhost:3000/art/scene-rooted/portal-centered.avif
curl -I http://localhost:3000/art/scene-rooted/portal-centered.webp
```
Expected: both return 200.

- [ ] **Step 3: Commit (no behavior change yet)**

```bash
git add apps/web/public/art/scene-rooted/portal-centered.avif apps/web/public/art/scene-rooted/portal-centered.webp
git commit -m "chore(art): add portal-centered .avif and .webp companions

Asset prep for the anchor cleanup. No behavior change in this commit
(D13 step 1 of 2).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 7.2 — Atomic switchover (Commit 2)

**Files:**
- Modify: `apps/web/src/components/kingdom/kingdom-anchor.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx`

- [ ] **Step 1: Change `HERO_ASSET_BASE` in `kingdom-anchor.tsx:27`**

```ts
const HERO_ASSET_BASE = "/art/scene-rooted/portal-centered";
```

- [ ] **Step 2: Delete the CSS background rule in `globals.css:2906-2918` (the `.kingdom-anchor--playhub { background: url(...); ... }` block)**

- [ ] **Step 3: Delete the opacity-hide rule in `globals.css:2938-2940` (the `.kingdom-anchor--playhub .kingdom-anchor-picture { opacity: 0; }` block)**

- [ ] **Step 4: Update ALL 7 occurrences of `splash-loading` in the test file**

Edit `apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx` and replace every `splash-loading` reference with `portal-centered` (lines around 14, 19, 24, 63, 64, 67 and the test name on line 27). Confirm via:
```bash
grep -n "splash-loading" apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx
```
Expected after edits: 0 matches.

- [ ] **Step 5: Run anchor tests**

```bash
pnpm --filter web test --run components/kingdom
```
Expected: PASS.

- [ ] **Step 6: Visual smoke in dev**

```bash
pnpm --filter web dev
# open /hub on 390px; confirm the anchor renders the portal-centered art
```

- [ ] **Step 7: Commit (atomic switchover)**

```bash
git add apps/web/src/components/kingdom/kingdom-anchor.tsx apps/web/src/app/globals.css apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx
git commit -m "fix(hub): atomic anchor cleanup — portal-centered via <picture> (D13)

In a single commit:
- HERO_ASSET_BASE → /art/scene-rooted/portal-centered.
- Remove .kingdom-anchor--playhub background CSS rule.
- Remove .kingdom-anchor--playhub .kingdom-anchor-picture opacity:0.
- Update all 7 test references from splash-loading to portal-centered.

splash-loading remains as the actual loading surface (globals.css:2253).

Wolfcito 🐾 @akawolfcito"
```

---

## Phase 8 — Validation

### Task 8.1 — E2E tests

**Files:**
- Create: `apps/web/e2e/hub-redesign.spec.ts`

- [ ] **Step 1: Add the priority flows**

```ts
// apps/web/e2e/hub-redesign.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Hub redesign", () => {
  test("first-visit onboarding card visible + dismiss persists", async ({ page }) => {
    await page.goto("/hub");
    await expect(page.getByText(/welcome to chesscito/i)).toBeVisible();
    await page.getByRole("button", { name: /got it/i }).click();
    await page.reload();
    await expect(page.getByText(/welcome to chesscito/i)).not.toBeVisible();
  });

  test("secondary Enter Arena navigates to /arena", async ({ page }) => {
    await page.goto("/hub");
    await page.getByRole("button", { name: /enter arena/i }).click();
    await expect(page).toHaveURL(/\/arena/);
  });

  test("avatar tap opens Profile sheet", async ({ page }) => {
    await page.goto("/hub");
    await page.locator('[data-testid="hub-avatar"]').click();
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("/trophies renders the candy page with back button", async ({ page }) => {
    await page.goto("/trophies");
    await expect(page.getByRole("link", { name: /back to hub/i })).toBeVisible();
  });

  test("/hub?sheet=profile deep-links into the Profile sheet", async ({ page }) => {
    await page.goto("/hub?sheet=profile");
    await expect(page.getByText(/general stats/i)).toBeVisible();
  });

  test("?hub=v2 query is ignored (V2 retired)", async ({ page }) => {
    await page.goto("/hub?hub=v2");
    // confirm V1-specific structure renders (e.g. dock 5 slots)
    await expect(page.getByRole("button", { name: /home/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E**

```bash
pnpm --filter web test:e2e -- hub-redesign.spec.ts
```
Expected: ALL pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/hub-redesign.spec.ts
git commit -m "test(e2e): add hub redesign smoke specs

Wolfcito 🐾 @akawolfcito"
```

---

### Task 8.2 — Manual QA checklist run

- [ ] **Step 1: Run the full checklist (from SPEC 1 §Validation gates)**

iPhone (MiniPay viewport 390px), real wallet:
- [ ] Hero CTA — new-player state (clear localStorage first)
- [ ] Hero CTA — daily-pending state (verify label + sub + destination)
- [ ] Hero CTA — default state (after solving today's daily)
- [ ] PRO chip — active path (shows days)
- [ ] PRO chip — inactive path (shows current PRO drop in upsell)
- [ ] Claim queue — empty (section hidden in Profile)
- [ ] Claim queue — single free claim (badge available, tap → tx prompt → row disappears optimistically)
- [ ] Claim queue — single paid claim (Arena win minted within 24h)
- [ ] Disconnected wallet — HUD shows Connect, Profile shows Visitor tier, claims show Connect-to-claim
- [ ] Onboarding — mid-read reload re-renders; after dismiss, reload → hidden
- [ ] Settings sheet — version chip matches build SHA; disabled toggles show tooltip
- [ ] DisplayName dialog — save → persists across reload; clear → reverts to truncated wallet
- [ ] /trophies — back button works, candy palette visible
- [ ] Secondary CTA — wallet disconnected → still proceeds to /arena (gate handles it)

- [ ] **Step 2: Document any deviation in `docs/reviews/2026-05-XX-hub-redesign-qa.md` and address before promotion**

- [ ] **Step 3: Final grep — no V2 leftovers**

```bash
grep -rn "hub-v2\|HUB_V2\|hub-scaffold-v2\|HubScaffoldV2\|splash-loading" apps/web/src
```
Expected: only matches are in `globals.css:2253-2259` (the loading surface, intentional).

---

## Self-review

Before declaring the plan complete, the executing agent should:

1. **Spec coverage check** — every D1–D15 in the spec maps to at least one task here. D14 onboarding has Tasks 2.5 + 3.5 + 5.4 + 5.5. D15 V2 retirement is Task 0.1. D13 anchor is Tasks 7.1+7.2. D9 Profile is Tasks 4.1–4.4 + 5.5.
2. **Placeholder scan** — no "TBD" or "implement later" in the plan. The only ambiguity is the `performClaim` wiring in Task 4.2 step 3 which references the existing flows; the implementing agent must read `exercises-screen.tsx` and `app/arena/page.tsx` to wire concretely.
3. **Type consistency** — `HeroCTA.color` is `"amber" | "blue"` across hero-cta.ts and HubScaffold. `Claim` discriminated union is consistent (queue.ts → PendingClaims → actions.ts). `TierKey` is reused. `ClaimQueueState` matches in queue.ts + sources.ts.

---

## Execution handoff

After this plan is approved, the engineer can execute it via either:

- **Subagent-Driven Development** (recommended): fresh subagent per task with two-stage review between tasks. Use `superpowers:subagent-driven-development`.
- **Inline Execution**: batched execution with checkpoint reviews. Use `superpowers:executing-plans`.

**Estimated effort:** ~28 tasks × ~30 min average = 14h of focused work, distributed across ~30+ atomic commits over 2-3 calendar days for one engineer working full-time with TDD discipline.
