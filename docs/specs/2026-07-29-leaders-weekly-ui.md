# Spec — leaders-weekly · Slice 2C: UI

**Date**: 2026-07-29
**Status**: ✅ READY for `/tdd` — **after** Slice 2B (API) is merged
**Parent**: `2026-07-29-leaders-weekly-window-v2.md` — the source of truth for D1–D5, the week
definition, the off-chain asymmetry and the traceability matrix.
**Depends on**: `2026-07-29-leaders-weekly-api.md` (the `LeaderboardResponse` contract;
§Contract received restates it, it does not redefine it).
**TDD order**: DB → API → **UI (this)**

## Scope

`src/components/exercises/leaderboard-sheet.tsx` and its copy:

1. `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` — the kill switch, default OFF.
2. The weekly / all-time tab control.
3. Per-tab fetch state.
4. Tab preference, read after hydration.
5. Empty state, CTA footer, error state — including the 500.
6. Week rollover handling.
7. The optimistic row's new lifecycle.

## Not in scope

- Any server code, SQL or route change. If a state cannot be rendered from
  `LeaderboardResponse`, that is a 2B gap, not a 2C fetch of something else.
- `components/play/play-leaders-sheet.tsx` — it reads `/api/hall-of-fame` (victory NFTs) and is
  unrelated despite the name. **Untouched.**
- A reset countdown. `weekStart`/`weekEnd` are available; using them is a separate product call
  (parent §Open questions).
- Changing all-time's rendering, its optimistic append, or its on-chain seal.

## Contract received (from Slice 2B)

```ts
type LeaderboardWindow = "weekly" | "alltime";

type LeaderboardResponse = {
  window: LeaderboardWindow;
  rows: LeaderboardRow[];            // top 10
  player: LeaderboardRow | null;     // ranked over the UNCUT set → can be rank 11+
  weekStart?: string;                // weekly only, ISO 8601 UTC
  weekEnd?: string;                  // weekly only, ISO 8601 UTC
  surface?: ScoreSaveSurface;        // present on weekly
};
```

- `GET /api/leaderboard?window=weekly[&player=…]` → `LeaderboardResponse`.
- `GET /api/leaderboard[?player=…]` → the legacy shapes, still what all-time uses.
- On a weekly row `hasOnchain` is **absent** — never render the on-chain seal on the weekly tab.
- `player: null` on weekly is the **normal** state for someone who has not played since Monday.
  It is not an error and not a zero.
- A weekly request can answer **500** when the deployment's surface is unresolved.

## Design

### Kill switch (parent D4)

`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`, default **OFF**. Read at call time, like every other gate
here.

- **OFF** — the component takes its current code path unchanged: no tab control, no weekly
  request, no new copy on screen. Byte-identical to today from the player's side.
- **ON** — tabs, weekly default.

The endpoint ignores the flag (2B), so the board is probeable in prod before anyone sees it.

### Per-tab fetch state

The current single `hasFetched` ref (`leaderboard-sheet.tsx:86`) cannot express "weekly fetched,
all-time not" — reusing it renders one tab's data under the other's header.

```ts
type TabState = {
  rows: LeaderboardRow[];
  ownRow: LeaderboardRow | null;
  fetched: boolean;
  stale: boolean;
  weekStart?: string;  // weekly only; a change means rollover → replace, not merge
};
type SheetState = Record<LeaderboardWindow, TabState>;
```

A response is applied **only if it matches the currently requested window** — two tabs fetching
concurrently must not resolve out of order into each other's slot.

### Tab preference (parent D3)

Stored under `chesscito:leaders-tab`, read **after** hydration. First render is always `weekly`;
a stored `alltime` is applied in an effect. Deciding from unhydrated storage is the exact shape
of the intermittent bug that has already hit this codebase three times. An unreadable or unknown
value falls back to `weekly`.

### UI states and transitions

| State | Weekly tab | All-time tab |
|---|---|---|
| Loading, first open | skeleton (existing) | skeleton |
| Loaded, rows > 0 | ranked list; hero band shows champion + count | unchanged from today |
| Loaded, rows = 0 (fresh Monday / first week) | empty state: no champion, `heroEmptyHeadline`/`heroEmptyHint` | today's empty state |
| Loaded, 1–2 rows (thin week) | render exactly those rows — **never pad with all-time rows** | n/a |
| Fetch error | error + retry (existing), scoped to the tab that failed | idem |
| 500, unresolved surface | error state, never a board | unaffected — all-time is not surface-scoped |
| Own row exists in window | pinned `YOUR RANK` footer (existing) | unchanged |
| Own row at rank 11+ | footer shows the real rank; the list still shows only the top 10 | unchanged |
| Own row absent in window | footer becomes a **CTA**, no rank | n/a — all-time keeps today's behavior |
| Wallet not connected | no footer (no `player` param sent) | unchanged |
| Save-on-chain pending | CTA footer variant (existing `canSaveOnChain`) — **all-time tab only**, since weekly has no on-chain concept | unchanged |

**Transitions**
- weekly → all-time: tab click. Fetches once, then served from `SheetState`.
- no-activity → ranked: after a save lands, `refreshTrigger` fires; the CTA footer becomes the
  rank footer in the same render pass.
- week rollover with the sheet open: `weekStart` changes → rows **replaced**, own row reset to
  `null`, footer falls back to the CTA.

### Copy

```text
Empty state (weekly, zero rows)
EN:  THE WEEKLY BOARD IS JUST GETTING STARTED
     Play an exercise to put the first name on it.
ES:  EL RANKING SEMANAL RECIÉN EMPIEZA
     Juega un ejercicio para poner el primer nombre.

Footer CTA (weekly, no activity this week)
EN:  PLAY TO JOIN THIS WEEK
     Complete an exercise to enter the weekly ranking.
ES:  JUEGA PARA ENTRAR ESTA SEMANA
     Completa un ejercicio para aparecer en el ranking semanal.
```

Lives in `LEADERBOARD_SHEET_COPY`. The ES bundle is a **top-level namespace spread**, so every
new key must be added to both bundles — a partial namespace prints the raw path on screen. The
CTA keeps the rank footer's height so switching tabs does not jump the layout.

### Optimistic row lifecycle

`chesscito:optimistic-score` (sessionStorage, 2 min TTL, `leaderboard-sheet.tsx:29`) is appended
today when the player's own row is missing from the response. In weekly that heuristic is wrong
twice over: an absent own row is the *expected* state, and the entry carries no surface, so a
Play score could be painted onto a Learn board.

- **Weekly never appends it and never renders it.**
- **All-time keeps today's append-if-missing behavior**, unchanged.
- **Either tab clears it** using the check that already exists: drop the entry as soon as a
  response contains a row whose `rowId` equals `deriveRowId(optimistic.player)`
  (`leaderboard-sheet.tsx:102-108`). Weekly performs that clear without ever appending. Without
  it, a weekly-default session leaves the entry alive for its full TTL, and a tab switch inside
  that window appends a score the all-time response already contains — a duplicated own-row
  reachable by an ordinary tap.

**Do not compare scores to decide the clear.** `optimistic.score` is one exercise's value while
a row's `score` is a per-player total; both are `number` and mean different things, so a `>=`
between them reads as correct and is wrong. Presence by `rowId` is the existing, correct signal.

## Acceptance criteria

Kill switch (parent D4)
- [ ] **UI-1** Flag OFF: the sheet renders no tab control and issues no weekly request.
- [ ] **UI-2** Flag ON, no stored preference: the sheet opens on the weekly tab.

Tabs and state
- [ ] **UI-3** A stored `alltime` preference is applied only after hydration; first paint is
      weekly.
- [ ] **UI-4** Switching tabs fetches the other window once; switching back does not refetch.
- [ ] **UI-5** A response for a non-active window is discarded, not written into the active tab.
- [ ] **UI-6** `refreshTrigger` refetches the active tab and marks the other stale; the stale tab
      refetches on next activation.
- [ ] **UI-7** A response whose `weekStart` differs from the stored one **replaces** the rows and
      resets the own row to `null`, rather than merging.

Rendering
- [ ] **UI-8** Zero weekly rows renders the empty state with no champion in the hero band.
- [ ] **UI-9** A thin week (1–2 rows) renders exactly those rows, with no all-time rows mixed in.
- [ ] **UI-10** With no weekly activity, the footer renders the CTA (EN + ES asserted) and not a
      rank.
- [ ] **UI-11** The CTA footer and the rank footer have the same height (no layout jump).
- [ ] **UI-12** `player.rank === 11` renders the real rank in the footer while the list shows
      only the top 10.
- [ ] **UI-13** A 500 on the weekly request renders the error state and never a board.
- [ ] **UI-14** No weekly row renders the on-chain seal.
- [ ] **UI-15** Every new copy key exists in EN and ES.

Optimistic row
- [ ] **UI-16** The optimistic row is never appended on the weekly tab.
- [ ] **UI-17** The optimistic entry is cleared once any tab's response contains a row matching
      its `rowId` — a subsequent tab switch does not append a duplicate.
- [ ] **UI-18** No code path compares `optimistic.score` against a `LeaderboardRow.score`.

## Definition of done

- All 18 ACs green, written before the implementation.
- With the flag unset, the component's rendered output is unchanged from `main` — UI-1 is the
  guard, and the existing sheet tests must still pass untouched.
- No server file, route or SQL touched.
- New copy keys present in both bundles; `pnpm content:audit` clean.
- `pnpm exec tsc --noEmit` clean and the full suite green before commit.
