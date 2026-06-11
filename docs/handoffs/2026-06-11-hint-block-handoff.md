# Handoff — HINT block (2026-06-11)

> Continuation of the exercises economy/UX block. Re-smoke of the
> preview came back green on the automated portion; the HINT polish
> trio shipped on `main` (LOCAL — not pushed).

## Re-smoke results (preview.chesscito.com, build `4f0b0b1`)

- ✅ **Rotation OFF confirmed** (the #1 check): env flag empty in
  preview BEFORE the build, and the Rook drawer shows the full
  10-exercise pool in linear order (rotation ON would show a rotated
  subset of 8).
- ✅ Guest flow sane: exercise 1 playable, 3 stars, "Connect to save"
  overlay correct.
- ⚠️ Minor: 2 console errors from `/684266321c090098/script.js` 404 —
  external script NOT in the repo (likely Vercel preview
  toolbar/analytics). Pre-existing, not from the D block.
- ⏳ **Wallet-gated checks still need the founder's MiniPay pass**
  (covered by unit tests meanwhile): SAVE+CLAIM both visible,
  4th save w/o Peones → Get Peones + Not now, free-saves pill.

## Done this block (commits on `main`, LOCAL — not pushed)

| Commit | What |
|---|---|
| `feat(art)` | hint-icon triplet (png/webp/avif, 256px) in `new-icons-chesscito/` |
| `d13b5ab0` | **D3-HINT**: chip renders hint-icon sprite + label across all connected states; guest stays text-only |
| `f4a29208` | **D4**: hint reveal = centered golden pulsing CIRCLE overlay (was inset square glow); emoji sparkle removed |
| `a845ebd0` | **Hint race fix**: 429 `rate_limited` → own transient state "One sec, try again" / "Un momento, intenta de nuevo"; insufficient copy now cost-explicit "Need 1 Peón" / "Te falta 1 Peón" (D1 alignment) |

Suite **3497/3497**, tsc + eslint clean. VR not run: hint visuals only
render during a paid reveal, no baseline captures them.

## Hint race — root cause + open follow-up

Symptom (founder): confusing message spending the last Peón on hint;
worked after a delay. Analysis: `/api/peones/spend` shares the
`rl:read:ip` bucket (60/min/IP) with balance + earn and returns 429
`rate_limited`, which the chip collapsed into generic
"Hint unavailable" — a transient condition presented as broken.
Fixed client-side (distinct state + copy). **Open follow-up**: split
the spend endpoint onto a dedicated bucket (`rl:spend:ip`, precedent
`scoreSaveIpLimiter`) — deferred pending log evidence that the shared
bucket actually starves spends in practice.

## NEXT SESSION — start here

1. User pushes `main` → fresh preview.
2. Founder MiniPay pass: the 3 wallet-gated checks above + the new
   HINT trio (icon chip, pulsing circle, retry copy when rate-limited).
3. **Deep Hint (3 Peones)** spec — next economy-v2 sink (desirable,
   visible, understandable; do NOT tighten earn). Cite 2-3 proven
   patterns (e.g. Candy Crush boosters, Duolingo gem hints) before
   custom design, per ux-pattern-references.
4. Backlog: rotation-aware `advanceExercise` spec (flag stays OFF),
   spend bucket split (see above).

---

## Addendum — founder feedback cluster (same day, 2nd pass)

7 items from the founder's MiniPay pass. 6 shipped on `main` (LOCAL):

| Commit | What |
|---|---|
| `feat` ActionPin status marker | green check / pulsing red dot primitive (`.action-pin-status` / `.action-pin-notif`, mirrors kingdom reward rail) |
| `feat` HINT → action row pin | floating chip removed; row = DAILY · HINT · SAVE · CLAIM · SPECIAL; cost in aria-label; reveal shows check |
| `feat` SavedChip → pin+check | no star pill / no "BEAT YOUR SCORE" caption; aria-label keeps guidance |
| `feat` check/dot across row | DAILY (dot until played → check), SAVE/CLAIM (dot while takeable), SPECIAL TRAINING (dot unlocked-unbeaten → check via getMiniArenaBest; `<PinStatusMarker>` shared) |
| `fix` error overlay composition | warning triangle removed; text + avatar share one in-flow row |
| `style` GetPeonesSheet | pawn+title row, price below, text+avatar row on insufficient |
| `style` BadgeEarnedPrompt + mini-arena ceremony | both migrated CandyGlassShell → VictoryPopupShell (panel-bg1) + PrincipalButton CTAs |

Suite 3502/3502 after each slice; tsc + eslint clean.

### OPEN — item 7: SAVE/CLAIM pins vanish after SAVE (transient)

Repro (founder): piece-complete → SAVE (0 Peones) → pins gone →
navigate /hub → back to /exercises → pins return. Investigated:
`getRewardActions` only excludes phase=failure; BadgeEarnedPrompt SAVE
clears autoReset + closes prompt; insufficient path mounts error
overlay only. No read branch conclusively hides BOTH pins. Next: re-smoke
on the new build (slices changed this surface), watch
`score_save_{insufficient,duplicate}` telemetry to identify the branch,
then trace `contextAction`/`isSavedAtParity` state at that moment.

---

## Addendum 2 — action-row polish + v1 icon set (same day, 3rd pass)

All pushed to `origin/main`. Sally (UX) drove composition decisions.

- Action row layout: 3-col grid `1fr auto 1fr` — edges = persistent
  entry points (Daily left, Training right), center = contextual
  group (Hint + SAVE/CLAIM) distributed without holes.
- Signal hierarchy: red dot ONLY for new value (Daily unopened, CLAIM
  unclaimed, Training never-beaten). SAVE/HINT never dotted.
- Retire-when-done: completed Daily leaves the row; saved-at-parity
  renders nothing (SavedChip retired from slot); Training clears its
  marker once beaten.
- v1 universal icon set wired (gift+1 / lightbulb / open chest /
  badge-claim showcase / crossed swords), 44px uniform sprite height
  (sizing on the img — inline <picture> ignores height utilities),
  64px touch targets. CLAIM uses `badge-claim-icon` triplet.
- Alert dot = pure CSS (16px glossy sphere), PNG dropped in action
  row scope (kingdom rail keeps it).
- Design principle recorded: "the screen communicates the world, the
  icon communicates the action" — no chess decoration inside 56px
  action icons.

Suite 3502/3502 throughout. ~10 commits `a43852bc..2eb57887`.

### Dock iconography — analyzed, NOT executed (founder will signal)

Sally verdict: Badges/Arena/Trophies keep; Shop → money pouch,
Leaders → stepped 2-1-3 podium. Specs: 256px master, 24px grayscale
silhouette test, warm palette against the dark stone. Waiting on
`shop-icon-v1.png` / `leaderboard-icon-v1.png` in `design/iconsx/`.
