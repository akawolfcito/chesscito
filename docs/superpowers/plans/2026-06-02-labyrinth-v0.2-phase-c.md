# Labyrinth System v0.2 — Phase C Implementation Prompt (for Clausita)

**Scope:** Phase C of the Labyrinth System v0.2 roadmap — ship
`POST /api/sign-labyrinth` (badge-shape) with the §6.2 plausibility
checks. No UI, no contracts, no leaderboard, no monetization, no
catalog changes.

**Status of upstream phases:**
- Phase A (design freeze): `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md` — APPROVED, do NOT renegotiate.
- Phase B (types + resolver): MERGED to `main` at commit `59808d8c`. Resolver lives at `apps/web/src/lib/game/labyrinth-mint-policy.ts`.
- Phase D (contract review → Option A vs B): NOT STARTED. See §6.4 of the spec — it is deferred.

---

## 1. What you are building

A single Node.js route handler at:

`apps/web/src/app/api/sign-labyrinth/route.ts`

…plus a colocated Vitest file at:

`apps/web/src/app/api/sign-labyrinth/__tests__/route.test.ts`

Everything else is out of scope.

### 1.1 Request shape (from spec §6.2)

```ts
// POST /api/sign-labyrinth
{
  player: "0x…",
  labyrinthId: "pawn-lab-1",
  moves: 3,
  campaignId?: "rook-week-2026-06"   // optional
}
```

### 1.2 Response shape (from spec §6.2)

```ts
{
  player: "0x…",
  labyrinthId: "pawn-lab-1",
  moves: "3",                 // stringified (bigint-style, mirror sign-badge)
  stars: 3,                   // 1, 2, or 3 — derived
  campaignId: "rook-week-2026-06" | null,
  nonce: "…",
  deadline: "…",
  signature: "0x…"
}
```

### 1.3 Server-side checks (in order — spec §6.2 numbered list)

1. `enforceOrigin(request)` — reuse as-is.
2. `parseAddress(body.player)` — reuse as-is.
3. `await enforceRateLimit(getRequestIp(request), player)` — reuse as-is.
4. **Validate `labyrinthId`** against the catalog allowlist. Iterate
   `LABYRINTHS` from `@/lib/game/exercises` and reject (400) if no
   `Exercise` matches. Capture the matching `Exercise` for use in 5–7.
5. **Plausibility-bound `moves`** ∈ `[optimal, optimal * 5]` where
   `optimal = exercise.optimalMoves`. Reject with a clear 400 error
   message — DO NOT reuse `parseInteger` directly because the bounds
   are per-labyrinth, not a single global range. Inline the check.
6. Compute `stars = labyrinthStars(moves, optimal)` from
   `@/lib/game/exercises`.
7. Resolve the mint policy via
   `resolveLabyrinthMintPolicy(exercise)`:
   - Reject (400) if `mintable === false`.
   - Reject (400) if `stars < minStarsToMint`.
8. **Campaign validation** — if `campaignId` is provided:
   - Reject (400) if the resolved policy's `campaignId` is `null` or
     does not match the incoming `campaignId`.
   - Do NOT validate "campaign is open" / deadline windows in Phase
     C — that's a Phase D+ open question. Leave a `// TODO(phase-D)`
     comment naming the gap.
9. Sign the EIP-712 `LabyrinthMint` struct (see §1.4 below).

### 1.4 EIP-712 signing — transitional verifyingContract (LOCKED)

The spec assumes a `verifyingContract` exists for the labyrinth
proof. Phase D will pick Option A (extend `BadgesUpgradeable`) vs
Option B (new `LabyrinthBadges`). Phase C must not block on that
choice.

**Locked decision (do NOT re-ask):** sign against
`getDemoConfig().badgesAddress` as the transitional
`verifyingContract`. This is consistent with the §6.4
default-of-record (Option A) and is trivially swappable when Phase D
lands. Do NOT add `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` in Phase C
(no env-template churn).

Mark the transition with a single-line comment at the call site:

```ts
// TODO(phase-D): replace verifyingContract if contract review chooses LabyrinthBadges
```

The struct itself:

```ts
LabyrinthMint: [
  { name: "player",      type: "address" },
  { name: "labyrinthId", type: "bytes32" },   // keccak256(utf8(labyrinthId))
  { name: "moves",       type: "uint256" },
  { name: "stars",       type: "uint256" },
  { name: "campaignId",  type: "bytes32" },   // keccak256 or 0x00…00 when null
  { name: "nonce",       type: "uint256" },
  { name: "deadline",    type: "uint256" },
]
```

Use `ethers.id(labyrinthId)` for the `bytes32` keccak. Use
`ethers.ZeroHash` when `campaignId` is null.

Domain: `{ name: "LabyrinthBadges", version: "1", chainId, verifyingContract }`.

### 1.5 Status-code policy (mirror sign-badge `route.ts:60`)

- `"Forbidden"` → 403
- `"Rate limit exceeded"` → 429
- everything else → 400

---

## 2. Files you will touch (exhaustive)

Create:
- `apps/web/src/app/api/sign-labyrinth/route.ts`
- `apps/web/src/app/api/sign-labyrinth/__tests__/route.test.ts`

Read-only references:
- `apps/web/src/app/api/sign-badge/route.ts` — shape template.
- `apps/web/src/app/api/sign-badge/__tests__/route.test.ts` — test
  scaffolding pattern (mock `@/lib/server/demo-signing`).
- `apps/web/src/lib/server/demo-signing.ts` — helpers.
- `apps/web/src/lib/game/labyrinth-mint-policy.ts` — resolver.
- `apps/web/src/lib/game/exercises.ts` — `LABYRINTHS`,
  `labyrinthStars`.
- `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md` —
  authoritative spec, especially §6.2.

DO NOT touch:
- Any contract under `apps/contracts/**`.
- Any UI (`apps/web/src/components/**`, overlays, sheets, dock).
- `apps/web/src/lib/content/editorial.ts` (no copy in Phase C).
- The exercises catalog (no metadata additions in Phase C).
- Monetization / PRO / Peones / leaderboard surfaces.
- `next.config.js`, `vercel.json`, env templates (unless adopting
  transitional option (ii) AFTER user approval — see §1.4).

---

## 3. Workflow — non-negotiable

### 3.1 Plan-before-edit

The plan is already locked in this document (transitional EIP-712 =
`badgesAddress`, see §1.4). Do NOT re-ask the user to confirm that
choice. Proceed directly to TDD once you have read the referenced
files. Only stop to ask if you discover a contradiction with the
spec or with an existing file that this document did not anticipate.

### 3.2 TDD — SDD → TDD → EDD

Order of operations:
1. Write `route.test.ts` first — RED.
2. Write `route.ts` minimum to pass — GREEN.
3. Refactor only if needed.

**Catalog rule:** do NOT modify `LABYRINTHS` in `exercises.ts` or
add any campaign-flavored entries to the catalog. Campaign and
mint-policy edge cases are exercised by mocking the resolver, not by
authoring fixture labs.

Target test cases (minimum):
- 200 happy path: valid `pawn-lab-1`, moves at `optimal`, no
  `campaignId` → signature returned, `stars === 3`.
- 200 happy path with `campaignId` matching the resolved policy.
  Achieve by mocking `resolveLabyrinthMintPolicy` to return a policy
  whose `campaignId` matches the incoming value. Keep the underlying
  lab unchanged.
- 400 unknown `labyrinthId`.
- 400 `moves < optimal`.
- 400 `moves > optimal * 5`.
- 400 `mintable === false` — mock the resolver to return
  `mintable: false`.
- 400 `stars < minStarsToMint` — mock the resolver with
  `minStarsToMint = 3`, submit a 1★ move count.
- 400 `campaignId` mismatch — leave the resolver at defaults (no
  campaign on the lab) and send a `campaignId` in the request body.
- 403 when `enforceOrigin` throws.
- 429 when `enforceRateLimit` throws `"Rate limit exceeded"`.

Mock surface:

```ts
vi.mock("@/lib/server/demo-signing", () => ({ /* same as sign-badge */ }));
vi.mock("@/lib/game/labyrinth-mint-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/labyrinth-mint-policy")>();
  return { ...actual, resolveLabyrinthMintPolicy: vi.fn(actual.resolveLabyrinthMintPolicy) };
});
```

Default the resolver mock to pass-through; per-test, override with
`vi.mocked(resolveLabyrinthMintPolicy).mockReturnValueOnce({...})`.

Mirror the mock setup from `sign-badge/__tests__/route.test.ts`
verbatim for `@/lib/server/demo-signing`: stub `getDemoConfig` with a
`signTypedData` Vitest fn.

### 3.3 Commits — single final commit, never red

TDD red→green is an INTERNAL workflow only. Do NOT commit while
tests are failing. Land the entire Phase C change as a single
commit once the full suite is green:

```
feat(api): add sign-labyrinth route

Wolfcito 🐾 @akawolfcito
```

Run the full test suite (`pnpm test`) before committing. Report the
pass count in the commit body (project baseline 1727 + the new
sign-labyrinth tests).

### 3.4 No push without approval

Do not `git push`. Stop at local commits and report. The user
controls the push step.

### 3.5 Reuse audit (spec §6.1)

You MUST reuse these helpers verbatim from `@/lib/server/demo-signing`:
`enforceOrigin`, `enforceRateLimit`, `getRequestIp`, `parseAddress`,
`createNonce`, `createDeadline`, `getDemoConfig`. DO NOT
re-implement, fork, or wrap them with redundant try/catch.

---

## 4. Anti-AI-prose rule

Code comments and any user-visible string MUST avoid em-dashes (—) /
en-dashes (–). Use commas, periods, or restructure. This rule is
enforced by a CI ceiling test (`anti-ai-prose-ceiling`); a new
em-dash will fail the gate. (Comments in this prompt are fine; the
rule applies to code you ship.)

---

## 5. Out of scope — defer to follow-ups

These are NOT in Phase C. If you discover them, file them as
one-line follow-ups in your end-of-task report, do NOT bundle them
in:

- Contract code, deployment, or address wiring.
- UI for the mint sheet / mint CTA (Phase E).
- Catalog metadata authoring (which labs become `leaderboardEligible`,
  `rewardEligible`, `campaignEligible`).
- Re-mint / strict-improvement enforcement at the sign endpoint
  (spec §6.5 step 2 — depends on contract layer reading).
- Replay verification (spec §6.3 — Phase D+).
- Telemetry events (`labyrinth.mint.*`) — defer until UI lands.
- Any change to existing routes (`/api/sign-badge`,
  `/api/sign-victory`, `/api/pro/*`).

---

## 6. Acceptance — when you are done

- `route.ts` exists at the path above, ≤ 80 LOC excluding imports.
- `route.test.ts` covers the 10 cases in §3.2.
- `pnpm test` is green (report pass count).
- `pnpm lint` and `pnpm typecheck` are green.
- Spec invariants honored: no field outside `Exercise` is read; the
  resolver is the only source of policy truth; no `localStorage` is
  touched server-side.
- Commits follow §3.3.
- Nothing pushed.
- End-of-task report includes: files created, test pass count, the
  single commit SHA, follow-ups discovered.
