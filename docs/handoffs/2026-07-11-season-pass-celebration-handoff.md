# Handoff — Season Pass celebration (2026-07-11)

**Branch:** `main` @ `9672302d` · **PRs:** #210, #211, #212 (all merged)
**Suite:** 4865 passing / 401 files (baseline was 4853) · **VR:** 51/51

---

## What shipped

### 1. The Season Pass had no post-purchase payoff (#210)

Buying the pass produced **no celebration at all** on the main path. `onSuccess` in
`legacy-hub-client.tsx` closed the sheet in the same tick the rail reached
`"success"`, so the popup simply vanished and the only evidence of the purchase
was a small chip on the `ChallengeCard`. The LEARN dock path (which passed no
`onSuccess`) showed a bare emoji + "Pass Activated!".

Both entry points now land on one celebration (`SeasonPassCelebration`):
confetti, the `21 days · +3 Shields` stat row, Chesito behind a **Start Focus**
CTA that routes to `/exercises`.

Load-bearing details:

- **The celebration outranks every status branch** in the sheet's ternary chain.
  The host refreshes the entitlement on success; without precedence, a refreshed
  status flips the sheet to "Pass Active" and swallows the celebration the buyer
  just earned.
- **Shields are read from the verified receipt, not hardcoded.** `verify-payment`
  answers `shieldsCredited: 0` when the payment settled but the Redis grant
  failed (`route.ts:290-293`). A hardcoded "+3 Shields" would promise what the
  wallet does not have. That path renders "Shields soon".
- **Start Focus reuses the hub's CTA** (same class `.hub-lite-start-focus`, same
  copy key `HUB_LITE_COPY.startFocus`, same destination). Buying from the LEARN
  dock already sits on `/exercises`, where a push is a no-op — there the button
  closes the sheet instead.
- The panel art bakes in the frame, crest and garden, so `VictoryPopupShell` took
  a `panelBackgroundImage` override rather than layering over `panel-bg1` (which
  would double the frame). **Default unchanged for every other popup.**
- Confetti was **extracted, not reinvented**: the burst was private to
  `mission-panel-candy.tsx` and now lives in `components/redesign/confetti-burst.tsx`,
  consumed by both surfaces.

### 2. Dev probe, kept alive on purpose (#211)

```
/dev/season-pass-celebration                  → shields credited (+3)
/dev/season-pass-celebration?variant=pending  → shields not yet granted
```

Gated on `VERCEL_ENV === "production"`, **not** `NODE_ENV` — preview builds also
run `NODE_ENV=production`, so the `NODE_ENV` guard the older probes use would
404 the page on preview, exactly where validation happens. Dead in prod either way.

**The probe caught a real bug on its first run:** with shields pending,
"Shields on the way" wrapped and dragged the day count onto two lines, breaking
the stat row. That state only occurs when the payment settles and the shield
grant does not — unreachable by hand, so no amount of manual testing would have
found it. Fixed by shortening the label and pinning the stats to `nowrap`.

### 3. Probe fonts (#212)

The `/dev` tree is its own root layout and never loaded Rowdies/Fredoka, so the
probe rendered the title in **system type** and misreported the typography it
exists to validate. The real modal was always correct (measured:
`--font-rowdies` empty in `/dev`, resolves to the loaded family under `[locale]`).

The subtle part: declaring `--font-rowdies` on a wrapper is **not enough**.
`--font-game-action` is declared on `:root` as `var(--font-rowdies), ...`, and
custom properties substitute **where they are declared, not where they are used**
— `:root` had already resolved it against nothing. The derived tokens are
re-declared on the probe wrapper.

---

## Open questions / known state

- **VR does not guard typography.** Every fixture baseline lives under `/dev` and
  was captured in system type. If Rowdies broke in production, all 51 baselines
  would still pass. **Founder decision 2026-07-11: leave it, do NOT regenerate
  baselines for this.** Loading the fonts in `dev/layout.tsx` would churn all 51.
  Reopen only on founder request.
- **The probe's font workaround is divergence debt.** It re-declares font tokens
  on its wrapper because `/dev` lacks them. If those tokens change in the real
  layout, the probe can drift. It is the one place where probe and real screen
  are not identical.
- **The pass still gates no content.** Audited: `seasonPass.active` is consumed
  only by `ChallengeCard` (day counter + chip) and the shields grant. No exercise
  or surface is locked behind it. The value is the challenge/habit and the
  shields — which makes this celebration the only real evidence of the purchase.
- **No share button** (explicitly out of scope by founder decision).
- The hub-level regression (that `onSuccess` no longer closes the sheet) has **no
  test** — `legacy-hub-client` has no test file and mounting it needs wagmi +
  dynamic-import mocks. The celebration's precedence is guarded at the sheet
  level instead.

---

## Next steps (unchanged from the 2026-07-10 backlog)

Backlog remains `docs/backlog/2026-07-10-backlog-index.md`. Still next:

1. **Investigate "Claim 3 Shields"** — the only pending item with unexplained
   behavior (investigation, not code).
2. **Custom-errors decoder** — GO with evidence, does not block stability.
3. **PLAY #8** — drop LUZ's redundant confirmation.

---

## Files touched

| Area | Path |
|---|---|
| Celebration | `components/payments/season-pass-celebration.tsx` (new) |
| Confetti | `components/redesign/confetti-burst.tsx` (new, extracted) |
| Sheet | `components/payments/season-pass-sheet.tsx` |
| Hub | `components/hub/legacy-hub-client.tsx`, `components/hub/challenge-card.tsx` |
| Shell | `components/arena/victory-popup-shell.tsx` |
| Probe | `app/dev/season-pass-celebration/{page,fixture}.tsx` (new) |
| Copy | `lib/content/editorial.ts`, `lib/content/messages/es.ts` |
| Styles | `app/globals.css` |
| Art | `public/art/celebration/bg-celebration.{png,webp,avif}` |
| Tests | `components/payments/__tests__/season-pass-sheet.test.tsx` (+5) |

The success branch had **zero test coverage** before this session — that is why
changing its shape entirely broke nothing.
