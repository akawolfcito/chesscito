# Spec — Arena rival personas + clearer confirm modals + JOURNAL play fix (2026-06-15)

Status: DRAFT — awaiting founder approval before implementation.
Pattern references (per ux-pattern-references rule): Chess.com named bots
(persona + rating humanize the opponent), Clash Royale Trainer, Duolingo
characters. Named rivals beat a cold "AI" label for engagement + clarity.

## Item A — JOURNAL "PLAY" button is broken (bug, small)

- Bug: `apps/web/src/app/[locale]/coach/history/page.tsx:98` renders
  `t("playCta")` from the `COACH_COPY` namespace, but `COACH_COPY` has no
  `playCta` key → the raw key string ("COACH_COPY.playCta", read as
  "COACH_COMPY…") shows on the button.
- Fix:
  1. Add `playCta: "PLAY"` to `COACH_COPY` in `editorial.ts` (EN) and the
     mirror in `messages/es.ts` (`"JUGAR"`).
  2. Center the button on X: it currently uses `className="w-full"` (full
     width). Switch to a centered, label-width button (`self-center` / drop
     `w-full`) so PLAY sits centered like the other popup CTAs.

## Item B — BACK/quit confirmation → modal (clarity)

- Today: `ArenaBackChip` (`arena-hud.tsx:40-118`) shows an INLINE red
  "QUIT?" with a 3s countdown two-tap. Not clear enough.
- Change: replace with a `VictoryPopupShell` modal (forest panel + red X),
  same vocabulary as every other popup.
  - Title: "Leave the match?"  Body: "Your progress in this match will be
    lost." Two CTAs: primary danger "Leave" + secondary "Keep playing"
    (red X also dismisses = keep playing).
  - Move open-state to `arena/page.tsx`; BACK tap opens modal instead of
    arming the inline countdown. Remove the countdown timer + inline UI.
- New copy keys (ARENA_COPY): `quitModalTitle`, `quitModalBody`,
  `quitModalConfirm`, `quitModalCancel`. Retire `confirmQuitLabel`.

## Item C — RESIGN confirmation → modal (clarity)

- Today: `ArenaActionBar` (`arena-action-bar.tsx:58-126`) toggles the label
  to "Confirm?" for 3s (no scrim, easy to miss).
- Change: same `VictoryPopupShell` modal pattern.
  - Title: "Resign this match?" Body: "This counts as a loss." CTAs:
    primary danger "Resign" + secondary "Keep playing".
  - Open-state in `arena/page.tsx`; RESIGN opens modal → confirm calls
    `game.resign()`. Remove inline label toggle + timer.
- New copy keys (ARENA_COPY): `resignModalTitle`, `resignModalBody`,
  `resignModalConfirm`, `resignModalCancel`. Retire `resignConfirm` /
  `confirmResignLabel` inline copy.

Shared: a single small `ArenaConfirmModal` presentational component
(title, body, danger-confirm, cancel) wrapping `VictoryPopupShell`, reused
by B and C.

## Item D — Rival personas (selector + gameplay HUD identity)

Humanize the opponent. Keep it a *reference*, not a literal guide.

### D1 — Rival config (new)
`apps/web/src/lib/game/rivals.ts` (or extend `DIFFICULTY_CARD` in
`arena-select-scaffold.tsx`):
```ts
type Rival = {
  difficulty: ArenaDifficulty
  name: string        // Sally's pick, NO "AI"
  tagline: string     // existing difficultyDesc, de-AI'd
  elo: number         // representative single ELO (in-range), HUD chip
  eloRange: string    // "0 - 800 ELO" for the selector
  piece: 'pawn'|'knight'|'bishop'  // KEEP for now; avatar later
}
```

### Personas (founder-approved 2026-06-15)
| Diff | Name | Tagline | ELO range | Piece |
|------|------|---------|-----------|-------|
| Easy | **Pipo** | Friendly rival, learns with you | 0–800 | pawn |
| Medium | **Mara** | Calm rival, finds solid moves | 801–1500 | knight |
| Hard | **Kairo** | Sharp rival, plays to win | 1501–2200 | bishop |

No "AI" anywhere. Names identical in EN/ES (proper nouns).

### Resolved decisions (founder 2026-06-15)
- CTA tone (B/C modals): danger-red primary ("Leave"/"Resign") + neutral
  secondary ("Keep playing"). Red X = keep playing.
- Gameplay ELO: RANDOM within the rival's range, generated once at game
  start (stable for the match), shown in the HUD chip. Uses `Math.random`
  in app code (allowed; only forbidden in workflow scripts).
- Scope: all 4 items this session.

### D2 — Selector redesign (`arena-select-scaffold.tsx`)
- Card hierarchy (matches image #5): **Name primary** (big) → tagline →
  trophy + ELO range. Difficulty badge (EASY/MEDIUM/HARD) becomes a small
  SECONDARY pill, not the headline.
- Keep the piece image as the avatar slot (left), keep the per-difficulty
  GREEN/YELLOW/RED colors (do NOT change), keep the selected check.
- Add the "⚔️ Choose your rival" header line (image #7) above the cards.
- Copy: rename `difficulty.*` usage so the NAME leads; keep
  `difficultyDesc.*` as taglines (drop the word "AI").

### D3 — Gameplay HUD identity (`arena-hud.tsx` + `page.tsx`)
- Match image #8: above the board, "You / {playerColorName}" on the left,
  "{Rival.name} / {oppColorName}" on the right.
- The `vsBelowSlot` pill becomes the rival chip: "{Rival.name} ·
  {Difficulty} · {Rival.elo} ELO" (tap still opens change-difficulty).
- Thread `Rival` from selection → `useChessGame` state (derive from
  `difficulty`, so no new persisted field strictly needed) → HUD.
- Color names: White/Black labels from copy.

## Order / commits (atomic)
1. A — JOURNAL play fix (tiny, independent).
2. Shared `ArenaConfirmModal` + B (quit) + C (resign).
3. D1 rival config + D2 selector redesign.
4. D3 gameplay HUD identity.
Each: unit tests first (TDD), VR refresh where surfaces drift, granular commit.

## Open questions for founder
1. Sally's names (Pip / Mara / Kovor) — OK or adjust?
2. Quit/resign CTA tone: danger-red primary "Leave"/"Resign" + neutral
   "Keep playing" — OK?
3. Gameplay ELO: show a fixed representative number per rival (720/1150/
   1850) — OK? (image #8 shows a single ELO, not the range.)
4. Scope: all 4 items this session, or split D (the big one) to its own?
