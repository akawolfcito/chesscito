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
