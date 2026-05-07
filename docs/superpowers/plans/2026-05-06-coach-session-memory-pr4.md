# Coach Session Memory — PR 4 Implementation Plan (Delete UI + DELETE endpoint)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the user-facing surface for Coach session memory — a `DELETE /api/coach/history` endpoint with chain/domain-bound signature + nonce + recovered-address binding (red-team P0-1/P0-8); a new `/coach/history` page route hosting the existing `<CoachHistory>` plus a new `<CoachHistoryDeletePanel>` (atop `<ConfirmDeleteSheet>` built on the project's `<Sheet>` primitive); a `useCoachHistoryCount` hook for the disabled-on-empty button (red-team P0-7); and `<CoachPanel>` props (`proActive` + `historyMeta`) threaded through `arena/page.tsx` so the in-result footer renders for PRO users. Free path stays bit-identical (locked by PR 2's inline snapshot — verified at every commit).

**Architecture:** Pure additive layer on top of PR 3's wired analyze route. The DELETE handler reuses the same fail-soft pattern as PR 3 (rate limit → input validate → atomic nonce claim → recover-or-401 → equality-or-403 → dual delete in `Promise.all`) and emits the spec-mandated `coach_history_deleted` / `coach_delete_supabase_unavailable` telemetry. The UI components are vanilla `useEffect + fetch + useState` (matches the existing `<CoachHistory>` pattern); state for the delete flow lives entirely within `<CoachHistoryDeletePanel>` and does not require app-level state. This is the FIRST surface to introduce viem's `recoverMessageAddress` — a single-line module comment in `route.ts` documents the choice (the codebase already uses ethers in `lib/server/demo-signing.ts` but new auth surfaces standardize on viem to match the wagmi client stack).

**Tech Stack:** TypeScript (strict), Vitest + RTL + jsdom, Next.js Route Handler (`DELETE`), Upstash Redis, supabase-js v2, viem (`recoverMessageAddress`, `isAddress`), wagmi (`useSignMessage`, `useAccount`), Radix Dialog via the project's `<Sheet>` primitive.

**Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — §8.2 (DELETE handler full security model), §9.1 (`<CoachPanel>` footer), §9.2 (`/coach/history` page), §9.3 (editorial constants), §10 (module map rows for `coach-panel`, `arena/page.tsx`, `coach/history` page, `coach-history-delete-panel`, `confirm-delete-sheet`, `use-coach-history-count`, `coach/history` route DELETE), §12 (`coach_history_deleted` + `coach_delete_supabase_unavailable`), §13 (PR 4 scope), §15 (P0-1 replay defense, P0-2 `/coach/history` route, P0-3 `<CoachPanel>` props, P0-7 honest delete UX, P0-8 recovered-vs-body, P2-1 `<Sheet>` primitive).

**Free-path snapshot regression guard:** the inline snapshot in `apps/web/src/lib/coach/__tests__/prompt-template.test.ts` (PR 2 commit `bf4bc85`) MUST stay green at every commit. This PR only touches surfaces downstream of the prompt template — `route.test.ts` is for `/api/coach/history`, not `/api/coach/analyze` — so the guard is exercised by running `pnpm --filter web test -- prompt-template --run` in Tasks 2 and 9 explicitly.

**Out of scope for PR 4** (PR 5): privacy page copy with `PRIVACY_COACH_COPY`, cron purge route, `PRO_COPY` array swap (`perksRoadmap` → `perksActive`), first-run banner localStorage flag (`chesscito:coach-history-callout-seen`), `docs/runbooks/log-salt-rotation.md`. The cached `existingAnalysis` short-circuit propagating `proActive` (carried forward from PR 3 review I-1 follow-up) — also deferred to PR 5 or beyond.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/src/lib/content/editorial.ts` | MODIFIED | Append `historyFooter` (building / reviewing / manageLabel) and `historyDelete` (title, body, cta, confirmTitle, confirmBody, confirmAccept, confirmCancel, signMessage(nonce, iso), successToast, errorToast) entries to `COACH_COPY`. |
| `apps/web/src/app/api/coach/history/route.ts` | MODIFIED | Add `DELETE` handler with full security flow per spec §8.2. Reuses `enforceOrigin`, `enforceRateLimit`, `getRequestIp`. New imports: `recoverMessageAddress` (viem), `getSupabaseServer`, `createLogger` + `hashWallet`, `REDIS_KEYS.deleteNonce` (PR 3 added). |
| `apps/web/src/app/api/coach/history/__tests__/route.test.ts` | MODIFIED | Append `describe("DELETE /api/coach/history", …)` block with 8 specs covering each error code (400/401/403/409/410/503) + happy path + nonce-replay short-circuit. |
| `apps/web/src/lib/coach/use-coach-history-count.ts` | NEW | `useCoachHistoryCount(walletAddress?: string)` returning `{ rowCount: number \| undefined, isLoading: boolean, refetch: () => void }`. Plain `useEffect + fetch + useState`, matches `<CoachHistory>` pattern. |
| `apps/web/src/lib/coach/__tests__/use-coach-history-count.test.tsx` | NEW | RTL hook test: loading, success, error, refetch. |
| `apps/web/src/components/coach/confirm-delete-sheet.tsx` | NEW | Generic confirm sheet built atop `<Sheet>` primitive. Props: `open`, `onOpenChange`, `title`, `body`, `confirmLabel`, `cancelLabel`, `onConfirm`, `isWorking`. Uses `<Sheet side="bottom">` for mobile. |
| `apps/web/src/components/coach/__tests__/confirm-delete-sheet.test.tsx` | NEW | RTL: renders title/body when open, fires onConfirm/onCancel correctly, disables confirm button when isWorking. |
| `apps/web/src/components/coach/coach-history-delete-panel.tsx` | NEW | Wires `useCoachHistoryCount` + `useAccount` (wagmi) + `useSignMessage` (wagmi). Disabled-on-empty button (P0-7), confirm sheet, generates nonce client-side, signs message, calls DELETE, reflects success/error inline (no global toaster — keeps scope contained; spec's `successToast`/`errorToast` strings render as inline status text). |
| `apps/web/src/components/coach/__tests__/coach-history-delete-panel.test.tsx` | NEW | RTL: button disabled when rowCount===0, button enabled with rowCount>0, opens sheet, success path triggers DELETE call, error path shows error toast text, sign cancellation closes sheet without calling DELETE. |
| `apps/web/src/app/coach/history/page.tsx` | NEW | Client page route (`"use client"`). Reads `address` from `useAccount`. Renders `<CoachHistory>` (when address present) and `<CoachHistoryDeletePanel>`. Empty fallback when no wallet connected. |
| `apps/web/src/components/coach/coach-panel.tsx` | MODIFIED | Add `proActive?: boolean` and `historyMeta?: { gamesPlayed: number }` props. Render `<p data-testid="coach-history-footer">` when both present. |
| `apps/web/src/components/coach/__tests__/coach-panel.test.tsx` | NEW | RTL: footer renders when `proActive && historyMeta`, "Building your history…" when `gamesPlayed === 0`, pluralization correct, hidden for free, manage link href correct. |
| `apps/web/src/app/arena/page.tsx` | MODIFIED | Capture `proActive` + `historyMeta` from `analyzeData` (already returned by PR 3) into local state. Thread both into `<CoachPanel>` Props. |

`prompt-template.ts`, `history-digest.ts`, `weakness-tags.ts`, `persistence.ts`, `backfill.ts`, `redis-keys.ts`, `logger.ts`, `analyze/route.ts` are not modified.

---

## Task 1: `COACH_COPY` editorial entries

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

Pure-string additions. No new test file required (editorial constants are exercised transitively by component tests in later tasks).

- [ ] **Step 1: Append entries to `COACH_COPY`**

Edit `apps/web/src/lib/content/editorial.ts`. Locate the `COACH_COPY` object (starts at line 678). Append these properties at the end of the object literal (before the closing `} as const;` line — verify the closing pattern by reading the surrounding code first):

```ts
  /* Coach session memory (PR 4 + PR 5). The footer renders inside
   * <CoachPanel> when proActive && historyMeta are present. */
  historyFooter: {
    building: "Building your history…",
    reviewing: (n: number) => `Reviewing ${n} past ${n === 1 ? "game" : "games"}`,
    manageLabel: "manage history",
  },
  /* Delete-by-self surface in /coach/history. Spec §8.2 / red-team
   * P0-1 (replay defense), P0-7 (honest UX), P0-8 (recovered-vs-body). */
  historyDelete: {
    title: "Delete all your Coach history",
    body:
      "Permanently removes every stored analysis from our records. This action cannot be undone. Your active PRO pass is unaffected.",
    cta: "Delete history",
    confirmTitle: "Delete all history?",
    confirmBody:
      "This will permanently remove all your past Coach analyses and weakness tracking. Your next analysis will start fresh.",
    confirmAccept: "Yes, delete everything",
    confirmCancel: "Keep my history",
    /* Chain + domain bound message format. Keep in lockstep with the
     * DELETE_MESSAGE template in app/api/coach/history/route.ts. */
    signMessage: (nonce: string, iso: string) =>
      `Delete my Coach history\nDomain: chesscito.app\nChain: 42220\nNonce: ${nonce}\nIssued: ${iso}`,
    /* Neutral wording so we never imply a positive action that may
     * not have happened (red-team P0-7). */
    successToast: "All Coach data cleared from our records",
    errorToast: "Could not delete — please retry",
  },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. The `as const` annotation already on `COACH_COPY` keeps the new entries narrowed.

- [ ] **Step 3: Run full suite — confirm nothing regressed**

Run: `pnpm --filter web test`
Expected: 935/935 pass (PR 3 baseline). No tests reference these new keys yet.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "$(cat <<'EOF'
feat(coach): COACH_COPY entries for delete UI + history footer

- historyFooter: building / reviewing(n) / manageLabel for <CoachPanel>
- historyDelete: title/body/cta + confirm sheet copy + signMessage()
  template (chain + domain bound) + successToast/errorToast (neutral
  wording per red-team P0-7)

Spec §9.3 — PR 4 of 5 (delete UI + DELETE endpoint).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: DELETE handler in `app/api/coach/history/route.ts`

**Files:**
- Modify: `apps/web/src/app/api/coach/history/route.ts`
- Modify: `apps/web/src/app/api/coach/history/__tests__/route.test.ts`

The full security flow per spec §8.2. Six explicit error codes + a happy path. Uses `recoverMessageAddress` from viem — first surface in this codebase to do so; a brief module comment documents the choice (existing demo-signing uses ethers; new auth surfaces standardize on viem to match the wagmi client stack).

- [ ] **Step 1: Append failing tests**

Append to `apps/web/src/app/api/coach/history/__tests__/route.test.ts`:

```ts
import { vi as _vi } from "vitest";

// recoverMessageAddress is mocked at the viem layer so tests don't have
// to compute real signatures. The DELETE handler is the only consumer of
// this API surface in this file, so a partial mock is safe.
vi.mock("viem", async (importActual) => {
  const actual = await importActual<typeof import("viem")>();
  return {
    ...actual,
    recoverMessageAddress: vi.fn(),
  };
});

import { DELETE } from "../route";
import { recoverMessageAddress } from "viem";

const mockedRecover = vi.mocked(recoverMessageAddress);

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_NONCE = "deadbeefcafef00d1234567890abcdef";
const VALID_SIG = "0x" + "11".repeat(65);

function makeDeleteRequest(body: unknown) {
  return new Request("http://localhost/api/coach/history", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function freshIso() {
  return new Date().toISOString();
}

describe("DELETE /api/coach/history", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    redisMock.del.mockReset();
    redisMock.lrange.mockReset();
    mockedRecover.mockReset();
    vi.stubEnv("LOG_SALT", "test-salt");

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    // Default: nonce successfully claimed (returns "OK" → truthy).
    redisMock.set.mockResolvedValue("OK");
    redisMock.del.mockResolvedValue(1);
    redisMock.lrange.mockResolvedValue([]);
  });

  it("400 — invalid wallet shape", async () => {
    const res = await DELETE(makeDeleteRequest({
      walletAddress: "0xnotanaddress",
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid nonce shape (not 32 hex chars)", async () => {
    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: "tooshort",
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(400);
  });

  it("410 — message older than 5 minutes", async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: stale,
    }));
    expect(res.status).toBe(410);
  });

  it("409 — nonce already claimed (replay)", async () => {
    redisMock.set.mockResolvedValue(null); // SETNX collision
    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(409);
  });

  it("401 — signature recovery throws", async () => {
    mockedRecover.mockRejectedValue(new Error("bad signature bytes"));
    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(401);
  });

  it("403 — recovered address ≠ body walletAddress", async () => {
    mockedRecover.mockResolvedValue("0xabababababababababababababababababababab");
    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(403);
  });

  it("503 — Supabase unavailable", async () => {
    mockedRecover.mockResolvedValue(VALID_WALLET);
    // Override the supabase mock for this test only.
    const { getSupabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(getSupabaseServer).mockReturnValue(null);

    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(503);
  });

  it("200 happy path — deletes Supabase rows + Redis keys", async () => {
    mockedRecover.mockResolvedValue(VALID_WALLET);

    // Supabase delete chain: from(...).delete({count:'exact'}).eq(...).
    const supabaseDelete = vi.fn().mockResolvedValue({ count: 7, error: null });
    const supabaseEq = vi.fn().mockReturnValue(supabaseDelete);
    const supabaseDeleteWrap = vi.fn().mockReturnValue({ eq: supabaseEq });
    const supabaseFrom = vi.fn().mockReturnValue({ delete: supabaseDeleteWrap });
    const { getSupabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(getSupabaseServer).mockReturnValue({ from: supabaseFrom } as never);

    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.del.mockResolvedValue(3);

    const res = await DELETE(makeDeleteRequest({
      walletAddress: VALID_WALLET,
      signature: VALID_SIG,
      nonce: VALID_NONCE,
      issuedIso: freshIso(),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true, supabase_rows: 7 });
    expect(supabaseFrom).toHaveBeenCalledWith("coach_analyses");
    expect(supabaseEq).toHaveBeenCalledWith("wallet", VALID_WALLET);
    expect(redisMock.del).toHaveBeenCalledWith(
      `coach:analyses:${VALID_WALLET}`,
      `coach:analysis:${VALID_WALLET}:g1`,
      `coach:analysis:${VALID_WALLET}:g2`,
    );
  });
});
```

(The existing `getSupabaseServer` mock setup at the top of the test file should already be present from PR 2/PR 3 — re-use it. If absent, add `vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }))` near the other top-of-file mocks.)

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- coach/history --run`
Expected: 8 new tests FAIL with `DELETE is not a function` or similar import error.

- [ ] **Step 3: Add the DELETE handler**

Edit `apps/web/src/app/api/coach/history/route.ts`. Add imports at the top of the file:

```ts
import { recoverMessageAddress } from "viem";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLogger, hashWallet } from "@/lib/server/logger";
```

(Keep the existing `import { isAddress } from "viem";` line — viem now contributes two named imports.)

Append the handler at the end of the file:

```ts
const NONCE_TTL_S = 300;
const NONCE_RE = /^[0-9a-f]{32}$/i;
const ISO_AGE_LIMIT_MS = 5 * 60 * 1000;

/* Chain + domain bound. Keep in lockstep with COACH_COPY.historyDelete.signMessage. */
const DELETE_MESSAGE = (nonce: string, issuedIso: string) =>
  `Delete my Coach history\nDomain: chesscito.app\nChain: 42220\nNonce: ${nonce}\nIssued: ${issuedIso}`;

/* PR 4 introduces viem's recoverMessageAddress to this codebase.
 * lib/server/demo-signing.ts uses ethers for the demo-signer flow, but
 * new auth surfaces standardize on viem to match the wagmi client stack
 * already in apps/web/src/components/wallet-provider.tsx. */
export async function DELETE(req: Request) {
  const log = createLogger({ route: "/api/coach/history" });

  try {
    enforceOrigin(req);
    await enforceRateLimit(getRequestIp(req));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, signature, nonce, issuedIso } = body as {
    walletAddress?: string;
    signature?: string;
    nonce?: string;
    issuedIso?: string;
  };

  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!signature || !signature.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!nonce || !NONCE_RE.test(nonce)) {
    return NextResponse.json({ error: "Invalid nonce" }, { status: 400 });
  }
  if (!issuedIso) {
    return NextResponse.json({ error: "Missing issuedIso" }, { status: 400 });
  }

  const issuedAtMs = Date.parse(issuedIso);
  if (!Number.isFinite(issuedAtMs)) {
    return NextResponse.json({ error: "Invalid issuedIso" }, { status: 400 });
  }
  if (Math.abs(Date.now() - issuedAtMs) > ISO_AGE_LIMIT_MS) {
    return NextResponse.json({ error: "Message expired" }, { status: 410 });
  }

  // Atomic nonce claim. Replays within the 5-min window collide here.
  const nonceKey = REDIS_KEYS.deleteNonce(nonce);
  const claimed = await redis.set(nonceKey, walletAddress.toLowerCase(), {
    nx: true,
    ex: NONCE_TTL_S,
  });
  if (!claimed) {
    return NextResponse.json({ error: "Nonce already used" }, { status: 409 });
  }

  // Recover signing address. Bad signature → 401.
  const message = DELETE_MESSAGE(nonce, issuedIso);
  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  // Strict-equality check — recovered address MUST match body walletAddress.
  // Otherwise an attacker can sign with wallet A and pass B in body to wipe B.
  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "Address mismatch" }, { status: 403 });
  }

  // ALL deletes key off the recovered address — never the body field.
  const wallet = recovered.toLowerCase();

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("coach_delete_supabase_unavailable", { wallet_hash: hashWallet(wallet) });
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const [supaRes, redisKeysDeleted] = await Promise.all([
    supabase.from("coach_analyses").delete({ count: "exact" }).eq("wallet", wallet),
    (async () => {
      const ids = await redis.lrange<string>(REDIS_KEYS.analysisList(wallet), 0, -1);
      const keys = [
        REDIS_KEYS.analysisList(wallet),
        ...ids.map((id) => REDIS_KEYS.analysis(wallet, id)),
      ];
      return keys.length > 0 ? redis.del(...keys) : 0;
    })(),
  ]);

  log.info("coach_history_deleted", {
    wallet_hash: hashWallet(wallet),
    supabase_rows: supaRes.count ?? 0,
    redis_keys_deleted: redisKeysDeleted, // count, not array — red-team P2-2
  });

  return NextResponse.json({ deleted: true, supabase_rows: supaRes.count ?? 0 });
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- coach/history --run`
Expected: PASS, 8 new specs + existing GET specs.

- [ ] **Step 5: Run prompt-template snapshot**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs (snapshot still green — this PR doesn't touch the template).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/coach/history/route.ts apps/web/src/app/api/coach/history/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): DELETE /api/coach/history with full security flow

- Chain + domain bound message + 5-min freshness + atomic nonce SETNX
  (red-team P0-1 replay defense)
- recoverMessageAddress (viem) — strict-equality vs body wallet
  (red-team P0-8)
- Service-unavailable 503 when supabase env missing (logs
  coach_delete_supabase_unavailable)
- Dual delete in Promise.all: Supabase coach_analyses + Redis
  analysisList + per-id keys
- Telemetry: coach_history_deleted with supabase_rows +
  redis_keys_deleted (count, not array — red-team P2-2)
- Six explicit error codes 400/401/403/409/410/503

Spec §8.2 / §12 — PR 4 of 5 (delete UI + DELETE endpoint).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: `useCoachHistoryCount` hook

**Files:**
- Create: `apps/web/src/lib/coach/use-coach-history-count.ts`
- Test: `apps/web/src/lib/coach/__tests__/use-coach-history-count.test.tsx` (NEW)

Plain hook over `GET /api/coach/history?wallet=…` returning the entry count. Drives the disabled-on-empty button (red-team P0-7) and refetches after a successful delete.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/coach/__tests__/use-coach-history-count.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCoachHistoryCount } from "../use-coach-history-count.js";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

describe("useCoachHistoryCount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns rowCount=undefined and isLoading=true initially", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    expect(result.current.rowCount).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("returns rowCount=N after successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ gameId: "g1" }, { gameId: "g2" }, { gameId: "g3" }]),
        }),
      ),
    );
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rowCount).toBe(3);
  });

  it("returns rowCount=0 on fetch error (fail-soft)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rowCount).toBe(0);
  });

  it("does not fetch when walletAddress is undefined", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCoachHistoryCount(undefined));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.rowCount).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("refetch() re-runs the request", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ gameId: "g1" }]),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.rowCount).toBe(1));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- use-coach-history-count --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the hook**

Create `apps/web/src/lib/coach/use-coach-history-count.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

/**
 * Read the wallet's Coach history entry count via GET /api/coach/history.
 *
 * Returns:
 * - `rowCount`: number when fetch succeeds, `undefined` while loading or
 *   when no wallet is supplied.
 * - `isLoading`: true while the in-flight request resolves.
 * - `refetch`: stable callback to re-run the request (used after delete
 *   to flip the disabled-button gate, red-team P0-7).
 *
 * Fail-soft: any fetch/network error resolves `rowCount` to 0 — same UX
 * as "you have nothing to delete" so the button stays disabled. Spec §9.2.
 */
export function useCoachHistoryCount(walletAddress: string | undefined): {
  rowCount: number | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  const [rowCount, setRowCount] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(walletAddress !== undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!walletAddress) {
      setRowCount(undefined);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/coach/history?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setRowCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRowCount(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { rowCount, isLoading, refetch };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- use-coach-history-count --run`
Expected: PASS, 5 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/coach/use-coach-history-count.ts apps/web/src/lib/coach/__tests__/use-coach-history-count.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): useCoachHistoryCount hook

- GET /api/coach/history?wallet=… → length
- Fail-soft: network errors resolve rowCount=0 (button stays disabled)
- Drives the disabled-on-empty gate in <CoachHistoryDeletePanel>
  (red-team P0-7)
- refetch() callback so the panel can re-flip after delete

Spec §9.2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: `<ConfirmDeleteSheet>` component

**Files:**
- Create: `apps/web/src/components/coach/confirm-delete-sheet.tsx`
- Test: `apps/web/src/components/coach/__tests__/confirm-delete-sheet.test.tsx` (NEW)

Generic confirm sheet built atop the project's `<Sheet>` primitive. No Coach-specific logic — accepts title/body/labels via props so it can be reused if PR 5 needs another confirm flow.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/coach/__tests__/confirm-delete-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDeleteSheet } from "../confirm-delete-sheet";

describe("<ConfirmDeleteSheet>", () => {
  it("renders title and body when open", () => {
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("This is permanent.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /no/i })).toBeEnabled();
  });

  it("does not render when open=false", () => {
    render(
      <ConfirmDeleteSheet
        open={false}
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
  });

  it("fires onConfirm when accept button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        isWorking={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onOpenChange(false) when cancel button clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={onOpenChange}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /no/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons when isWorking=true", () => {
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking
      />,
    );
    expect(screen.getByRole("button", { name: /yes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /no/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- confirm-delete-sheet --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/coach/confirm-delete-sheet.tsx`:

```tsx
"use client";

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  isWorking: boolean;
};

/**
 * Generic confirm sheet built atop the project's `<Sheet>` primitive
 * (Radix Dialog). Used by `<CoachHistoryDeletePanel>` for the destructive
 * delete-history flow (red-team P2-1: codebase has no `<Dialog>`, so the
 * confirm UI is a bottom sheet).
 *
 * Both buttons disable while the parent's onConfirm is pending so a user
 * can't double-click into a duplicate request.
 */
export function ConfirmDeleteSheet({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isWorking,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-rose-300 bg-white">
        <SheetTitle className="text-rose-600">{title}</SheetTitle>
        <SheetDescription className="text-sm text-rose-800/80">{body}</SheetDescription>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="game-danger"
            size="game"
            onClick={onConfirm}
            disabled={isWorking}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
          >
            {cancelLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

(Note: the `Button` component already supports `variant="game-danger"`/`game-ghost` per the design system; verify by reading `apps/web/src/components/ui/button.tsx` if uncertain — `game-danger` uses the rose tier, never `red-*`.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- confirm-delete-sheet --run`
Expected: PASS, 5 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/confirm-delete-sheet.tsx apps/web/src/components/coach/__tests__/confirm-delete-sheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): ConfirmDeleteSheet — destructive-action sheet

Generic confirm-then-act sheet built atop the project's <Sheet>
primitive (red-team P2-1: codebase has no <Dialog>). Used by
<CoachHistoryDeletePanel>; reusable for any future destructive flow.

- Both buttons disable while isWorking=true (no double-click duplicates)
- rose-tier styling per design system (never red-*)

Spec §9.2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: `<CoachHistoryDeletePanel>` component

**Files:**
- Create: `apps/web/src/components/coach/coach-history-delete-panel.tsx`
- Test: `apps/web/src/components/coach/__tests__/coach-history-delete-panel.test.tsx` (NEW)

The user-facing delete UI. Disabled-on-empty button (red-team P0-7), opens confirm sheet, generates 32-hex nonce client-side, calls wagmi's `useSignMessage`, posts to DELETE handler, surfaces success/error inline (no global toaster — keeps scope contained; spec's `successToast`/`errorToast` strings render as inline status text).

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/coach/__tests__/coach-history-delete-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CoachHistoryDeletePanel } from "../coach-history-delete-panel";

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useSignMessage: () => ({
    signMessageAsync: vi.fn(async () => "0x" + "11".repeat(65)),
  }),
}));

const useCoachHistoryCountMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/use-coach-history-count", () => ({
  useCoachHistoryCount: useCoachHistoryCountMock,
}));

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

describe("<CoachHistoryDeletePanel>", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    useCoachHistoryCountMock.mockReset();
    vi.restoreAllMocks();

    useAccountMock.mockReturnValue({ address: VALID_WALLET });
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 5,
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it("renders the panel title from COACH_COPY", () => {
    render(<CoachHistoryDeletePanel />);
    expect(screen.getByText(/Delete all your Coach history/i)).toBeInTheDocument();
  });

  it("disables the delete button when rowCount=0 (red-team P0-7)", () => {
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 0,
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<CoachHistoryDeletePanel />);
    expect(screen.getByRole("button", { name: /Delete history/i })).toBeDisabled();
  });

  it("enables the delete button when rowCount>0", () => {
    render(<CoachHistoryDeletePanel />);
    expect(screen.getByRole("button", { name: /Delete history/i })).toBeEnabled();
  });

  it("opens the confirm sheet when delete button clicked", () => {
    render(<CoachHistoryDeletePanel />);
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    expect(screen.getByText(/Delete all history\?/i)).toBeInTheDocument();
  });

  it("happy path: confirm → sign → DELETE → success status text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ deleted: true, supabase_rows: 5 }),
        }),
      ),
    );
    const refetch = vi.fn();
    useCoachHistoryCountMock.mockReturnValue({ rowCount: 5, isLoading: false, refetch });

    render(<CoachHistoryDeletePanel />);
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete everything/i }));

    await waitFor(() =>
      expect(screen.getByText(/All Coach data cleared/i)).toBeInTheDocument(),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("DELETE non-2xx → renders errorToast inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "boom" }),
        }),
      ),
    );

    render(<CoachHistoryDeletePanel />);
    fireEvent.click(screen.getByRole("button", { name: /Delete history/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete everything/i }));

    await waitFor(() =>
      expect(screen.getByText(/Could not delete — please retry/i)).toBeInTheDocument(),
    );
  });

  it("returns null when no wallet address (not connected)", () => {
    useAccountMock.mockReturnValue({ address: undefined });
    const { container } = render(<CoachHistoryDeletePanel />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- coach-history-delete-panel --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/coach/coach-history-delete-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { COACH_COPY } from "@/lib/content/editorial";
import { useCoachHistoryCount } from "@/lib/coach/use-coach-history-count";
import { ConfirmDeleteSheet } from "./confirm-delete-sheet";

type Status = "idle" | "working" | "success" | "error";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Delete-by-self surface for Coach history. Renders a button + confirm
 * sheet; on confirm, generates a nonce, signs the chain/domain-bound
 * message, and POSTs to DELETE /api/coach/history.
 *
 * Red-team:
 * - P0-7 — button is disabled when rowCount === 0; success text is
 *   neutral ("All Coach data cleared from our records") so we never
 *   imply a positive action that may not have happened.
 * - P0-1 / P0-8 — nonce + signature flow handled server-side; this
 *   component just generates the nonce and forwards the signature.
 *
 * Spec §9.2.
 */
export function CoachHistoryDeletePanel() {
  const { address } = useAccount();
  const { rowCount, isLoading, refetch } = useCoachHistoryCount(address);
  const { signMessageAsync } = useSignMessage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  if (!address) return null;

  const hasHistory = (rowCount ?? 0) > 0;

  async function signAndDelete() {
    if (!address) return;
    setStatus("working");
    try {
      const nonce = generateNonce();
      const issuedIso = new Date().toISOString();
      const message = COACH_COPY.historyDelete.signMessage(nonce, issuedIso);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/coach/history", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          nonce,
          issuedIso,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setConfirmOpen(false);
      refetch();
    } catch {
      // User cancelled wallet sign, or network error.
      setStatus("error");
    }
  }

  return (
    <section className="mt-8 border-t border-white/10 pt-4">
      <h3 className="text-sm font-bold text-rose-200">{COACH_COPY.historyDelete.title}</h3>
      <p className="mt-1 text-xs text-white/65">{COACH_COPY.historyDelete.body}</p>
      <Button
        type="button"
        variant="game-danger"
        size="game-sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isLoading || !hasHistory || status === "working"}
        className="mt-3"
      >
        {COACH_COPY.historyDelete.cta}
      </Button>
      {status === "success" && (
        <p data-testid="coach-history-delete-status-success" className="mt-2 text-xs text-emerald-400">
          {COACH_COPY.historyDelete.successToast}
        </p>
      )}
      {status === "error" && (
        <p data-testid="coach-history-delete-status-error" className="mt-2 text-xs text-rose-400">
          {COACH_COPY.historyDelete.errorToast}
        </p>
      )}
      <ConfirmDeleteSheet
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && status === "working") setStatus("idle");
        }}
        title={COACH_COPY.historyDelete.confirmTitle}
        body={COACH_COPY.historyDelete.confirmBody}
        confirmLabel={COACH_COPY.historyDelete.confirmAccept}
        cancelLabel={COACH_COPY.historyDelete.confirmCancel}
        onConfirm={signAndDelete}
        isWorking={status === "working"}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- coach-history-delete-panel --run`
Expected: PASS, 7 specs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/coach-history-delete-panel.tsx apps/web/src/components/coach/__tests__/coach-history-delete-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): CoachHistoryDeletePanel — sign + DELETE flow

- Disabled-on-empty button (red-team P0-7) via useCoachHistoryCount
- Client-side 32-hex nonce + chain/domain-bound message + wagmi
  useSignMessage → DELETE /api/coach/history
- Inline success/error status text (no global toaster — scope contained)
- success path refetches the count so the button re-disables to 0
- Returns null when wallet not connected (no surface to act on)

Spec §9.2 / red-team P0-1, P0-7, P0-8.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: `/coach/history` page route

**Files:**
- Create: `apps/web/src/app/coach/history/page.tsx`

The page mounts existing `<CoachHistory>` plus the new `<CoachHistoryDeletePanel>`. Client component because both children read `useAccount`. Empty fallback when no wallet connected.

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/coach/history/page.tsx`:

```tsx
"use client";

import { useAccount } from "wagmi";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";

/**
 * Coach session history page. Mounts the existing <CoachHistory> list
 * plus the new <CoachHistoryDeletePanel>. Page exists so the
 * "manage history" link in the <CoachPanel> footer (Task 7) has a target
 * (red-team P0-2 — verified the route did not exist before PR 4).
 *
 * Spec §9.2.
 */
export default function CoachHistoryPage() {
  const { address } = useAccount();

  if (!address) {
    return (
      <main className="mx-auto max-w-[var(--app-max-width,390px)] px-4 py-6">
        <p className="text-sm text-white/65">Connect your wallet to view your Coach history.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--app-max-width,390px)] px-4 py-6">
      <CoachHistory
        walletAddress={address}
        credits={0}
        onSelectEntry={() => {
          /* No-op on this dedicated page — entries are read-only here. */
        }}
      />
      <CoachHistoryDeletePanel />
    </main>
  );
}
```

(Reads `address` from wagmi like the rest of the app. Passes `credits={0}` because the dedicated history page doesn't need to display the credits header — `<CoachHistory>` accepts the prop verbatim. `onSelectEntry` is a no-op because there's no in-line analysis review on this surface in v1.)

- [ ] **Step 2: Typecheck — verify component contracts**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. If the `<CoachHistory>` `Props` shape doesn't match (e.g., it requires a non-undefined `onSelectEntry`), adjust to satisfy the existing contract — do not change the existing `<CoachHistory>` signature.

- [ ] **Step 3: Smoke-build the route — Next.js manifest**

Run: `pnpm --filter web exec next build` for a quick page-level type check, OR run `pnpm --filter web dev` and navigate to `/coach/history` manually. (The full build can be deferred to Task 9; this is just a sanity check.)

If `next build` is too slow, skip — Task 9's full suite covers compilation through Vitest's typecheck.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/coach/history/page.tsx
git commit -m "$(cat <<'EOF'
feat(coach): /coach/history page route

Mounts <CoachHistory> + <CoachHistoryDeletePanel> with wagmi
useAccount. Empty fallback when wallet disconnected. Route exists
so PR 4 Task 7's "manage history" footer link has a target
(red-team P0-2).

Spec §9.2.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: `<CoachPanel>` props + footer + tests

**Files:**
- Modify: `apps/web/src/components/coach/coach-panel.tsx`
- Create: `apps/web/src/components/coach/__tests__/coach-panel.test.tsx` (NEW)

Add the two new optional props and render the footer when both are present. The footer text is driven by `COACH_COPY.historyFooter` (Task 1) and links to `/coach/history` (Task 6).

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/coach/__tests__/coach-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachPanel } from "../coach-panel";
import type { CoachResponse } from "@/lib/coach/types";

const RESPONSE: CoachResponse = {
  kind: "full",
  summary: "You played a tight game.",
  mistakes: [],
  lessons: ["Watch your king safety."],
  praise: ["Solid opening."],
};

const baseProps = {
  response: RESPONSE,
  difficulty: "medium",
  totalMoves: 24,
  elapsedMs: 100_000,
  credits: 5,
  onPlayAgain: vi.fn(),
  onBackToHub: vi.fn(),
};

describe("<CoachPanel> footer (PR 4)", () => {
  it("does NOT render the footer when proActive is undefined", () => {
    render(<CoachPanel {...baseProps} />);
    expect(screen.queryByTestId("coach-history-footer")).toBeNull();
  });

  it("does NOT render the footer when historyMeta is undefined", () => {
    render(<CoachPanel {...baseProps} proActive />);
    expect(screen.queryByTestId("coach-history-footer")).toBeNull();
  });

  it("renders the 'Building your history…' footer when gamesPlayed === 0", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 0 }} />,
    );
    const footer = screen.getByTestId("coach-history-footer");
    expect(footer).toHaveTextContent(/Building your history/i);
  });

  it("renders 'Reviewing 1 past game' (singular) when gamesPlayed === 1", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 1 }} />,
    );
    expect(screen.getByTestId("coach-history-footer")).toHaveTextContent(/Reviewing 1 past game/i);
  });

  it("renders 'Reviewing 12 past games' (plural) when gamesPlayed > 1", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 12 }} />,
    );
    expect(screen.getByTestId("coach-history-footer")).toHaveTextContent(/Reviewing 12 past games/i);
  });

  it("includes a link to /coach/history with the manageLabel text", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    const link = screen.getByRole("link", { name: /manage history/i });
    expect(link).toHaveAttribute("href", "/coach/history");
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- coach-panel --run`
Expected: 6 new tests FAIL — `<CoachPanel>` doesn't yet accept `proActive`/`historyMeta` props or render the footer.

- [ ] **Step 3: Modify `coach-panel.tsx`**

Edit `apps/web/src/components/coach/coach-panel.tsx`. Add `Link` import at the top (after the existing imports):

```tsx
import Link from "next/link";
```

Update the `Props` type:

```tsx
type Props = {
  response: CoachResponse;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
  credits: number;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  onViewHistory?: () => void;
  /** PR 4: surfaces PRO-only history footer when truthy alongside historyMeta. */
  proActive?: boolean;
  /** PR 4: drives the footer's "Building your history…" / "Reviewing N past games" wording. */
  historyMeta?: { gamesPlayed: number };
};
```

Update the destructured params in the function signature to include the two new fields:

```tsx
export function CoachPanel({
  response,
  difficulty,
  totalMoves,
  elapsedMs,
  credits,
  onPlayAgain,
  onBackToHub,
  onViewHistory,
  proActive,
  historyMeta,
}: Props) {
```

Inside the JSX, AFTER the closing `</div>` of the CTA group (the last `<button>` that calls `onBackToHub`) and BEFORE the outer `</div>` of the function's return, add:

```tsx
      {proActive && historyMeta && (
        <p
          data-testid="coach-history-footer"
          className="mt-3 text-nano text-center"
          style={{ color: warmSubtle }}
        >
          {historyMeta.gamesPlayed === 0
            ? COACH_COPY.historyFooter.building
            : COACH_COPY.historyFooter.reviewing(historyMeta.gamesPlayed)}
          {" · "}
          <Link href="/coach/history" className="underline underline-offset-2">
            {COACH_COPY.historyFooter.manageLabel}
          </Link>
        </p>
      )}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- coach-panel --run`
Expected: PASS, 6 new specs (no pre-existing CoachPanel tests to regress).

- [ ] **Step 5: Run prompt-template snapshot**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/coach/coach-panel.tsx apps/web/src/components/coach/__tests__/coach-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): CoachPanel proActive/historyMeta footer

- New optional props proActive?: boolean + historyMeta?: { gamesPlayed }
- Footer renders only when both are present (red-team P0-3 props gap closed)
- "Building your history…" when gamesPlayed === 0;
  "Reviewing N past games" otherwise (singular for 1)
- "manage history" link to /coach/history (Task 6 route)

Spec §9.1.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: `arena/page.tsx` — thread `proActive`/`historyMeta`

**Files:**
- Modify: `apps/web/src/app/arena/page.tsx`

PR 3 already shipped `proActive: true` + `historyMeta: { gamesPlayed }` in the analyze response payload (§6.4). This task captures both fields into local state and passes them to `<CoachPanel>` (Task 7's new props).

- [ ] **Step 1: Add state hooks for the two new fields**

Edit `apps/web/src/app/arena/page.tsx`. Locate the existing state hooks for the coach (around line 130 — `coachPhase`, `coachResponse`, `coachJobId`, `coachCredits`, etc.). Append two more:

```ts
  const [coachProActive, setCoachProActive] = useState<boolean>(false);
  const [coachHistoryMeta, setCoachHistoryMeta] = useState<{ gamesPlayed: number } | undefined>(undefined);
```

- [ ] **Step 2: Capture from analyze response**

Locate the success branch where `analyzeData.status === "ready"` is handled (around line 283). The current code is:

```ts
if (analyzeData.status === "ready") {
  setCoachResponse(analyzeData.response);
  // …
  setCoachPhase("result");
}
```

Update it to also capture the new fields:

```ts
if (analyzeData.status === "ready") {
  setCoachResponse(analyzeData.response);
  setCoachProActive(analyzeData.proActive === true);
  setCoachHistoryMeta(analyzeData.historyMeta);
  // …
  setCoachPhase("result");
}
```

(The exact "// …" lines vary — preserve them. Just add the two `setCoach*` calls right after `setCoachResponse`.)

If there is also a job-completion branch (e.g., the `<CoachLoading>` component's `onReady` callback at line 1179) that sets `coachResponse`, it does NOT receive `proActive`/`historyMeta` from the job poll path — leave as-is. That path predates PR 3's payload extension and is acceptable in v1; the in-result footer just won't render after a long-running job. Spec acknowledges this as a non-blocking limitation (the cached short-circuit also has this).

- [ ] **Step 3: Pass the new props into `<CoachPanel>`**

Locate the `<CoachPanel ... />` usage at line 1198. Add the two new props at the end of the existing prop list:

```tsx
<CoachPanel
  response={coachResponse}
  difficulty={game.difficulty}
  totalMoves={game.moveCount}
  elapsedMs={game.elapsedMs}
  credits={coachCredits}
  onPlayAgain={handlePlayAgain}
  onBackToHub={handleBackToHub}
  onViewHistory={address ? () => setCoachPhase("history") : undefined}
  proActive={coachProActive}
  historyMeta={coachHistoryMeta}
/>
```

- [ ] **Step 4: Run prompt-template snapshot**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs (free-path snapshot still green — this PR didn't touch the template, but Task 8 is the largest non-test change in PR 4 so confirm explicitly).

- [ ] **Step 5: Run analyze route tests**

Run: `pnpm --filter web test -- analyze --run`
Expected: PASS — no analyze route changes here, but the route response shape is what we're consuming, so this guards against a regression.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/arena/page.tsx
git commit -m "$(cat <<'EOF'
feat(coach): arena/page.tsx — thread proActive/historyMeta to CoachPanel

PR 3 added proActive + historyMeta to the analyze response payload
(§6.4). PR 4 now captures them into local state and passes them to
<CoachPanel> so the new footer (Task 7) renders for PRO users.

The job-completion branch (long-running analyses via <CoachLoading>)
does not receive these fields — predates PR 3 and is acceptable in
v1; spec documents this as a non-blocking limitation.

Spec §9.1 / §10 (red-team P0-3 props plumbing).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `pnpm --filter web test`
Expected: PR 3 baseline ~935 + PR 4 adds:
- `route.test.ts` — 8 (DELETE)
- `use-coach-history-count.test.tsx` — 5
- `confirm-delete-sheet.test.tsx` — 5
- `coach-history-delete-panel.test.tsx` — 7
- `coach-panel.test.tsx` — 6

→ ≈ +31 specs, baseline ~966. No failures.

- [ ] **Step 2: Free-path snapshot guard**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs. The PR 2 → PR 3 → PR 4 snapshot regression guard is GREEN.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `pnpm --filter web lint`
Expected: no new warnings introduced. Pre-existing warnings (img-tag, exhaustive-deps) unchanged.

- [ ] **Step 5: Scope diff**

```bash
git diff --name-only main..HEAD -- apps/web/src
```

Expected (exactly):

```
apps/web/src/app/api/coach/history/__tests__/route.test.ts
apps/web/src/app/api/coach/history/route.ts
apps/web/src/app/arena/page.tsx
apps/web/src/app/coach/history/page.tsx
apps/web/src/components/coach/__tests__/coach-history-delete-panel.test.tsx
apps/web/src/components/coach/__tests__/coach-panel.test.tsx
apps/web/src/components/coach/__tests__/confirm-delete-sheet.test.tsx
apps/web/src/components/coach/coach-history-delete-panel.tsx
apps/web/src/components/coach/coach-panel.tsx
apps/web/src/components/coach/confirm-delete-sheet.tsx
apps/web/src/lib/coach/__tests__/use-coach-history-count.test.tsx
apps/web/src/lib/coach/use-coach-history-count.ts
apps/web/src/lib/content/editorial.ts
```

(13 files: 7 source + 5 tests + 1 page route. No analyze/route.ts. No prompt-template.ts. No types.ts. No backfill.ts. No persistence.ts.)

- [ ] **Step 6: Commit log review**

Run: `git log --oneline main..HEAD`

Expected: 8 commits in this approximate order (SHAs may vary):
1. `feat(coach): COACH_COPY entries for delete UI + history footer`
2. `feat(coach): DELETE /api/coach/history with full security flow`
3. `feat(coach): useCoachHistoryCount hook`
4. `feat(coach): ConfirmDeleteSheet — destructive-action sheet`
5. `feat(coach): CoachHistoryDeletePanel — sign + DELETE flow`
6. `feat(coach): /coach/history page route`
7. `feat(coach): CoachPanel proActive/historyMeta footer`
8. `feat(coach): arena/page.tsx — thread proActive/historyMeta to CoachPanel`

- [ ] **Step 7: Manual smoke (optional)**

If time allows — set `LOG_SALT` in `apps/web/.env.local`, run `pnpm --filter web dev`:
1. Connect a wallet without a PRO badge → `/coach/history` shows the existing `<CoachHistory>` and the delete panel; button is disabled if `coach:analyses:{wallet}` is empty.
2. With at least one analysis cached, click Delete → confirm sheet opens → click "Yes, delete everything" → wallet sign popup → submit → success status text "All Coach data cleared from our records" appears.
3. Verify `coach:analyses:{wallet}` is now empty in Redis (Upstash dashboard) and the Supabase `coach_analyses` table has no rows for the wallet.

- [ ] **Step 8: Done**

PR 4 is ready to open. Suggested PR title:

```
feat(coach): PR 4 — Delete UI + DELETE endpoint
```

PR body: link to spec §13 PR 4 + this plan. Note explicitly: "Free path stays bit-identical (snapshot still green); PRO users now see the history footer in their Coach analysis result; `/coach/history` exposes the delete-by-self surface."

---

## Self-review checklist

- [x] **Spec coverage:** §8.2 DELETE handler ✓ Task 2; §9.1 `<CoachPanel>` footer ✓ Task 7; §9.2 `/coach/history` page + `<CoachHistoryDeletePanel>` ✓ Tasks 5+6; §9.3 editorial ✓ Task 1; §10 module rows ✓ Tasks 1–8; §12 telemetry `coach_history_deleted` + `coach_delete_supabase_unavailable` ✓ Task 2. §15 P0-1 (replay defense) ✓ Task 2; P0-2 (`/coach/history` route) ✓ Task 6; P0-3 (`<CoachPanel>` props) ✓ Tasks 7+8; P0-7 (honest UX) ✓ Task 5 (disabled button + neutral toast); P0-8 (recovered-vs-body) ✓ Task 2; P2-1 (`<Sheet>` primitive) ✓ Task 4; P2-2 (`redis_keys_deleted` count not array) ✓ Task 2.
- [x] **Placeholder scan:** no TBD/TODO. Each step shows actual code. Task 8's "preserve // …" notation explicitly marks the existing lines that surround new ones — not a TODO.
- [x] **Type consistency:** `useCoachHistoryCount(walletAddress?: string)` returning `{ rowCount: number \| undefined; isLoading: boolean; refetch: () => void }` pinned in Task 3, consumed verbatim in Task 5. `<ConfirmDeleteSheet>` `Props` shape pinned in Task 4, consumed in Task 5. `<CoachPanel>` new props `proActive?: boolean` + `historyMeta?: { gamesPlayed: number }` pinned in Task 7, consumed in Task 8. `COACH_COPY.historyDelete.signMessage(nonce, iso)` template defined in Task 1, consumed in Task 5; the SAME template (verbatim) is the server-side `DELETE_MESSAGE` in Task 2's `route.ts` — the comment in editorial.ts ("Keep in lockstep") names this dependency for future maintainers.
- [x] **Free-path bit-identicality invariant:** snapshot guard re-verified at Tasks 2/7/8/9. Route changes are isolated to `/api/coach/history` (DELETE method) — analyze route and prompt template are untouched.
- [x] **Mock pattern consistency:** `vi.mock("wagmi", …)` uses the same hoisted-mock pattern as PR 3's analyze tests. The viem partial mock in Task 2 (`importActual` spread) is the standard idiom for keeping `isAddress` real while stubbing `recoverMessageAddress`. `vi.stubGlobal("fetch", …)` matches the pattern used elsewhere in the codebase for hook tests.
- [x] **Telemetry hygiene (red-team P2-2):** `coach_history_deleted` logs `redis_keys_deleted: number` (the `redis.del(...)` resolved value), never the raw key list. `wallet_hash` everywhere via `hashWallet()`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-coach-session-memory-pr4.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
