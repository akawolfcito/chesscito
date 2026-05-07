# Coach Session Memory — PR 5 Implementation Plan (Privacy + cron + copy unlock)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the rollout — render the privacy disclosure for Coach session memory on `/privacy`, ship the daily `coach-purge` cron job (batched delete of expired rows + Redis advisory lock + concurrency-protected GH Actions schedule), publish the `LOG_SALT` rotation runbook, swap "Personalized coaching plan from match history" from `PRO_COPY.perksRoadmap` → `perksActive` (it's now live), and surface a one-shot first-run banner inside `<CoachPanel>` so existing PRO users who watched SOON for weeks get an explicit "this is now active" affordance (red-team P2-3). Free path remains bit-identical (locked by PR 2's inline snapshot — verified at every commit).

**Architecture:** Pure additive layer on top of PR 4's UI. The cron route follows the existing `/api/cron/sync` pattern (auth via `CRON_SECRET` + `runtime: "nodejs"` + structured logging). The purge query uses Supabase's `.delete().lt("expires_at", now).order(...).limit(5000).select("game_id")` paginated-by-default approach, looping up to 20 passes (≤ 100k rows/run cap) with a Redis advisory lock to prevent overlapping schedules + manual `workflow_dispatch` collisions. The first-run banner state lives entirely in `<CoachPanel>` with a `useEffect` reading/writing `localStorage["chesscito:coach-history-callout-seen"]` (no app-level state needed, no SSR concern since CoachPanel is client-only). The privacy disclosure renders as a single `<section>` block beneath the existing `LEGAL_COPY.privacy.sections.map(...)` loop, sourced from a new `PRIVACY_COACH_COPY` constant in `editorial.ts`.

**Tech Stack:** TypeScript (strict), Vitest + RTL + jsdom, Next.js Route Handler (`GET`), Upstash Redis, supabase-js v2, GitHub Actions (cron + concurrency), markdown runbook.

**Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — §8.1 (cron purge full reference), §8.3 (privacy copy), §8.4 (`LOG_SALT` rotation contract), §9.4 (`PRO_COPY` array swap + first-run banner), §10 (module map rows for `app/privacy/page.tsx`, `lib/content/editorial.ts`, `app/api/cron/coach-purge/route.ts`, `.github/workflows`, `docs/runbooks/log-salt-rotation.md`), §12 (`coach_purge_complete` + `coach_purge_failed`), §13 (PR 5 scope), §15 (P0-6 cron concurrency, P1-8 LOG_SALT secrecy, P2-3 silent-perks-swap mitigation).

**Free-path snapshot regression guard:** the inline snapshot in `apps/web/src/lib/coach/__tests__/prompt-template.test.ts` (PR 2 commit `bf4bc85`) MUST stay green at every commit. PR 5 doesn't touch the prompt template or the analyze route, so the guard is exercised by Task 9 explicitly.

**Out of scope:** No further PRs after this one — Etapa 2 closes with this merge. Followups (cached `existingAnalysis` short-circuit propagating `proActive`, `<CoachLoading>` `onReady` capturing the new fields, `game-danger` Button variant) are tracked as v2 work.

**One spec deviation acknowledged upfront:** spec §10 module map lists `.github/workflows/cron-cache-sync.yml` as MODIFIED. This plan creates a NEW file `.github/workflows/cron-coach-purge.yml` instead, because the existing file has a different schedule (`*/15 * * * *`) and different endpoint — adding a second job to the same file would force shared concurrency or per-job conditionals. Separate workflow files give clean concurrency boundaries and independent failure handling. Functionally equivalent to spec §8.1; deviation noted in Task 5's commit message.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/src/lib/content/editorial.ts` | MODIFIED | (a) Add `PRIVACY_COACH_COPY` constant (heading + 4 paragraphs per §8.3). (b) `PRO_COPY.perksActive` += "Personalized coaching plan from match history"; `perksRoadmap` -= same string (array swap). (c) `COACH_COPY.featureBanner` += `{ title, body, dismiss }` strings. |
| `apps/web/src/app/privacy/page.tsx` | MODIFIED | Import `PRIVACY_COACH_COPY`; append a new `<section>` after the existing `sections.map(...)` block rendering heading + 4 paragraphs. |
| `apps/web/src/app/api/cron/coach-purge/route.ts` | NEW | `GET` handler: auth via `Bearer ${CRON_SECRET}` → Redis SETNX advisory lock at `coach:cron:purge` with 600s TTL → loop up to 20 passes of `.delete().lt("expires_at", now).order(...).limit(5000).select("game_id")` → log `coach_purge_complete` (info) on finish or `coach_purge_failed` (error) on Supabase error mid-loop → release lock in `finally`. |
| `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts` | NEW | 6 specs: 401 missing auth, 401 wrong auth, 200 with `{ skipped: true }` on lock contention, 200 multi-pass termination (counts cumulative rows), 500 on Supabase error mid-pass with partial count, lock released in `finally` even when supabase throws. |
| `apps/web/src/app/__tests__/privacy.test.tsx` | NEW | RTL: confirms the page renders the new `PRIVACY_COACH_COPY` heading + 4 paragraph titles + 4 paragraph bodies alongside the pre-existing privacy sections. |
| `apps/web/src/components/coach/coach-panel.tsx` | MODIFIED | Add a one-shot first-run banner (red-team P2-3): when `proActive` and `localStorage["chesscito:coach-history-callout-seen"]` is unset, render a top-of-panel banner with `COACH_COPY.featureBanner` strings + dismiss button. Click sets the localStorage flag and hides the banner. |
| `apps/web/src/components/coach/__tests__/coach-panel.test.tsx` | MODIFIED | Append 4 specs: banner renders when `proActive && !seen`, hidden for free, hidden when seen flag set, dismiss click writes the flag and hides the banner. |
| `.github/workflows/cron-coach-purge.yml` | NEW | Daily at 03:00 UTC. Concurrency group `cron-coach-purge` with `cancel-in-progress: false`. Reuses `CRON_URL` + `CRON_SECRET` repo secrets. |
| `docs/runbooks/log-salt-rotation.md` | NEW | Quarterly rotation procedure: generate new salt → `vercel env rm` + `vercel env add` for each environment → redeploy → operational notes (old wallet_hash log lines become non-correlatable post-rotation, which is the intended privacy property). |

`prompt-template.ts`, `analyze/route.ts`, `history/route.ts`, `backfill.ts`, `persistence.ts`, `history-digest.ts`, `weakness-tags.ts`, `redis-keys.ts`, `logger.ts`, `types.ts`, `arena/page.tsx` are not modified.

---

## Task 1: `PRIVACY_COACH_COPY` constant

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

Pure-string addition. No new test file required (the constant is exercised by the privacy page test in Task 3).

- [ ] **Step 1: Read the file**

Read `apps/web/src/lib/content/editorial.ts` around `LEGAL_COPY` (line 757) and the closing `} as const;` of that object (around line 830) to find a clean insertion point for a peer top-level export.

- [ ] **Step 2: Append the constant**

After the `LEGAL_COPY` `} as const;` closing line (around 830), insert:

```ts
/**
 * Coach session memory privacy disclosure (red-team P0-4 — corrected
 * path; lives in editorial.ts per CLAUDE.md SSOT rule, not legal-copy.ts).
 * Spec §8.3.
 *
 * Renders inside `app/privacy/page.tsx` as a separate <section> after
 * the existing privacy sections, so PRO subscribers can find the data-
 * handling story for their stored Coach analyses.
 */
export const PRIVACY_COACH_COPY = {
  heading: "Coach Match History (Chesscito PRO)",
  para1:
    "Active PRO subscribers have their game analyses stored to provide personalized coaching across sessions. We retain match analyses for 365 days from creation, after which they are automatically deleted. Free tier users' analyses live only in our 30-day cache and are never persisted long-term.",
  para2Title: "Your control:",
  para2:
    "You can delete all stored Coach history at any time via your wallet from the Coach history page, regardless of PRO status. Deletion is permanent and immediate.",
  para3Title: "What's stored:",
  para3:
    "Wallet address (lowercase), game ID, timestamps, game metadata (difficulty, result, total move count), and the AI-generated coaching response (summary, identified mistakes, lessons, praise). We do NOT store your full move list. No personal identifiers beyond the wallet address.",
  para4Title: "Lost wallet access:",
  para4:
    "Deletion requires control of the wallet that owns the analyses. If you lose access, contact support@chesscito.app for an out-of-band deletion request. We will require proof of original ownership.",
} as const;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run full suite — confirm nothing regressed**

Run: `pnpm --filter web test`
Expected: 971/971 PR 4 baseline pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "$(cat <<'EOF'
feat(coach): PRIVACY_COACH_COPY constant for /privacy page

- Heading + 4-paragraph disclosure: data we retain (365 days), user
  deletion control, exact stored fields ("not the move list"), and
  lost-wallet recourse path
- Lives in editorial.ts per CLAUDE.md SSOT rule (not legal-copy.ts)
- Spec §8.3 / red-team P0-4

PR 5 of 5 (privacy + cron + copy unlock).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 2: `PRO_COPY` array swap (perksRoadmap → perksActive)

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

Move "Personalized coaching plan from match history" from `perksRoadmap[0]` (where it landed in PR Bundle Etapa 1, commit `bfe0e88`) into the END of `perksActive`. The feature ships in this PR; the "SOON" chip should flip to active.

- [ ] **Step 1: Edit `PRO_COPY.perksActive`**

In `editorial.ts` (~line 989), the current `perksActive` is:

```ts
perksActive: [
  "AI Coach: instant analysis, no daily limit",
  "Your contribution keeps Chesscito free for new players",
] as const,
```

Replace with:

```ts
perksActive: [
  "AI Coach: instant analysis, no daily limit",
  "Personalized coaching plan from match history",
  "Your contribution keeps Chesscito free for new players",
] as const,
```

(Insert as the second item — the contribution line stays last because it's a meta-perk, not a feature perk.)

- [ ] **Step 2: Edit `PRO_COPY.perksRoadmap`**

Current (~line 1003):

```ts
perksRoadmap: [
  "Personalized coaching plan from match history",
  "Early access to new challenges",
  "Premium achievements",
  "Guided by FIDE Master + dev team",
] as const,
```

Replace with:

```ts
perksRoadmap: [
  "Early access to new challenges",
  "Premium achievements",
  "Guided by FIDE Master + dev team",
] as const,
```

(Drop the first entry; the rest stay in order.)

- [ ] **Step 3: Update the surrounding comment**

The existing comment block at lines 998-1002 mentions the bundle v1 reasoning. Update it to reflect that the PR 5 swap has landed:

```ts
  /** Roadmap labels rendered in `<ProSheet>` paired with `<ComingSoonChip />`
   *  (addendum §3.7 / §6.1 commit #6). The chip carries the "SOON" status,
   *  so labels here MUST stay suffix-free. Adding a new entry? Skip the
   *  inline "(coming soon)" — the chip handles it.
   *
   *  Bundle v1 (2026-05-05): tightened to items with a realistic plan.
   *  PR 5 (2026-05-06): "Personalized coaching plan from match history"
   *  graduated from roadmap → perksActive (Coach session memory shipped). */
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors. Any test that pinned the array length or specific index will need updating — sweep `pnpm --filter web test` next to surface failures.

- [ ] **Step 5: Run full suite**

Run: `pnpm --filter web test`
Expected: 971/971 (or 972 with editorial-snapshot-style tests). If a `<ProSheet>` test asserts the old array contents, update it to match the new shape — those updates are in scope for THIS commit.

If any tests fail because they assert the old `perksActive`/`perksRoadmap` arrays, locate them and update the assertions. Do NOT skip or @ts-ignore.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
# If any ProSheet/related tests had to be updated, stage them too.
git commit -m "$(cat <<'EOF'
feat(pro): graduate Coach memory perk to perksActive

PR 5 of 5 — Coach session memory ships, so "Personalized coaching plan
from match history" moves from PRO_COPY.perksRoadmap (SOON chip) to
PRO_COPY.perksActive. The first-run banner inside <CoachPanel> (Task 8)
gives existing PRO users an explicit "this is now active" affordance
since a silent array swap wouldn't notify them (red-team P2-3).

Spec §9.4 / §13.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 3: Privacy page renders `PRIVACY_COACH_COPY` section

**Files:**
- Modify: `apps/web/src/app/privacy/page.tsx`
- Create: `apps/web/src/app/__tests__/privacy.test.tsx` (NEW)

Render a new `<section>` block beneath the existing `sections.map(...)` loop, sourced from `PRIVACY_COACH_COPY`. Heading + 4 paragraphs (para1 alone, para2Title:para2, para3Title:para3, para4Title:para4).

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/app/__tests__/privacy.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "../privacy/page";

describe("Privacy page — Coach session memory section", () => {
  it("renders the PRIVACY_COACH_COPY heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Coach Match History \(Chesscito PRO\)/i)).toBeInTheDocument();
  });

  it("renders the para1 retention disclosure", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/365 days from creation/i)).toBeInTheDocument();
  });

  it("renders the 'Your control' subheading + body", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Your control:/i)).toBeInTheDocument();
    expect(screen.getByText(/Deletion is permanent and immediate/i)).toBeInTheDocument();
  });

  it("renders the 'What's stored' subheading + body — game metadata, not move list", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/What's stored:/i)).toBeInTheDocument();
    expect(screen.getByText(/We do NOT store your full move list/i)).toBeInTheDocument();
  });

  it("renders the 'Lost wallet access' subheading + body — out-of-band recourse", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Lost wallet access:/i)).toBeInTheDocument();
    expect(screen.getByText(/support@chesscito\.app/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- privacy --run`
Expected: 5 new tests FAIL — the page doesn't yet render the new section.

- [ ] **Step 3: Modify the privacy page**

Edit `apps/web/src/app/privacy/page.tsx`. Add `PRIVACY_COACH_COPY` to the import:

```tsx
import { LEGAL_COPY, PRIVACY_COACH_COPY } from "@/lib/content/editorial";
```

After the existing `{sections.map((section) => …)}` block and BEFORE the closing `</LegalPageShell>`, append:

```tsx
      <section>
        <h2
          className="mb-2 text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          {PRIVACY_COACH_COPY.heading}
        </h2>
        <p style={{ color: "var(--paper-text-muted)" }}>{PRIVACY_COACH_COPY.para1}</p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para2Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para2}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para3Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para3}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para4Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para4}
        </p>
      </section>
```

(Style values mirror the existing `<section>` blocks — `--paper-text` for headings, `--paper-text-muted` for bodies. Keep visual consistency.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- privacy --run`
Expected: PASS, 5 specs.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/privacy/page.tsx apps/web/src/app/__tests__/privacy.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): /privacy renders PRIVACY_COACH_COPY section

New <section> below the existing privacy sections rendering the
heading + 4 paragraphs from PRIVACY_COACH_COPY (Task 1). Visual styling
mirrors the existing privacy sections via the --paper-text* tokens.

Spec §8.3.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 4: `coach-purge` cron route

**Files:**
- Create: `apps/web/src/app/api/cron/coach-purge/route.ts`
- Test: `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts` (NEW)

Daily TTL purge with batched LIMIT (5000) + Redis advisory lock + error branch (red-team P0-6).

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

function makeRequest(auth?: string) {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request("http://localhost/api/cron/coach-purge", { headers });
}

function buildSupabaseChain(passes: Array<{ data?: unknown[]; error?: { message: string } | null }>) {
  let callIndex = 0;
  const limit = vi.fn().mockImplementation(() => Promise.resolve(passes[callIndex++] ?? { data: [], error: null }));
  const order = vi.fn().mockReturnValue({ limit });
  // Inner select chained after limit — supabase-js v2: `.select("game_id")` resolves the query.
  // We match the production ordering: from(...).delete().lt(...).order(...).limit(N).select("game_id")
  const selectAfterLimit = vi.fn().mockImplementation(() => Promise.resolve(passes[callIndex++] ?? { data: [], error: null }));
  const limitChained = vi.fn().mockReturnValue({ select: selectAfterLimit });
  const orderChained = vi.fn().mockReturnValue({ limit: limitChained });
  const lt = vi.fn().mockReturnValue({ order: orderChained });
  const del = vi.fn().mockReturnValue({ lt });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { from, del, lt, order: orderChained, limit: limitChained, select: selectAfterLimit };
}

describe("GET /api/cron/coach-purge", () => {
  const ORIG_SECRET = process.env.CRON_SECRET;

  beforeEach(() => {
    redisMock.set.mockReset();
    redisMock.del.mockReset();
    vi.mocked(getSupabaseServer).mockReset();
    vi.stubEnv("LOG_SALT", "test-salt");
    process.env.CRON_SECRET = "s3cret";
    redisMock.set.mockResolvedValue("OK");
    redisMock.del.mockResolvedValue(1);
  });

  afterEach(() => {
    if (ORIG_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIG_SECRET;
  });

  it("401 — missing authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("401 — wrong bearer", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns { skipped: true } when another run holds the lock", async () => {
    redisMock.set.mockResolvedValue(null); // SETNX collision
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: true, reason: "another run in progress" });
  });

  it("happy path — single pass returns rows_deleted with cumulative count", async () => {
    const chain = buildSupabaseChain([{ data: [{ game_id: "g1" }, { game_id: "g2" }], error: null }]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 2 });
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });

  it("happy path — multi-pass terminates when batch < limit", async () => {
    // Two passes: first returns 5000 rows, second returns 17 rows (< 5000 → break)
    const fullBatch = Array.from({ length: 5000 }, (_, i) => ({ game_id: `g${i}` }));
    const partial = Array.from({ length: 17 }, (_, i) => ({ game_id: `g${5000 + i}` }));
    const chain = buildSupabaseChain([
      { data: fullBatch, error: null },
      { data: partial, error: null },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    const body = await res.json();
    expect(body).toEqual({ rows_deleted: 5017 });
  });

  it("500 on supabase error mid-pass — partial count returned", async () => {
    const chain = buildSupabaseChain([
      { data: Array.from({ length: 5000 }, (_, i) => ({ game_id: `g${i}` })), error: null },
      { data: null, error: { message: "boom" } },
    ]);
    vi.mocked(getSupabaseServer).mockReturnValue({ from: chain.from } as never);
    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "purge failed", deleted_before_failure: 5000 });
    // Lock still released even on error (finally block).
    expect(redisMock.del).toHaveBeenCalledWith("coach:cron:purge");
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- coach-purge --run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the route**

Create `apps/web/src/app/api/cron/coach-purge/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const PURGE_BATCH_SIZE = 5_000;
const PURGE_LOCK_TTL_S = 600;
const PURGE_LOCK_KEY = "coach:cron:purge";
const PURGE_MAX_PASSES = 20;

const redis = Redis.fromEnv();

/**
 * Daily cron: deletes `coach_analyses` rows where `expires_at < now()`.
 *
 * Race-safe (red-team P0-6):
 * - Bearer auth via CRON_SECRET (matches /api/cron/sync convention).
 * - Redis SETNX advisory lock with 600s TTL prevents overlapping runs
 *   (scheduled run + manual workflow_dispatch + GH Actions retries).
 * - Batched LIMIT 5000 with up to 20 passes (≤ 100k rows/run cap)
 *   avoids table-level locks on backlog catch-up.
 * - Lock release in `finally` regardless of supabase outcome.
 *
 * Spec §8.1 / §12.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createLogger({ route: "/api/cron/coach-purge" });

  // Advisory lock — collision returns { skipped } so GH Actions doesn't
  // retry-spam (cancel-in-progress: false on the workflow side).
  const acquired = await redis.set(PURGE_LOCK_KEY, Date.now(), {
    nx: true,
    ex: PURGE_LOCK_TTL_S,
  });
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: "another run in progress" });
  }

  let totalDeleted = 0;
  try {
    const supabase = getSupabaseServer();
    if (!supabase) {
      log.error("coach_purge_supabase_unavailable", {});
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    for (let pass = 0; pass < PURGE_MAX_PASSES; pass++) {
      const { data, error } = await supabase
        .from("coach_analyses")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(PURGE_BATCH_SIZE)
        .select("game_id");

      if (error) {
        log.error("coach_purge_failed", {
          err: error.message,
          pass,
          total_so_far: totalDeleted,
        });
        return NextResponse.json(
          { error: "purge failed", deleted_before_failure: totalDeleted },
          { status: 500 },
        );
      }

      const rows = data?.length ?? 0;
      totalDeleted += rows;
      if (rows < PURGE_BATCH_SIZE) break;
    }

    log.info("coach_purge_complete", { rows_deleted: totalDeleted });
    return NextResponse.json({ rows_deleted: totalDeleted });
  } finally {
    await redis.del(PURGE_LOCK_KEY).catch(() => {});
  }
}
```

(The `503` branch on missing supabase env was added beyond the spec — equivalent to the DELETE handler's pattern in PR 4. Spec is silent on this; preserving cron resiliency in misconfigured envs is the pragmatic choice.)

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter web test -- coach-purge --run`
Expected: PASS, 6 specs (the test for the 503 branch is implicit — the existing tests already mock supabase non-null).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/coach-purge/route.ts apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(coach): /api/cron/coach-purge — daily TTL purge

- Bearer auth via CRON_SECRET (matches /api/cron/sync convention)
- Redis SETNX advisory lock at coach:cron:purge with 600s TTL prevents
  overlapping runs (red-team P0-6)
- Batched delete: LIMIT 5000 × up to 20 passes (≤ 100k/run cap)
- Telemetry: coach_purge_complete (info), coach_purge_failed (error
  with pass + total_so_far for partial-progress diagnosis)
- Lock release in finally regardless of supabase outcome

Spec §8.1 / §12.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 5: GitHub Actions cron workflow

**Files:**
- Create: `.github/workflows/cron-coach-purge.yml`

NEW workflow file (deviation from spec module map noted in plan header). Daily at 03:00 UTC. Concurrency group + `cancel-in-progress: false` so a long-running purge isn't pre-empted by the next scheduled trigger.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/cron-coach-purge.yml`:

```yaml
name: Cron — Coach analyses purge

on:
  schedule:
    # Daily at 03:00 UTC. Off-hours for most of our wallet base; runs
    # post-LLM-traffic peak. Spec §8.1.
    - cron: '0 3 * * *'
  workflow_dispatch:  # manual trigger for testing / on-demand purge

# Race-safe (red-team P0-6): if a run is still in progress when the
# next scheduled trigger or a manual dispatch fires, the new run waits
# in the queue rather than cancelling the active one. The route's own
# Redis SETNX lock provides server-side defense in depth.
concurrency:
  group: cron-coach-purge
  cancel-in-progress: false

jobs:
  purge:
    name: Trigger /api/cron/coach-purge
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Call coach-purge endpoint
        env:
          CRON_URL: ${{ secrets.CRON_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
        run: |
          if [ -z "$CRON_URL" ] || [ -z "$CRON_SECRET" ]; then
            echo "::error::Missing CRON_URL or CRON_SECRET repo secret"
            exit 1
          fi
          curl --fail --silent --show-error \
            --max-time 240 \
            -H "Authorization: Bearer ${CRON_SECRET}" \
            "${CRON_URL%/}/api/cron/coach-purge"
```

(`--max-time 240` matches the route's 60s `maxDuration` × 4 to absorb GH Actions runner startup + DNS + TLS overhead. The route itself caps at 60s; curl just needs enough margin to not error before the route finishes.)

- [ ] **Step 2: Lint via `actionlint` if available, or eyeball**

If the repo has an `actionlint` setup, run it. Otherwise eyeball the YAML for indentation + secret naming consistency with `cron-cache-sync.yml`.

The two workflow files should now coexist; there's no implicit conflict because:
- Different schedules.
- Different concurrency groups (each has its own).
- Different endpoints + workflow names.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/cron-coach-purge.yml
git commit -m "$(cat <<'EOF'
chore(ci): cron-coach-purge workflow — daily 03:00 UTC

NEW workflow file (separate from cron-cache-sync.yml — different
schedule + endpoint + concurrency). Spec §10 module map listed it as
MODIFIED to the existing file, but a NEW file gives clean concurrency
boundaries and independent failure handling.

- Daily at 03:00 UTC (off-hours for most wallets)
- concurrency.group: cron-coach-purge with cancel-in-progress: false
  (red-team P0-6 — defense in depth alongside the route's Redis lock)
- Reuses CRON_URL + CRON_SECRET repo secrets
- workflow_dispatch enabled for manual testing

Spec §8.1.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 6: `LOG_SALT` rotation runbook

**Files:**
- Create: `docs/runbooks/log-salt-rotation.md`

Quarterly rotation procedure for the `LOG_SALT` server secret. Spec §8.4 mandates this runbook lands in PR 5.

- [ ] **Step 1: Confirm the runbooks directory**

Run: `ls docs/runbooks/ 2>/dev/null || mkdir -p docs/runbooks && ls docs/runbooks/`

If the directory doesn't exist, create it (the `||` fallback above handles that).

- [ ] **Step 2: Create the runbook**

Create `docs/runbooks/log-salt-rotation.md`:

```markdown
# `LOG_SALT` Rotation Runbook

> **Cadence:** Quarterly (every ~90 days). Set a recurring calendar reminder.
> **Owner:** Server-side secrets steward (currently @akawolfcito).
> **Spec reference:** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` §8.4 / red-team P1-8.

## Why

`LOG_SALT` is the server-side secret that turns wallet addresses into stable, non-reversible 16-hex-char identifiers in our logs (`hashWallet(wallet) = sha256(wallet.toLowerCase() + LOG_SALT).slice(0, 16)` — see `apps/web/src/lib/server/logger.ts`). Without rotation, an attacker who eventually obtains `LOG_SALT` (e.g., via a misconfigured Vercel env export, an insider leak, or a forensic image of a build artifact) can rainbow-table all historical wallet hashes back to their plaintext addresses.

Rotation breaks the correlation window: hashes from before the rotation are no longer correlatable to hashes after the rotation, so the blast radius of any future salt leak is bounded to ~one quarter of historical logs rather than the entire log history.

## How

### 1. Generate a new salt

```bash
openssl rand -hex 32
```

(64 hex chars / 256 bits of entropy. Save the output to your password manager BEFORE pasting it into Vercel — if you lose it mid-rotation, you'll need to redeploy with a fresh value and the previous quarter's hashes become uncorrelatable too.)

### 2. Rotate in Vercel

For each environment that uses `LOG_SALT` (production, preview, development if used):

```bash
# Remove the old value
vercel env rm LOG_SALT production
# Add the new value (Vercel CLI prompts for stdin)
vercel env add LOG_SALT production
```

Repeat for `preview` and `development` if applicable.

### 3. Trigger a redeploy

The new `LOG_SALT` only takes effect on the next build. Either:

- Push an empty commit to `main` (`git commit --allow-empty -m "chore: redeploy for LOG_SALT rotation" && git push`), or
- Use the Vercel dashboard "Redeploy" button on the latest production deployment.

### 4. Verify

After the redeploy completes, exercise any Coach surface that emits `wallet_hash` (e.g., `/api/coach/analyze` with a PRO wallet, or trigger `/api/cron/coach-purge` manually via the GH Actions `workflow_dispatch`). Confirm new log lines have `wallet_hash` values that DON'T match historical hashes for the same wallet — that's the rotation working.

If `hashWallet()` is throwing `LOG_SALT env is required (server-side secret)`, the env var didn't propagate. Re-check the Vercel env list (`vercel env ls`) and redeploy.

## Operational notes

- **Old log lines stay valid** — they just become uncorrelatable to post-rotation lines. This is the intended privacy property.
- **Cross-period investigations**: if you need to correlate a wallet across a rotation boundary (e.g., for an abuse investigation), you'll need both the old and new salts. The old salt is in your password manager from the previous rotation; the new one is in your password manager from THIS rotation.
- **Rotation atomicity**: `LOG_SALT` is read fresh on every `hashWallet()` call (no caching), so the rotation transition is atomic at the request level — once the new build serves traffic, every new log line uses the new salt.
- **Don't commit `LOG_SALT`**: it lives in Vercel env only. Pre-commit hook (`DRAGON` guard) blocks `.env*` files; double-check your local `.env.local` if you also use it for local dev.
- **Recovery**: if you rotate by accident or lose the new salt before saving to the password manager, the operational impact is just "this quarter's logs become uncorrelatable to next quarter's". Redeploy with a fresh `openssl rand -hex 32` and continue.

## Calendar template

Add to your team calendar:

> **Title**: Rotate `LOG_SALT` (Chesscito)
> **Recurrence**: Every 90 days
> **Description**: See `docs/runbooks/log-salt-rotation.md`. Estimated 10 minutes total. Required quarterly to limit historical-log deanonymization windows.
```

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/log-salt-rotation.md
git commit -m "$(cat <<'EOF'
docs(runbook): LOG_SALT quarterly rotation procedure

Spec §8.4 mandates a runbook for the server-side LOG_SALT secret used
by hashWallet(). Quarterly rotation limits the deanonymization blast
radius of any future salt leak to ~one quarter of historical logs.

Steps: generate (openssl rand -hex 32) → vercel env rm/add per
environment → empty-commit-redeploy → verify hashes change.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 7: `COACH_COPY.featureBanner` strings

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`

First-run banner strings for the `<CoachPanel>` callout (Task 8). Red-team P2-3: existing PRO subscribers who watched "SOON" for weeks need an explicit "this is now active" affordance — a silent array swap (Task 2) wouldn't notify them.

- [ ] **Step 1: Append the entry to `COACH_COPY`**

In `editorial.ts`, locate the `COACH_COPY` object (~line 678). Within the existing PR 4 section (`historyFooter`, `historyDelete`), append a third related entry:

```ts
  /**
   * One-shot first-run callout shown inside <CoachPanel> for PRO users
   * the first time they see the new history-aware analysis. Closes
   * red-team P2-3: existing PRO subscribers who saw "SOON" for weeks
   * deserve an explicit "this is now active" affordance rather than
   * a silent array swap (Task 2).
   *
   * LocalStorage flag: chesscito:coach-history-callout-seen.
   */
  featureBanner: {
    title: "Personalized coaching is live",
    body: "Your Coach now references your past games to spot recurring patterns.",
    dismiss: "Got it",
  },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "$(cat <<'EOF'
feat(coach): COACH_COPY.featureBanner strings

Banner copy for the one-shot first-run callout inside <CoachPanel>
(red-team P2-3 — closes the silent-perks-swap gap by giving existing
PRO subscribers an explicit "this is now active" affordance).

LocalStorage flag: chesscito:coach-history-callout-seen.

Spec §9.4.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 8: First-run banner in `<CoachPanel>`

**Files:**
- Modify: `apps/web/src/components/coach/coach-panel.tsx`
- Modify: `apps/web/src/components/coach/__tests__/coach-panel.test.tsx`

Render the banner at the top of the panel when `proActive && !localStorage[chesscito:coach-history-callout-seen]`. Click "Got it" sets the flag and hides the banner.

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/components/coach/__tests__/coach-panel.test.tsx`:

```tsx
describe("<CoachPanel> first-run banner (PR 5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the banner when proActive && historyMeta && flag unset", () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    expect(screen.getByText(/Personalized coaching is live/i)).toBeInTheDocument();
    expect(screen.getByText(/references your past games/i)).toBeInTheDocument();
  });

  it("does NOT render the banner when proActive=false", () => {
    render(<CoachPanel {...baseProps} historyMeta={{ gamesPlayed: 5 }} />);
    expect(screen.queryByText(/Personalized coaching is live/i)).toBeNull();
  });

  it("does NOT render the banner when localStorage flag is already set", () => {
    window.localStorage.setItem("chesscito:coach-history-callout-seen", "1");
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    expect(screen.queryByText(/Personalized coaching is live/i)).toBeNull();
  });

  it("dismiss button writes the flag and hides the banner", async () => {
    render(
      <CoachPanel {...baseProps} proActive historyMeta={{ gamesPlayed: 5 }} />,
    );
    const dismiss = screen.getByRole("button", { name: /Got it/i });
    fireEvent.click(dismiss);
    expect(window.localStorage.getItem("chesscito:coach-history-callout-seen")).toBe("1");
    expect(screen.queryByText(/Personalized coaching is live/i)).toBeNull();
  });
});
```

(The `fireEvent` import is already in scope from PR 4 Task 7's tests; if not, add `import { fireEvent } from "@testing-library/react";` at the top.)

- [ ] **Step 2: Run — expect failures**

Run: `pnpm --filter web test -- coach-panel --run`
Expected: 4 new tests FAIL — banner not rendered.

- [ ] **Step 3: Wire the banner into `<CoachPanel>`**

Edit `apps/web/src/components/coach/coach-panel.tsx`. Add `useState` + `useEffect` imports at the top:

```tsx
import { useEffect, useState } from "react";
```

Inside the function body, immediately after the destructured props but BEFORE the `const time = formatTime(elapsedMs);` line, add:

```tsx
  const [bannerSeen, setBannerSeen] = useState<boolean>(true);

  useEffect(() => {
    // SSR-safe: only read localStorage on the client. Default state is
    // `true` (banner hidden) so SSR renders without flashing the banner
    // and then hiding it after the localStorage read.
    const seen = window.localStorage.getItem("chesscito:coach-history-callout-seen");
    if (!seen) setBannerSeen(false);
  }, []);

  function dismissBanner() {
    window.localStorage.setItem("chesscito:coach-history-callout-seen", "1");
    setBannerSeen(true);
  }

  const showBanner = proActive && historyMeta && !bannerSeen;
```

Then inside the JSX, IMMEDIATELY after the opening `<div className="flex flex-col gap-4">` and BEFORE the existing first child (the `<div className="flex items-center justify-between">` with difficulty/credits), insert:

```tsx
      {showBanner && (
        <div
          data-testid="coach-history-banner"
          className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3"
        >
          <p className="text-xs font-bold" style={{ color: "rgba(63, 34, 8, 0.95)" }}>
            {COACH_COPY.featureBanner.title}
          </p>
          <p className="mt-1 text-xs" style={{ color: "rgba(110, 65, 15, 0.85)" }}>
            {COACH_COPY.featureBanner.body}
          </p>
          <button
            type="button"
            onClick={dismissBanner}
            className="mt-2 text-xs font-semibold underline underline-offset-2"
            style={{ color: "rgba(110, 65, 15, 0.95)" }}
          >
            {COACH_COPY.featureBanner.dismiss}
          </button>
        </div>
      )}
```

- [ ] **Step 4: Run — expect pass + free-path snapshot still green**

Run: `pnpm --filter web test -- coach-panel --run`
Expected: PASS, 10 specs total (6 from PR 4 + 4 new).

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/coach/coach-panel.tsx apps/web/src/components/coach/__tests__/coach-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(coach): one-shot first-run banner in <CoachPanel>

Closes red-team P2-3: existing PRO users who watched "SOON" for weeks
get an explicit "this is now active" affordance when the perk
graduates from perksRoadmap → perksActive (Task 2).

- Banner renders when proActive && historyMeta && localStorage flag
  `chesscito:coach-history-callout-seen` is unset
- "Got it" click writes the flag and hides the banner
- SSR-safe: defaults to hidden, useEffect promotes to visible only
  on client mount with unset flag (no SSR flash)

Spec §9.4.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `pnpm --filter web test`
Expected: PR 4 baseline 971 + PR 5 adds:
- `privacy.test.tsx` — 5
- `cron/coach-purge/__tests__/route.test.ts` — 6
- `coach-panel.test.tsx` — 4 (appended)

→ ≈ +15 specs, baseline ~986. No failures.

- [ ] **Step 2: Free-path snapshot guard**

Run: `pnpm --filter web test -- prompt-template --run`
Expected: PASS, 16 specs. The PR 2 → PR 3 → PR 4 → PR 5 regression guard is GREEN.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `pnpm --filter web lint`
Expected: no new warnings introduced.

- [ ] **Step 5: Scope diff**

```bash
git diff --name-only main..HEAD
```

Expected files (exactly):

```
.github/workflows/cron-coach-purge.yml
apps/web/src/app/__tests__/privacy.test.tsx
apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts
apps/web/src/app/api/cron/coach-purge/route.ts
apps/web/src/app/privacy/page.tsx
apps/web/src/components/coach/__tests__/coach-panel.test.tsx
apps/web/src/components/coach/coach-panel.tsx
apps/web/src/lib/content/editorial.ts
docs/runbooks/log-salt-rotation.md
```

(9 files: 5 NEW + 4 MODIFIED. No analyze/route.ts. No prompt-template.ts. No history/route.ts. No cron-cache-sync.yml.)

- [ ] **Step 6: Commit log review**

Run: `git log --oneline main..HEAD`

Expected: 8 commits in this approximate order (SHAs vary):
1. `feat(coach): PRIVACY_COACH_COPY constant for /privacy page`
2. `feat(pro): graduate Coach memory perk to perksActive`
3. `feat(coach): /privacy renders PRIVACY_COACH_COPY section`
4. `feat(coach): /api/cron/coach-purge — daily TTL purge`
5. `chore(ci): cron-coach-purge workflow — daily 03:00 UTC`
6. `docs(runbook): LOG_SALT quarterly rotation procedure`
7. `feat(coach): COACH_COPY.featureBanner strings`
8. `feat(coach): one-shot first-run banner in <CoachPanel>`

- [ ] **Step 7: Manual smoke (optional, post-merge)**

After deploy:
1. Set `LOG_SALT` in Vercel (already done per session log).
2. Add `CRON_URL` + `CRON_SECRET` repo secrets if not already present (re-used from cron-cache-sync.yml — should already be set).
3. Trigger the new workflow manually via GitHub Actions UI: `Actions → Cron — Coach analyses purge → Run workflow`. Confirm 200 response with `rows_deleted: 0` (no expired rows yet).
4. Visit `/privacy` and confirm the new "Coach Match History" section renders below the existing privacy sections.
5. With a PRO wallet, run an Arena analysis → on the result panel, confirm the amber banner "Personalized coaching is live" renders. Click "Got it" → confirm it disappears + reload page → still hidden.

- [ ] **Step 8: Done**

PR 5 is ready to open. Suggested PR title:

```
feat(coach): PR 5 — Privacy + cron + copy unlock (closes Etapa 2)
```

PR body: link to spec §13 PR 5 + this plan. Note: "Etapa 2 of bundle PRO v1 closes with this merge. The Coach session memory feature is fully shipped."

---

## Self-review checklist

- [x] **Spec coverage:** §8.1 cron purge ✓ Tasks 4+5; §8.3 privacy copy ✓ Tasks 1+3; §8.4 LOG_SALT runbook ✓ Task 6; §9.4 PRO_COPY swap + first-run banner ✓ Tasks 2+7+8; §10 module rows ✓ Tasks 1–8; §12 telemetry `coach_purge_complete` + `coach_purge_failed` ✓ Task 4; §13 PR 5 scope ✓ all tasks; §15 P0-6 (cron concurrency) ✓ Tasks 4+5; P1-8 (LOG_SALT secrecy) ✓ Task 6; P2-3 (silent-perks-swap) ✓ Tasks 7+8.
- [x] **Placeholder scan:** no TBD/TODO. Each step shows actual code or actual command. The Task 5 "deviation noted" is documented in the plan header — not a TODO.
- [x] **Type consistency:** `PRIVACY_COACH_COPY` shape (heading + para1 + paraNTitle/paraN x3) defined in Task 1, consumed by Task 3. `COACH_COPY.featureBanner` shape (`{ title, body, dismiss }`) defined in Task 7, consumed by Task 8. `chesscito:coach-history-callout-seen` localStorage key string used identically in Task 8 source + tests. `coach:cron:purge` Redis key inlined in Task 4 (matches spec; v1 acceptable to not centralize via REDIS_KEYS for a singleton key).
- [x] **Free-path bit-identicality invariant:** snapshot guard re-verified at Tasks 8/9. PR 5 doesn't touch the prompt template or analyze route.
- [x] **Mock pattern consistency:** `vi.mock("@upstash/redis", …)` + `vi.mock("@/lib/supabase/server", …)` follow PR 3/PR 4 pattern. The supabase chain mock for Task 4's purge query mirrors PR 3's backfill chain (call-index incrementing per pass).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
