# Analytics & Telemetry Test Patterns — Chesscito

Reference for designing tests for new analytics/telemetry code in the Chesscito project.

## Test Stack

- **Vitest 4.1.4** with jsdom environment (globals: true)
- **React Testing Library 16.3.2** for hook testing (`renderHook`, `waitFor`, `act`)
- **Tanstack React Query 5.90.21** (fresh QueryClient per render to avoid cache leakage)
- **Setup file**: `apps/web/vitest.setup.ts` provides global mocks for Next.js and i18n
- **Test file location**: `src/**/__tests__/<name>.test.{ts,tsx}` (glob in `vitest.config.ts`)

---

## 1. Telemetry Hook Testing

### Basic Pattern

Mock `@/lib/telemetry` at the **top level** (before imports), render the hook, trigger actions, inspect `track()` calls.

```typescript
// apps/web/src/hooks/__tests__/use-exercise-progress-telemetry.test.ts

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

// Mock dependencies the hook uses
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: vi.fn().mockResolvedValue({
    kind: "success",
    credited: 0,
    attestationHash: null,
    ledgerId: null,
    duplicate: false,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

import { act, renderHook } from "@testing-library/react";
import { track } from "@/lib/telemetry";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";

const mockTrack = vi.mocked(track);

// Helper to filter calls by event name
function callsOf(name: string) {
  return mockTrack.mock.calls.filter((c) => c[0] === name);
}

describe("useExerciseProgress — telemetry", () => {
  beforeEach(() => {
    localStorage.clear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("fires training_exercise_started once after hydration", async () => {
    const { rerender } = renderHook(() => useExerciseProgress("rook"));
    // Allow post-mount useEffect to run
    await Promise.resolve();

    const started = callsOf("training_exercise_started");
    expect(started).toHaveLength(1);
    expect(started[0]![1]).toMatchObject({
      piece: "rook",
      exerciseId: "rook-1",
      slotIndex: 0,
      isReplay: false,
    });

    // Verify de-duplication on re-render
    rerender();
    rerender();
    expect(callsOf("training_exercise_started")).toHaveLength(1);
  });

  it("training_exercise_completed fires every completeExercise call", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // 1 move → 3 stars
    });

    const completed = callsOf("training_exercise_completed");
    expect(completed).toHaveLength(1);
    expect(completed[0]![1]).toMatchObject({
      piece: "rook",
      exerciseId: "rook-1",
      movesUsed: 1,
      optimalMoves: 1,
      starsEarned: 3,
      isReplay: false,
      bestStarsBefore: 0,
      bestStarsAfter: 3,
    });
  });

  it("training_stars_earned fires only when delta > 0", async () => {
    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // Fresh 3★
    });

    const earned = callsOf("training_stars_earned");
    expect(earned).toHaveLength(1);
    expect(earned[0]![1]).toMatchObject({
      piece: "rook",
      exerciseId: "rook-1",
      delta: 3,
      newPieceTotal: 3,
    });
  });

  it("does NOT fire training_stars_earned on replay without improvement", async () => {
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({
        piece: "rook",
        exerciseIndex: 0,
        stars: [3, 0, 0, 0, 0],
      }),
    );

    const { result } = renderHook(() => useExerciseProgress("rook"));
    await Promise.resolve();

    act(() => {
      result.current.completeExercise(1); // Already 3★ — delta 0
    });

    expect(callsOf("training_stars_earned")).toHaveLength(0);
    // But the completed event still fires (every attempt is logged)
    expect(callsOf("training_exercise_completed")).toHaveLength(1);
  });
});
```

### Key Practices

1. **Guard conditions first** — Test "fires only when X" and "does NOT fire when Y" conditions separately
2. **Use `callsOf()` helper** — Cleaner than manually filtering `mockTrack.mock.calls`
3. **De-duplication tests** — Verify re-renders don't re-emit (use ref in hook to prevent)
4. **Payload shape assertions** — Use `.toMatchObject()` to verify all required fields
5. **Hydration delay** — `await Promise.resolve()` lets useEffect (post-mount) run before assertions
6. **Reset mocks per test** — `mockTrack.mockClear()` in `beforeEach`

---

## 2. API Route Testing (Supabase + Telemetry)

### Pattern for Payment/Ledger Routes

```typescript
// apps/web/src/app/api/verify-payment/__tests__/route.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks needed by other mocks
const mockGetReceipt = vi.hoisted(() => vi.fn());
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({ getTransactionReceipt: mockGetReceipt })),
  };
});

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { encodeAbiParameters, encodeEventTopics } from "viem";
import { POST } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);

// Helper: build realistic Supabase mock with chained calls
function buildSupabaseMock(opts: {
  existingRow?: { id: number; amount: number; attestation_hash?: string } | null;
  insertResult?: { data: { id: number } | null; error: { code?: string; message?: string } | null };
  raceRow?: { id: number; amount: number } | null;
  capRow?: { balance: number } | null;
} = {}) {
  const insertSpy = vi.fn();
  let selectIdx = 0;
  const rpc = vi.fn().mockResolvedValue({
    data: opts.capRow !== undefined ? [opts.capRow] : [{ balance: 50 }],
    error: null,
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockImplementation(() => {
          const idx = selectIdx++;
          if (idx === 0) {
            return Promise.resolve({ data: opts.existingRow ?? null });
          }
          return Promise.resolve({ data: opts.raceRow ?? null });
        }),
      })),
    })),
    insert: insertSpy.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(opts.insertResult ?? { data: { id: 1 }, error: null }),
      })),
    }),
  }));
  return { supabase: { from, rpc } as never, insertSpy };
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.CHESSCITO_TREASURY_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
  mockGetReceipt.mockReset();
  mockedSupabase.mockReset();
  mockedSupabase.mockReturnValue(buildSupabaseMock().supabase);
});

afterEach(() => {
  delete process.env.CHESSCITO_TREASURY_ADDRESS;
  vi.restoreAllMocks();
});

describe("fail-closed", () => {
  it("treasury unset → rail_not_configured, no receipt fetch, no ledger", async () => {
    delete process.env.CHESSCITO_TREASURY_ADDRESS;
    const res = await POST(makeRequest({ chainId: 42220, txHash: "0xabc" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("rail_not_configured");
    expect(mockGetReceipt).not.toHaveBeenCalled();
    expect(mockedSupabase).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it("malformed body → invalid_input", async () => {
    const res = await POST(new Request("http://localhost/api/verify-payment", {
      method: "POST",
      body: "not json",
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
  });
});

describe("crediting", () => {
  it("exact payment → credits nominal amount, duplicate false", async () => {
    const mock = buildSupabaseMock({ insertResult: { data: { id: 7 }, error: null } });
    mockedSupabase.mockReturnValue(mock.supabase);
    
    const res = await POST(makeRequest({
      chainId: 42220,
      txHash: "0xabc123",
      wallet: "0x0924...",
      token: "0xcebA9300...",
      sku: "peones_pack_50",
    }));
    
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, peonesCredited: 50, duplicate: false });
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("duplicate idempotency → success duplicate, no insert", async () => {
    const mock = buildSupabaseMock({ existingRow: { id: 99, amount: 50 } });
    mockedSupabase.mockReturnValue(mock.supabase);
    
    const res = await POST(makeRequest({
      chainId: 42220,
      txHash: "0xabc123",
      wallet: "0x0924...",
      token: "0xcebA9300...",
      sku: "peones_pack_50",
    }));
    
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, duplicate: true, peonesCredited: 50 });
    expect(mock.insertSpy).not.toHaveBeenCalled();
  });

  it("transient insert error but row landed → success duplicate, not 500", async () => {
    // On-chain transfer settled; a timeout error whose write actually committed
    // must NOT surface as a failed payment. Idempotency re-check finds row → success.
    const mock = buildSupabaseMock({
      insertResult: { data: null, error: { code: "08006", message: "timeout" } },
      raceRow: { id: 42, amount: 50 },
    });
    mockedSupabase.mockReturnValue(mock.supabase);
    
    const res = await POST(makeRequest({
      chainId: 42220,
      txHash: "0xabc123",
      wallet: "0x0924...",
      token: "0xcebA9300...",
      sku: "peones_pack_50",
    }));
    
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, duplicate: true });
  });
});
```

### Key Practices

1. **`vi.hoisted()` for hoisted mocks** — When a mock is used in another mock's definition, hoist it
2. **Builder functions for complex mock trees** — `buildSupabaseMock()` encapsulates nested chain logic
3. **Fail-closed first** — Test missing env var → 503, then input validation, then success paths
4. **Idempotency tests** — Verify duplicate detection + race condition handling
5. **Spy on side effects** — Track `insertSpy` to confirm ledger write attempts
6. **Env var cleanup** — `beforeEach` sets, `afterEach` deletes to avoid cross-test pollution

---

## 3. Custom Event Testing (Daily Progress Pattern)

### In-Tab Event Bus Pattern

```typescript
// From lib/daily/events.ts — CustomEvent-based in-tab bus

const EVENT_NAME = "chesscito:daily-progress-changed";

export function dispatchDailyProgressChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeToDailyProgressChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
```

### Test Pattern

```typescript
// apps/web/src/lib/exercises/__tests__/use-streak.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { bumpStreak, readStreak, resetStreak } from "../use-streak";

describe("useStreak storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readStreak returns 0 when no value is stored", () => {
    expect(readStreak()).toBe(0);
  });

  it("bumpStreak increments and returns the new value", () => {
    expect(bumpStreak()).toBe(1);
    expect(bumpStreak()).toBe(2);
    expect(readStreak()).toBe(3);
  });

  // Event dispatch test
  it("bumpStreak dispatches chesscito:streak-changed so subscribers can refresh", () => {
    let dispatched = 0;
    const handler = () => {
      dispatched += 1;
    };
    
    window.addEventListener("chesscito:streak-changed", handler);
    bumpStreak();
    expect(dispatched).toBe(1);
    window.removeEventListener("chesscito:streak-changed", handler);
  });

  it("resetStreak is a no-op when value is already 0 (no event dispatched)", () => {
    let dispatched = 0;
    const handler = () => {
      dispatched += 1;
    };
    
    window.addEventListener("chesscito:streak-changed", handler);
    resetStreak(); // No change, no event
    expect(dispatched).toBe(0);
    window.removeEventListener("chesscito:streak-changed", handler);
  });

  it("design invariant: streak storage is monotone — caller gates on isReplay", () => {
    // Documents architectural decision: the streak helper is unconditional;
    // the gate on replays lives in the caller (exercises-screen handleMove).
    bumpStreak();
    bumpStreak();
    expect(readStreak()).toBe(2);
    
    const before = readStreak();
    // Caller can choose NOT to bump — the gate is at call-site, not in bumpStreak
    expect(readStreak()).toBe(before);
  });
});
```

### Key Practices

1. **Counter pattern** — Track event dispatch with `let dispatched = 0` and a handler
2. **Add then remove listener** — Prevents cross-test pollution
3. **Test no-dispatch cases** — Verify events only fire under specific conditions
4. **Document architectural decisions** — Use tests to pin contracts (e.g., "gate is at call-site")

---

## 4. Mocking Reference

| Target | Pattern | Notes |
|--------|---------|-------|
| **Telemetry** | `vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }))` | Use `callsOf(name)` helper to filter by event |
| **Fetch** | `vi.stubGlobal("fetch", mockFn)` + `vi.unstubAllGlobals()` in afterEach | For fetch-based routes |
| **Supabase** | Builder fn with nested `.from().select().eq().maybeSingle()` chains | Each `.eq()` call increments `selectIdx` for multi-call sequences |
| **Viem** | `vi.hoisted(() => vi.fn())` for receipt, `encodeEventTopics()` + `encodeAbiParameters()` for logs | Construct realistic event logs from Transfer ABIs |
| **Wagmi** | `useAccount: vi.fn(() => ({ isConnected, address }))` | Guest mode by default (isConnected: false) |
| **Timers** | `vi.useFakeTimers()` → `vi.advanceTimersByTime(ms)` → `vi.useRealTimers()` | Wrap timer operations in `act()` |
| **Storage** | Pre-populate in `beforeEach`, clear in `afterEach` | Use `localStorage.setItem(key, JSON.stringify(...))` |
| **CustomEvent** | `window.addEventListener(EVENT, handler)` + counter pattern | Test dispatch + subscription symmetry |

---

## 5. Test Utilities & Providers

### `renderWithAppProviders()`

For wallet-dependent hooks (uses wagmi, Query, i18n):

```typescript
import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";

// Fresh QueryClient per render, avoids cache leakage
const { result } = renderWithAppProviders(
  <HookComponent />,
  { locale: "en" }
);
```

Wraps:
- `WagmiProvider` (config from `@/components/wallet-provider`)
- `QueryClientProvider` (fresh QueryClient, retry: false)
- `NextIntlClientProvider` (messages by locale)

### Global Mocks (vitest.setup.ts)

- `next/navigation`: router, pathname, searchParams mocks
- `@/i18n/navigation`: Link stub (renders as `<a>`)
- `next-intl/server`: `getTranslations()` walks EN message bundle by dotted path

No per-file boilerplate needed for these.

---

## 6. Test File Organization

- **Location**: `src/**/__tests__/<name>.test.{ts,tsx}`
- **Grouping**: Group assertions by concern (telemetry, error cases, edge cases)
- **Lifecycle**:
  - `beforeEach`: Reset mocks, clear storage, set env vars
  - `afterEach`: Clean up storage, restore mocks, delete env vars
  - Use async hooks when needed (`beforeEach(() => setupAsync())`)

### Example Layout

```
describe("featureName", () => {
  beforeEach(() => {
    localStorage.clear();
    mockTrack.mockClear();
  });

  describe("guard conditions", () => {
    it("fires when X", ...);
    it("does NOT fire when Y", ...);
  });

  describe("payload shape", () => {
    it("includes all required fields", ...);
    it("normalizes wallet/token to lowercase", ...);
  });

  describe("edge cases", () => {
    it("handles race conditions", ...);
    it("de-duplicates on re-render", ...);
  });
});
```

---

## 7. Common Patterns for Analytics

### Event Payload Assertions

```typescript
expect(callsOf("event_name")[0]![1]).toMatchObject({
  piece: "rook",
  exerciseId: "rook-1",
  delta: 3,
  newPieceTotal: 3,
});
```

Use `.toMatchObject()` to ignore extra fields and allow partial checks.

### Filtering Event Calls

```typescript
// Filter by event name
const earned = mockTrack.mock.calls.filter((c) => c[0] === "training_stars_earned");
// Or use the helper
const earned = callsOf("training_stars_earned");
```

### Hydration + State Update Pattern

```typescript
const { result, rerender } = renderHook(() => useHook());
await Promise.resolve(); // Let useEffect (post-mount) run

act(() => {
  result.current.method(); // Trigger state change
});

expect(mockTrack).toHaveBeenCalledWith(...);
rerender(); // Verify de-duplication
```

### Mocking Async Dependencies

```typescript
vi.mock("@/lib/peones/training-earn", () => ({
  submitTrainingExerciseEarn: vi.fn().mockResolvedValue({
    kind: "success",
    credited: 50,
    ledgerId: 123,
  }),
}));
```

Use `.mockResolvedValue()` for success, `.mockRejectedValue()` for errors.

---

## 8. Checklist for New Analytics Features

- [ ] Mock `@/lib/telemetry` at top level with `vi.mock()`
- [ ] Create `callsOf(eventName)` helper in test file
- [ ] Test each event's **guard conditions** (fires only when X, NOT when Y)
- [ ] Test **payload shape** (all fields present, correct type)
- [ ] Test **de-duplication** (re-render, replay, idempotency)
- [ ] Test **edge cases** (boundary crossings, zero-delta, error paths)
- [ ] Use `await Promise.resolve()` before assertions on post-mount effects
- [ ] Clear mocks in `beforeEach`, clear storage in `afterEach`
- [ ] For Supabase writes, use builder mock + `insertSpy` to verify calls
- [ ] For CustomEvents, use counter + add/remove listener pattern
- [ ] Document architectural decisions in test comments (e.g., "gate at call-site")

---

## References

- **Main telemetry test**: `apps/web/src/hooks/__tests__/use-exercise-progress-telemetry.test.ts` (5 training_* events, full guard condition coverage)
- **API route test**: `apps/web/src/app/api/verify-payment/__tests__/route.test.ts` (fail-closed, idempotency, race conditions)
- **CustomEvent test**: `apps/web/src/lib/exercises/__tests__/use-streak.test.ts` (dispatch, subscription, no-op cases)
- **Setup file**: `apps/web/vitest.setup.ts` (global mocks, message resolution)
- **Test utilities**: `apps/web/src/test-utils/render-with-app-providers.tsx` (wallet-backed UI)
- **Daily progress bus**: `apps/web/src/lib/daily/events.ts` (in-tab CustomEvent pattern)
