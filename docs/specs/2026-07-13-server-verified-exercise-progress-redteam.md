# Red Team Review — server-verified-exercise-progress

**Date**: 2026-07-13
**Reviewer mindset**: hostile QA + senior engineer
**Reviewing**: `docs/specs/2026-07-13-server-verified-exercise-progress.md`

---

## Findings

### P0 — Must address before implementation

#### [core-premise] The spec's own mechanism does not stop a determined attacker. It converts "forge a number" into "forge a path" — and the app ships the path generator.

`lib/game/exercise-bfs.ts:98` exports:

```ts
export function computeExerciseBfsPath(piece, exercise, maxDepth = 32):
  { optimalMoves: number; path: BoardPosition[] } | null
```

It returns **the full optimal path, start-to-target inclusive**, and it is in the
client bundle. The exercise catalog is also in the client bundle.

So the attack against the *proposed* system is:

1. Read `EXERCISES` (already in your JS).
2. For each exercise, call the app's own `computeExerciseBfsPath`.
3. POST that path to `/api/exercises/verify`.
4. Collect 3★ on every exercise, for every piece, in about a second.
5. The server replays each path, finds it perfectly legal and optimal, and
   writes 3★. The qualification bit is granted. `sign-badge` signs. `sign-score`
   derives a **maximal** score — and now the forged score is one the server
   *vouched for*.

Server-side replay proves the solution is **correct**. It does not prove a
**human played it**. Those are different claims, and the spec's Goal ("refuses to
sign a score the player has not demonstrably earned") asserts the second while
the design only delivers the first.

Worse, the outcome is not neutral — it is arguably a **regression in honesty**:
today the forged score is transparently a client-supplied number that `score.ts`
openly documents as untrusted. After this change, the same forged score carries a
server's signature and a row in a table called `exercise_progress`, which reads as
evidence to anyone who looks later.

**Why blocking:** the feature is being built specifically because money hangs off
the leaderboard. Shipping it and *believing* the hole is closed is more dangerous
than the current state, where the hole is known and documented in a header comment.

**This does not mean "don't build it."** It means the spec must be re-framed and
one of these decided **before** code:

- **(a) Ship it as defense-in-depth, honestly scoped.** It kills casual cheating
  (devtools, `curl` a number, the copy-paste exploit shared in a Telegram group),
  gives a real audit trail, and is a hard prerequisite for every stronger control.
  The Goal is rewritten to claim exactly that and no more, and **the prize pool does
  not rest on it.**
- **(b) Add a server-issued challenge.** The server hands out a signed, single-use
  token when it serves an exercise (issued-at, bound to player + exercise id).
  `verify` requires it. This forces the attacker's script to at least round-trip
  and respect a plausible minimum elapsed time — it raises cost from "one second"
  to "grind at human pace", which is a real deterrent for a prize pool. It is still
  not proof of humanity. Cost: a new token endpoint on the exercise-serving path.
- **(c) Move the trust anchor to identity.** `passport_cache.is_verified` **already
  exists in the schema** (`schema.sql:33`) and the leaderboard view already joins
  it. Gate *prize eligibility* (not gameplay) on a verified passport, so forging
  progress buys a cheater a rank but not a payout.

My recommendation: **(a) + (c) now, (b) when the pool is real money.** But that is
a product call, and it must be made explicitly rather than absorbed silently into
an implementation.

#### [rollout] Deploy day locks out every honest un-minted player, simultaneously.

Decision 2 says un-minted localStorage progress is not imported. Behavior 6 says a
missing bit → **403**. Compose them: the moment this deploys, every existing player
sitting at 10★ locally who has not minted **cannot claim**, and there is no signal
telling them why beyond "Finish 10★ on this piece to claim" — which they *have*
done, from their point of view. That copy is a lie to the honest majority.

**Why blocking:** the spec's own UI table renders this state as a benign rule, not
as what it is: a migration that silently revokes earned progress from real players.
This is the exact class of defect the CLAUDE.md rule about enumerating UI states
exists to catch, and the spec walked right past it.

Needs, before implementation:
- A **shadow mode**: verify + write + log, but **do not enforce the 403**, until
  server progress exists for the active player base. Enforcement becomes a flag
  flip with data behind it, not a big bang.
- Honest copy for the genuinely-affected honest player, distinct from the
  not-qualified case.

### P1 — Should address

#### [contract] The replay contract omits `captureTargets` and obstacle rules.

`Exercise` (`types.ts:33`) carries `obstacles?: BoardPosition[]` **and**
`captureTargets?: BoardPosition[]`, and `getValidTargets(piece, pos, blockers,
isCapture, captureTargets, target)` takes all of them (`exercise-bfs.ts:115`). The
spec's `ExerciseSolution` and its `VerificationFailure` union never mention
`captureTargets`, so a pawn-labyrinth solution — where the pawn may only move
diagonally onto a `captureTargets` square — has no defined verdict. An implementer
following the spec literally would call the legality check without those args and
either reject valid pawn captures or accept illegal ones.

**Risk if ignored:** the verifier disagrees with the game the player actually played.
Every disagreement is an honest player told they cheated.

#### [semantics] Deriving `sign-score` from progress can silently *lower* a returning player's score.

Behavior 8 derives `score = sum(stars) * POINTS_PER_STAR` from `exercise_progress`.
A grandfathered player has an on-chain badge but **zero** progress rows (decision 2
imports the bit, not the stars). Their derived score is therefore **0**, so
Behavior 9 (403 on no rows) fires and they cannot save a score at all — despite
holding the badge the system just credited them for.

The grandfathering path credits qualification but not the star map, and the score
path needs the star map. The two decisions contradict each other.

#### [auth] No route proves the caller owns `player`.

Anyone can POST solutions for **any** address. It is not directly exploitable (you
would be doing a stranger a favour, and `sign-badge`'s signature binds to `player`,
which the contract checks against `msg.sender`), but:
- unbounded writes to `exercise_progress` for arbitrary addresses — a cheap way to
  bloat the table and the bill;
- the grandfathering read-through (Behavior 10) lets an anonymous caller trigger an
  RPC contract read per address, unboundedly.

`enforceRateLimit` is keyed on IP + player, which a script rotates. If these routes
are the money path, they want a wallet-signed session (SIWE-style), not just a rate
limit.

#### [tie-breaks] `timeMs` stays client-supplied and still feeds the leaderboard.

Open question 1 raises it and shrugs. If ranks pay out, a forged `timeMs` is a
forged rank on a tie. Either derive from `sum(elapsed_ms)` (itself client-supplied,
so no better) or accept explicitly, in writing, that tie-breaks are forgeable.

### P2 — Nice to clarify

- **[threshold] "summed stars for that piece" (Behavior 4) is ambiguous** — sum over
  *all stored rows*, or over *ids in the current pool*? They diverge the moment an
  exercise is retired. The spec says elsewhere the sum "walks the current pool";
  say it once, in the behavior, and pick.
- **[grandfathering] Which contract read?** `balanceOf(player, levelId)` is implied
  but never named, and the piece→levelId mapping (`getLevelId`) is client-side today.
  The server needs its own copy, and the two must not drift.
- **[observability] No logging plan for `ok: false`.** The rejection reasons are the
  single best cheat-detection signal the system will have, and the spec throws them
  away. Log them with the player, the exercise, and the submitted path.
- **[503] The "never fall back to baseline" rule needs a test**, or the next person
  who touches `getMergedCatalog` will "helpfully" add the fallback back.

---

## Categories audited

**Contract gaps** — `captureTargets`/`obstacles` missing from the replay contract
(P1). `VerificationFailure` is otherwise complete and every variant is reachable
(I checked: `blocked-square` is *not* dead, because `Exercise.obstacles` is shared
between labyrinths and exercises).

**Behavioral ambiguity** — threshold summation (P2); grandfathered players'
score derivation contradicts the score behavior (P1).

**Hidden assumptions** — the big one: that a correct solution implies a played
solution (P0). Also assumes the server can always resolve the overlay catalog; the
spec handles this well (503, no fallback) and that is the strongest part of it.

**Backward compatibility** — deploy-day lockout of honest un-minted players (P0).
Existing `scores` rows are untouched, which is correct.

**Security & data** — no wallet ownership proof (P1). Service-role-only tables:
correct and explicitly stated. Rate limiting: insufficient for a money path.

**Test coverage gaps** — acceptance criteria are testable and the first one ("403
for a wallet with no qualification row") is exactly the missing test that let the
original bug ship. Missing: a test that the verifier accepts a BFS-optimal path
(it will — that is the P0), and a test for the 503-no-fallback rule.

**Operational readiness** — no shadow mode, no rollback plan, no logging of
rejections. All three are needed before this touches the claim path.

---

## Verdict

**NEEDS REVISION.**

P0 findings: **2**
P1 findings: **4**
P2 findings: **4**

The engineering in the spec is sound — the monotonic bit, the sparse id-map, the
no-baseline-fallback rule, and the reuse of `computeStars` instead of a
re-implementation are all right, and the catalog-drift trap is handled better than I
expected.

But the spec answers the wrong question. It proves solutions are **correct**; the
threat model needs solutions to be **played**. Until the Goal is rewritten to claim
only what the design delivers — and the prize-pool decision is decoupled from it —
this should not go to `/tdd`.

Fix in the spec first:
1. Re-frame the Goal (P0 core-premise) and pick (a)/(b)/(c).
2. Add shadow mode + honest migration copy (P0 rollout).
3. Resolve the grandfathering ↔ score-derivation contradiction (P1).
4. Put `captureTargets`/`obstacles` in the replay contract (P1).
