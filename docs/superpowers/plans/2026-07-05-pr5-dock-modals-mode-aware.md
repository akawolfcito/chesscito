# PR5 — Dock/Modals Mode-Aware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<PersistentDock>` and its five destination sheets (Badges/Shop/Arena-center/Trophies/Leaders) render mode-correct content for Learn vs Play vs Full, without touching entitlements, payments, treasury, or routing.

**Architecture:** `persistent-dock.tsx` gains a Play branch (center permanently pinned to Arena, leaderboard fallback never targets `/exercises`) alongside its existing Learn branch. The two host pages (`/arena`, `/exercises`) each swap in mode-correct sheet components for the same dock slugs — reusing `computeAchievements` (already Victory-NFT-derived), the existing `TrophiesSheet` (already mode-branches Learn vs non-Learn internally), the existing training `LeaderboardSheet` (Learn, unchanged), and two new components (`PlayBadgesSheet`, `PlayLeadersSheet`) plus a thin `LearnShopSheet` wrapper around the already-Learn-gated `SeasonPassSheet`. A pre-existing module-level `/api/leaderboard` prefetch bug gets fixed as part of the performance requirements.

## Global Constraints

- Do NOT touch: PRO/Season-Pass entitlement rules, `/api/verify-pro`, any payment route, Treasury/Get-Peones-Canary code, `mode-routing.ts`, `app-mode.ts`, `middleware.ts`, any landing URL.
- Do NOT touch Play Tactics storage or `localStorage`/`sessionStorage` keys used by Learn or Play Tactics.
- `CHESSCITO_LITE_MODE` (from `@/lib/feature-flags`) is the canonical Learn flag; `isPlayMode()` is the canonical Play flag. Both are build-time constants — safe to call anywhere, not React hooks.
- Every new/changed sheet must gate its data fetch on `open` — closed sheet fires zero network requests.
- Every dock slot must resolve to exactly one Radix `<Sheet>` open at a time (reuse the existing `activeDockTab`/`openSheet` single-state pattern — never introduce a second parallel boolean for the same slug).
- Commit messages end with `Wolfcito 🐾 @akawolfcito`. Run the full `pnpm --filter web test` suite before every commit and report the pass count in the commit message (per project CLAUDE.md).
- Command hygiene: never prefix Bash with `cd`; use `git -C <path>` / `pnpm -C <path>`; one command per Bash call; no heredocs/pipes; typecheck via `pnpm exec tsc --noEmit`.
- New `public/art/**` assets are NOT needed — reuse `/art/badge-menu` and `/art/leaderboard-menu` (already shipped, already used by the dock itself).

---

## Task 1: Fix the leaderboard module-level prefetch + gate fetch on `open`

**Files:**
- Modify: `apps/web/src/components/exercises/leaderboard-sheet.tsx:46-52,79,85,139-147`
- Test: `apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx` (create if none exists — check first)

**Interfaces:**
- No prop/type changes. `LeaderboardSheetProps` (`open`, `onOpenChange`, `showTrigger?`, `refreshTrigger?`) stays identical.

This is a real, standalone bug fix (independent of mode-awareness): `leaderboard-sheet.tsx` currently fires `fetch("/api/leaderboard")` at **module load time** (lines 46-52, `if (typeof window !== "undefined") { fetch(...) }`) — this runs the instant the module is imported, i.e. on every `/arena` or `/exercises` page load, whether or not the user ever opens the Leaders sheet. It ALSO fires a second unconditional fetch on component **mount** (lines 139-142, not gated by `open`), because the sheet is always mounted (hidden) as a sibling of the dock.

- [ ] **Step 1: Check for an existing test file**

Run: `find /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/exercises/__tests__ -iname "leaderboard-sheet*"`

If a file exists, read it fully before editing (Step 5 must not break its existing assertions). If none exists, Step 2's new test file is additive.

- [ ] **Step 2: Write the failing test** (new file if none existed, else add this block to the existing one)

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen, waitFor } from "@/test-utils/render-with-intl";
import { LeaderboardSheet } from "../leaderboard-sheet";

vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined }) }));

const originalFetch = global.fetch;

describe("LeaderboardSheet — no fetch while closed", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("does not call fetch when mounted closed", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} />);

    // Give any stray microtask a chance to fire, then assert it didn't.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches exactly once when opened", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<LeaderboardSheet open={true} onOpenChange={() => {}} showTrigger={false} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2b: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/exercises/__tests__/leaderboard-sheet.test.tsx`
Expected: FAIL — the "does not call fetch when mounted closed" case fails because the module-level + mount-effect fetches both fire regardless of `open`.

- [ ] **Step 3: Remove the module-level prefetch**

In `leaderboard-sheet.tsx`, delete lines 46-52:

```ts
let prefetchedRows: LeaderboardRow[] | null = null;
if (typeof window !== "undefined") {
  fetch("/api/leaderboard")
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { if (Array.isArray(data)) prefetchedRows = data; })
    .catch(() => {});
}
```

- [ ] **Step 4: Update the two references to `prefetchedRows`**

Change line 79:
```ts
const [rows, setRows] = useState<LeaderboardRow[]>(prefetchedRows ?? []);
```
to:
```ts
const [rows, setRows] = useState<LeaderboardRow[]>([]);
```

Change line 85:
```ts
const hasFetched = useRef(prefetchedRows !== null);
```
to:
```ts
const hasFetched = useRef(false);
```

- [ ] **Step 5: Merge the two mount/open effects into one, gated on `open`**

Replace lines 139-147:
```ts
useEffect(() => {
  fetchLeaderboard();
  hasFetched.current = true;
}, [fetchLeaderboard]);

useEffect(() => {
  if (!open || !hasFetched.current) return;
  fetchLeaderboard(false);
}, [open, fetchLeaderboard, refreshTrigger]);
```
with:
```ts
useEffect(() => {
  if (!open) return;
  fetchLeaderboard(!hasFetched.current);
  hasFetched.current = true;
}, [open, fetchLeaderboard, refreshTrigger]);
```

This preserves existing UX: first open shows the loading skeleton (`showLoading=true`), subsequent reopens/`refreshTrigger` bumps refetch silently (`showLoading=false`), and a closed sheet fires nothing.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/exercises/__tests__/leaderboard-sheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full existing test suite once to confirm no regression**

Run: `pnpm --filter web exec vitest run src/components/exercises/__tests__/leaderboard-sheet.test.tsx src/app/\[locale\]/arena` (adjust glob to whatever arena/exercises test files exist — find them first with `find ... -iname "*leaderboard*" -o -iname "*arena*page*"`).

- [ ] **Step 8: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/exercises/leaderboard-sheet.tsx apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
perf(leaderboard): remove module-level prefetch, gate fetch on sheet open

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: Add PLAY_BADGES_COPY / PLAY_LEADERS_COPY copy

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts` (append near `ACHIEVEMENTS_COPY`)
- Modify: `apps/web/src/lib/content/messages/es.ts` (append namespace overrides)
- Verify (no edit expected): `apps/web/src/lib/content/messages/en.ts` auto-derives from editorial.ts

**Interfaces:**
- Produces: `t("pageTitle")`, `t("pageDescription")`, `t("closeSheetLabel")` under both new namespaces; `t("emptyMessage")`, `t("loadError")`, `t("retry")` additionally under `PLAY_LEADERS_COPY`. Consumed by Task 3/4's `useTranslations("PLAY_BADGES_COPY")` / `useTranslations("PLAY_LEADERS_COPY")`.

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "^export const ACHIEVEMENTS_COPY" /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/lib/content/editorial.ts`

- [ ] **Step 2: Add the two EN namespaces to `editorial.ts`** (insert directly after the `ACHIEVEMENTS_COPY` export closes)

```ts
export const PLAY_BADGES_COPY = {
  pageTitle: "Arena Badges",
  pageDescription: "Achievements earned from your ranked victories.",
  closeSheetLabel: "Close badges",
} as const;

export const PLAY_LEADERS_COPY = {
  pageTitle: "Hall of Fame",
  pageDescription: "Top players by minted victories.",
  closeSheetLabel: "Close leaders",
  emptyMessage: "No victories minted yet. Be the first champion.",
  loadError: "Couldn't load the Hall of Fame. Try again.",
  retry: "Retry",
} as const;
```

- [ ] **Step 3: Verify `messages/en.ts` picks it up with no manual edit**

Run: `pnpm --filter web exec tsc --noEmit`

`messages/en.ts` does `import * as editorial from "../editorial"` and spreads it — no function values in these two consts, so no ICU mirror is needed. If typecheck fails referencing these namespaces, re-check the export syntax matches the `as const` pattern used by neighboring exports.

- [ ] **Step 4: Add the ES overrides to `messages/es.ts`**

Find the object literal that spreads `...en` and add two new keys (mirror the existing style — copy a full namespace block for consistency):

```ts
PLAY_BADGES_COPY: {
  pageTitle: "Insignias de Arena",
  pageDescription: "Logros ganados con tus victorias clasificatorias.",
  closeSheetLabel: "Cerrar insignias",
},
PLAY_LEADERS_COPY: {
  pageTitle: "Salón de la Fama",
  pageDescription: "Mejores jugadores por victorias acuñadas.",
  closeSheetLabel: "Cerrar líderes",
  emptyMessage: "Aún no hay victorias acuñadas. Sé el primer campeón.",
  loadError: "No se pudo cargar el Salón de la Fama. Intenta de nuevo.",
  retry: "Reintentar",
},
```

- [ ] **Step 5: Run the content audit (warn-only, non-blocking)**

Run: `pnpm --filter web content:audit` (if the script exists — check `apps/web/package.json` scripts first; skip this step if it doesn't exist)

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(content): add PLAY_BADGES_COPY and PLAY_LEADERS_COPY (EN+ES)

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: Create `PlayBadgesSheet`

**Files:**
- Create: `apps/web/src/components/play/play-badges-sheet.tsx`
- Test: `apps/web/src/components/play/__tests__/play-badges-sheet.test.tsx`

**Interfaces:**
- Consumes: `computeAchievements(victories)` from `@/lib/achievements/compute` (existing, derives the 7 competitive achievements — `first-victory`, `solid-player`, `arena-champion`, `speedrunner`, `rapid-finish`, `five-crowns`, `dedication` — purely from `VictoryEntry[]`, NEVER piece badges). `TrophiesDataProvider`/`useTrophiesData` from `@/components/trophies/trophies-data-provider` (existing, fetches `/api/my-victories`, gated internally on `isConnected && address`). `AchievementsGrid` from `@/components/trophies/achievements-grid` (existing).
- Produces: `PlayBadgesSheet({ open, onOpenChange })` — same `open`/`onOpenChange` contract as every other dock sheet.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { PlayBadgesSheet } from "../play-badges-sheet";

vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined, isConnected: false }) }));

describe("PlayBadgesSheet", () => {
  it("renders competitive achievement tiles, not piece badges, when open", () => {
    render(<PlayBadgesSheet open={true} onOpenChange={() => {}} />);
    // Locked-state achievements grid renders even disconnected (all locked).
    expect(screen.queryByText(/rook|bishop|knight|pawn|queen|king/i)).not.toBeInTheDocument();
  });

  it("does not mount the data provider (no fetch trigger) when closed", () => {
    const { container } = render(<PlayBadgesSheet open={false} onOpenChange={() => {}} />);
    expect(container.querySelector(".achievement-tile-grid")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/play/__tests__/play-badges-sheet.test.tsx`
Expected: FAIL — module `../play-badges-sheet` does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { useTranslations } from "next-intl";

import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { TrophiesDataProvider, useTrophiesData } from "@/components/trophies/trophies-data-provider";
import { computeAchievements } from "@/lib/achievements/compute";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type PlayBadgesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PlayBadgesBody() {
  const { victories } = useTrophiesData();
  const summary = computeAchievements(victories);
  return <AchievementsGrid achievements={summary.list} />;
}

/**
 * PlayBadgesSheet — Play mode's dock "badge" destination. Renders the 7
 * competitive achievements derived from Victory NFTs (`computeAchievements`),
 * the same derivation TrophiesBody already uses for non-Learn achievements.
 * Never renders Learn's piece badges (`BadgeSheet`).
 */
export function PlayBadgesSheet({ open, onOpenChange }: PlayBadgesSheetProps) {
  const t = useTranslations("PLAY_BADGES_COPY");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("pageTitle")}
        description={t("pageDescription")}
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/badge-menu" />}
            title={t("pageTitle")}
            subtitle={t("pageDescription")}
            close={{ onClick: () => onOpenChange(false), label: t("closeSheetLabel") }}
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-6">
          {open ? (
            <TrophiesDataProvider>
              <PlayBadgesBody />
            </TrophiesDataProvider>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/play/__tests__/play-badges-sheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/play/play-badges-sheet.tsx apps/web/src/components/play/__tests__/play-badges-sheet.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(play): add PlayBadgesSheet (competitive achievements from Victory NFTs)

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: Create `PlayLeadersSheet`

**Files:**
- Create: `apps/web/src/components/play/play-leaders-sheet.tsx`
- Test: `apps/web/src/components/play/__tests__/play-leaders-sheet.test.tsx`

**Interfaces:**
- Consumes: `TrophyList` from `@/components/trophies/trophy-list` (existing, `variant="hall-of-fame"`). `ApiVictoryRow`, `toVictoryEntry`, `getOptimisticVictory`, `clearOptimisticVictory` from `@/components/trophies/trophies-data-provider` (existing, already-exported generic utilities — do NOT modify that file). `getVictoryAddress`, `VictoryEntry` from `@/lib/game/victory-events`. Fetches `/api/hall-of-fame` (existing route, global cross-player victories, no auth/wallet needed).
- Produces: `PlayLeadersSheet({ open, onOpenChange })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithIntl as render, screen, waitFor } from "@/test-utils/render-with-intl";
import { PlayLeadersSheet } from "../play-leaders-sheet";

const originalFetch = global.fetch;

describe("PlayLeadersSheet", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("does not fetch when closed", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<PlayLeadersSheet open={false} onOpenChange={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches /api/hall-of-fame when opened", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<PlayLeadersSheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("/api/hall-of-fame"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/play/__tests__/play-leaders-sheet.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { TrophyList } from "@/components/trophies/trophy-list";
import {
  clearOptimisticVictory,
  getOptimisticVictory,
  toVictoryEntry,
  type ApiVictoryRow,
} from "@/components/trophies/trophies-data-provider";
import { getVictoryAddress } from "@/lib/game/victory-events";
import type { VictoryEntry } from "@/lib/game/victory-events";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type PlayLeadersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PlayLeadersBody() {
  const t = useTranslations("PLAY_LEADERS_COPY");
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = getVictoryAddress() !== null;

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hall-of-fame");
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        const found = entries.some(
          (e) => e.player.toLowerCase() === optimistic.player.toLowerCase(),
        );
        if (found) clearOptimisticVictory();
        else entries.unshift(toVictoryEntry(optimistic));
      }
      setHallOfFame(entries);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [configured, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TrophyList
      victories={hallOfFame}
      loading={loading}
      error={error}
      emptyMessage={t("emptyMessage")}
      variant="hall-of-fame"
      onRetry={() => void load()}
    />
  );
}

/**
 * PlayLeadersSheet — Play mode's dock "leaderboard" destination. Shows the
 * global Arena Hall of Fame (minted victories across all players, via the
 * existing `/api/hall-of-fame` route). No ELO, no durable ranking — victory
 * count only, matching the MVP scope. Never Learn's training leaderboard.
 */
export function PlayLeadersSheet({ open, onOpenChange }: PlayLeadersSheetProps) {
  const t = useTranslations("PLAY_LEADERS_COPY");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("pageTitle")}
        description={t("pageDescription")}
        className="mission-shell sheet-bg-leaderboard flex h-[100dvh] flex-col rounded-none border-0 pb-0"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/leaderboard-menu" />}
            title={t("pageTitle")}
            subtitle={t("pageDescription")}
            close={{ onClick: () => onOpenChange(false), label: t("closeSheetLabel") }}
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-6 space-y-6">
          {open ? <PlayLeadersBody /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/play/__tests__/play-leaders-sheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/play/play-leaders-sheet.tsx apps/web/src/components/play/__tests__/play-leaders-sheet.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(play): add PlayLeadersSheet (Arena Hall of Fame, no ELO)

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: Create `LearnShopSheet`

**Files:**
- Create: `apps/web/src/components/learn/learn-shop-sheet.tsx`
- Test: `apps/web/src/components/learn/__tests__/learn-shop-sheet.test.tsx`

**Interfaces:**
- Consumes: `SeasonPassSheet`, `SeasonPassSheetProps` from `@/components/payments/season-pass-sheet` (existing, already self-gates `if (!CHESSCITO_LITE_MODE) return null` — untouched).
- Produces: `LearnShopSheet(props: SeasonPassSheetProps)` — a structural boundary so Learn's dock never imports the Full/Play `ShopSheet` (PRO, Founder Badge, Streak Shields).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LearnShopSheet } from "../learn-shop-sheet";

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/payments/use-get-peones-token-selection", () => ({
  useStablecoinTokenSelection: () => ({
    selectedSymbol: "USDC",
    selected: null,
    tokens: [],
    noPayableToken: true,
    setSelectedSymbol: () => {},
  }),
}));
vi.mock("@/lib/season-pass/use-season-pass-rail", () => ({
  useSeasonPassRail: () => ({ phase: "idle", available: true, pay: () => {} }),
  mapSeasonPassError: () => "",
}));

describe("LearnShopSheet", () => {
  it("renders the Season Pass content when open", () => {
    render(<LearnShopSheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByTestId("season-pass-sheet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/learn/__tests__/learn-shop-sheet.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { SeasonPassSheet, type SeasonPassSheetProps } from "@/components/payments/season-pass-sheet";

/**
 * LearnShopSheet — Learn mode's dock "shop" destination. Thin wrapper so
 * Learn's dock imports this, never the Full/Play `ShopSheet`. All Season
 * Pass logic lives in `SeasonPassSheet`, which already self-gates to
 * Learn mode only.
 */
export function LearnShopSheet(props: SeasonPassSheetProps) {
  return <SeasonPassSheet {...props} />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/components/learn/__tests__/learn-shop-sheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/learn/learn-shop-sheet.tsx apps/web/src/components/learn/__tests__/learn-shop-sheet.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(learn): add LearnShopSheet wrapper around Season Pass

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: Make `persistent-dock.tsx` mode-aware (center pin, side items, fallback routes)

**Files:**
- Modify: `apps/web/src/components/exercises/persistent-dock.tsx`

**Interfaces:**
- Consumes: `isPlayMode` (new import) alongside existing `CHESSCITO_LITE_MODE` from `@/lib/feature-flags`.
- Produces: same public `PersistentDock()` export and `DockSlot` type — no signature change, only internal branching.

- [ ] **Step 1: Update the import**

Change:
```ts
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
```
to:
```ts
import { CHESSCITO_LITE_MODE, isPlayMode } from "@/lib/feature-flags";
```

- [ ] **Step 2: Make `SIDE_LEFT` unconditional (Learn now gets Shop too)**

Replace:
```ts
const SIDE_LEFT: ReadonlyArray<Item> = CHESSCITO_LITE_MODE
  ? [{ id: "badge", labelKey: "badge", icon: "shield", iconSrc: "/art/badge-menu", sheet: "badges", fallback: "/?sheet=badges" }]
  : [
      { id: "badge", labelKey: "badge", icon: "shield", iconSrc: "/art/badge-menu", sheet: "badges", fallback: "/?sheet=badges" },
      { id: "shop", labelKey: "shop", icon: "shop", iconSrc: "/art/shop-menu", sheet: "shop", fallback: "/?sheet=shop" },
    ];
```
with:
```ts
const SIDE_LEFT: ReadonlyArray<Item> = [
  { id: "badge", labelKey: "badge", icon: "shield", iconSrc: "/art/badge-menu", sheet: "badges", fallback: "/?sheet=badges" },
  { id: "shop", labelKey: "shop", icon: "shop", iconSrc: "/art/shop-menu", sheet: "shop", fallback: "/?sheet=shop" },
];
```

- [ ] **Step 3: Make `SIDE_RIGHT`'s leaderboard fallback mode-aware**

Replace:
```ts
const SIDE_RIGHT: ReadonlyArray<Item> = [
  { id: "trophies", labelKey: "trophies", icon: "trophy", iconSrc: "/art/action-row/trofeo-epico", sheet: "trophies", fallback: "/trophies", activeWhen: "/trophies" },
  { id: "leaderboard", labelKey: "leaderboard", icon: "star", iconSrc: "/art/leaderboard-menu", sheet: "leaderboard", fallback: "/exercises?sheet=leaderboard" },
];
```
with:
```ts
const SIDE_RIGHT: ReadonlyArray<Item> = [
  { id: "trophies", labelKey: "trophies", icon: "trophy", iconSrc: "/art/action-row/trofeo-epico", sheet: "trophies", fallback: "/trophies", activeWhen: "/trophies" },
  {
    id: "leaderboard",
    labelKey: "leaderboard",
    icon: "star",
    iconSrc: "/art/leaderboard-menu",
    sheet: "leaderboard",
    // Play never has a reachable /exercises (PR2 redirects it to Learn) —
    // its cross-route fallback must land on /arena instead.
    fallback: isPlayMode() ? "/arena?sheet=leaderboard" : "/exercises?sheet=leaderboard",
  },
];
```

- [ ] **Step 4: Pin `resolveCenter`/`resolveBase` to Arena for Play**

Replace:
```ts
function resolveCenter(pathname: string): ModeDescriptor {
  if (CHESSCITO_LITE_MODE) return MODE_DESCRIPTORS.exercises;
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.exercises : MODE_DESCRIPTORS.arena;
}
```
with:
```ts
function resolveCenter(pathname: string): ModeDescriptor {
  if (isPlayMode()) return MODE_DESCRIPTORS.arena;
  if (CHESSCITO_LITE_MODE) return MODE_DESCRIPTORS.exercises;
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.exercises : MODE_DESCRIPTORS.arena;
}
```

Replace:
```ts
function resolveBase(pathname: string): ModeDescriptor {
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.arena : MODE_DESCRIPTORS.exercises;
}
```
with:
```ts
function resolveBase(pathname: string): ModeDescriptor {
  if (isPlayMode()) return MODE_DESCRIPTORS.arena;
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.arena : MODE_DESCRIPTORS.exercises;
}
```

- [ ] **Step 5: Update `isCenterActive` to glow for Play on `/arena`**

Inside `PersistentDock()`, replace:
```ts
const isCenterActive = CHESSCITO_LITE_MODE && pathname.startsWith("/exercises");
```
with:
```ts
const isCenterActive =
  (CHESSCITO_LITE_MODE && pathname.startsWith("/exercises")) ||
  (isPlayMode() && pathname.startsWith("/arena"));
```

- [ ] **Step 6: Guard the center button's onClick against a self-navigate reset in Play**

Play's center is pinned to Arena even while the user IS on `/arena`. Without a guard, tapping it there (no overlay open) would `router.push("/arena?fresh=1")`, which the arena page's `freshResetRef` effect treats as an explicit "reset to selector" — interrupting an in-progress match. Replace the center button's `onClick`:

```tsx
onClick={() => {
  if (isOverlayOpen) {
    track("dock_center_close", { sheet: openSheet });
    requestCloseDockSheet();
    return;
  }
  track("dock_tap", { item: center.trackItem });
  router.push(center.href);
}}
```
with:
```tsx
onClick={() => {
  if (isOverlayOpen) {
    track("dock_center_close", { sheet: openSheet });
    requestCloseDockSheet();
    return;
  }
  // Play's center is permanently pinned to Arena — tapping it while
  // already on /arena has no "other side" to swap to and must not
  // fire a fresh-entry reset that would interrupt an active match.
  if (isPlayMode() && pathname.startsWith("/arena")) return;
  track("dock_tap", { item: center.trackItem });
  router.push(center.href);
}}
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 8: Commit** (defer full test run to Task 7, which adds the coverage for these branches)

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/exercises/persistent-dock.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(dock): mode-aware center pin + side items for Play, Shop added to Learn

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: Extend `persistent-dock.test.tsx` with Learn + Play coverage

**Files:**
- Modify: `apps/web/src/components/exercises/__tests__/persistent-dock.test.tsx` (append new `describe` blocks at the end — do not touch the existing ones)

**Interfaces:**
- Consumes: `vi.doMock`/`vi.resetModules` (Vitest) to re-import `../persistent-dock` under a different `@/lib/feature-flags` mock per block, without disturbing the file's existing static `import { PersistentDock } from "../persistent-dock"` used by the pre-existing Full-mode describe blocks.

The existing file's describe blocks run under the real (unmocked) `@/lib/feature-flags` module, which resolves to `"full"` mode by default in the test environment (no `NEXT_PUBLIC_CHESSCITO_MODE` env var set) — this is unchanged by Task 6, so those assertions must still pass as-is. Verify this first.

- [ ] **Step 1: Run the existing suite to confirm Full-mode assertions still pass after Task 6**

Run: `pnpm --filter web exec vitest run src/components/exercises/__tests__/persistent-dock.test.tsx`
Expected: PASS (all pre-existing tests green, unmodified).

- [ ] **Step 2: Append the Learn-mode and Play-mode describe blocks**

Add at the end of the file (after the last existing `describe` block, before EOF):

```tsx
describe("PersistentDock — Learn mode (Shop added, points at Season Pass)", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/feature-flags");
    vi.resetModules();
  });

  it("shows Shop alongside Badges on the left side", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: true,
      isPlayMode: () => false,
    }));
    pathnameMock.mockReturnValue("/exercises");
    const { PersistentDock: LearnDock } = await import("../persistent-dock");

    render(<LearnDock />);

    expect(screen.getByRole("button", { name: /badges/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shop/i })).toBeInTheDocument();
  });
});

describe("PersistentDock — Play mode (Arena pinned, no Pieces, no /exercises)", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/feature-flags");
    vi.resetModules();
  });

  it("center is Arena on /arena and never swaps to Pieces", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/arena");
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);

    expect(screen.getByRole("button", { name: /^arena$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pieces/i })).not.toBeInTheDocument();
  });

  it("center is still Arena from the root route (never swaps to Pieces)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/");
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);

    expect(screen.getByRole("button", { name: /^arena$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pieces/i })).not.toBeInTheDocument();
  });

  it("tapping the pinned Arena center while already on /arena does not navigate", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/arena");
    pushMock.mockReset();
    const user = userEvent.setup();
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);
    await user.click(screen.getByRole("button", { name: /^arena$/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("leaderboard fallback never points at /exercises", async () => {
    vi.resetModules();
    vi.doMock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
      isPlayMode: () => true,
    }));
    pathnameMock.mockReturnValue("/hub");
    pushMock.mockReset();
    const user = userEvent.setup();
    const { PersistentDock: PlayDock } = await import("../persistent-dock");

    render(<PlayDock />);
    await user.click(screen.getByRole("button", { name: /leaders/i }));

    expect(pushMock).toHaveBeenLastCalledWith("/arena?sheet=leaderboard");
  });
});
```

- [ ] **Step 3: Run the full file**

Run: `pnpm --filter web exec vitest run src/components/exercises/__tests__/persistent-dock.test.tsx`
Expected: PASS — all pre-existing + new blocks green.

If the dynamic `vi.doMock` + `vi.resetModules()` + `await import` pattern doesn't pick up the mock (stale cached module), try adding an explicit `vi.unmock` / re-registering `vi.mock("next/navigation", ...)` inside `vi.resetModules()`'s scope, since `resetModules()` clears the registry but hoisted `vi.mock` factories at file top remain registered — this should already work, but verify empirically and adjust if the harness behaves differently.

- [ ] **Step 4: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/exercises/__tests__/persistent-dock.test.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
test(dock): cover Learn Shop addition + Play Arena-pin behavior

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: Wire Learn's Shop in `exercises-screen.tsx` (Season Pass via dock)

**Files:**
- Modify: `apps/web/src/components/exercises/exercises-screen.tsx:121,754,797,2023,3129-3151,3022-3027`

**Interfaces:**
- Consumes: `LearnShopSheet` (new, Task 5) instead of the direct `SeasonPassSheet` import.
- Removes: the standalone `seasonPassSheetOpen`/`setSeasonPassSheetOpen` state — consolidated onto the existing `activeDockTab === "shop"` / `storeOpen` / `setStoreOpen` mechanism so only one Season-Pass-driven Sheet can ever be mounted (no stacked Radix dialogs).

- [ ] **Step 1: Read the current insufficient-Peones recovery block for exact context**

Run: `grep -n "seasonPassSheetOpen\|insufficient_peones" /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/exercises/exercises-screen.tsx > /tmp/grep-out.txt` then Read `/tmp/grep-out.txt` to confirm line numbers haven't drifted from this plan (the file may have moved lines slightly since this was written).

- [ ] **Step 2: Write/extend the test**

Check `apps/web/src/components/exercises/__tests__/exercises-screen*.test.tsx` (or wherever its tests live) for any existing assertion referencing `ShopSheet`, `seasonPassSheetOpen`, or "Get Season Pass" in Lite mode — read that file first. Add or update:

```tsx
it("Learn mode: dock Shop tap opens the Season Pass sheet (LearnShopSheet), not the full ShopSheet", async () => {
  // ... render with CHESSCITO_LITE_MODE mocked true, open the dock's Shop slot,
  // assert screen.getByTestId("season-pass-sheet") is present and that no
  // PRO/Founder Badge copy from the full ShopSheet renders.
});
```

(Write this against the file's existing render/mock setup conventions — read the file first, this plan cannot predict its exact harness without re-reading a 3000+ line file's test counterpart at execution time.)

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run <path-to-exercises-screen-test>`

- [ ] **Step 4: Remove the `!CHESSCITO_LITE_MODE` guard on the shop deep-link**

Find (inside the `deepLinkConsumedRef` effect):
```ts
if (slug === "shop" && !CHESSCITO_LITE_MODE) setActiveDockTab("shop");
```
Replace with:
```ts
if (slug === "shop") setActiveDockTab("shop");
```

- [ ] **Step 5: Swap the Shop mount to branch on mode**

Find:
```tsx
{!CHESSCITO_LITE_MODE && <ShopSheet
  open={storeOpen}
  onOpenChange={setStoreOpen}
  items={displayShopCatalog}
  onSelectItem={(itemId) => {
    if (itemId === PRO_ITEM_ID) {
      setStoreOpen(false);
      proSheet.openSheet();
      return;
    }
    setSelectedItemId(itemId);
    const item = shopCatalog.find((i) => i.itemId === itemId);
    if (item) setPaymentToken(selectPaymentToken(item.onChainPrice, itemId));
    setStoreOpen(false);
    setConfirmOpen(true);
  }}
  showTrigger={false}
  welcomePack={welcomePack}
/>}
```
Replace with:
```tsx
{CHESSCITO_LITE_MODE ? (
  <LearnShopSheet open={storeOpen} onOpenChange={setStoreOpen} />
) : (
  <ShopSheet
    open={storeOpen}
    onOpenChange={setStoreOpen}
    items={displayShopCatalog}
    onSelectItem={(itemId) => {
      if (itemId === PRO_ITEM_ID) {
        setStoreOpen(false);
        proSheet.openSheet();
        return;
      }
      setSelectedItemId(itemId);
      const item = shopCatalog.find((i) => i.itemId === itemId);
      if (item) setPaymentToken(selectPaymentToken(item.onChainPrice, itemId));
      setStoreOpen(false);
      setConfirmOpen(true);
    }}
    showTrigger={false}
    welcomePack={welcomePack}
  />
)}
```

- [ ] **Step 6: Remove the now-redundant standalone `seasonPassSheetOpen` state + mount**

Delete the state declaration:
```ts
const [seasonPassSheetOpen, setSeasonPassSheetOpen] = useState(false);
```

Delete the standalone mount:
```tsx
{seasonPassSheetOpen ? (
  <SeasonPassSheet
    open={seasonPassSheetOpen}
    onOpenChange={setSeasonPassSheetOpen}
  />
) : null}
```

- [ ] **Step 7: Redirect the recovery CTA to the dock's Shop slot instead**

Find (inside the `insufficient_peones` result-overlay recovery branch):
```ts
if (CHESSCITO_LITE_MODE) {
  setSeasonPassSheetOpen(true);
} else {
  setGetPeonesOpen(true);
}
```
Replace with:
```ts
if (CHESSCITO_LITE_MODE) {
  setActiveDockTab("shop");
} else {
  setGetPeonesOpen(true);
}
```

(`setResultOverlay(null)` already runs in the same handler right before this — both setState calls batch together, so the result overlay closing and the Shop sheet opening happen in the same render pass, no race.)

- [ ] **Step 8: Update imports**

Remove the now-unused direct import:
```ts
import { SeasonPassSheet } from "@/components/payments/season-pass-sheet";
```
Add:
```ts
import { LearnShopSheet } from "@/components/learn/learn-shop-sheet";
```

- [ ] **Step 9: Typecheck + run the test**

Run: `pnpm --filter web exec tsc --noEmit`
Run: `pnpm --filter web exec vitest run <path-to-exercises-screen-test>`
Expected: PASS.

- [ ] **Step 10: Run the full web test suite once (this file is large and central — verify no other suite broke)**

Run: `pnpm --filter web test`

- [ ] **Step 11: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/components/exercises/exercises-screen.tsx apps/web/src/components/exercises/__tests__/
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(learn): wire dock Shop to LearnShopSheet, consolidate Season Pass state

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 9: Wire Play's Badges/Leaders in `arena/page.tsx` (effects)

**Files:**
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (opener/closer/deep-link effects only — JSX swap is Task 10)

**Interfaces:**
- Consumes: `isPlayMode` from `@/lib/feature-flags` (new import).
- Play mode skips `badgeSheet.openSheet()`/`badgeSheet.closeSheet()` calls (the on-chain piece-claim hook is irrelevant to `PlayBadgesSheet`, which reads Victory NFTs instead) — `activeDockTab` alone drives `PlayBadgesSheet`'s open state.

- [ ] **Step 1: Add the import**

```ts
import { isPlayMode } from "@/lib/feature-flags";
```

- [ ] **Step 2: Guard `badgeSheet.openSheet()` in the dock opener effect**

Find:
```ts
const unregisterOpener = registerDockSheetOpener((slug) => {
  badgeSheet.closeSheet();
  shopSheet.closeSheet();
  if (slug === "shop") {
    setActiveDockTab("shop");
    shopSheet.openSheet();
  } else if (slug === "badge") {
    setActiveDockTab("badge");
    badgeSheet.openSheet();
  } else if (slug === "trophies" || slug === "leaderboard") {
    setActiveDockTab(slug);
  }
});
```
Replace with:
```ts
const unregisterOpener = registerDockSheetOpener((slug) => {
  badgeSheet.closeSheet();
  shopSheet.closeSheet();
  if (slug === "shop") {
    setActiveDockTab("shop");
    shopSheet.openSheet();
  } else if (slug === "badge") {
    setActiveDockTab("badge");
    if (!isPlayMode()) badgeSheet.openSheet();
  } else if (slug === "trophies" || slug === "leaderboard") {
    setActiveDockTab(slug);
  }
});
```

- [ ] **Step 3: Guard the closer effect's badge branch**

Find:
```ts
const unregisterCloser = registerDockSheetCloser(() => {
  if (activeDockTab === "shop") handleShopSheetOpenChange(false);
  else if (activeDockTab === "badge") handleBadgeSheetOpenChange(false);
  else setActiveDockTab(null);
  if (proSheet.open) proSheet.closeSheet();
});
```
Replace with:
```ts
const unregisterCloser = registerDockSheetCloser(() => {
  if (activeDockTab === "shop") handleShopSheetOpenChange(false);
  else if (activeDockTab === "badge") {
    if (isPlayMode()) setActiveDockTab(null);
    else handleBadgeSheetOpenChange(false);
  }
  else setActiveDockTab(null);
  if (proSheet.open) proSheet.closeSheet();
});
```

- [ ] **Step 4: Guard the `?sheet=badges` deep-link effect**

Find:
```ts
} else if (sheet === "badges") {
  setActiveDockTab("badge");
  badgeSheet.openSheet();
}
```
Replace with:
```ts
} else if (sheet === "badges") {
  setActiveDockTab("badge");
  if (!isPlayMode()) badgeSheet.openSheet();
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/app/\[locale\]/arena/page.tsx
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(play): skip piece-badge claim wiring for the badge dock slug in Play mode

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 10: Wire Play's Badges/Leaders in `arena/page.tsx` (JSX swap)

**Files:**
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (both duplicated dock+sheets JSX blocks — scaffold variant ~line 1084-1110, legacy variant ~line 1159-1186)
- Test: `apps/web/src/app/[locale]/arena/__tests__/*.test.tsx` (find and extend the existing arena page test(s))

**Interfaces:**
- Produces: `<PlayBadgesSheet>`/`<PlayLeadersSheet>` mounted in place of `<BadgeSheet>`/`<LeaderboardSheet>` when `isPlayMode()`, in BOTH JSX blocks (the file already duplicates this dock+sheets block twice for the `?arena=legacy` opt-out — both copies must swap identically).

- [ ] **Step 1: Add imports**

```ts
import { PlayBadgesSheet } from "@/components/play/play-badges-sheet";
import { PlayLeadersSheet } from "@/components/play/play-leaders-sheet";
```

- [ ] **Step 2: Write/extend the failing test**

Locate the arena page test file(s) first:
```
find /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app -path "*arena*__tests__*"
```
Read whatever exists, then add (adapting to its existing mock/render conventions — it will already mock `wagmi`, `next/navigation`, `useChessGame`, etc.):

```tsx
describe("ArenaPage — Play mode dock destinations", () => {
  it("mounts PlayBadgesSheet and PlayLeadersSheet, not BadgeSheet/LeaderboardSheet", () => {
    // mock @/lib/feature-flags isPlayMode() => true for this describe block
    // render <ArenaPage/>, open the dock's badge slot, assert
    // PlayBadgesSheet content (no piece-badge copy) renders.
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run <arena-page-test-path>`

- [ ] **Step 4: Swap the scaffold-variant JSX block (~line 1084-1110)**

Find:
```tsx
<PersistentDock />
<BadgeSheet
  {...badgeSheet.sheetProps}
  onOpenChange={handleBadgeSheetOpenChange}
  showTrigger={false}
/>
<ShopSheet
  {...shopSheet.sheetProps}
  onOpenChange={handleShopSheetOpenChange}
  showTrigger={false}
/>
<TrophiesSheet
  open={activeDockTab === "trophies"}
  onOpenChange={setTrophiesOpen}
  showTrigger={false}
/>
<LeaderboardSheet
  open={activeDockTab === "leaderboard"}
  onOpenChange={setLeaderboardOpen}
  showTrigger={false}
/>
<PurchaseConfirmSheet {...shopSheet.confirmProps} />
<ProSheet {...proSheet.sheetProps} />
```
Replace with:
```tsx
<PersistentDock />
{isPlayMode() ? (
  <PlayBadgesSheet
    open={activeDockTab === "badge"}
    onOpenChange={(v) => setActiveDockTab(v ? "badge" : null)}
  />
) : (
  <BadgeSheet
    {...badgeSheet.sheetProps}
    onOpenChange={handleBadgeSheetOpenChange}
    showTrigger={false}
  />
)}
<ShopSheet
  {...shopSheet.sheetProps}
  onOpenChange={handleShopSheetOpenChange}
  showTrigger={false}
/>
<TrophiesSheet
  open={activeDockTab === "trophies"}
  onOpenChange={setTrophiesOpen}
  showTrigger={false}
/>
{isPlayMode() ? (
  <PlayLeadersSheet
    open={activeDockTab === "leaderboard"}
    onOpenChange={setLeaderboardOpen}
  />
) : (
  <LeaderboardSheet
    open={activeDockTab === "leaderboard"}
    onOpenChange={setLeaderboardOpen}
    showTrigger={false}
  />
)}
<PurchaseConfirmSheet {...shopSheet.confirmProps} />
<ProSheet {...proSheet.sheetProps} />
```

- [ ] **Step 5: Swap the legacy-variant JSX block (~line 1159-1186) — same substitution**

Find:
```tsx
<PersistentDock />
<BadgeSheet
  {...badgeSheet.sheetProps}
  onOpenChange={handleBadgeSheetOpenChange}
  showTrigger={false}
/>
<ShopSheet
  {...shopSheet.sheetProps}
  onOpenChange={handleShopSheetOpenChange}
  showTrigger={false}
/>
<TrophiesSheet
  open={activeDockTab === "trophies"}
  onOpenChange={(v) => setActiveDockTab(v ? "trophies" : null)}
  showTrigger={false}
/>
<LeaderboardSheet
  open={activeDockTab === "leaderboard"}
  onOpenChange={(v) => setActiveDockTab(v ? "leaderboard" : null)}
  showTrigger={false}
/>
<PurchaseConfirmSheet {...shopSheet.confirmProps} />
<ProSheet {...proSheet.sheetProps} />
```
Replace with the same pattern as Step 4 (reusing this block's own `onOpenChange` inline-arrow style rather than `setTrophiesOpen`/`setLeaderboardOpen`, to match what's already there):
```tsx
<PersistentDock />
{isPlayMode() ? (
  <PlayBadgesSheet
    open={activeDockTab === "badge"}
    onOpenChange={(v) => setActiveDockTab(v ? "badge" : null)}
  />
) : (
  <BadgeSheet
    {...badgeSheet.sheetProps}
    onOpenChange={handleBadgeSheetOpenChange}
    showTrigger={false}
  />
)}
<ShopSheet
  {...shopSheet.sheetProps}
  onOpenChange={handleShopSheetOpenChange}
  showTrigger={false}
/>
<TrophiesSheet
  open={activeDockTab === "trophies"}
  onOpenChange={(v) => setActiveDockTab(v ? "trophies" : null)}
  showTrigger={false}
/>
{isPlayMode() ? (
  <PlayLeadersSheet
    open={activeDockTab === "leaderboard"}
    onOpenChange={(v) => setActiveDockTab(v ? "leaderboard" : null)}
  />
) : (
  <LeaderboardSheet
    open={activeDockTab === "leaderboard"}
    onOpenChange={(v) => setActiveDockTab(v ? "leaderboard" : null)}
    showTrigger={false}
  />
)}
<PurchaseConfirmSheet {...shopSheet.confirmProps} />
<ProSheet {...proSheet.sheetProps} />
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run <arena-page-test-path>`
Expected: PASS.

- [ ] **Step 8: Run the full web test suite**

Run: `pnpm --filter web test`

- [ ] **Step 9: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/app/\[locale\]/arena/page.tsx apps/web/src/app/\[locale\]/arena/__tests__/
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "$(cat <<'EOF'
feat(play): mount PlayBadgesSheet/PlayLeadersSheet on /arena in Play mode

Tests: N passed
Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 11: Full-branch verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm --filter web test`
Expected: all green. Report the pass count.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 3: Build**

Run: `pnpm --filter web build`
Confirm `.next/BUILD_ID` is written (per `feedback_next_build_pipe_tail_truncation` — do not pipe this command through `tail`).

- [ ] **Step 4: `git diff --check`**

Run: `git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito diff --check main`

- [ ] **Step 5: Trace the acceptance criteria against the diff, one by one**

Confirm each of the user's listed acceptance criteria against the actual committed diff (not just against this plan's intent):
- Dock exacto por modo — Task 6.
- Play center siempre Arena — Task 6 Steps 4-6, tested Task 7.
- Play no muestra Pieces — Task 6 Step 4, tested Task 7.
- Play no navega a /exercises — Task 6 Step 3, tested Task 7.
- Modal correcto por modo — Tasks 9-10 (arena), Task 8 (exercises).
- Play badges no usan badges de piezas — Task 3 (`computeAchievements`, never `badgesAbi`/piece IDs).
- Play trophies/leaders usan Victory NFTs — Task 4 (`/api/hall-of-fame`) + existing `TrophiesSheet` (unchanged, already Victory-NFT-based for non-Learn).
- Learn badges/trophies/leaders siguen funcionando — unchanged files (`badge-sheet.tsx`, `trophies-sheet.tsx`, `leaderboard-sheet.tsx` content untouched; only the shop addition is new).
- Sheet cerrada no dispara fetch — Task 1 (leaderboard), Task 3/4 (`{open ? <Provider> : null}` gating).
- No se apilan dialogs al cambiar sheets — all new sheets reuse the single `activeDockTab` state, never a parallel boolean.
- Full legacy no cambia — `BadgeSheet`/`ShopSheet`/`TrophiesSheet`/`LeaderboardSheet` untouched; Full's `SIDE_LEFT` was already 2 items (no visual change); Full's `resolveCenter`/`resolveBase` branches are the untouched `else` paths.
- TypeScript pasa — Steps 2 above.
- Tests relevantes pasan — Step 1 above.
- Build web pasa — Step 3 above.
- git diff --check pasa — Step 4 above.

- [ ] **Step 6: Report to the user**

Summarize: files touched, test pass count, confirmation PR6 (PRO/Season-Pass entitlement unification) was not started, and current git status (branch, ahead-of-main commit count, clean working tree apart from the unrelated pre-existing branding changes noted at the very start of this session).
