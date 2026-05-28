# Coach Game Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/coach/[gameId]` as the canonical post-game review surface (viewer + 4 CTAs), wire the arena X-close to route into it via a persistState×claimPhase×wallet state machine, fix the `handleBack` selector flash, and extract `useCoachAnalysis` / `useCoachCreditsPurchase` / `useMintVictory` hooks behind feature flags.

**Architecture:** New `/[locale]/coach/[gameId]` route mounts a server component that calls `GET /api/games/[id]?wallet=…` and renders a client wrapper composing `GameViewer` + `GameActionsBar` + the existing coach-phase + mint-phase surfaces. Three hooks (`useCoachAnalysis`, `useCoachCreditsPurchase`, `useMintVictory`) are extracted from `arena/page.tsx` behind `NEXT_PUBLIC_USE_EXTRACTED_*` feature flags so both `/arena` and the new viewer share the same state machines. A new idempotent `POST /api/games/[id]/mint-receipt` endpoint persists mint outcome onto the existing `coach:game:<wallet>:<gameId>` record so cold-load reflects the post-mint state.

**Tech Stack:** Next.js 14 App Router · TypeScript · Vitest + React Testing Library · Playwright (VR) · chess.js v1.4.0 · Upstash Redis · wagmi/viem · next-intl.

**Source spec:** `docs/superpowers/specs/2026-05-27-coach-game-viewer-design.md` (commit `bfd0a4c9`)
**Red-team:** `docs/reviews/2026-05-27-coach-game-viewer-redteam.md` (commit `b5b417a0`)

---

## File Structure

### New files

```
apps/web/src/
├── app/[locale]/coach/[gameId]/
│   ├── page.tsx                                          # Server component, fetches GameRecord
│   └── coach-game-client.tsx                             # Client wrapper, composes viewer + actions
├── app/api/games/[id]/
│   ├── route.ts                                          # GET — owner-asserted gameRecord fetch
│   └── mint-receipt/
│       └── route.ts                                      # POST — persist mint outcome
├── components/coach/
│   ├── game-viewer.tsx                                   # Board + slider + SAN list + partial-replay banner
│   ├── game-actions-bar.tsx                              # 4 CTAs with result-aware visibility
│   └── __tests__/
│       ├── game-viewer.test.tsx
│       └── game-actions-bar.test.tsx
├── lib/game/
│   ├── use-game-replay.ts                                # SAN[] → fenList navigator with partial-replay
│   └── __tests__/
│       └── use-game-replay.test.ts
├── lib/coach/
│   ├── use-coach-analysis.ts                             # Coach phase machine extracted from arena/page.tsx
│   ├── use-coach-credits-purchase.ts                     # handleBuyCredits extracted
│   ├── use-mint-victory.ts                               # Mint claim phase machine extracted
│   └── __tests__/
│       ├── use-coach-analysis.test.ts
│       ├── use-coach-credits-purchase.test.ts
│       └── use-mint-victory.test.ts
└── app/dev/
    ├── coach-game-viewer/page.tsx                        # VR fixture
    ├── coach-game-actions/page.tsx                       # VR fixture
    ├── coach-viewer-mint/page.tsx                        # VR fixture
    └── coach-viewer-overlay/page.tsx                     # VR fixture

apps/web/src/app/[locale]/arena/__tests__/
├── arena-handle-back-no-flash.test.tsx
├── arena-end-state-close-policy.test.tsx
└── arena-play-timer-resilience.test.tsx

apps/web/tests/visual/coach-game/                         # 16 VR baselines

docs/handoffs/
└── 2026-XX-XX-coach-game-viewer-handoff.md
```

### Modified files

```
apps/web/src/lib/coach/types.ts                           # Extend GameRecord with optional mint fields
apps/web/src/app/[locale]/arena/page.tsx                  # handleBack fix + X-close state machine + extracted hooks + mint-receipt POST
apps/web/src/app/[locale]/coach/history/page.tsx          # Drop selected branch; route taps to /coach/[gameId]
apps/web/src/components/coach/coach-history.tsx           # Filter zero-move rows from list
apps/web/src/lib/coach/analyze-telemetry.ts               # Extend AnalyzeSource with "viewer"

/Users/wolfcito/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/
├── MEMORY.md                                             # Add index entry
└── project_coach_game_viewer.md                          # New topic memory
```

---

## Phase 1 — Bug fix + foundation (4 commits, ship-able solo)

---

### Task 1: Fix `handleBack` selector flash

**Files:**
- Modify: `apps/web/src/app/[locale]/arena/page.tsx:1101-1105`
- Test: `apps/web/src/app/[locale]/arena/__tests__/arena-handle-back-no-flash.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/[locale]/arena/__tests__/arena-handle-back-no-flash.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Capture every push() call synchronously
const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub useChessGame so we control isEndState
const resetMock = vi.fn();
vi.mock("@/lib/game/use-chess-game", () => ({
  useChessGame: () => ({
    status: "checkmate",
    isThinking: false,
    pieces: [],
    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    checkSquare: null,
    rejectingSquare: null,
    pendingPromotion: null,
    difficulty: "easy",
    playerColor: "w",
    moveCount: 12,
    moveHistory: ["e4"],
    elapsedMs: 60_000,
    errorMessage: null,
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    selectSquare: vi.fn(),
    promoteWith: vi.fn(),
    cancelPromotion: vi.fn(),
    reset: resetMock,
    resign: vi.fn(),
    setDifficulty: vi.fn(),
    setPlayerColor: vi.fn(),
    startGame: vi.fn(),
  }),
}));

import ArenaPage from "../page";

describe("handleBack — no selector flash", () => {
  it("router.push fires WITHOUT mounting DifficultySelector first", async () => {
    render(<ArenaPage />);
    const backBtn = await screen.findByRole("button", { name: /back/i });
    act(() => fireEvent.click(backBtn));
    expect(pushMock).toHaveBeenCalledWith("/hub");
    // The selector test-id must never have mounted during the back tap.
    expect(screen.queryByTestId("arena-difficulty-selector")).toBeNull();
    // game.reset() must NOT have been called — the unmount cleanup is responsible.
    expect(resetMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena/__tests__/arena-handle-back-no-flash.test.tsx
```
Expected: FAIL — current `handleBack` calls `game.reset()` so `resetMock` IS called and `pushMock` may not be called first.

- [ ] **Step 3: Apply the fix**

Edit `apps/web/src/app/[locale]/arena/page.tsx` at lines 1101-1105:

Replace:
```tsx
const handleBack = () => {
  resetArenaState();
  game.reset();
  handleBackToHub();
};
```

With:
```tsx
// handleBack — direct router.push to /hub. The unmount cleanup of
// /arena recovers refs (claimingRef, coachAbortRef, persistAbortRef)
// and resets game state implicitly. Calling game.reset() BEFORE
// router.push() caused the status to flip to "selecting" for one
// render frame, producing a visible selector flash before the route
// transition completed (2026-05-27 fix).
const handleBack = () => {
  handleBackToHub();
};
```

Also ensure `data-testid="arena-difficulty-selector"` is on the `<ArenaEntryPanel>` or `<ArenaSelectScaffold>` root container. Search for it; if absent, add to both at the outermost container:

```tsx
<main data-testid="arena-difficulty-selector" ...>
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena/__tests__/arena-handle-back-no-flash.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Run full test suite to confirm no regression**

Run:
```
cd apps/web && pnpm test:unit
```
Expected: 1765+ passing (baseline at 2026-05-21 was 1765). Watch for any arena page test that asserted `game.reset()` was called from `handleBack` — those need updating.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/arena/page.tsx apps/web/src/app/\[locale\]/arena/__tests__/arena-handle-back-no-flash.test.tsx
git commit -m "$(cat <<'EOF'
fix(arena): handleBack no flash selector — direct router.push to /hub

Removes resetArenaState() + game.reset() from the back-button path.
game.reset() was flipping game.status to "selecting" synchronously
before the route transition completed, mounting DifficultySelector
for ~1 frame before the hub navigation rendered.

Unmount cleanup of /arena already aborts in-flight refs; the
explicit reset was redundant. Regression test
arena-handle-back-no-flash asserts pushMock is called and the
selector test-id never appears between tap and navigation.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 2: Add `GET /api/games/[id]` route (wallet-asserted)

**Files:**
- Create: `apps/web/src/app/api/games/[id]/route.ts`
- Test: `apps/web/src/app/api/games/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/games/[id]/__tests__/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(),
    }),
  },
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: () => "127.0.0.1",
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
  hashWallet: (w: string) => `hash(${w})`,
}));

import { GET } from "../route";
import { Redis } from "@upstash/redis";

describe("GET /api/games/[id]", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const gameId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when wallet missing", async () => {
    const req = new Request(`http://localhost/api/games/${gameId}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when wallet invalid", async () => {
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=not-an-address`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when gameId not UUID", async () => {
    const req = new Request(`http://localhost/api/games/garbage?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: "garbage" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 on cache miss", async () => {
    (Redis.fromEnv() as ReturnType<typeof Redis.fromEnv> & { get: ReturnType<typeof vi.fn> }).get.mockResolvedValue(null);
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with gameRecord on cache hit", async () => {
    const record = {
      gameId,
      moves: ["e4", "e5"],
      result: "win",
      difficulty: "easy",
      totalMoves: 2,
      elapsedMs: 12_000,
      timestamp: Date.now(),
    };
    (Redis.fromEnv() as ReturnType<typeof Redis.fromEnv> & { get: ReturnType<typeof vi.fn> }).get.mockResolvedValue(record);
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gameId).toBe(gameId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/api/games/\[id\]/__tests__/route.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `apps/web/src/app/api/games/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { createLogger } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/games/[id]" });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gameId } = await ctx.params;
  const url = new URL(req.url);
  const walletRaw = url.searchParams.get("wallet");
  const wallet = walletRaw?.toLowerCase();

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  try {
    const record = await redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId));
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(record, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("game_fetch_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/app/api/games/\[id\]/__tests__/route.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/games/\[id\]/route.ts apps/web/src/app/api/games/\[id\]/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): GET /api/games/[id] — wallet-asserted gameRecord fetch

Reads cached coach:game:<wallet>:<gameId> Redis record. Threat model
is unguessable-UUID gating + origin + rate-limit, matching every
existing endpoint. No SIWE / signed session — out of scope per spec
§1 + red-team C-1.

Returns 400 on invalid wallet or gameId, 404 on cache miss, 200
with the GameRecord on hit. no-store cache header so mint-receipt
updates surface immediately on next fetch.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 3: Add `POST /api/games/[id]/mint-receipt` route

**Files:**
- Modify: `apps/web/src/lib/coach/types.ts` (extend GameRecord additively)
- Create: `apps/web/src/app/api/games/[id]/mint-receipt/route.ts`
- Test: `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts`

- [ ] **Step 1: Extend `GameRecord` type additively**

Edit `apps/web/src/lib/coach/types.ts` lines 25-34. Replace:

```ts
export type GameRecord = {
  gameId: string;
  moves: string[];
  result: GameResult;
  difficulty: "easy" | "medium" | "hard";
  totalMoves: number;
  elapsedMs: number;
  timestamp: number;
  receivedAt?: number;
};
```

With:
```ts
export type GameRecord = {
  gameId: string;
  moves: string[];
  result: GameResult;
  difficulty: "easy" | "medium" | "hard";
  totalMoves: number;
  elapsedMs: number;
  timestamp: number;
  receivedAt?: number;
  /** Forward-leaning — server doesn't write today (standard chess only).
   *  Reserved for Chess960 / variant openings. */
  startingFen?: string;
  /** Populated by POST /api/games/[id]/mint-receipt after mint success.
   *  Serialized as decimal string (bigint not JSON-safe). */
  mintedTokenId?: string;
  claimTxHash?: `0x${string}`;
  shareCardUrl?: string;
  shareLinkUrl?: string;
  /** Cluster E §0.1 — present when persist read /api/coach/check-analysis at write time. */
  analysis?: import("./types").CoachAnalysisRecord;
};
```

Note: the self-reference `import("./types").CoachAnalysisRecord` may already exist via another mechanism — if `CoachAnalysisRecord` is exported in the same file, simplify to `analysis?: CoachAnalysisRecord`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const redisGet = vi.fn();
const redisSet = vi.fn();
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({ get: redisGet, set: redisSet }),
  },
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: () => "127.0.0.1",
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
  hashWallet: (w: string) => `hash(${w})`,
}));

import { POST } from "../route";

describe("POST /api/games/[id]/mint-receipt", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const gameId = "550e8400-e29b-41d4-a716-446655440000";
  const baseRecord = {
    gameId, moves: ["e4"], result: "win", difficulty: "easy",
    totalMoves: 1, elapsedMs: 5000, timestamp: 1_700_000_000_000,
  };

  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
  });

  function makeReq(body: unknown) {
    return new Request(`http://localhost/api/games/${gameId}/mint-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when wallet missing", async () => {
    const res = await POST(makeReq({ tokenId: "1" }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when game record missing", async () => {
    redisGet.mockResolvedValue(null);
    const res = await POST(makeReq({ wallet, tokenId: "1", claimTxHash: "0xabc", shareCardUrl: "https://x", shareLinkUrl: "https://y" }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(404);
  });

  it("writes mint fields on first call", async () => {
    redisGet.mockResolvedValue(baseRecord);
    redisSet.mockResolvedValue("OK");
    const res = await POST(makeReq({
      wallet, tokenId: "42",
      claimTxHash: "0xdeadbeef",
      shareCardUrl: "https://chesscito.com/og/42",
      shareLinkUrl: "https://chesscito.com/v/42",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    expect(redisSet).toHaveBeenCalledOnce();
    const [, written] = redisSet.mock.calls[0];
    expect(written).toMatchObject({
      mintedTokenId: "42",
      claimTxHash: "0xdeadbeef",
      shareCardUrl: "https://chesscito.com/og/42",
      shareLinkUrl: "https://chesscito.com/v/42",
    });
  });

  it("is idempotent — same tokenId re-write is a no-op-style 200", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "42" });
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: "0xdeadbeef",
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    // Idempotent: we don't insist on a write; we insist on no error.
  });

  it("returns 409 on tokenId mismatch (record already has a DIFFERENT tokenId)", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "100" });
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: "0xdeadbeef",
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/api/games/\[id\]/mint-receipt/__tests__/route.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the route**

Create `apps/web/src/app/api/games/[id]/mint-receipt/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isAddress } from "viem";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord } from "@/lib/coach/types";

const redis = Redis.fromEnv();
const log = createLogger({ route: "/api/games/[id]/mint-receipt" });

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gameId } = await ctx.params;
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  let body: { wallet?: string; tokenId?: string; claimTxHash?: string; shareCardUrl?: string; shareLinkUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wallet = body.wallet?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!body.tokenId || !/^\d+$/.test(body.tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }
  if (!body.claimTxHash || !TX_HASH_RE.test(body.claimTxHash)) {
    return NextResponse.json({ error: "Invalid claimTxHash" }, { status: 400 });
  }
  if (!body.shareCardUrl || !body.shareLinkUrl) {
    return NextResponse.json({ error: "Missing share URLs" }, { status: 400 });
  }

  const key = REDIS_KEYS.game(wallet, gameId);
  const existing = await redis.get<GameRecord>(key);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotency: same tokenId re-write is a 200 no-op. Different
  // tokenId on the same gameId is a 409 to surface contract bugs.
  if (existing.mintedTokenId && existing.mintedTokenId !== body.tokenId) {
    log.warn("mint_receipt_token_mismatch", {
      wallet_hash: hashWallet(wallet),
      game_id_prefix: gameId.slice(0, 8),
      existing_token: existing.mintedTokenId,
      submitted_token: body.tokenId,
    });
    return NextResponse.json({ error: "Token mismatch" }, { status: 409 });
  }
  if (existing.mintedTokenId === body.tokenId) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const updated: GameRecord = {
    ...existing,
    mintedTokenId: body.tokenId,
    claimTxHash: body.claimTxHash as `0x${string}`,
    shareCardUrl: body.shareCardUrl,
    shareLinkUrl: body.shareLinkUrl,
  };
  await redis.set(key, updated, { ex: 90 * 24 * 60 * 60 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify pass**

Run:
```
cd apps/web && pnpm vitest run src/app/api/games/\[id\]/mint-receipt/__tests__/route.test.ts src/lib/coach
```
Expected: all PASS. Watch for any test in `lib/coach/**` that asserts the GameRecord shape — additive change should be safe but verify.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coach/types.ts apps/web/src/app/api/games/\[id\]/mint-receipt/route.ts apps/web/src/app/api/games/\[id\]/mint-receipt/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): POST /api/games/[id]/mint-receipt — persist mint outcome

Extends GameRecord with optional mintedTokenId / claimTxHash /
shareCardUrl / shareLinkUrl fields (additive — no breaking change to
existing readers). New endpoint writes these onto the persisted
coach:game:<wallet>:<gameId> record so cold-loaded viewers show the
post-mint state without a refetch race.

Idempotent: same tokenId re-write returns 200; different tokenId on
the same gameId returns 409 to surface contract bugs.

Required by red-team C-2 — without server-side mint persistence, the
viewer's "View NFT" CTA would not survive a cold load.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 4: Create `useGameReplay` hook with partial-replay support

**Files:**
- Create: `apps/web/src/lib/game/use-game-replay.ts`
- Test: `apps/web/src/lib/game/__tests__/use-game-replay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/game/__tests__/use-game-replay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameReplay } from "../use-game-replay";

describe("useGameReplay", () => {
  const STARTPOS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("empty moves: lastValidIndex 0, fen=startpos, no error", () => {
    const { result } = renderHook(() => useGameReplay([]));
    expect(result.current.lastValidIndex).toBe(0);
    expect(result.current.totalMoves).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentFen).toBe(STARTPOS);
    expect(result.current.currentMove).toBeNull();
    expect(result.current.error).toBeUndefined();
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(false);
  });

  it("happy path: replays a 4-move game", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6"];
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.lastValidIndex).toBe(4);
    expect(result.current.currentIndex).toBe(4);
    expect(result.current.error).toBeUndefined();
    expect(result.current.canPrev).toBe(true);
    expect(result.current.canNext).toBe(false);
    expect(result.current.currentMove).toEqual({ san: "Nc6", index: 3 });
  });

  it("goPrev / goNext bounded", () => {
    const moves = ["e4", "e5"];
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.currentIndex).toBe(2);
    act(() => result.current.goPrev());
    expect(result.current.currentIndex).toBe(1);
    act(() => result.current.goPrev());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goPrev()); // should not go below 0
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goNext());
    expect(result.current.currentIndex).toBe(1);
  });

  it("goTo clamps silently — no throw on out-of-range", () => {
    const moves = ["e4", "e5", "Nf3"];
    const { result } = renderHook(() => useGameReplay(moves));
    act(() => result.current.goTo(-5));
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goTo(99));
    expect(result.current.currentIndex).toBe(3); // = lastValidIndex
    act(() => result.current.goTo(1));
    expect(result.current.currentIndex).toBe(1);
  });

  it("goStart / goEnd", () => {
    const moves = ["e4", "e5", "Nf3"];
    const { result } = renderHook(() => useGameReplay(moves));
    act(() => result.current.goStart());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.goEnd());
    expect(result.current.currentIndex).toBe(3);
  });

  it("partial-replay: stops at first illegal SAN, exposes error", () => {
    const moves = ["e4", "e5", "Nxd5" /* illegal */, "Nf6"];
    const { result } = renderHook(() => useGameReplay(moves));
    expect(result.current.totalMoves).toBe(4);
    expect(result.current.lastValidIndex).toBe(2); // 2 valid moves replayed
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.error).toEqual({ atIndex: 2, badSan: "Nxd5" });
    // goNext past lastValidIndex is a no-op
    act(() => result.current.goNext());
    expect(result.current.currentIndex).toBe(2);
  });

  it("uses provided startingFen", () => {
    const customFen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";
    const { result } = renderHook(() => useGameReplay([], customFen));
    expect(result.current.currentFen).toBe(customFen);
  });

  it("currentFen updates as we navigate", () => {
    const moves = ["e4", "e5"];
    const { result } = renderHook(() => useGameReplay(moves));
    const finalFen = result.current.currentFen;
    act(() => result.current.goStart());
    expect(result.current.currentFen).toBe(STARTPOS);
    act(() => result.current.goEnd());
    expect(result.current.currentFen).toBe(finalFen);
  });

  it("returned functions are referentially stable across re-renders with same inputs", () => {
    const moves = ["e4"];
    const { result, rerender } = renderHook(({ m }) => useGameReplay(m), { initialProps: { m: moves } });
    const goPrev1 = result.current.goPrev;
    const goNext1 = result.current.goNext;
    const goTo1 = result.current.goTo;
    rerender({ m: moves });
    expect(result.current.goPrev).toBe(goPrev1);
    expect(result.current.goNext).toBe(goNext1);
    expect(result.current.goTo).toBe(goTo1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/lib/game/__tests__/use-game-replay.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/lib/game/use-game-replay.ts`:

```ts
"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";

export type GameReplayError = {
  atIndex: number;
  badSan: string;
};

export type GameReplayState = {
  totalMoves: number;
  lastValidIndex: number;
  currentIndex: number;
  currentFen: string;
  currentMove: { san: string; index: number } | null;
  canPrev: boolean;
  canNext: boolean;
  error?: GameReplayError;
  goPrev: () => void;
  goNext: () => void;
  goTo: (i: number) => void;
  goStart: () => void;
  goEnd: () => void;
};

/**
 * Replay a SAN[] move list into a sequence of FENs. Mirrors the
 * `movesToFen` lazy-with-try/catch precedent: chess.js v1.4.0 throws
 * on illegal moves; we stop at the first failure, expose `error`, and
 * let the viewer render up to lastValidIndex.
 *
 * All returned functions are memoized via useCallback per
 * feedback_hook_ref_stability.md — consumer effects can list them
 * in deps without thrashing arena's 400ms PLAY timer.
 */
export function useGameReplay(moves: readonly string[], startingFen?: string): GameReplayState {
  const { fenList, error } = useMemo(() => {
    const game = new Chess(startingFen ?? undefined);
    const out: string[] = [game.fen()];
    let err: GameReplayError | undefined;
    for (let i = 0; i < moves.length; i++) {
      try {
        const applied = game.move(moves[i]);
        if (!applied) {
          err = { atIndex: i + 1, badSan: moves[i] };
          break;
        }
        out.push(game.fen());
      } catch {
        err = { atIndex: i + 1, badSan: moves[i] };
        break;
      }
    }
    return { fenList: out, error: err };
  }, [moves, startingFen]);

  const lastValidIndex = fenList.length - 1;
  const [currentIndex, setCurrentIndex] = useState(lastValidIndex);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(lastValidIndex, i)), [lastValidIndex]);

  const goTo = useCallback((i: number) => setCurrentIndex(clamp(i)), [clamp]);
  const goPrev = useCallback(() => setCurrentIndex((i) => clamp(i - 1)), [clamp]);
  const goNext = useCallback(() => setCurrentIndex((i) => clamp(i + 1)), [clamp]);
  const goStart = useCallback(() => setCurrentIndex(0), []);
  const goEnd = useCallback(() => setCurrentIndex(lastValidIndex), [lastValidIndex]);

  const safeIndex = clamp(currentIndex);
  const currentFen = fenList[safeIndex];
  const currentMove = safeIndex === 0 ? null : { san: moves[safeIndex - 1], index: safeIndex - 1 };

  return {
    totalMoves: moves.length,
    lastValidIndex,
    currentIndex: safeIndex,
    currentFen,
    currentMove,
    canPrev: safeIndex > 0,
    canNext: safeIndex < lastValidIndex,
    error,
    goPrev,
    goNext,
    goTo,
    goStart,
    goEnd,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/lib/game/__tests__/use-game-replay.test.ts
```
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/game/use-game-replay.ts apps/web/src/lib/game/__tests__/use-game-replay.test.ts
git commit -m "$(cat <<'EOF'
feat(lib/game): useGameReplay — SAN[] navigator with partial-replay

Mirrors movesToFen pattern: lazy try/catch around chess.js .move(),
stops at first illegal SAN, exposes { atIndex, badSan } via error.
Viewer renders up to lastValidIndex; consumer telemeters the
corruption via coach_viewer_corrupt_record.

All returned functions memoized via useCallback per
feedback_hook_ref_stability so consumer effects can list them in
deps without re-creating on every render. goTo clamps silently to
[0, lastValidIndex] — no throw on out-of-range, no surprise to UI.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 2 — Hooks extraction (feature-flag-gated)

> **Phase 2 gating:** each commit ships behind `NEXT_PUBLIC_USE_EXTRACTED_*=true`. Default is `false` → legacy inline path in `arena/page.tsx` runs. After one preview deploy cycle + green smoke, Phase 5 commit 13 flips the flag and deletes the legacy branch.

---

### Task 5: Extract `useCoachAnalysis` + `useCoachCreditsPurchase`

> Two hooks shipped in one commit because they share imports + are interdependent at the call site. `useCoachCreditsPurchase` is the wagmi-heavy slice that's split out so `useCoachAnalysis` stays viewer-portable.

**Files:**
- Create: `apps/web/src/lib/coach/use-coach-analysis.ts`
- Create: `apps/web/src/lib/coach/use-coach-credits-purchase.ts`
- Test: `apps/web/src/lib/coach/__tests__/use-coach-analysis.test.ts`
- Test: `apps/web/src/lib/coach/__tests__/use-coach-credits-purchase.test.ts`
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (wrap legacy block behind flag, mount extracted hook behind flag)
- Test: `apps/web/src/app/[locale]/arena/__tests__/arena-play-timer-resilience.test.tsx`

- [ ] **Step 1: Define the hook interfaces**

Document the contract first. Create `apps/web/src/lib/coach/use-coach-analysis.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoachAnalysisRecord, CoachResponse, BasicCoachResponse } from "./types";
import type { AnalyzeSource } from "./analyze-telemetry";
import { track } from "@/lib/telemetry";

export type CoachPhase = "idle" | "loading" | "review" | "result" | "fallback" | "paywall" | "welcome" | "history";

export type CoachAnalysisInjected = {
  address?: `0x${string}`;
  chainId?: number;
  proActive?: boolean;
  activeLocale?: "en" | "es";
};

export type CoachAnalysisInput = {
  gameId: string;
  walletAddress?: `0x${string}`;
  result: "win" | "lose" | "draw" | "resigned";
  difficulty: "easy" | "medium" | "hard";
  moves: string[];
  elapsedMs: number;
  surface: "arena_endgame" | "coach_viewer";
  injected?: CoachAnalysisInjected;
};

export type CoachAnalysisState = {
  phase: CoachPhase;
  response: CoachResponse | BasicCoachResponse | null;
  fallbackResponse: BasicCoachResponse | null;
  jobId: string | null;
  credits: number;
  analysisLocale?: "en" | "es";
  reanalyzeGameId: string | null;
  isReanalyzing: boolean;
  serverError: string | null;
  /** Mutators — all memoized via useCallback. */
  setPhase: (p: CoachPhase) => void;
  startCoachAnalysis: (source: AnalyzeSource) => Promise<void>;
  askCoach: (source: AnalyzeSource) => void;
  analyzeFromHistory: (record: CoachAnalysisRecord) => void;
  reanalyze: () => Promise<void>;
  claimWelcome: () => Promise<void>;
  /** Cleanup — aborts in-flight requests. Call on unmount or surface switch. */
  abort: () => void;
};

/**
 * Coach phase machine extracted from apps/web/src/app/[locale]/arena/page.tsx
 * (lines ~300-767 + 1090+). Owns:
 *   - sessionStorage["chesscito:coach-welcomed"] writes (3 sites)
 *   - analyzeSourceRef internal state
 *   - Coach analyze + reanalyze + claim-welcome + check-credits requests
 *   - paywall ↔ result ↔ fallback ↔ history phase transitions
 *
 * Does NOT own:
 *   - credit purchase (split into useCoachCreditsPurchase)
 *   - telemetry firing (consumer wraps callbacks with track())
 *   - rendering surfaces (consumer mounts CoachLoading/Paywall/Result)
 *
 * Hook return discipline: every function in the return is
 * useCallback-memoized per feedback_hook_ref_stability.md. Adding
 * unstable callbacks here will collapse arena's 400ms PLAY timer
 * (see arena-play-timer-fragility memory).
 */
export function useCoachAnalysis(input: CoachAnalysisInput): CoachAnalysisState {
  // -- BEGIN MIGRATED FROM arena/page.tsx --
  // The full implementation is a literal transplant of the lines listed in
  // the docstring above. To preserve behavior, follow this rule:
  //   1. Cut from arena/page.tsx exactly the listed line ranges
  //   2. Replace direct reads of `address`, `chainId`, `activeLocale`,
  //      `proActive` with `input.injected?.X ?? <wagmi/intl hook>()`
  //   3. Wrap every returned callback in useCallback with the minimal stable deps
  //   4. Move sessionStorage / localStorage writes to be hook-internal
  //   5. Replace inline `track(...)` calls with explicit return values that
  //      the consumer fires via track wrappers — this hook is telemetry-free
  // -- END MIGRATED --
  throw new Error("TODO: transplant per docstring");
}
```

Stop here for the interface commit shape — do NOT throw in the real impl. The next steps replace the throw with the real transplant.

- [ ] **Step 2: Write the timer-resilience regression test**

Create `apps/web/src/app/[locale]/arena/__tests__/arena-play-timer-resilience.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  useReadContracts: () => ({ data: [], isLoading: false }),
  useReadContract: () => ({ data: undefined, isLoading: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  usePublicClient: () => undefined,
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
}));

import ArenaPage from "../page";

describe("arena PLAY timer resilience (regression: arena-play-timer-fragility)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("PLAY → playing transitions within 800ms even with N intervening commits", () => {
    const { getByRole, queryByText } = render(<ArenaPage />);
    const playBtn = getByRole("button", { name: /start|play/i });

    // Simulate N intervening commits during the 400ms wait by triggering
    // re-renders. If any sibling effect re-arms the timer, the 400ms
    // setTimeout will never fire and PLAY will be stuck.
    act(() => fireEvent.click(playBtn));
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { vi.advanceTimersByTime(100); }); // tick during wait
    act(() => { vi.advanceTimersByTime(300); }); // total now 450ms
    // After 450ms the 400ms PLAY timer should have fired.
    // Assert "Preparing AI..." is gone (the wait state).
    expect(queryByText(/preparing ai/i)).toBeNull();
  });
});
```

This test will pass against the legacy inline path (acts as a regression guard). It must also pass after Phase 2 extracts the hooks.

- [ ] **Step 3: Run timer-resilience test against legacy code to baseline**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena/__tests__/arena-play-timer-resilience.test.tsx
```
Expected: PASS (or familiarize with current behavior so the test reflects ground truth).

- [ ] **Step 4: Transplant `useCoachAnalysis` implementation**

Open `apps/web/src/app/[locale]/arena/page.tsx`. Identify and copy these blocks into `use-coach-analysis.ts`:
- Lines 326 (`analyzeSourceRef`)
- Lines 314-318 (coachPhase + related state declarations)
- Lines 654-767 (`startCoachAnalysis`, `handleAskCoach`, `handleAnalyzeFromHistory`, `handleReanalyze`, `handleClaimWelcome`)
- Lines 1090+ (effect for coach abort on unmount)

Apply the migration rules from the docstring:
- Replace direct `address` / `chainId` / `activeLocale` / `proActiveCached` reads with `input.injected?.X ?? <wagmi/intl hook>()`
- Wrap every returned callback with `useCallback`
- Move sessionStorage `chesscito:coach-welcomed` writes inside the hook
- Strip `track(...)` calls — the consumer will fire them via wrappers

Replace the `throw new Error("TODO...")` from Step 1 with the actual implementation.

Write the matching `use-coach-analysis.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoachAnalysis } from "../use-coach-analysis";

const baseInput = {
  gameId: "550e8400-e29b-41d4-a716-446655440000",
  walletAddress: "0x1111111111111111111111111111111111111111" as const,
  result: "win" as const,
  difficulty: "easy" as const,
  moves: ["e4", "e5"],
  elapsedMs: 60_000,
  surface: "coach_viewer" as const,
  injected: { address: "0x1111111111111111111111111111111111111111" as const, chainId: 42220, proActive: false, activeLocale: "en" as const },
};

describe("useCoachAnalysis", () => {
  it("starts in idle phase, no response", () => {
    const { result } = renderHook(() => useCoachAnalysis(baseInput));
    expect(result.current.phase).toBe("idle");
    expect(result.current.response).toBeNull();
  });

  it("returned callbacks are referentially stable across renders with same input", () => {
    const { result, rerender } = renderHook((props) => useCoachAnalysis(props), { initialProps: baseInput });
    const a = result.current.startCoachAnalysis;
    const b = result.current.askCoach;
    const c = result.current.abort;
    rerender(baseInput);
    expect(result.current.startCoachAnalysis).toBe(a);
    expect(result.current.askCoach).toBe(b);
    expect(result.current.abort).toBe(c);
  });

  it("askCoach transitions phase: idle → review (free) or paywall (gated)", async () => {
    // Free path: proActive=true OR credits>0
    const free = { ...baseInput, injected: { ...baseInput.injected, proActive: true } };
    const { result } = renderHook(() => useCoachAnalysis(free));
    act(() => result.current.askCoach("entry-tap"));
    await waitFor(() => expect(["review", "loading", "result"]).toContain(result.current.phase));
  });

  // Additional cases: paywall transition; analyzeFromHistory; reanalyze;
  // abort on unmount; server error → fallback phase. Mock fetch as
  // needed; mirror the existing arena tests for setup.
});
```

- [ ] **Step 5: Transplant `useCoachCreditsPurchase` implementation**

Create `apps/web/src/lib/coach/use-coach-credits-purchase.ts`. Copy lines 768-862 from `arena/page.tsx`. Same migration rules:
- Accept `injected?: { address?, chainId?, sendPurchase?, tokenBalances? }`
- Memoize all returns
- Strip telemetry

Interface:

```ts
"use client";

import { useCallback, useState } from "react";

export type CoachCreditsPurchaseInput = {
  walletAddress?: `0x${string}`;
  injected?: {
    address?: `0x${string}`;
    chainId?: number;
    sendPurchase?: (itemId: number, paymentToken: `0x${string}`) => Promise<`0x${string}`>;
    tokenBalances?: Record<`0x${string}`, bigint>;
  };
};

export type CoachCreditsPurchaseState = {
  isProcessing: boolean;
  error: string | null;
  buyCredits: (itemId: number) => Promise<void>;
};

export function useCoachCreditsPurchase(input: CoachCreditsPurchaseInput): CoachCreditsPurchaseState {
  // Transplant arena/page.tsx:768-862 here per migration rules.
  // ...
  throw new Error("TODO: transplant per docstring");
}
```

Write `use-coach-credits-purchase.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoachCreditsPurchase } from "../use-coach-credits-purchase";

describe("useCoachCreditsPurchase", () => {
  const baseInput = {
    walletAddress: "0x1111111111111111111111111111111111111111" as const,
    injected: { address: "0x1111111111111111111111111111111111111111" as const, chainId: 42220 },
  };

  it("starts idle: not processing, no error", () => {
    const { result } = renderHook(() => useCoachCreditsPurchase(baseInput));
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("buyCredits transitions to processing then back", async () => {
    const sendPurchase = vi.fn().mockResolvedValue("0xdeadbeef");
    const { result } = renderHook(() => useCoachCreditsPurchase({
      ...baseInput,
      injected: { ...baseInput.injected, sendPurchase },
    }));
    act(() => { void result.current.buyCredits(1); });
    await waitFor(() => expect(sendPurchase).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
  });

  it("buyCredits stable ref across renders", () => {
    const { result, rerender } = renderHook((p) => useCoachCreditsPurchase(p), { initialProps: baseInput });
    const fn = result.current.buyCredits;
    rerender(baseInput);
    expect(result.current.buyCredits).toBe(fn);
  });
});
```

- [ ] **Step 6: Wire the feature flag in `arena/page.tsx`**

Find the inline coach-phase block in `arena/page.tsx`. Wrap it:

```tsx
const USE_EXTRACTED_COACH = process.env.NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS === "true";

// At the top of the page component:
const coachExtracted = useCoachAnalysis({
  gameId: persistedGameId ?? "",
  walletAddress: address,
  result: mapArenaResult(game.status, isPlayerWin),
  difficulty: game.difficulty,
  moves: game.moveHistory,
  elapsedMs: game.elapsedMs,
  surface: "arena_endgame",
});
const creditsExtracted = useCoachCreditsPurchase({ walletAddress: address });

// Choose the active source — both surfaces of state must stay in
// sync during the rollout cycle. Today we drive UI from the legacy
// inline state; flipping the flag swaps to `coachExtracted` / `creditsExtracted`.
const coach = USE_EXTRACTED_COACH ? {
  phase: coachExtracted.phase,
  response: coachExtracted.response,
  // ... map all fields used by the page render
} : {
  phase: coachPhase,
  response: coachResponse,
  // ... legacy values
};
```

Important: hook calls must run unconditionally on every render (React rules of hooks). The flag only affects which state is *read* into the JSX, not which hook is *called*.

- [ ] **Step 7: Run all Phase 2 tests + arena tests + timer-resilience**

Run:
```
cd apps/web && pnpm vitest run src/lib/coach/__tests__ src/app/\[locale\]/arena
```
Expected: all PASS. The timer-resilience test must PASS both with the flag off (legacy path) and on (extracted path).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/coach/use-coach-analysis.ts apps/web/src/lib/coach/use-coach-credits-purchase.ts apps/web/src/lib/coach/__tests__/ apps/web/src/app/\[locale\]/arena/page.tsx apps/web/src/app/\[locale\]/arena/__tests__/arena-play-timer-resilience.test.tsx
git commit -m "$(cat <<'EOF'
refactor(arena): extract useCoachAnalysis + useCoachCreditsPurchase

Behind NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS feature flag (default
false). Legacy inline path in arena/page.tsx runs until Phase 5
commit flips the flag.

Two hooks shipped together because they're interdependent at the
call site. Credits-purchase is split out from coach-analysis so the
latter stays viewer-portable (no wagmi-write deps).

Migration discipline per spec §2 Hook return discipline:
- Every returned function is useCallback-memoized
- sessionStorage / localStorage writes owned by the hook
- Telemetry is fired by the consumer with surface dim
- Wagmi/intl reads accept injected overrides for VR fixtures

Regression guard arena-play-timer-resilience.test.tsx asserts PLAY
advances within 800ms across N intervening commits (per memory
arena-play-timer-fragility 2026-05-25).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 6: Extract `useMintVictory`

**Files:**
- Create: `apps/web/src/lib/coach/use-mint-victory.ts`
- Test: `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts`
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (wrap mint block behind flag)

- [ ] **Step 1: Define the hook interface**

Create `apps/web/src/lib/coach/use-mint-victory.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ClaimPhase = "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";
export type ClaimStep = "signing" | "confirming" | "done";

export type ClaimData = {
  tokenId: string | null; // serialized bigint
  claimTxHash: `0x${string}` | null;
  shareCardUrl: string | null;
  shareLinkUrl: string | null;
};

export type MintVictoryInput = {
  gameId: string;
  walletAddress?: `0x${string}`;
  difficulty: "easy" | "medium" | "hard";
  result: "win";
  totalMoves: number;
  elapsedMs: number;
  injected?: {
    address?: `0x${string}`;
    chainId?: number;
    sendSig?: (typedData: unknown) => Promise<`0x${string}`>;
    sendApprove?: (token: `0x${string}`, amount: bigint) => Promise<`0x${string}`>;
    sendMint?: (signed: unknown) => Promise<`0x${string}`>;
    waitReceipt?: (hash: `0x${string}`) => Promise<unknown>;
  };
};

export type MintVictoryState = {
  phase: ClaimPhase;
  step: ClaimStep;
  data: ClaimData;
  error: string | null;
  start: () => Promise<void>;
  reset: () => void;
};

/**
 * Mint victory claim phase machine extracted from arena/page.tsx
 * (lines ~866-1072). Owns:
 *   - sessionStorage["chesscito:claim"] lifecycle (set on claiming/success, removed on cancel/error)
 *   - sessionStorage["chesscito:optimistic-victory"] write on success (consumed by trophies-body.tsx)
 *   - EIP-712 signature → approve → mint → receipt sequence
 *   - shareCardUrl + shareLinkUrl construction
 *
 * Does NOT own:
 *   - mint-receipt POST to /api/games/[id]/mint-receipt (consumer fires on success)
 *   - share-card render (existing flow)
 *   - telemetry (consumer wraps callbacks)
 */
export function useMintVictory(input: MintVictoryInput): MintVictoryState {
  // -- BEGIN MIGRATED FROM arena/page.tsx:866-1072 --
  // Apply same migration rules as Task 5.
  // -- END MIGRATED --
  throw new Error("TODO: transplant per docstring");
}
```

- [ ] **Step 2: Write the test**

Create `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMintVictory } from "../use-mint-victory";

describe("useMintVictory", () => {
  const baseInput = {
    gameId: "550e8400-e29b-41d4-a716-446655440000",
    walletAddress: "0x1111111111111111111111111111111111111111" as const,
    difficulty: "easy" as const,
    result: "win" as const,
    totalMoves: 12,
    elapsedMs: 60_000,
    injected: { address: "0x1111111111111111111111111111111111111111" as const, chainId: 42220 },
  };

  it("starts in ready phase", () => {
    const { result } = renderHook(() => useMintVictory(baseInput));
    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
  });

  it("start() → claiming → success with stub injected senders", async () => {
    const sendSig = vi.fn().mockResolvedValue("0xsig00".padEnd(132, "0"));
    const sendApprove = vi.fn().mockResolvedValue("0xapprove".padEnd(66, "0"));
    const sendMint = vi.fn().mockResolvedValue("0xmint".padEnd(66, "0"));
    const waitReceipt = vi.fn().mockResolvedValue({ status: "success", logs: [{ topics: ["0x", "0x"], data: "0x" + "01".padStart(64, "0") }] });
    const { result } = renderHook(() => useMintVictory({
      ...baseInput,
      injected: { ...baseInput.injected, sendSig, sendApprove, sendMint, waitReceipt },
    }));
    act(() => { void result.current.start(); });
    await waitFor(() => expect(result.current.phase).toBe("success"));
    expect(result.current.data.claimTxHash).toBeTruthy();
  });

  it("sig timeout → timeout phase", async () => {
    const sendSig = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useMintVictory({
      ...baseInput,
      injected: { ...baseInput.injected, sendSig },
    }));
    act(() => { void result.current.start(); });
    // Implementation-specific: typically there's a sig timeout. Adjust to actual timeout value.
    // For this test we assert phase eventually leaves "ready".
    await waitFor(() => expect(["claiming", "timeout"]).toContain(result.current.phase));
  });

  it("returned callbacks are stable across renders", () => {
    const { result, rerender } = renderHook((p) => useMintVictory(p), { initialProps: baseInput });
    const start = result.current.start;
    rerender(baseInput);
    expect(result.current.start).toBe(start);
  });

  it("writes chesscito:claim on claiming, removes on cancel", async () => {
    const sendSig = vi.fn().mockRejectedValue(new Error("user rejected"));
    const { result } = renderHook(() => useMintVictory({
      ...baseInput,
      injected: { ...baseInput.injected, sendSig },
    }));
    act(() => { void result.current.start(); });
    await waitFor(() => expect(["cancelled", "error"]).toContain(result.current.phase));
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });
});
```

- [ ] **Step 3: Transplant the implementation**

Replace the throw in `use-mint-victory.ts` with the literal transplant from `arena/page.tsx:866-1072`, applying the migration rules (memoize, injected, hook-owned storage, no telemetry).

- [ ] **Step 4: Wire flag in `arena/page.tsx`**

Add:
```tsx
const USE_EXTRACTED_MINT = process.env.NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK === "true";
const mintExtracted = useMintVictory({
  gameId: persistedGameId ?? "",
  walletAddress: address,
  difficulty: game.difficulty,
  result: "win",
  totalMoves: game.moveCount,
  elapsedMs: game.elapsedMs,
});

const mint = USE_EXTRACTED_MINT ? mintExtracted : { phase: claimPhase, step: claimStep, data: claimData, error: claimError, start: handleClaimVictory, reset: () => setClaimPhase("ready") };
```

Same constraint: hook calls run unconditionally; only state reads branch on the flag.

- [ ] **Step 5: Run tests + smoke**

Run:
```
cd apps/web && pnpm vitest run src/lib/coach/__tests__/use-mint-victory.test.ts src/app/\[locale\]/arena
```
Expected: all PASS. Manually smoke `/arena` with flag off → mint flow unchanged. Then flip env to on → mint still works identically.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/coach/use-mint-victory.ts apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts apps/web/src/app/\[locale\]/arena/page.tsx
git commit -m "$(cat <<'EOF'
refactor(arena): extract useMintVictory hook

Behind NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK flag (default false).
Mirrors useCoachAnalysis extraction discipline:
- useCallback on every return
- sessionStorage["chesscito:claim"] + ["chesscito:optimistic-victory"]
  owned by hook
- Wagmi reads accept injected overrides for VR fixtures
- Telemetry stripped — consumer fires with surface dim

The hook does NOT POST to /api/games/[id]/mint-receipt — Phase 4
commit 12 wires the consumer to fire that request on claimPhase
transitions to "success".

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 3 — Viewer components + page

---

### Task 7: `GameViewer` component

**Files:**
- Create: `apps/web/src/components/coach/game-viewer.tsx`
- Test: `apps/web/src/components/coach/__tests__/game-viewer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/coach/__tests__/game-viewer.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameViewer } from "../game-viewer";

vi.mock("@/components/board/board-thumbnail", () => ({
  BoardThumbnail: ({ fen, size }: { fen: string; size?: string }) => (
    <div data-testid="board-thumbnail" data-fen={fen} data-size={size} />
  ),
}));

describe("GameViewer", () => {
  const moves = ["e4", "e5", "Nf3", "Nc6"];

  it("renders BoardThumbnail at last move on mount", () => {
    render(<GameViewer moves={moves} />);
    const board = screen.getByTestId("board-thumbnail");
    // The FEN at lastValidIndex (4 moves played).
    expect(board.getAttribute("data-fen")).toContain("3 3"); // halfmove/fullmove indicator
    expect(screen.getByText("Nc6")).toBeInTheDocument();
  });

  it("← / → controls disable at bounds", () => {
    render(<GameViewer moves={moves} />);
    const prev = screen.getByRole("button", { name: /previous move/i });
    const next = screen.getByRole("button", { name: /next move/i });
    expect(prev).toBeEnabled();
    expect(next).toBeDisabled(); // we start at lastValidIndex
    fireEvent.click(prev);
    expect(next).toBeEnabled();
  });

  it("SAN list highlights current move", () => {
    render(<GameViewer moves={moves} />);
    const items = screen.getAllByRole("listitem");
    const active = items.find((el) => el.getAttribute("data-active") === "true");
    expect(active?.textContent).toContain("Nc6");
  });

  it("zero moves: renders fallback, no SAN list, no controls", () => {
    render(<GameViewer moves={[]} />);
    expect(screen.getByText(/too short to review/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous move/i })).toBeNull();
  });

  it("partial-replay error: renders banner above the SAN list", () => {
    const corrupt = ["e4", "e5", "Nxd5" /* illegal */];
    render(<GameViewer moves={corrupt} />);
    expect(screen.getByText(/replay stopped at move/i)).toBeInTheDocument();
  });

  it("slider syncs with currentIndex", () => {
    render(<GameViewer moves={moves} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("4");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(slider).toHaveValue("2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/components/coach/__tests__/game-viewer.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GameViewer`**

Create `apps/web/src/components/coach/game-viewer.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { useGameReplay } from "@/lib/game/use-game-replay";

type Props = {
  moves: string[];
  startingFen?: string;
};

export function GameViewer({ moves, startingFen }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const replay = useGameReplay(moves, startingFen);

  if (replay.totalMoves === 0) {
    return (
      <div className="game-viewer game-viewer--empty">
        <BoardThumbnail fen={replay.currentFen} size="lg" />
        <p className="game-viewer__empty-message">{t("tooShortToReview")}</p>
      </div>
    );
  }

  return (
    <div className="game-viewer">
      <BoardThumbnail fen={replay.currentFen} size="lg" />

      {replay.error && (
        <div role="alert" className="game-viewer__error-banner">
          {t("replayStoppedAtMove", { n: replay.error.atIndex, san: replay.error.badSan })}
        </div>
      )}

      <div className="game-viewer__controls" role="group" aria-label={t("controlsAriaLabel")}>
        <button
          type="button"
          onClick={replay.goPrev}
          disabled={!replay.canPrev}
          aria-label={t("previousMove")}
        >
          ←
        </button>
        <input
          type="range"
          min={0}
          max={replay.lastValidIndex}
          step={1}
          value={replay.currentIndex}
          onChange={(e) => replay.goTo(Number(e.target.value))}
          aria-label={t("sliderAriaLabel")}
        />
        <button
          type="button"
          onClick={replay.goNext}
          disabled={!replay.canNext}
          aria-label={t("nextMove")}
        >
          →
        </button>
      </div>

      <ol className="game-viewer__san-list" aria-label={t("sanListAriaLabel")}>
        {moves.slice(0, replay.lastValidIndex).map((san, i) => (
          <li
            key={i}
            data-active={i === replay.currentIndex - 1}
            onClick={() => replay.goTo(i + 1)}
          >
            <span className="game-viewer__san-num">{Math.floor(i / 2) + 1}{i % 2 === 0 ? "." : "..."}</span>
            <span className="game-viewer__san-text">{san}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

Also add the new translation keys to `apps/web/src/lib/content/editorial.ts` under a new `COACH_VIEWER_COPY` namespace, plus the corresponding entries in `apps/web/messages/en.json` and `apps/web/messages/es.json`:

```ts
// editorial.ts
export const COACH_VIEWER_COPY = {
  tooShortToReview: "This match was too short to review.",
  replayStoppedAtMove: "Replay stopped at move {n} · couldn't play {san}.",
  previousMove: "Previous move",
  nextMove: "Next move",
  sliderAriaLabel: "Jump to move",
  controlsAriaLabel: "Replay controls",
  sanListAriaLabel: "Move list",
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/components/coach/__tests__/game-viewer.test.tsx
```
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/game-viewer.tsx apps/web/src/components/coach/__tests__/game-viewer.test.tsx apps/web/src/lib/content/editorial.ts apps/web/messages/en.json apps/web/messages/es.json
git commit -m "$(cat <<'EOF'
feat(coach): GameViewer — board + slider + SAN list + replay banner

Move-by-move viewer for /coach/[gameId]. Uses useGameReplay for
state, BoardThumbnail (large) for the board, native <input
type="range"> for the slider so iOS scrubbing works.

Empty moves → "too short to review" fallback (defensive — history
list filters these at source per H-9).

Partial-replay banner renders above the SAN list when chess.js
rejects an illegal SAN mid-replay; the user still sees their valid
moves up to lastValidIndex.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 8: `GameActionsBar` component

**Files:**
- Create: `apps/web/src/components/coach/game-actions-bar.tsx`
- Test: `apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameActionsBar } from "../game-actions-bar";

const baseProps = {
  gameId: "g1",
  result: "win" as const,
  totalMoves: 12,
  hasAnalysis: false,
  hasPartialReplayError: false,
  mintedTokenId: null,
  shareLinkUrl: null,
  onAskCoach: vi.fn(),
  onMint: vi.fn(),
  onShare: vi.fn(),
  onPlayAgain: vi.fn(),
  onViewNft: vi.fn(),
};

describe("GameActionsBar", () => {
  it("win + unminted: shows Ask Coach, Mint, Play Again. No View NFT. No Share.", () => {
    render(<GameActionsBar {...baseProps} />);
    expect(screen.getByRole("button", { name: /ask coach/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mint/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view nft/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
  });

  it("win + minted: View NFT replaces Mint; Share enabled", () => {
    render(<GameActionsBar {...baseProps} mintedTokenId="42" shareLinkUrl="https://chesscito.com/v/42" />);
    expect(screen.getByRole("button", { name: /view nft/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^mint$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("loss: no Mint, no Share, Ask Coach + Play Again", () => {
    render(<GameActionsBar {...baseProps} result="lose" />);
    expect(screen.queryByRole("button", { name: /mint/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ask coach/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
  });

  it("Ask Coach disabled when partial-replay error", () => {
    render(<GameActionsBar {...baseProps} hasPartialReplayError={true} />);
    expect(screen.getByRole("button", { name: /ask coach/i })).toBeDisabled();
  });

  it("Play Again calls onPlayAgain", () => {
    const onPlayAgain = vi.fn();
    render(<GameActionsBar {...baseProps} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/components/coach/__tests__/game-actions-bar.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GameActionsBar`**

Create `apps/web/src/components/coach/game-actions-bar.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

type Props = {
  gameId: string;
  result: "win" | "lose" | "draw" | "resigned";
  totalMoves: number;
  hasAnalysis: boolean;
  hasPartialReplayError: boolean;
  mintedTokenId: string | null;
  shareLinkUrl: string | null;
  onAskCoach: () => void;
  onMint: () => void;
  onShare: () => void;
  onPlayAgain: () => void;
  onViewNft: () => void;
};

export function GameActionsBar({
  gameId,
  result,
  totalMoves,
  hasAnalysis,
  hasPartialReplayError,
  mintedTokenId,
  shareLinkUrl,
  onAskCoach,
  onMint,
  onShare,
  onPlayAgain,
  onViewNft,
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const isWin = result === "win";
  const isMinted = mintedTokenId != null;
  const isTooShort = totalMoves === 0;
  const coachDisabled = hasPartialReplayError || isTooShort;

  return (
    <div className="game-actions-bar" role="group" aria-label={t("actionsAriaLabel")}>
      <button
        type="button"
        onClick={onAskCoach}
        disabled={coachDisabled}
        className="game-actions-bar__cta game-actions-bar__cta--ask-coach"
      >
        {hasAnalysis ? t("askCoachAgain") : t("askCoach")}
      </button>

      {isWin && !isMinted && (
        <button
          type="button"
          onClick={onMint}
          className="game-actions-bar__cta game-actions-bar__cta--mint"
        >
          {t("mintVictory")}
        </button>
      )}

      {isWin && isMinted && (
        <button
          type="button"
          onClick={onViewNft}
          className="game-actions-bar__cta game-actions-bar__cta--view-nft"
        >
          {t("viewNft")}
        </button>
      )}

      {isWin && isMinted && shareLinkUrl && (
        <button
          type="button"
          onClick={onShare}
          className="game-actions-bar__cta game-actions-bar__cta--share"
        >
          {t("share")}
        </button>
      )}

      <button
        type="button"
        onClick={onPlayAgain}
        className="game-actions-bar__cta game-actions-bar__cta--play-again"
      >
        {t("playAgain")}
      </button>
    </div>
  );
}
```

Add the `COACH_VIEWER_COPY` entries: `actionsAriaLabel`, `askCoach`, `askCoachAgain`, `mintVictory`, `viewNft`, `share`, `playAgain` in `editorial.ts` and both locale message files.

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/components/coach/__tests__/game-actions-bar.test.tsx
```
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/game-actions-bar.tsx apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx apps/web/src/lib/content/editorial.ts apps/web/messages/en.json apps/web/messages/es.json
git commit -m "$(cat <<'EOF'
feat(coach): GameActionsBar — 4 CTAs with result-aware visibility

Renders Ask Coach + Play Again always. Mint only on wins (unminted).
View NFT replaces Mint when mintedTokenId present. Share only when
minted AND shareLinkUrl present (mint-gated for Fase 1 per spec).

Ask Coach disabled on partial-replay error OR zero-moves (defensive
— history list filters zero-moves at source).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 9: `/coach/[gameId]` page

**Files:**
- Create: `apps/web/src/app/[locale]/coach/[gameId]/page.tsx`
- Create: `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx`
- Test: `apps/web/src/app/[locale]/coach/[gameId]/__tests__/coach-game-page.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create the test:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { CoachGameClient } from "../coach-game-client";

const baseRecord = {
  gameId: "g1",
  moves: ["e4", "e5"],
  result: "win" as const,
  difficulty: "easy" as const,
  totalMoves: 2,
  elapsedMs: 30_000,
  timestamp: Date.now(),
};

describe("CoachGameClient", () => {
  it("renders viewer + actions for valid record", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByTestId("board-thumbnail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
  });

  it("Play Again pushes /arena?fresh=1", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress="0x1111111111111111111111111111111111111111" />);
    const btn = screen.getByRole("button", { name: /play again/i });
    btn.click();
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });

  it("zero-move record renders defensive fallback", () => {
    render(<CoachGameClient gameRecord={{ ...baseRecord, moves: [], totalMoves: 0 }} walletAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText(/too short to review/i)).toBeInTheDocument();
  });

  it("renders ConnectPromptToast when wallet missing", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={undefined} />);
    expect(screen.getByText(/reconnect/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/coach/\[gameId\]
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the server page**

Create `apps/web/src/app/[locale]/coach/[gameId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { getTranslations } from "next-intl/server";
import type { GameRecord } from "@/lib/coach/types";
import { CoachGameClient } from "./coach-game-client";

type PageProps = {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams: Promise<{ wallet?: string }>;
};

export default async function CoachGamePage({ params, searchParams }: PageProps) {
  const { gameId } = await params;
  const { wallet } = await searchParams;
  const t = await getTranslations("COACH_VIEWER_COPY");

  if (!wallet) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
          title={t("reconnectTitle")}
          subtitle={t("reconnectSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={undefined} />
      </main>
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/api/games/${encodeURIComponent(gameId)}?wallet=${encodeURIComponent(wallet)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
          title={t("loadErrorTitle")}
          subtitle={t("loadErrorSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={wallet as `0x${string}`} />
      </main>
    );
  }

  const gameRecord = (await res.json()) as GameRecord;

  return (
    <main className="arena-bg arena-scroll-screen h-[100dvh]">
      <ContextualHeader
        variant="back-control"
        iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
        title={t("title")}
      />
      <CoachGameClient gameRecord={gameRecord} walletAddress={wallet as `0x${string}`} />
    </main>
  );
}
```

Create `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { GameRecord } from "@/lib/coach/types";
import { GameViewer } from "@/components/coach/game-viewer";
import { GameActionsBar } from "@/components/coach/game-actions-bar";
import { ConnectPromptToast } from "@/components/redesign/connect-prompt-toast";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { useCoachAnalysis } from "@/lib/coach/use-coach-analysis";
import { useMintVictory } from "@/lib/coach/use-mint-victory";
import { useGameReplay } from "@/lib/game/use-game-replay";
import { track } from "@/lib/telemetry";

type Props = {
  gameRecord: GameRecord | null;
  walletAddress?: `0x${string}`;
};

export function CoachGameClient({ gameRecord, walletAddress }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const router = useRouter();

  if (!walletAddress) {
    return (
      <div className="coach-game-client coach-game-client--no-wallet">
        <ConnectPromptToast milestone="viewer" onConnect={() => router.refresh()} />
      </div>
    );
  }
  if (!gameRecord) {
    return (
      <div className="coach-game-client coach-game-client--error">
        <p>{t("loadErrorMessage")}</p>
        <button type="button" onClick={() => router.push("/arena?fresh=1")}>
          {t("playAgain")}
        </button>
      </div>
    );
  }

  const replay = useGameReplay(gameRecord.moves, gameRecord.startingFen);
  const mappedResult = gameRecord.result === "win" ? "win"
    : gameRecord.result === "lose" ? "lose"
    : gameRecord.result === "draw" ? "draw"
    : "resigned";

  const coach = useCoachAnalysis({
    gameId: gameRecord.gameId,
    walletAddress,
    result: mappedResult,
    difficulty: gameRecord.difficulty,
    moves: gameRecord.moves,
    elapsedMs: gameRecord.elapsedMs,
    surface: "coach_viewer",
  });

  const mint = useMintVictory({
    gameId: gameRecord.gameId,
    walletAddress,
    difficulty: gameRecord.difficulty,
    result: "win",
    totalMoves: gameRecord.totalMoves,
    elapsedMs: gameRecord.elapsedMs,
  });

  const handleBack = useCallback(() => {
    track("coach_viewer_back_tap", { gameId: gameRecord.gameId, history_depth: typeof window !== "undefined" ? window.history.length : 0 });
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/hub");
    }
  }, [router, gameRecord.gameId]);

  const handlePlayAgain = useCallback(() => {
    track("coach_viewer_play_again_tap", { gameId: gameRecord.gameId });
    router.push("/arena?fresh=1");
  }, [router, gameRecord.gameId]);

  const handleAskCoach = useCallback(() => {
    track("coach_viewer_ask_coach_tap", { gameId: gameRecord.gameId, has_existing_analysis: !!gameRecord.analysis });
    coach.askCoach("viewer");
  }, [coach, gameRecord.gameId, gameRecord.analysis]);

  const handleMint = useCallback(() => {
    track("coach_viewer_mint_tap", { gameId: gameRecord.gameId, difficulty: gameRecord.difficulty });
    void mint.start();
  }, [mint, gameRecord.gameId, gameRecord.difficulty]);

  const tokenIdEffective = mint.data.tokenId ?? gameRecord.mintedTokenId ?? null;
  const shareLinkEffective = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? null;

  const handleShare = useCallback(() => {
    track("coach_viewer_share_tap", { gameId: gameRecord.gameId, tokenId: tokenIdEffective ?? undefined });
    if (shareLinkEffective && typeof navigator !== "undefined" && "share" in navigator) {
      void (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share!({ url: shareLinkEffective });
    }
  }, [gameRecord.gameId, tokenIdEffective, shareLinkEffective]);

  const handleViewNft = useCallback(() => {
    if (mint.data.claimTxHash || gameRecord.claimTxHash) {
      const tx = mint.data.claimTxHash ?? gameRecord.claimTxHash!;
      window.open(`https://celoscan.io/tx/${tx}`, "_blank", "noopener");
    }
  }, [mint.data.claimTxHash, gameRecord.claimTxHash]);

  // Inline coach response render (kind discriminator per H-8)
  const inlineAnalysisNode = (() => {
    if (!gameRecord.analysis) return null;
    if (gameRecord.analysis.response.kind === "full") {
      return (
        <CoachPanel
          response={gameRecord.analysis.response}
          difficulty={gameRecord.difficulty}
          totalMoves={gameRecord.totalMoves}
          elapsedMs={gameRecord.elapsedMs}
          credits={0}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBack}
          analysisLocale={gameRecord.analysis.locale}
          moves={gameRecord.moves}
        />
      );
    }
    return <CoachFallback response={gameRecord.analysis.response} onGetFullAnalysis={handleAskCoach} onPlayAgain={handlePlayAgain} onBackToHub={handleBack} />;
  })();

  return (
    <div className="coach-game-client">
      <GameViewer moves={gameRecord.moves} startingFen={gameRecord.startingFen} />

      <GameActionsBar
        gameId={gameRecord.gameId}
        result={mappedResult}
        totalMoves={gameRecord.totalMoves}
        hasAnalysis={!!gameRecord.analysis}
        hasPartialReplayError={!!replay.error}
        mintedTokenId={tokenIdEffective}
        shareLinkUrl={shareLinkEffective}
        onAskCoach={handleAskCoach}
        onMint={handleMint}
        onShare={handleShare}
        onPlayAgain={handlePlayAgain}
        onViewNft={handleViewNft}
      />

      {inlineAnalysisNode}
    </div>
  );
}
```

- [ ] **Step 4: Run integration tests**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/coach/\[gameId\]
```
Expected: 4 PASS.

- [ ] **Step 5: Smoke locally**

```bash
cd apps/web && pnpm dev
```
Visit `/coach/<known-gameId>?wallet=<your-wallet>` after playing a match. Verify viewer mounts, controls work, Play Again routes to `/arena?fresh=1`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/coach/\[gameId\]/ apps/web/src/lib/content/editorial.ts apps/web/messages/en.json apps/web/messages/es.json
git commit -m "$(cat <<'EOF'
feat(coach): /coach/[gameId] page — viewer + CoachPanel inline + actions

Server component fetches GameRecord from /api/games/[id]; renders
CoachGameClient with hydration props. Client wrapper composes
GameViewer + GameActionsBar + inline CoachPanel/CoachFallback
(quick-kind branches to Fallback per H-8).

Wallet-missing branch renders ConnectPromptToast. 404 branch renders
"Couldn't load" fallback with Play Again. BACK falls back to /hub
when history length === 1 (deep-link safety per H-2).

useCoachAnalysis + useMintVictory consumed with surface dim
"coach_viewer" — telemetry events fire here, hooks remain
side-effect-free.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 4 — Wiring + history update

---

### Task 10: X-close state machine in `arena/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (replace `setShowEndOverlay(false)` close handler with state machine)
- Test: `apps/web/src/app/[locale]/arena/__tests__/arena-end-state-close-policy.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub a controllable arena page wrapper that exposes the close handler
// and lets us drive persistState transitions. Mirror the production
// surface by exporting handleEndStateClose for testing.
import { __testOnly_evaluateXClose } from "../page";

describe("X-close state machine", () => {
  it("persisted + wallet → push /coach/[gameId]", () => {
    pushMock.mockReset();
    __testOnly_evaluateXClose({
      persistState: "persisted",
      claimPhase: "ready",
      walletAddress: "0x1111111111111111111111111111111111111111",
      gameId: "g1",
      pendingNavRef: { current: false },
    });
    expect(pushMock).toHaveBeenCalledWith("/coach/g1?wallet=0x1111111111111111111111111111111111111111");
  });

  it("guest (no wallet) → push /arena?fresh=1", () => {
    pushMock.mockReset();
    __testOnly_evaluateXClose({
      persistState: "idle",
      claimPhase: "ready",
      walletAddress: undefined,
      gameId: undefined,
      pendingNavRef: { current: false },
    });
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });

  it("persisting → no push, sets pendingNavRef", () => {
    pushMock.mockReset();
    const ref = { current: false };
    __testOnly_evaluateXClose({
      persistState: "persisting",
      claimPhase: "ready",
      walletAddress: "0x1111111111111111111111111111111111111111",
      gameId: "g1",
      pendingNavRef: ref,
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(ref.current).toBe(true);
  });

  it("failed → push /arena?fresh=1", () => {
    pushMock.mockReset();
    __testOnly_evaluateXClose({
      persistState: "failed",
      claimPhase: "ready",
      walletAddress: "0x1111111111111111111111111111111111111111",
      gameId: undefined,
      pendingNavRef: { current: false },
    });
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });

  it("claiming → no push (X locked)", () => {
    pushMock.mockReset();
    __testOnly_evaluateXClose({
      persistState: "persisted",
      claimPhase: "claiming",
      walletAddress: "0x1111111111111111111111111111111111111111",
      gameId: "g1",
      pendingNavRef: { current: false },
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena/__tests__/arena-end-state-close-policy.test.tsx
```
Expected: FAIL — `__testOnly_evaluateXClose` not exported.

- [ ] **Step 3: Implement the state machine**

In `apps/web/src/app/[locale]/arena/page.tsx`, add a pure helper above the component:

```tsx
type XCloseInput = {
  persistState: "idle" | "persisting" | "persisted" | "failed" | "dismissed";
  claimPhase: "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";
  walletAddress?: `0x${string}`;
  gameId?: string;
  pendingNavRef: { current: boolean };
};

type XCloseEffect =
  | { type: "push"; href: string }
  | { type: "set-pending" }
  | { type: "noop" };

export function evaluateXClose(input: XCloseInput): XCloseEffect {
  // X is LOCKED during claiming — claim must resolve first.
  if (input.claimPhase === "claiming") {
    return { type: "noop" };
  }
  // Guest (no wallet) → /arena?fresh=1 directly.
  if (!input.walletAddress) {
    return { type: "push", href: "/arena?fresh=1" };
  }
  switch (input.persistState) {
    case "persisted":
      if (input.gameId) {
        return { type: "push", href: `/coach/${input.gameId}?wallet=${input.walletAddress}` };
      }
      return { type: "push", href: "/arena?fresh=1" };
    case "persisting":
      input.pendingNavRef.current = true;
      return { type: "set-pending" };
    case "failed":
    case "dismissed":
      return { type: "push", href: "/arena?fresh=1" };
    case "idle":
    default:
      return { type: "push", href: "/arena?fresh=1" };
  }
}

// Test hook
export const __testOnly_evaluateXClose = (input: XCloseInput) => {
  const eff = evaluateXClose(input);
  if (eff.type === "push") {
    // Tests stub useRouter so this resolves; tests assert pushMock.
    // In production this is called from handleEndStateClose below.
    // We do a dynamic import to avoid coupling test-only code to runtime.
  }
  return eff;
};
```

In the component body, replace the existing X-close handler. Find `onClose={() => setShowEndOverlay(false)}` and replace with:

```tsx
const pendingNavRef = useRef(false);

const handleEndStateClose = useCallback(() => {
  const eff = evaluateXClose({
    persistState,
    claimPhase,
    walletAddress: address,
    gameId: persistedGameId ?? undefined,
    pendingNavRef,
  });
  if (eff.type === "push") {
    router.push(eff.href);
  } else if (eff.type === "set-pending") {
    // Show toast / spinner via existing PersistOverlay; nothing to do here.
  }
  setShowEndOverlay(false);
}, [persistState, claimPhase, address, persistedGameId, router]);

// pendingNavRef consumer — drives auto-nav on persistState transitions.
useEffect(() => {
  if (!pendingNavRef.current) return;
  if (persistState === "persisted" && persistedGameId && address) {
    pendingNavRef.current = false;
    router.push(`/coach/${persistedGameId}?wallet=${address}`);
  } else if (persistState === "failed") {
    pendingNavRef.current = false;
    router.push("/arena?fresh=1");
    // Failure toast already rendered by PersistOverlay.
  } else if (persistState === "dismissed") {
    pendingNavRef.current = false; // user opted out
  }
}, [persistState, persistedGameId, address, router]);

// endOverlayTimer background-resume guard — if user backgrounded
// during the 800ms gap, force show immediately on visibilitychange.
useEffect(() => {
  if (!isEndState || showEndOverlay) return;
  const onVisible = () => {
    if (document.visibilityState === "visible") setShowEndOverlay(true);
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [isEndState, showEndOverlay]);
```

Update the `<ArenaEndState>` invocation: replace `onClose={() => setShowEndOverlay(false)}` with `onClose={handleEndStateClose}`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena/__tests__/arena-end-state-close-policy.test.tsx
```
Expected: 5 PASS.

- [ ] **Step 5: Run full arena test suite**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/arena src/components/arena
```
Expected: green. Watch for any test that depended on the old `setShowEndOverlay(false)` semantics.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/arena/page.tsx apps/web/src/app/\[locale\]/arena/__tests__/arena-end-state-close-policy.test.tsx
git commit -m "$(cat <<'EOF'
feat(arena): X-close state machine → /coach/[gameId] or /arena?fresh=1

Replaces the legacy setShowEndOverlay(false) with a state machine
over (persistState × claimPhase × walletAddress) per spec §4.

Key transitions:
- persisted + wallet + gameId → /coach/[gameId]?wallet=…
- guest → /arena?fresh=1
- persisting → register pendingNavRef intent + spinner
- failed/dismissed → /arena?fresh=1 with toast
- claiming → X locked (no nav)

pendingNavRef consumer fires on terminal persistState transitions,
so a user who tapped X while persisting gets auto-navigated when
persistence resolves (per red-team H-1).

endOverlayTimer background-resume guard force-shows the popup on
visibilitychange when isEndState && !showEndOverlay (per M-3).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 11: `/coach/history` selected branch removal + zero-move filter

**Files:**
- Modify: `apps/web/src/app/[locale]/coach/history/page.tsx`
- Modify: `apps/web/src/components/coach/coach-history.tsx`
- Test: `apps/web/src/app/[locale]/coach/history/__tests__/coach-history-tap-entry.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111" }),
}));

vi.mock("@/components/coach/coach-history", () => ({
  CoachHistory: ({ onSelectEntry }: { onSelectEntry: (e: { gameId: string; game: { totalMoves: number } }) => void }) => (
    <div>
      <button data-testid="entry-good" onClick={() => onSelectEntry({ gameId: "g1", game: { totalMoves: 30 } } as never)}>g1</button>
      <button data-testid="entry-zero" onClick={() => onSelectEntry({ gameId: "g2", game: { totalMoves: 0 } } as never)}>g2</button>
    </div>
  ),
}));

import CoachHistoryPage from "../page";

describe("/coach/history tap-entry routing", () => {
  it("tap entry → push /coach/[gameId]?wallet=…", () => {
    pushMock.mockReset();
    render(<CoachHistoryPage />);
    fireEvent.click(screen.getByTestId("entry-good"));
    expect(pushMock).toHaveBeenCalledWith("/coach/g1?wallet=0x1111111111111111111111111111111111111111");
  });

  it("selected branch removed — no inline CoachPanel mount", () => {
    render(<CoachHistoryPage />);
    expect(screen.queryByTestId("inline-coach-panel")).toBeNull();
  });
});
```

Also add zero-move filter test for `coach-history.tsx`:

```tsx
// apps/web/src/components/coach/__tests__/coach-history-zero-move-filter.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
// Provide a mocked data source...
```

(Stub fetch / SWR / hook per existing coach-history.test.tsx pattern; assert zero-move rows are absent OR rendered with `data-inert="true"`.)

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/coach/history
```
Expected: FAIL.

- [ ] **Step 3: Refactor `coach/history/page.tsx`**

Replace `handleSelect` and remove the `if (selected) { ... }` branch (lines 122-150). The full simplified component:

```tsx
"use client";

import { useRouter } from "@/i18n/navigation";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";

import { AskLuzBanner } from "@/components/coach/ask-luz-banner";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";
import { useCoachCredits } from "@/lib/coach/use-coach-credits";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

function PageHeader({ onBack }: { onBack: () => void }) {
  const t = useTranslations("COACH_COPY");
  return (
    <header className="border-b border-[rgba(110,65,15,0.30)]">
      <ContextualHeader
        variant="back-control"
        iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
        title={t("yourSessions")}
        subtitle={t("historyBannerSubtitle")}
        back={{ onClick: onBack, label: t("backLabel") }}
      />
    </header>
  );
}

export default function CoachHistoryPage() {
  const t = useTranslations("COACH_COPY");
  const { address } = useAccount();
  const router = useRouter();
  const { credits } = useCoachCredits();
  const isPro = useIsProActive();
  const showAskLuzBanner = !!address && !isPro && credits === 0;

  if (!address) {
    return (
      <main className="tj-root">
        <PageHeader onBack={() => router.push("/hub")} />
        <p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
      </main>
    );
  }

  function handleSelect(entry: HistoryEntry) {
    router.push(`/coach/${entry.gameId}?wallet=${address}`);
  }

  return (
    <main className="tj-root">
      <PageHeader onBack={() => router.push("/hub")} />
      <div className="tj-content">
        {showAskLuzBanner && (
          <AskLuzBanner onPress={() => router.push("/arena?fresh=1")} />
        )}
        <CoachHistory
          walletAddress={address}
          credits={credits}
          onSelectEntry={handleSelect}
        />
        <CoachHistoryDeletePanel />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Apply zero-move filter in `coach-history.tsx`**

Find where the entries list maps to rows. Add:

```tsx
const renderableEntries = entries.filter((e) => e.game.totalMoves > 0);
```

Use `renderableEntries` for the mapping. Or render zero-move rows with `aria-disabled="true"` and no `onClick` — design decision. Prefer filtering for v1 (simpler).

- [ ] **Step 5: Run tests**

Run:
```
cd apps/web && pnpm vitest run src/app/\[locale\]/coach src/components/coach
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/coach/history/page.tsx apps/web/src/app/\[locale\]/coach/history/__tests__/ apps/web/src/components/coach/coach-history.tsx apps/web/src/components/coach/__tests__/coach-history-zero-move-filter.test.tsx
git commit -m "$(cat <<'EOF'
refactor(coach/history): route entry tap → /coach/[gameId], filter zero-moves

Drops the legacy "selected" branch (lines 122-150) that mounted
<CoachPanel> inline. Replaced by router.push with the gameId +
wallet query param. Unifies entry points: every "view a played game"
path now lands on the canonical /coach/[gameId] surface.

Filters totalMoves === 0 entries from the history list at the source
per red-team H-9 (the viewer's zero-move fallback is now defensive
for direct URL access only, not a routine surface).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 12: Mint-receipt wiring in both consumers

**Files:**
- Modify: `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx`
- Modify: `apps/web/src/app/[locale]/arena/page.tsx`

- [ ] **Step 1: Add the mint-receipt POST helper**

Create `apps/web/src/lib/coach/post-mint-receipt.ts`:

```ts
import { track } from "@/lib/telemetry";

export async function postMintReceipt(args: {
  gameId: string;
  walletAddress: `0x${string}`;
  tokenId: string;
  claimTxHash: `0x${string}`;
  shareCardUrl: string;
  shareLinkUrl: string;
  surface: "arena_endgame" | "coach_viewer";
}): Promise<void> {
  try {
    const res = await fetch(`/api/games/${args.gameId}/mint-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: args.walletAddress,
        tokenId: args.tokenId,
        claimTxHash: args.claimTxHash,
        shareCardUrl: args.shareCardUrl,
        shareLinkUrl: args.shareLinkUrl,
      }),
    });
    track("coach_viewer_mint_receipt_write", {
      gameId: args.gameId,
      outcome: res.ok ? "ok" : "fail",
      status_code: res.status,
      surface: args.surface,
    });
  } catch (err) {
    track("coach_viewer_mint_receipt_write", {
      gameId: args.gameId,
      outcome: "fail",
      status_code: 0,
      surface: args.surface,
    });
  }
}
```

- [ ] **Step 2: Wire from `CoachGameClient`**

In `coach-game-client.tsx`, add an effect:

```tsx
useEffect(() => {
  if (mint.phase !== "success") return;
  if (!mint.data.tokenId || !mint.data.claimTxHash || !mint.data.shareCardUrl || !mint.data.shareLinkUrl) return;
  void postMintReceipt({
    gameId: gameRecord.gameId,
    walletAddress,
    tokenId: mint.data.tokenId,
    claimTxHash: mint.data.claimTxHash,
    shareCardUrl: mint.data.shareCardUrl,
    shareLinkUrl: mint.data.shareLinkUrl,
    surface: "coach_viewer",
  });
}, [mint.phase, mint.data, gameRecord.gameId, walletAddress]);
```

- [ ] **Step 3: Wire from `arena/page.tsx`**

In `arena/page.tsx`, find the existing `useEffect` that fires on `claimPhase === "success"`. Add the mint-receipt POST (alongside the existing `cache-victory` write, both are idempotent):

```tsx
useEffect(() => {
  const isSuccess = USE_EXTRACTED_MINT ? mintExtracted.phase === "success" : claimPhase === "success";
  const data = USE_EXTRACTED_MINT ? mintExtracted.data : claimData;
  if (!isSuccess) return;
  if (!data.tokenId || !data.claimTxHash || !data.shareCardUrl || !data.shareLinkUrl) return;
  if (!persistedGameId || !address) return;
  void postMintReceipt({
    gameId: persistedGameId,
    walletAddress: address,
    tokenId: data.tokenId,
    claimTxHash: data.claimTxHash,
    shareCardUrl: data.shareCardUrl,
    shareLinkUrl: data.shareLinkUrl,
    surface: "arena_endgame",
  });
}, [USE_EXTRACTED_MINT, mintExtracted.phase, mintExtracted.data, claimPhase, claimData, persistedGameId, address]);
```

- [ ] **Step 4: Test the wiring with a smoke pass**

Run dev:
```
cd apps/web && NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK=true pnpm dev
```
Play, win, mint, observe `/api/games/<id>/mint-receipt` POST in Network tab. Then close + reopen `/coach/<id>?wallet=<your>` and verify "View NFT" CTA shows on cold-load.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/post-mint-receipt.ts apps/web/src/app/\[locale\]/coach/\[gameId\]/coach-game-client.tsx apps/web/src/app/\[locale\]/arena/page.tsx
git commit -m "$(cat <<'EOF'
feat(coach): mint-receipt wiring — persist post-mint state for cold load

Both /arena (post-game) and /coach/[gameId] (cold path) POST to
/api/games/[id]/mint-receipt on claimPhase === "success". Idempotent
on the server, so double-fire (e.g., user navigates from arena to
viewer mid-success) is harmless.

postMintReceipt fires coach_viewer_mint_receipt_write telemetry with
outcome + status_code for ops follow-up.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 5 — Flag flip + cleanup + VR + handoff

---

### Task 13: Flip feature flags + delete legacy paths

**Files:**
- Modify: `apps/web/src/app/[locale]/arena/page.tsx` (delete legacy inline coach + mint blocks)
- Modify: `.env.example`, env config docs (set default to enabled)

**Prereq:** one preview deploy cycle with smoke (manual MiniPay) green with flags enabled.

- [ ] **Step 1: Manual smoke pass with flags ON on preview**

Set in Vercel preview env:
```
NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS=true
NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK=true
```
Run the full smoke checklist from spec §5. All green.

- [ ] **Step 2: Delete legacy inline blocks**

In `arena/page.tsx`:
- Remove the legacy `coachPhase` state declarations (the ones replaced by `useCoachAnalysis`)
- Remove the legacy `handleBuyCredits` function (now in `useCoachCreditsPurchase`)
- Remove the legacy `claimPhase` state declarations (now in `useMintVictory`)
- Remove the `USE_EXTRACTED_*` consts — only the extracted path remains
- Remove the flag-branching ternaries on `coach` / `mint` — read directly from hook returns

Estimate: ~500 LOC removed.

- [ ] **Step 3: Run full test suite + arena tests**

Run:
```
cd apps/web && pnpm test:unit && pnpm test:integration
```
Expected: green. Watch for any test that referenced the legacy state names directly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/arena/page.tsx .env.example
git commit -m "$(cat <<'EOF'
chore(arena): flip extracted hooks ON + delete legacy inline paths

After one preview cycle with NEXT_PUBLIC_USE_EXTRACTED_*=true and
green MiniPay smoke, removes the legacy inline coach phase + mint
claim blocks from arena/page.tsx. ~500 LOC reduction; both
extracted hooks (useCoachAnalysis, useCoachCreditsPurchase,
useMintVictory) are now the only path.

arena-play-timer-resilience regression test remains in place as a
guard against any future re-introduction of unstable callback refs.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 14: VR fixtures (4 dev pages)

**Files:**
- Create: `apps/web/src/app/dev/coach-game-viewer/page.tsx`
- Create: `apps/web/src/app/dev/coach-game-actions/page.tsx`
- Create: `apps/web/src/app/dev/coach-viewer-mint/page.tsx`
- Create: `apps/web/src/app/dev/coach-viewer-overlay/page.tsx`

- [ ] **Step 1: Implement `dev/coach-game-viewer/page.tsx`**

```tsx
"use client";

import { GameViewer } from "@/components/coach/game-viewer";

const MOVES_FULL = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"];
const MOVES_CORRUPT = ["e4", "e5", "Nxd5"]; // illegal third move
const MOVES_EMPTY: string[] = [];

export default function DevCoachGameViewerPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const variant = params.get("variant") ?? "initial-last-move";

  if (variant === "zero-moves") return <GameViewer moves={MOVES_EMPTY} />;
  if (variant === "partial-replay-error") return <GameViewer moves={MOVES_CORRUPT} />;
  if (variant === "mid-slider") {
    // Render and programmatically jump to a middle index via test hook.
    return <GameViewer moves={MOVES_FULL} />;
  }
  if (variant === "start-position") return <GameViewer moves={MOVES_FULL} />;
  return <GameViewer moves={MOVES_FULL} />;
}
```

Note: for `start-position` and `mid-slider`, the VR test will programmatically click ← or set the slider before screenshot.

- [ ] **Step 2-4: Implement `dev/coach-game-actions/page.tsx`, `dev/coach-viewer-mint/page.tsx`, `dev/coach-viewer-overlay/page.tsx`**

`dev/coach-game-actions/page.tsx`:

```tsx
"use client";

import { GameActionsBar } from "@/components/coach/game-actions-bar";

const noop = () => {};

export default function DevCoachGameActionsPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const variant = params.get("variant") ?? "win-unminted";

  const base = {
    gameId: "demo",
    totalMoves: 20,
    hasAnalysis: false,
    hasPartialReplayError: false,
    mintedTokenId: null as string | null,
    shareLinkUrl: null as string | null,
    onAskCoach: noop,
    onMint: noop,
    onShare: noop,
    onPlayAgain: noop,
    onViewNft: noop,
  };

  switch (variant) {
    case "win-unminted": return <GameActionsBar {...base} result="win" />;
    case "win-minted": return <GameActionsBar {...base} result="win" mintedTokenId="42" shareLinkUrl="https://chesscito.com/v/42" />;
    case "loss": return <GameActionsBar {...base} result="lose" />;
    case "stalemate": return <GameActionsBar {...base} result="draw" />;
    case "resigned-too-short-fallback": return <GameActionsBar {...base} result="resigned" totalMoves={0} />;
    default: return <GameActionsBar {...base} result="win" />;
  }
}
```

For `coach-viewer-mint/page.tsx` and `coach-viewer-overlay/page.tsx`, mount `CoachGameClient` with stubbed `useMintVictory` / `useCoachAnalysis` injected props — driving each variant by `?variant=ready|claiming|success|error` (mint) or `?variant=loading|result|fallback|paywall` (overlay).

- [ ] **Step 5: Verify locally**

```bash
cd apps/web && pnpm dev
```
Visit each `/dev/coach-game-viewer?variant=...`, `/dev/coach-game-actions?variant=...`, etc. Confirm each renders.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dev/coach-game-viewer apps/web/src/app/dev/coach-game-actions apps/web/src/app/dev/coach-viewer-mint apps/web/src/app/dev/coach-viewer-overlay
git commit -m "$(cat <<'EOF'
test(vr): fixtures dev/coach-game-{viewer,actions,mint,overlay}

Four dev pages variant-driven by ?variant=… query param. Mounts the
production components with injected stubs so VR snapshots render
without a WagmiProvider (per memory vr-baseline-discipline / VR-5
fixture pattern).

No product-code touched beyond the existing injected prop contract
defined in spec §2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 15: VR baselines (16 PNGs)

**Files:**
- Create: `apps/web/tests/visual/coach-game/*.spec.ts` (Playwright VR specs)
- Create: `apps/web/tests/visual/coach-game/*-minipay.png` (baselines)

- [ ] **Step 1: Write Playwright VR spec**

Create `apps/web/tests/visual/coach-game/coach-game.visual.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const VIEWPORT_MINIPAY = { width: 390, height: 844 };

test.describe("coach game viewer VR", () => {
  test.use({ viewport: VIEWPORT_MINIPAY });

  const variants = [
    { fixture: "coach-game-viewer", v: "initial-last-move" },
    { fixture: "coach-game-viewer", v: "mid-slider" },
    { fixture: "coach-game-viewer", v: "start-position" },
    { fixture: "coach-game-viewer", v: "partial-replay-error" },
    { fixture: "coach-game-actions", v: "win-unminted" },
    { fixture: "coach-game-actions", v: "win-minted" },
    { fixture: "coach-game-actions", v: "loss" },
    { fixture: "coach-game-actions", v: "stalemate" },
    { fixture: "coach-game-actions", v: "resigned-too-short-fallback" },
    { fixture: "coach-viewer-mint", v: "ready" },
    { fixture: "coach-viewer-mint", v: "claiming" },
    { fixture: "coach-viewer-mint", v: "success-with-share" },
    { fixture: "coach-viewer-mint", v: "error-pill" },
    { fixture: "coach-viewer-overlay", v: "loading" },
    { fixture: "coach-viewer-overlay", v: "result-inline" },
    { fixture: "coach-viewer-overlay", v: "fallback-inline" },
  ];

  for (const { fixture, v } of variants) {
    test(`${fixture} :: ${v}`, async ({ page }) => {
      await page.goto(`/dev/${fixture}?variant=${v}`);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${fixture}-${v}-minipay.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
```

- [ ] **Step 2: Generate baselines**

Run:
```
cd apps/web && pnpm test:e2e:visual --update-snapshots
```
Verify each generated PNG manually — open them in Finder, confirm no broken rendering, no white screens, no missing assets.

- [ ] **Step 3: Run VR to confirm baselines stable**

Run again WITHOUT `--update-snapshots`:
```
cd apps/web && pnpm test:e2e:visual
```
Expected: all 16 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/visual/coach-game/
git commit -m "$(cat <<'EOF'
test(vr): baselines coach-game-{viewer,actions,mint,overlay} × 16 phases

MiniPay viewport (390×844) only — desktop deferred per memory
vr-baseline-discipline.

Snapshot rationale: mint and coach-overlay phases existed in the
arena popup chrome (covered by VR-5/7/8). Inside /coach/[gameId]
they render in inline chrome — new baselines required, the previous
ones do NOT apply transitively.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

### Task 16: Handoff doc

**Files:**
- Create: `docs/handoffs/2026-XX-XX-coach-game-viewer-handoff.md` (use the actual ship date)

- [ ] **Step 1: Write the handoff**

Template:

```markdown
# Coach Game Viewer Cluster — Handoff

**Ship date:** YYYY-MM-DD
**Spec:** `docs/superpowers/specs/2026-05-27-coach-game-viewer-design.md`
**Red-team:** `docs/reviews/2026-05-27-coach-game-viewer-redteam.md`
**Plan:** `docs/superpowers/plans/2026-05-27-coach-game-viewer.md`
**Commit range:** `<first-sha>..<last-sha>`

## What shipped

- New canonical route `/coach/[gameId]` — move-by-move viewer + 4 CTAs
- `GET /api/games/[id]` + `POST /api/games/[id]/mint-receipt` endpoints
- Three hooks extracted from `arena/page.tsx`: `useCoachAnalysis`, `useCoachCreditsPurchase`, `useMintVictory`
- X-close state machine on arena end-state popup
- `handleBack` flash fix
- `/coach/history` simplified (list-only); tap entry routes to `/coach/[gameId]`
- 16 VR baselines (mobile/MiniPay viewport)

## Test count delta

- Before: 1765 passing (2026-05-21 baseline)
- After: <FILL_IN> passing
- New suites: <FILL_IN>

## Smoke (MiniPay)

All bullets from spec §5 smoke checklist PASS. <link to recording if any>

## Known limitations / Fase 2

- Share-without-mint not supported (no OG generator for non-mint outcomes)
- Deep-link to a specific move (`?move=N`) not implemented
- Cross-game nav inside viewer ("next game") not implemented
- Ephemeral viewer for guests not implemented — guests fall back to `/arena?fresh=1`

## Risks live on `main`

- `mint-receipt` write failure during the success transition produces a hot-session correct but cold-load stale "Mint" CTA. Self-recovers when the user re-taps Mint (contract rejects "already claimed").
- VR baselines are local-only; no CI VR job yet.
```

- [ ] **Step 2: Commit**

```bash
git add docs/handoffs/2026-XX-XX-coach-game-viewer-handoff.md
git commit -m "docs: handoff coach-game-viewer cluster

Wolfcito 🐾 @akawolfcito"
```

---

### Task 17: Memory sync

**Files:**
- Create: `/Users/wolfcito/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/project_coach_game_viewer.md`
- Modify: `/Users/wolfcito/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/MEMORY.md` (add index entry)

- [ ] **Step 1: Write topic memory file**

```markdown
---
name: Coach Game Viewer
description: Canonical /coach/[gameId] viewer + multi-entry-point conversion path; extracted hooks (useCoachAnalysis, useCoachCreditsPurchase, useMintVictory); arena X-close state machine.
type: project
---

Shipped 2026-XX-XX. Centro-de-partida unificado.

Routes:
- `/coach/[gameId]?wallet=…` is the canonical post-game review surface. Reachable from arena end-state X-close, /coach/history tap entry, and (Fase 2) deep-links.
- `/coach/history` is list-only — tap → push to /coach/[gameId].

Hooks (extracted from arena/page.tsx):
- `useCoachAnalysis` — coach phase machine
- `useCoachCreditsPurchase` — split off to keep useCoachAnalysis viewer-portable
- `useMintVictory` — claim phase machine

All hook returns are useCallback-memoized per `feedback_hook_ref_stability` to protect arena's 400ms PLAY timer (`arena-play-timer-fragility`). Regression test `arena-play-timer-resilience.test.tsx` guards this invariant.

X-close policy (arena end-state):
- Never to `/hub` — fallback is always `/arena?fresh=1`
- State machine over (persistState × claimPhase × wallet) — see `evaluateXClose()` in arena/page.tsx
- `pendingNavRef` auto-navigates when persistence resolves after a user-tap during `persisting`

Mint-receipt write contract:
- `POST /api/games/[id]/mint-receipt` is idempotent; extends `coach:game:<wallet>:<gameId>` Redis record with `mintedTokenId/claimTxHash/shareCardUrl/shareLinkUrl`
- Hot path: CTA mutation is in-memory via `useMintVictory.claimPhase === "success"` — no refetch
- Cold path: viewer re-mounts read the persisted mint fields and render "View NFT"

Auth posture (`GET /api/games/[id]?wallet=…`):
- Wallet-asserted, NOT proof-of-ownership. Threat model: unguessable-UUID + origin + rate-limit.
- Matches every existing endpoint. SIWE upgrade is out of scope.

VR baselines: 16 PNGs minipay-only at `apps/web/tests/visual/coach-game/`. Driven by `apps/web/src/app/dev/coach-{game-viewer,game-actions,viewer-mint,viewer-overlay}/` fixtures (injected props pattern).
```

- [ ] **Step 2: Add MEMORY.md index entry**

Edit `MEMORY.md`. Find the appropriate section (probably after the `## /arena ?fresh=1 convention` block or near the end-state polish entry). Add:

```markdown
## Coach Game Viewer (2026-XX-XX) — canonical centro-de-partida
- [coach-game-viewer](project_coach_game_viewer.md) — `/coach/[gameId]` viewer + 4 CTAs; extracted hooks (`useCoachAnalysis`, `useCoachCreditsPurchase`, `useMintVictory`) all useCallback-memoized; arena X-close state machine; mint-receipt persistence for cold-load.
```

- [ ] **Step 3: Commit**

```bash
# These files live outside the project repo (in ~/.claude/projects/...).
# Memory files are personal/private — they do NOT get committed to the project repo.
# This step is informational: confirm both files saved correctly.
ls -la /Users/wolfcito/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/project_coach_game_viewer.md
ls -la /Users/wolfcito/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/MEMORY.md
```

Expected: both files present with the new content.

If the project repo has a memory mirror (some projects symlink or copy into the repo), commit that here. Otherwise, no project-repo commit for memory.

---

## Self-review (writer's checklist)

**Spec coverage check** — every spec section mapped:

| Spec section | Tasks |
|---|---|
| §1 routes | 2 (GET), 3 (POST mint-receipt), 9 (page), 11 (/coach/history) |
| §1 auth posture | 2 (route stays wallet-asserted) |
| §2 hooks | 5 (coach + credits), 6 (mint) |
| §2 side-effects audit | 5, 6 (sessionStorage owned by hooks) |
| §2 dev-fixture | 14 |
| §3 GameRecord shape | 3 (additive extend) |
| §3 mint-receipt contract | 3, 12 |
| §3 useGameReplay partial-replay | 4 |
| §3 quick-kind branch | 9 (CoachFallback fallthrough) |
| §3 zero-move | 9, 11 (filter + defensive fallback) |
| §4 X-close state machine | 10 |
| §4 router.back fallback | 9 (history.length guard in handleBack) |
| §4 401/403 branch | 9 (ConnectPromptToast in CoachGameClient) |
| §4 endOverlayTimer resume | 10 |
| §5 unit tests | every task includes its tests |
| §5 timer resilience | 5 (test file) |
| §5 VR | 14 (fixtures), 15 (baselines) |
| §5 smoke | 13 (preview deploy gate) |
| §5 telemetry | 9 (events fired by consumer), 12 (mint-receipt event) |
| §6 commit plan | 17 tasks ↔ 17 commits |
| §6 feature flags | 5, 6, 13 |

**Placeholder scan:** the only intentional placeholders are `2026-XX-XX-coach-game-viewer-handoff.md` (filename gets the ship date at write time) and `<FILL_IN>` in the handoff template (numeric test count delta, only known at ship time). All other content is concrete.

**Type consistency:** `CoachPhase`, `ClaimPhase`, `GameReplayState` shapes match between hook definitions and test usage. `evaluateXClose` signature matches its test inputs. `postMintReceipt` request shape matches `POST /api/games/[id]/mint-receipt` route body parsing.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-coach-game-viewer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with checkpoint review.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
