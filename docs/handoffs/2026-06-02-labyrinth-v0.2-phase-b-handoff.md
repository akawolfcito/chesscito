# Handoff — Labyrinth System v0.2 (Audit + Spec freeze + Phase B)

**Date:** 2026-06-02
**Branch:** `main` (pushed to `origin/main`)
**Last commit:** `59808d8c feat(labyrinth): add v0.2 mint policy types and resolver`
**Status:** Phase B closed. Phase C (`/api/sign-labyrinth`) unblocked.

## Cluster scope

Closes the loop on the pawn labyrinth smoke test from this session and
extends into the universal-mintability foundation of Labyrinth System v0.2.

Five commits, one logical arc:

1. `fec5f6d1` `docs(audit)` — pawn labyrinth design audit.
2. `3f4cdbb3` `feat(exercises)` — Easy `pawn-lab-1 "First Capture"`.
3. `271b7b15` `fix(i18n)` — King exercise descriptions in EN+ES catalogs.
4. `52810e81` `docs(spec)` — Labyrinth System v0.2 DESIGN FROZEN.
5. `59808d8c` `feat(labyrinth)` — Phase B types + mint-policy resolver.

## 1. Pawn labyrinth audit + `pawn-lab-1`

### Trigger

Manual smoke: pawn-lab-3 (`a2`, blockers `a3+a4`, star `d7`) read as "no
legal route" to a beginner. Investigation showed the rule engine was
correct (`b3` IS a legal capture from `a2`), but two layered issues:

1. **Visual discoverability** — `captureTargets` render as a glowing amber
   circle (`board.tsx:368-394`), not as an enemy piece sprite. New players
   don't recognize the affordance.
2. **Dead-state risk** — pawn-lab-3/4/5 all expose a forward-vs-capture
   fork mid-puzzle. The forward branch is a one-way file lock with no UI
   signal; the puzzle silently becomes unwinnable.

### Audit deliverable

`docs/audits/2026-06-02-pawn-labyrinth-audit.md` — per-lab path
verification table, dead-state branch enumeration, proposal table for the
new Easy lab.

### Shipped Easy lab

```ts
defineLabyrinth({
  id: "pawn-lab-1",
  start: "d2",
  target: "e5",
  obstacles: ["d3", "d4"],
  captureTargets: ["e3"],
  isCapture: true,
  optimalMoves: 3,
}),
```

Verified path: each square has exactly ONE legal move, so beginners
cannot stray. `d2 → e3` (forced capture) → `e4` (forced forward) → `e5`
(target). 5 new tests in `labyrinth.test.ts`. `labyrinths-catalog.test.ts`
Pawn regression bumped 3 → 4.

## 2. King exercise descriptions i18n fix

Chrome console surfaced `MISSING_MESSAGE: EXERCISE_DESCRIPTIONS.king-1..5
(en)` during smoke. King exercises (`king-1..5`) had entered
`PLAYABLE_PIECES` in commit `36598e2f` but no i18n labels were ever added
to either `editorial.ts` (EN) or `messages/es.ts` (ES). next-intl
rendered the raw key string.

Fixed with 5 EN + 5 ES labels (≤3 words, anti-AI-prose compliant) and a
new regression guard `exercise-descriptions.test.ts` that iterates every
`PLAYABLE_PIECES[*].id` and asserts both locale catalogs carry the key.
Catches future drift in CI.

| ID      | EN                | ES                     |
|---------|-------------------|------------------------|
| king-1  | One-square move   | Movimiento simple      |
| king-2  | Diagonal step     | Paso diagonal          |
| king-3  | Edge walk         | Camino al borde        |
| king-4  | Capture step      | Captura corta          |
| king-5  | Corner shelter    | Refugio en esquina     |

## 3. Labyrinth System v0.2 spec (frozen)

Doc: `docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md`
(484 lines, supersedes nothing — v0.1 stays valid for catalog rules).

### Locked decisions

1. **Universal mintability.** Every labyrinth is opt-in mintable by
   default (`mintable=true`). Mint never gates progress. localStorage
   stays for casual personal best; public leaderboards / campaigns /
   rewards read ONLY from minted proofs.

2. **10 optional `Exercise` fields** (spec §4.1):
   - `mintable`, `leaderboardEligible`, `rewardEligible`,
     `campaignEligible`
   - `minStarsToMint` (`1 | 2 | 3`), `minStarsForReward` (`1 | 2 | 3`)
   - `seasonId`, `campaignId`, `partnerId`
   - `rewardTier` (`"none" | "in_game" | "partner" | "mystery"`)

3. **Defaults centralized** in `resolveLabyrinthMintPolicy` — never read
   raw fields, always resolve through the helper.

4. **Anti-spam is a CORE PRINCIPLE** (§3.1.5, not buried as a UX
   guardrail): one mint per `(wallet, labyrinthId, star tier)`, allowed
   only on strict star-tier improvement. Enforced at contract layer
   (authoritative) → sign endpoint → rate limit → UI guard → no silent
   retries. Every layer required, no layer sufficient alone.

5. **Soulbound + Badge UX pattern locked** (§6 lede). Contract path
   stays open as Option A (extend `BadgesUpgradeable` if storage review
   permits) vs Option B (new `LabyrinthBadges` soulbound contract).
   Same player-facing UX either way. `VictoryNFTUpgradeable` explicitly
   OFF-table (transferable + fee-split don't fit proof shape).

6. **Leaderboard model**: public boards read ONLY from minted proofs.
   Personal "your best" displays still read from localStorage. Backfill
   is the player's job (re-attempt + mint).

### Phasing (§9)

| Phase | Scope | Status |
|-------|-------|--------|
| A | Spec written + APPROVED + design frozen | ✅ this session |
| B | `Exercise` type ext + mint-policy resolver | ✅ this session |
| C | `/api/sign-labyrinth` (badge-shape + plausibility) | ⏭ next |
| D | Contract review of Badges → pick A/B → testnet deploy | ⏭ |
| E | Post-completion mint CTA + sheet (opt-in) | ⏭ |
| F | "Mint historical" affordance + Unminted pill | ⏭ |
| G | Leaderboard reads minted proofs | ⏭ |
| H | First campaign (e.g. "Rook Week") | ⏭ |

## 4. Phase B — types + mint-policy resolver

### Files

- `apps/web/src/lib/game/types.ts` (+16 lines) — `Exercise` extended.
- `apps/web/src/lib/game/labyrinth-mint-policy.ts` (new, ~140 lines).
- `apps/web/src/lib/game/__tests__/labyrinth-mint-policy.test.ts` (new, ~200 lines).

### Exports

```ts
export type RewardTier = "none" | "in_game" | "partner" | "mystery";
export type StarTier = 1 | 2 | 3;
export type ResolvedLabyrinthMintPolicy = { /* all fields concrete */ };
export type LabyrinthMintPolicyValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

export function resolveLabyrinthMintPolicy(ex: Exercise): ResolvedLabyrinthMintPolicy;
export function validateLabyrinthMintPolicy(ex: Exercise): LabyrinthMintPolicyValidation;
export function assertValidLabyrinthMintPolicy(ex: Exercise): void; // throws
```

### Resolver contract (LOCKED)

Absent ids (`seasonId/campaignId/partnerId`) and `minStarsForReward`
(when `rewardEligible=false`) resolve to **`null`**, not `undefined`.
Spec §4.2 uses `undefined` for the raw catalog defaults; the resolver
normalizes to `null` so consumers (UI, sign endpoint, leaderboard
reader, JSON serializers) never need to distinguish "field never set"
from "field explicitly absent". Catalog-side `Exercise` keeps the
`undefined` semantics. Locked in resolver docstring + dedicated test
using `toBe(null)` (strict identity, fails on `undefined`).

### Validation rules (spec §4.3)

- `campaignEligible=true` requires `campaignId`.
- `rewardTier !== "none"` requires `rewardEligible=true`.
- `leaderboardEligible=true` requires `mintable !== false`.
- `minStarsToMint` ∈ `{1, 2, 3}`.
- `minStarsForReward` ∈ `{1, 2, 3}` when present.

Errors are **aggregated** in a single pass (no first-fail). Authors see
the full picture in one CI run.

### Catalog regression guard

`describe("LABYRINTHS catalog — mint policy regression guard")` iterates
all 14 current labyrinths (4 rook + 2 bishop + 5 knight + 4 pawn + 3
queen + 1 king) and asserts:

1. Every entry passes `assertValidLabyrinthMintPolicy`.
2. Every entry resolves to a fully concrete policy.

No existing labyrinth definition was modified — all new fields are
optional and defaults are valid.

### Test counts

- **Focused** (mint-policy + catalog + labyrinth path tests): 3 files /
  **163 tests passing**, 1.08s.
- **Full apps/web vitest suite**: 207 files / **2448 tests passing**,
  35.69s.
- **`npx tsc --noEmit`**: 0 errors.

## 5. Open questions for Phase C

These are explicitly deferred from spec §8, do not block Phase C kickoff:

- Mint cost (free vs $0.005 vs sponsored-by-treasury).
- Art per labyrinth (board thumbnail baseline vs bespoke per campaign).
- Cross-chain (Celo-only in v0.2).
- Catalog scaling / filtering UX (deferred to UX cluster).

## 6. Phase C kickoff checklist (next session)

1. Read this handoff + spec §6.2 (`/api/sign-labyrinth` shape).
2. Read `apps/web/src/app/api/sign-badge/route.ts` — the template.
3. Read `apps/web/src/lib/server/demo-signing.ts` for `enforceOrigin` +
   `enforceRateLimit` + `parseAddress` + `createNonce` + `createDeadline`.
4. Add `parseLabyrinthId` to demo-signing (must match a catalog id
   allowlist — derive from `LABYRINTHS`).
5. Implement plausibility: `moves ∈ [optimalMoves, optimalMoves * 5]`.
6. Use `resolveLabyrinthMintPolicy(lab)` to gate `mintable=false` and
   `stars < minStarsToMint`. Reject with 403 + descriptive error.
7. Sign EIP-712 `LabyrinthMint` struct. New domain name TBD (likely
   `"LabyrinthBadges"` once contract path is picked, but Phase C signs
   ahead of the contract — coordinate the domain name with Phase D).
8. Tests: cover origin enforcement, rate limit, invalid labyrinthId,
   moves out of plausibility range, mint-gating by policy, valid path.

## 7. Cluster closure checklist (per CLAUDE.md)

- [x] GitHub housekeeping — no associated issues or milestones (spec-
      driven session, not issue-driven).
- [x] README sync — "What's live" did not change.
- [x] MEMORY.md sync — index entry added.
- [x] Branch hygiene — no feature branches created (all on `main`).
- [x] Handoff doc — this file.
