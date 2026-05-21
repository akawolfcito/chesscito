---
date: 2026-05-20
arc: post-domain-migration UX addendum
parent_handoff: docs/release/2026-05-20-post-domain-migration-addendum-handoff.md
focus: Cluster E (persistence + Coach re-entry) — the only cluster that adds new flows; A/B/C/D already validated in their own sessions
duration_estimate: 45 minutes (30 device + 15 screen-reader)
---

# Smoke Plan — Post-Domain-Migration UX Addendum

## Pre-flight (5 min)

1. **Device** — physical Android phone with MiniPay installed. Opera Mini browser ≥ latest. Wallet funded with ≥ $0.10 cUSD (covers a Mint Victory test on Easy + Coach analysis).
2. **Production target** — `chesscito.com` (NOT preview URL). Verify the address bar resolves to the apex.
3. **DevTools tunnel** (optional but recommended) — Chrome on desktop with `chrome://inspect` connected to the Android USB device. Lets you watch Network + Console while the user taps.
4. **Telemetry monitor** — open Vercel dashboard → Logs filtered on `game_persist_attempt`, `game_persist_outcome`, `coach_analyze_request`, `coach_history_unanalyzed_view`. Have it on a second screen.
5. **Reset state** — clear MiniPay's browser storage for `chesscito.com` so the smoke runs against a clean slate (no cached persisted games, no welcomed Coach flag).

---

## Track A — Device smoke (Android MiniPay, ~30 min)

Each step is a separate scenario. Mark **PASS** / **FAIL** per row. Capture screenshot on FAIL.

### A.1 — Cold persistence happy path (the load-bearing test)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Open `chesscito.com` from MiniPay's app picker. Hub loads. | Hub renders within 3s. No 403 on `/api/sign-*` or `/api/pro/status`. | ☐ |
| 2 | Tap **Free Play** → Arena selector. Pick **Easy**, **White**. | Arena scaffold loads. | ☐ |
| 3 | Play a full game. Win by checkmate (move-by-move on Easy AI takes <2 min). | Game ends, board shows checkmate position for 800ms, then end-state overlay fades in. | ☐ |
| 4 | **Within the same overlay**, watch the bottom of the viewport. | A candy-warm toast pill labeled `Saving match…` mounts within 200ms of the overlay. | ☐ |
| 5 | Wait. | Toast morphs to a ✓ then unmounts (≤1500ms after `persisted` state). `Mint Victory ▶` + `Get Coach Analysis` (secondary) both transition from `aria-busy="true"` to enabled. | ☐ |
| 6 | Open `/coach/history` from the dock. | The just-finished game appears at the TOP of the list with title `Match · Easy · Win · just now` and a green `Analyze ▶` chip. NO Coach Review chip (FULL/QUICK). | ☐ |

**Telemetry check:** Vercel logs show `game_persist_attempt` followed by `game_persist_outcome{result:"success"}` within 600ms of each other. No `game_persist_cap_overflow` (you're far under the 200-row cap).

### A.2 — Coach analysis from end-state (immediate source)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Continue from A.1 end-state (don't navigate away). Tap **Get Coach Analysis** (secondary under Mint Victory). | Coach loading screen mounts. After ≤15s, full Coach result panel renders. | ☐ |
| 2 | Network tab: inspect the POST to `/api/coach/analyze`. | Request fires once. Response: `{ status: "ready", response: {...} }` (no `idempotent: true`). | ☐ |
| 3 | Telemetry: confirm `coach_analyze_request{source:"immediate"}` fired exactly once. NO `coach_analyze_idempotent_hit` for this game. | ☐ |

### A.3 — Coach re-entry from history (history source + idempotent)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Hub → New game. Play any game to end (don't tap Coach this time). | A.1 toast cycle replays; new entry hits `/coach/history` with Analyze chip. | ☐ |
| 2 | From `/coach/history`, tap the **Analyze ▶** chip on the new unanalyzed entry. | Coach loading screen mounts. Result panel renders. | ☐ |
| 3 | Telemetry: `coach_analyze_request{source:"history"}` fired exactly once. `coach_history_analyze_tap{game_id}` fired before the request. | ☐ |
| 4 | Back to `/coach/history`. The entry that was just analyzed now renders as a normal row (FULL chip, no Analyze chip). | ☐ |
| 5 | Tap the row again. | Coach result panel opens immediately (no analyze fetch). The entry's existing analysis row replays via `onSelectEntry`. | ☐ |
| 6 | **Idempotent edge:** open Network, then tap Analyze on any OTHER game already analyzed (force it via DevTools — set the chip's `onClick` to fire `onAnalyzeUnanalyzed(<analyzed-game-id>)`). | Response includes `idempotent: true`. Telemetry: `coach_analyze_idempotent_hit{source:"history"}` fired INSTEAD of `coach_analyze_request`. Credit count unchanged. | ☐ |

### A.4 — Loss path (Coach CTA as primary)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | New game. **Resign on move 2**. | End-state mounts. Toast fires + completes as in A.1. | ☐ |
| 2 | The end-state shows `Get Coach Analysis` as a **primary** amber candy button (full-width, prominent), NOT under a Mint peer. No Mint button visible. | ☐ |
| 3 | Tap it. | Coach loading → fallback (resigned game is too short for full analysis) OR result panel. Source dim: `immediate`. | ☐ |

### A.5 — 0-move guard (instant resign)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | New game. **Resign immediately, before making any move.** | End-state mounts. | ☐ |
| 2 | `/api/games` POST STILL fires (spec §I/O Matrix line 64). Verify in Network tab — record with `totalMoves: 0` is persisted. | ☐ |
| 3 | `Get Coach Analysis` CTA mounts disabled. Long-press it on Android. | Tooltip / title text shows `Match too short to analyze`. | ☐ |

### A.6 — Persistence failure path (force a 500)

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Open DevTools (Chrome `chrome://inspect`). Throttle network to "Offline" OR block requests to `/api/games`. | Network blocking armed. | ☐ |
| 2 | Play any game to end. | End-state mounts. Toast appears as `Saving match…` then morphs to a rose-tinted warning row with `Match not saved · play continues` + `[Retry]` + `[✕]` controls. | ☐ |
| 3 | Mint Victory + Get Coach Analysis remain disabled (`aria-busy="false"`, just `disabled` since the persist phase ended). Play Again + Back to Hub remain enabled. | ☐ |
| 4 | Unblock `/api/games`. Tap **Retry**. | Warning replaced by `Saving match…` then ✓. CTAs enable. Telemetry: `game_persist_outcome{result:"success"}` fires (NOT `user-dismissed`). | ☐ |
| 5 | Re-arm the block. Trigger another failure. Tap **✕** dismiss. | Warning unmounts. CTAs stay disabled. Telemetry: `game_persist_outcome{result:"user-dismissed"}`. | ☐ |

### A.7 — Offline guard on history Analyze

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Turn airplane mode ON. | Device offline. | ☐ |
| 2 | From `/coach/history`, tap Analyze on an unanalyzed entry (if any in cache). | The Coach flow short-circuits to the fallback panel with `You need to be online to analyze` error copy. No `/api/coach/analyze` request leaves the device. | ☐ |

### A.8 — Mint Victory on top of persisted game

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Win a fresh game. Confirm A.1 toast cycle completes (`gameRecordPersisted = true`). | CTAs enabled. | ☐ |
| 2 | Tap **Mint Victory ▶**. Approve cUSD allowance + mint. | Standard mint flow (TxProgressSteps pills variant). Receipt on Celoscan. | ☐ |
| 3 | Post-mint VictoryClaimSuccess screen renders. Tap the Coach button on that screen. | Coach loads. Telemetry: `coach_analyze_request{source:"victory-mint"}` (NOT `immediate`). | ☐ |
| 4 | NO double Coach CTA visible (the secondary candy from `composedCoachPreview` is NOT rendered in the post-mint branch). | ☐ |

---

## Track B — Screen-reader smoke (~15 min)

**Tools:** VoiceOver on iOS (Settings → Accessibility → VoiceOver) OR TalkBack on Android (Settings → Accessibility → TalkBack). Use a Bluetooth keyboard if possible — easier than touch swipes.

### B.1 — Persistence overlay announcement

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | With reader ON, complete a game and reach end-state. | Reader announces `Saving match…` polite-live region. | ☐ |
| 2 | When `persisted`, the toast unmounts silently. | No double-announcement on success transition. | ☐ |
| 3 | Force a failure (offline). | Reader announces (assertive-live) the failure copy + Retry button. NOT announced as a "dialog" (since `role="alert"`, not `alertdialog`). Focus is NOT trapped — user can navigate to Play Again. | ☐ |

### B.2 — End-state CTA states

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | While persisting, focus the **Get Coach Analysis** button. | Reader announces "Get Coach Analysis, busy, dimmed" or local equivalent (aria-busy=true). | ☐ |
| 2 | After persisted, re-focus the button. | Reader announces "Get Coach Analysis, button" — NO "busy". | ☐ |
| 3 | On win, focus the secondary Coach button (under Mint Victory). | Reader announces the label PLUS the `aria-describedby` hidden text "Secondary action — Mint Victory above is the primary action." | ☐ |
| 4 | On 0-move game, focus the disabled Coach CTA. | Reader announces "Get Coach Analysis, dimmed, Match too short to analyze" (title attribute used as accessible description). | ☐ |

### B.3 — `/coach/history` list semantics

| # | Action | Expected | Pass |
|---|--------|----------|------|
| 1 | Navigate to `/coach/history` with reader ON. | Reader announces the list role + the first item's aria-label. | ☐ |
| 2 | Swipe through entries. For an **unanalyzed** chip: aria-label format is `Analyze match from {timestamp}, {difficulty}, {result}`. | Reader reads exactly that pattern. | ☐ |
| 3 | For an **analyzed** entry: aria-label format is `Open Full Coach Review — Win, Easy, 14 moves` (existing OlderReviewRow contract). | ☐ |
| 4 | Activate any chip. | Coach panel opens. Reader announces transition. | ☐ |

---

## Acceptance gate

The addendum is "done-done" when:

- All 8 device scenarios (A.1–A.8) are ☐ → ✅.
- All 3 reader scenarios (B.1–B.3) are ☐ → ✅.
- Any FAIL escalates to an issue tracked in the next sprint; the addendum status changes from "shipped, smoke-pending" to "smoke-pending-with-known-issues" rather than "done".

**Skip rule:** if MiniPay's WebView blocks DevTools attachment, A.6 (force 500) and A.7 (offline) can be partially validated on desktop Chrome at `chesscito.com` — the persistence logic is identical, only the surface chrome differs. Document the skip in the smoke run notes.

---

## Recording

Save smoke run notes as `docs/handoffs/2026-05-2X-addendum-smoke-run-notes.md` (replace `X` with run date). Include:

- Pass/fail per scenario row
- Screenshot links for any FAIL (attach to handoff or paste in commit)
- Device model + Android version + MiniPay version
- Telemetry timestamps for the 4 key events (`game_persist_attempt`, `game_persist_outcome`, `coach_analyze_request`, `coach_analyze_idempotent_hit`)

Wolfcito 🐾 @akawolfcito
