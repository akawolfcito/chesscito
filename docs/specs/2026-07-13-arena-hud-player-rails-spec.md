# Arena HUD — Player Rails

**Date:** 2026-07-13
**Author:** Sally (UX) + Wolfcito
**Status:** Accepted, not built
**Scope:** Presentation only. No new functionality, no new data, no new state.
**Surface:** `/arena` playing + end-state (`apps/web/src/components/arena/arena-hud.tsx`)

---

## 1. Problem

The zone above the board is a **ceremonial banner** occupying the space of a
**gameplay HUD**. Today it renders:

- Two 96px avatars (`h-24 w-24`) facing each other
- A `WoodenBanner variant="vs"` between them
- A `MatchupLabel` per side (name + piece-color text) above each avatar
- The difficulty pill dangling below the VS via the `vsBelowSlot` prop

Four stacked rows of chrome before the player reaches the board. On a 390px
viewport this pushes the board down and compresses the action bar.

The ceremony is no longer needed here: **`ArenaMatchupTransition` (shipped
`ef2b0ae3`, 2026-07-13) already performs the VS reveal on entry.** The in-match
HUD is repeating a beat the player just watched.

## 2. Design decision: rails

Replace the symmetric "You ⚔ Bot" header with **rails** — rival strip above the
board, player strip below it.

```
┌──────────────────────────┐
│ ← ARENA        ⏱ 0:25 🛡7│   ContextualHeader (unchanged)
├──────────────────────────┤
│ [🤖] PIPO                │   rival rail  (tappable → change difficulty)
│      Easy · 477 ELO      │
│ ┌──────────────────────┐ │
│ │       BOARD          │ │   ArenaBoard (unchanged)
│ └──────────────────────┘ │
│ [🐺] YOU                 │   player rail (static)
│      Blue Bishop #6649   │
├──────────────────────────┤
│      ArenaActionBar      │
└──────────────────────────┘
```

### Why rails

`arena-board.tsx:92` → `const flipped = playerColor === "b"`. **The board already
flips.** The player's pieces are always at the bottom, the rival's always at the
top, regardless of the color drawn.

Therefore placing each avatar on the side where its own pieces live makes
**position the carrier of piece color**. The `White`/`Black` text label becomes
redundant *because of* the layout, not in spite of it.

### Composition (corrected during implementation, 2026-07-13)

**Both rails belong to the board group, not to `ArenaHud`.**

The first build put the rival rail inside `ArenaHud` (as a sibling of the
header) and the player rail in `page.tsx` below the board. It typechecked, all
tests passed — and the first screenshot showed the rails floating far away from
the board, because the board sits in a `flex-1 justify-center` wrapper and the
leftover vertical space opened up *between* the rail and the board. Three loose
elements instead of two sides of a match.

A rail's entire job is to sit hard against the board edge. So:

- `ArenaHud` = header only (back chip + timer). It owns **neither** rail.
- `page.tsx` wraps `[rival rail, ArenaBoard, player rail]` in one centred flex
  column. The adjacency is the argument; it cannot be delegated.

No test could have caught this. Screenshot the surface.

### Alignment

Both rails **left-aligned**. A mirrored layout (one left, one right) looks
symmetric in a mockup but breaks the vertical reading column and buys nothing at
390px.

## 3. Data — everything already exists

No new fields. No new hooks. No schema change.

| Slot | Source | Notes |
|---|---|---|
| Rival name | `rivalFor(game.difficulty).name` | Pipo / Mara / Kairo |
| Rival avatar | `/art/rivals/${rival.avatar}-avatar.png` | already passed as `rivalAvatarSrc` |
| Rival line 2 | `` `${difficultyLabel(d)} · ${rivalElo} ELO` `` | `randomEloForDifficulty`, `page.tsx:327` — stable per match |
| Player name | `tArena("youLabel")` | "You" |
| Player line 2 | `playerNickname` (`page.tsx:346`) | Identity Lite nickname; `undefined` for visitors |
| PRO ornament | `useIsProActive()` → `PlayerAvatar pro` | unchanged |

The reference mockup's "Blue Bishop #6649" is **exactly** `playerNickname`. The
only thing in the reference we do not have is a *player* ELO — and we do not
invent one. The player rail simply has no ELO segment.

## 4. HARD RULE — the avatar perimeter belongs to PRO

`PlayerAvatar` (`components/redesign/player-avatar.tsx`) renders the PRO state as
a **full ornamental PNG frame layered behind the avatar**
(`/art/chesscito-pro/borde-dorado-avatar-{azul,rojo}.png`), not as a CSS ring.

The perimeter of the avatar is therefore **already claimed**, by the
highest-value status signal we have.

**Forbidden on the HUD avatars:**

- ❌ A piece-color ring (white/black) — would fight the PRO frame, or silently
  vanish for PRO users. This is the bug that killed the first proposal.
- ❌ The `rivals.ts` `frame: "blue" | "silver" | "gold"` difficulty art
  (`/art/rivals/frame-<frame>.png`) — same collision. Difficulty stays **text**
  in line 2. The frame asset remains valid on the *selector* cards, where no PRO
  ornament is present.

Any future signal must find a carrier that is **not** the avatar perimeter.

## 5. Dropped interaction — in-match "change difficulty" (decided 2026-07-13)

The difficulty pill is currently a **`<button onClick={handleChangeDifficulty}>`**
(`page.tsx:1433`). That handler is literally `game.reset()` (`page.tsx:975`) —
**with no confirmation**.

So today, a tap on what *looks like an informational chip* destroys the
in-progress match silently, while the back chip — which is honestly destructive —
**does** raise a confirm modal (`ArenaConfirmModal`). That is an inconsistency and
a footgun.

**Decision: both rails are static. Neither is a button.**

- The affordance is not lost, only made honest: difficulty is picked on the
  Difficulty Selector at `/arena` entry. Mid-match, the path is
  back → confirm → hub → Enter Arena → selector.
- `handleChangeDifficulty` (`page.tsx:975`) is **deleted** — it has no other
  caller (verified: only `page.tsx:1435`).
- No tap target, no hover state, no `role="button"` on either rail.

This removes a destructive unconfirmed action; it does not add one.

## 6. UI states and transitions

Per `CLAUDE.md` — every state enumerated before implementation.

| # | State | Rival rail | Player rail |
|---|---|---|---|
| 1 | Player's turn (idle) | normal | **active** (see §6.1) |
| 2 | Rival thinking (`isThinking`) | **active** + thinking indicator | normal |
| 3 | End-state (`isEndState`) | normal, neither rail active | normal |
| 4 | PRO active | gold ornament frame | gold ornament frame |
| 5 | PRO inactive | no frame | no frame |
| 6 | Visitor (not connected) | unchanged | line 2 **omitted**, rail keeps its height (§6.2) |
| 7 | Promotion overlay open | normal | **active** (still player's turn) |

Neither rail is interactive in any state (§5).

### 6.1 Turn indicator (new, free)

Today "rival thinking" is a Lottie floating over the avatar
(`arena-hud.tsx:280`). In rails, the standard pattern is to **highlight the
active rail**.

Both are kept:

- The **active rail** (whoever must move) gets a subtle emphasis — raised
  opacity / soft glow on the rail background. The inactive rail dims.
- The **thinking Lottie** (`sandy-loading.lottie`) stays anchored to the rival
  avatar during `isThinking`.

This yields a **turn indicator the HUD does not have today**, at zero new state:
the turn is derivable from `isThinking` alone.

Edge cases:
- `isEndState` → **neither** rail is active. No glow, no dim, no Lottie. The
  match is over; the HUD must not imply someone is still to move.
- `pendingPromotion` → board is locked but it is still the player's turn. Player
  rail stays active.

### 6.2 Layout under stress

- Long nickname (Identity Lite can produce long strings) → line 2 truncates with
  `text-overflow: ellipsis`, single line, never wraps. A wrapped rail would
  shove the board.
- Rail height is **fixed** whether line 2 is present or not (visitor case), so
  the board never shifts vertically between a connected and a visitor session.

## 7. Removed

| Element | Fate |
|---|---|
| `WoodenBanner variant="vs"` | **removed from HUD.** NOTE: contrary to the original draft, `ArenaMatchupTransition` does *not* use `WoodenBanner` — the component is now unreferenced app-wide. Left in place pending a call from the founder; it is a generic 3-variant component, not arena-specific. |
| `MatchupLabel` (name + color) | **deleted.** Replaced by the rail's own name/meta lines. |
| `arena-matchup-label-color` CSS | **deleted** — the color text is gone (see §2). |
| `youColorLabel` / `rivalColorLabel` props | **deleted** from `ArenaHud`. `page.tsx:332-339` derivation goes with them. |
| `vsBelowSlot` prop | **deleted.** Its only consumer was the difficulty pill (§5). |
| Difficulty pill `<button>` | **deleted** (§5). Difficulty survives as text on the rival rail. |
| `handleChangeDifficulty` (`page.tsx:975`) | **deleted** — no remaining caller. |
| `arena-difficulty-pill` / `arena-rival-chip` CSS | **deleted** once the pill markup is gone. |
| Avatar size `h-24 w-24` | → ~`h-14 w-14` (56px) in the rails. |

`showCoachHint` prop: currently declared but **never rendered** in
`arena-hud.tsx`. Out of scope — leave it alone, do not "fix" it in this change.

## 8. New CSS

All classes go to `apps/web/src/app/globals.css` — the **only** CSS file
(`CLAUDE.md`). Proposed family:

- `.arena-rail` — the strip (flex row, avatar + text column)
- `.arena-rail--rival` / `.arena-rail--you`
- `.arena-rail.is-active` — active-turn emphasis
- `.arena-rail-name` — display name
- `.arena-rail-meta` — line 2 (truncating)

## 9. Non-goals

- No player ELO. Not invented, not faked, not derived.
- No captured-material row. That is real new functionality — a separate spec.
- No clock-per-player. The single match timer in the header stays as is.
- No change to `ArenaBoard`, `ArenaActionBar`, or the end-state overlays.
- No change to `ArenaMatchupTransition`.

## 10. Test impact

- `components/arena/__tests__/` — HUD tests asserting `MatchupLabel` /
  color-label text will fail. Update to assert the rail structure.
- Assert **neither rail exposes `role="button"`** in any state (§5) — this is the
  regression guard for the unconfirmed-reset footgun.
- Assert the player rail renders no line 2 for a visitor, and that rail height is
  unchanged between visitor and connected (§6.2).
- Assert no rail is `is-active` in end-state.
- VR baselines for `/arena` playing + end-state will need re-capture.
- Reminder (`CLAUDE.md`): any "one modal at a time" assertion counts
  `[aria-modal="true"]`, never `role="dialog"`.

## 11. Resolved questions

1. **Active-rail emphasis** → opacity lift + soft background lift on the active
   rail, inactive rail dims. Escalate to a glow only if it fails a squint test on
   the forest background. *(decided 2026-07-13)*
2. **Chevron / tap affordance on the rival rail** → moot. Neither rail is
   interactive (§5), so there is no affordance to signal.
