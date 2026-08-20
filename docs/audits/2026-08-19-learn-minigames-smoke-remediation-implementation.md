# Learn Mini-games — targeted smoke remediation (implementation)

**Date**: 2026-08-19
**Source audit**: `docs/audits/2026-08-19-learn-minigames-smoke-remediation-audit.md`
**Status**: implemented locally. **Not pushed. Not deployed.**
**Scope**: the three remediations the audit proved. Nothing else.

---

## 1. What changed, in one paragraph

A navigation-context ref (`completionOriginRef`) now records whether the lane
content on screen was entered from the Mini-games surface or from the exercise
path. `handleLabyrinthContinue` returns early to Learn Home for a featured entry
— which, because the overlay's X shares that handler, fixes Continue and Close
in one place and makes the `piece-complete` branch unreachable from a featured
completion. **No state write changed.** Plus one CSS/markup line removed to clear
the 360×640 primary-viewport rule.

---

## 2. Tests first (PART 1)

`apps/web/src/components/exercises/__tests__/featured-completion-boundary.test.tsx`
— 6 tests, driven through the **real move handler** (two clicks per rook move on
`[data-square]`), not a simulated completion.

Red before the fix, green after:

| AC | before | after |
|---|---|---|
| AC-1 featured renders its exact challenge | ✅ (already correct) | ✅ |
| AC-2 completion still writes its best | ✅ (already correct) | ✅ |
| AC-3 + AC-7 Continue → Learn Home, no Exercises UX | ❌ `expected "vi.fn()" to be called with [ '/' ]` | ✅ |
| AC-4 Close (X) → Learn Home | ❌ same | ✅ |
| AC-5 Retry stays local | ✅ (already correct) | ✅ |
| AC-6 exercise-path continuation unchanged | ✅ | ✅ |

AC-8 (`training_pass` still refused) and AC-9 (badge chain untouched) are already
pinned by `featured-minigame-open.test.tsx` and the drawer suite; both still pass.

### Two harness traps this test had to survive — both found by probing, not guessed

⛔ **`markMilestonesSeeded()` alone is not enough.** It stamps the migration
marker without persisting the celebrated set, so the queue still emitted. A probe
showed *"First Reward Earned"* mounted **over** the board with the challenge still
running: `celebration` was non-null, the lane-completion overlay was suppressed,
and every assertion would have failed for a reason unrelated to the boundary. The
test now calls `seedMilestonesOnce(...)`.
⚠️ Related: `giftAvailable` is hardcoded `CHESSCITO_LITE_MODE`
(`exercises-screen.tsx:1413`) — it does **not** read the welcome-package state,
so `first-reward` fires on 4 lifetime stars regardless of the gift. It must be
seeded, not avoided.

⛔ **The overlay's X and its primary CTA share an accessible name.** The overlay
passes `closeLabel={t("continue")}`, so `getByRole("button", {name:/continue/i})`
matches both — AC-3 and AC-4 would have stopped being two different tests.
Selectors are code-owned classes and DOM structure instead.

⚠️ Also: `.arena-result-primary-cta` does not exist on this overlay — its primary
is a `<PrincipalButton>`. It is located structurally, as the sibling of the cream
secondary inside the CTA stack.

### One test was rewritten rather than left passing vacuously

AC-6 originally entered through `?content=` and early-`return`ed when the board
did not mount — a **vacuous pass**. It now enters through the **path drawer**,
which is how the exercise path actually reaches a lane level, and asserts the
board mounts. (The deep link cannot be used there: with stored progress it hits
the pre-existing hydration race documented in audit §1.3.)

---

## 3. Entry context (PART 2)

`exercises-screen.tsx`:

```ts
const completionOriginRef = useRef<"featured_minigame" | "exercise_path" | null>(null);
```

- **Set** inside `requestTrainingContent`, only on a successful selection:
  `source === "featured"` → `featured_minigame`; every other declared source →
  `exercise_path`.
- ⚠️ **`automatic` PRESERVES the current origin.** It is how a replay
  (`onRetry`) and post-completion continuation re-enter content, not a new entry.
  Overwriting on `automatic` would silently demote a featured replay to the
  exercise path after the first *Play again* — AC-5 is what pins this.
- **Cleared** in `handleExitLabyrinth`, so anything opened afterwards declares
  its own origin.
- A **ref**, not state: it must not survive a reload (a refreshed tab is not a
  hub entry) and must not re-render anything.
- **No storage.** Not localStorage, not sessionStorage, not the DB.
- Restore cannot promote a non-featured entry: `restore` maps to `exercise_path`
  like every other non-featured source.

---

## 4. The boundary (PARTS 3, 4, 5, 6)

```ts
function handleLabyrinthContinue() {
  if (completionOriginRef.current === "featured_minigame") {
    handleExitLabyrinth();
    router.push("/");
    return;                     // ← before any exercise-path resolution
  }
  …unchanged…
}
```

- **`resolvePostLabContinue` is untouched**, and so is every branch below the
  early return. AC-6 pins that the exercise path is byte-equivalent.
- **PART 5 needed no overlay change.** `onClose` is already wired to
  `onContinue` (`labyrinth-complete-overlay.tsx:122`), so branching inside the
  single handler makes close and continue agree *by construction* rather than by
  two edits that must be kept in sync. Exercise-path close/continue semantics are
  unchanged.
- **PART 4 falls out of the early return**: `setShowPieceComplete(true)` lives in
  the `piece-complete` branch, which a featured completion never reaches.
  `completeExercise`'s badge logic is untouched.
- **PART 6**: destination is `/`. The Learn hub *is* `/` (`/hub` redirects to it)
  and the Mini-games section is on it. No new route, no hash anchor, no scroll
  restoration.

**Mini-game bests still feed mastery.** The fix is presentation only — the
principle the brief set (`SAME STATE SEMANTICS, DIFFERENT COMPLETION UX`) is
enforced by AC-2, which asserts the best is written on a featured completion.

---

## 5. Vertical budget (PARTS 7–12)

New measured assertion: `apps/web/e2e/learn-hub-viewport.spec.ts`. **Not a
screenshot** — `hub-clean`-class tolerance is ~1.646 px on 390×844, larger than
several of the blocks being budgeted, so the pass condition is
`getBoundingClientRect`.

### The deficit was 14 px, not 138 px

```
360x640, before:  first Mini-games card: bottom=654 exceeds viewport=640 by 14px
                  main Learn CTA  ✅ inside
                  Daily           ✅ inside
```

The 138 px figure from the audit is **total document overflow**, which is the
Training Path — content PART 12 explicitly allows below the fold. Only one
primary destination was actually out of reach.

### ⛔ Deviation from the stated C → B → E → D order, and why

**C (Season Pass detail behind its CTA) was NOT applied.** Measured, the offer
state does duplicate itself —

```
stats row : "21 days · +3 Shields · Special Training"
CTA banner: "21-Day Season Pass — Daily training · Progress rewards · 3 welcome Shields — $0.99"
```

— but the stats row is **directly pinned by four assertions** in
`challenge-card.test.tsx` (lines ~345, ~867, ~903, ~929) and it *is* the Season
Pass benefits list the brief protects ("Do NOT change its benefits"). Deleting
copy under four tests to recover 14 px is disproportionate. PART 12 authorises
this: *"prefer the product rule over cosmetic zero-scroll… document any deviation
explicitly."* This is the documented deviation.

**B (compact the card icon) was applied, measured, and REVERTED — it buys 0 px.**
`challenge-card-top` is 98 px while `challenge-card-icon` is 72 px: the block's
height is set by the **text column** beside it, not by the sprite. Shrinking the
icon would have moved four VR baselines for nothing. A comment now says so in
`globals.css` so nobody re-tries it.

**E (PART 10) was applied and is sufficient.** The redundant `"Featured
challenges"` sub-line is removed; `MINI-GAMES` + `EARLY ACCESS` stay, and the
concept survives in the section's `aria-label` ("Mini-games, featured
challenges"). The now-orphan `featuredLabel` key was removed from **both** the EN
and ES bundles so parity stays clean.

**D (Training Path) not needed.**

### After

```
360x640:  overflow 138 → 122   ·  mini-games block 137 → 121  ·  AC-10 PASSES
390x844:  overflow 0           ·  AC-10 PASSES
```

Mascot untouched. Season Pass untouched. Training Path untouched.

---

## 6. ⚠️ A VR result that was nearly misread

The first VR run after the change reported **12 failures**, including
`about-page`, `terms-page`, `privacy-page`, `support-page`, `frame-tablet-600`,
`hub-clean`, `hub-daily-tactic-open`, `hub-shop-sheet-open` — pages that share no
code with anything in this change.

Per the runbook, the `-actual` evidence was read before touching a baseline. The
`error-context.md` for `privacy-page` showed the page had rendered the **web
access gate** ("Unlock your Chesscito journey / Sign in to enter"), not the
privacy content.

Cause: an **orphaned `next-server` on port 3002**, 2 h 13 m old, left over from an
earlier Playwright run. `reuseExistingServer: !CI` adopted it, and that process
never received `webServer.env`. Killing it and letting Playwright start its own
server gave:

```
63 passed · 4 failed  — and the 4 are exactly the learn-hub baselines this change edits
```

**Nothing was re-recorded on the strength of the bad run.** Recorded here because
the same trap will catch the next person.

---

## DELIVERABLE

**FEATURED ROUTING:** UNCHANGED / PASS — `resolveMiniGameDeepLink`, rotation
resolution, catalog and content ids were not touched. AC-1 pins that a featured
card with stored progress still renders its exact challenge.

**ENTRY CONTEXT:** `completionOriginRef: useRef<"featured_minigame" |
"exercise_path" | null>` in `exercises-screen.tsx`. Set on a successful
`requestTrainingContent` from the declared source; `automatic` preserves it so a
replay stays featured; cleared by `handleExitLabyrinth`. Navigation context only
— a ref, never storage.

**FEATURED CONTINUE DESTINATION:** Learn Home (`router.push("/")`)

**FEATURED CLOSE DESTINATION:** Learn Home — the overlay's X already shares
`onContinue`, so one branch fixes both and they cannot drift apart.

**FEATURED RETRY:** unchanged — replays the same challenge, no navigation
(`requestTrainingContent(id, "automatic")`, which preserves the featured origin).

**FEATURED COMPLETION STATE WRITES:** UNCHANGED — AC-2 asserts the labyrinth best
is still written; mastery/lane state is fed exactly as before.

**EXERCISE-PATH COMPLETION UX:** UNCHANGED — AC-6 enters through the path drawer
and asserts the continuation does not go to Learn Home.

**ROOK ASCENDANT LEAK:** FIXED — a featured completion no longer routes into
lane-1, which is the only way it reached `completeExercise`'s last-exercise
branch. `completeExercise` itself is untouched.

**ALL EXERCISES COMPLETE LEAK:** FIXED — the `piece-complete` branch is behind
the early return and is unreachable from a featured entry. AC-3/AC-7 assert both
prompts are absent.

**LEARN HUB 390x844:** PASS (overflow 0)

**LEARN HUB 360x640:** PASS — every primary destination fully inside the first
viewport (document overflow 122 px is the Training Path, allowed by the rule)

**PIXELS RECOVERED:** 16 px (mini-games block 137 → 121) against a 14 px deficit.
B measured 0 px and was reverted; C deliberately not applied (see §5).

**MASCOT CHANGED:** NO

**SEASON PASS SEMANTICS CHANGED:** NO — price, benefits, purchase flow, telemetry
and the stats row are all untouched.

**PAYMENT CODE TOUCHED:** NO

**PEONES CODE TOUCHED:** NO — verified by an empty `git diff --stat` over
`lib/peones`, `lib/payments`, `app/api`, `supabase/`.

**DB MIGRATION:** NONE

**TELEMETRY EVENT FAMILIES ADDED:** 0 — `minigames_open`, `minigame_start` and
the single-emitter `labyrinth_complete` are unchanged; the duplicate emission
stays removed.

**FULL SUITE:** **703 files / 8732 passed + 1 todo (8733), EXIT 0, 183 s.**
Before this remediation: 702 / 8726 + 1. Session baseline on clean `main`:
694 / 8607. File count only ever rose.

**TSC:** clean (`pnpm exec tsc --noEmit`, exit 0).

**VR:** **67/67 passed with `--project=minipay --update-snapshots=none`** — `none`
cannot write, so the green compared. Baseline count unchanged at **81**; **4
modified**, all `vr18-learn-hub-*`, because the "Featured challenges" sub-line was
removed. Each `-actual.png` was inspected first and shows exactly that one line
gone. No baseline was auto-accepted, and none was recorded from the
orphan-server run.

**MANUAL SMOKE CHECKLIST:**

> **FLOW A — Featured Rook**
> 1. Learn Home → Mini-games → tap **Rook Rail**
> 2. ✅ the board reads **Two Roads**, `0/3`, 13 moves
> 3. complete it → completion overlay
> 4. tap **Continue**
> 5. ✅ lands on **Learn Home**, Mini-games section visible
> 6. ❌ must NOT see: the rocks/stars board (`rook-7`), an auto-route into
>    **Two Turns**, **Rook Ascendant Earned**, **All Exercises Complete!**
>
> **FLOW A2 — Featured Rook, close instead of continue**
> 1. repeat 1–3, then tap the **X**
> 2. ✅ lands on Learn Home — same destination as Continue
>
> **FLOW B — Featured Rook replay**
> 1. Learn Home → the Rook Rail card now reads **Play again**
> 2. tap it → ✅ **Two Roads** again (not another level)
> 3. complete → tap **Retry** → ✅ **Two Roads** again, no navigation
>
> **FLOW C — Exercises regression**
> 1. Exercises → complete the final Rook exercise
> 2. ✅ **Rook Ascendant Earned** still appears
> 3. ✅ **All Exercises Complete! / Start Bishop** still follows
>
> **FLOW D — Small viewport (360 × 640)**
> 1. ✅ the primary CTA is fully visible
> 2. ✅ the Daily gift is reachable
> 3. ✅ at least one Mini-games card is fully tappable
> 4. ⚠️ the Training Path roster sits below the fold **by design** — scrolling to
>    reach it is expected; scrolling to reach the three above is not

---

## VERDICT

**READY TO DEPLOY A+B + SMOKE REMEDIATION**

Nothing pushed, nothing deployed.

Two items carried forward, neither blocking and neither in scope here:
- the pre-existing `?content=` hydration race (audit §1.3) — affects hand-typed
  or shared deep links, not the Mini-games surface, and is recorded as `it.todo`;
- option **C** (Season Pass detail behind its CTA) remains available as a real
  ~28 px saving and a genuine copy de-duplication, but it is a product/copy
  decision with four tests attached, not part of a 14 px fix.
