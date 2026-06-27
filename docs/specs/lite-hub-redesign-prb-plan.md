# PR B — HubLiteScaffold implementation plan

> Builds the Lite presenter (the 21-Day Mind Challenge hero card layout from
> reference Image #1/#2). PR A (`useHubData()`) already landed. Spec:
> `lite-hub-redesign.md`. CTA colors per founder decision 2026-06-26:
> **Start Focus = dorado**, **Join Challenge = verde + glow** (reference images
> are layout guidance only — spec rev2 wins on color). Spec rev2 already matches.

## Decisions locked
- CTA: Start Focus = `dorado` token; Join Challenge = `verde` token + subtle
  glow (GPU-safe `transform`/`opacity` pseudo-element halo — NOT animated
  box-shadow/filter, per PR-B red-team P2-E / MiniPay jank history). Active pass
  → no Join CTA, no glow.
- Only new asset: `design/wallpapers/avatar-lite-hub.png` (1014×1138, transparent
  portrait — NOT framed) → optimize to `apps/web/public/art/` (png+webp+avif via
  `scripts/optimize-art-assets.sh`). Everything else reuses existing leaves / CSS.

### P1 resolutions folded in (red-team PR B)
- **P1-A (fold budget):** single-screen-first at 390×640; above-fold contract =
  Start Focus + challenge-card primary CTA. Mascot/oval ≤ ~34% viewport height;
  compact card (one dot row, 3 stat tiles, one CTA). Layout test asserts it.
- **P1-B (corner-icon gift):** add `HubDailyTile` `variant?: "tile" |
  "corner-icon"` (default `"tile"` → Full byte-identical). Lite passes
  `"corner-icon"` (glyph + badge, same `DailyTacticSheet` flow). Reuse an
  existing gift icon from `public/art/new-icons-chesscito/` — no new asset.
- **P1-C (i18n Start Focus label):** new `startFocusLabelByVariant` map →
  editorial.ts + `messages/{en,es}` keys + safe default; consume
  `contentLoopAction` for `variant`/`destination` only, never `ctaEN`.

## Staged TDD

### Stage 1 — ChallengeCard leaf (SDD → TDD → impl)
- Types: `ChallengeCardProps` (focusPassport, challenge, seasonPass,
  onJoinChallenge | null). No `any`.
- RTL tests (red first):
  - offer state: 21/+3 shields/$1.99 stat tiles + Join Challenge (verde+glow) +
    passport dot row (streak fills N of durationDays, flame anchors day 1).
  - active state: ACTIVE badge + `Day X/21` + shields count, **no** Join CTA.
  - loading (`focusPassport.isLoading`): empty dot shell, no filled flames.
- Embeds/reuses `FocusPassport` dot row where possible; fork only composition.

### Stage 1b — `HubDailyTile` corner-icon variant (P1-B)
- Add `variant?: "tile" | "corner-icon"` (default `"tile"`). RTL: default path
  byte-identical (Full untouched); `"corner-icon"` renders glyph + claimable
  badge only and opens the same `DailyTacticSheet` on tap. No logic fork.

### Stage 2 — HubLiteScaffold presenter
- Compose: HUD (Trophies chip, LanguageChip, Connect chip guest-only, daily gift
  top-right `HubDailyTile variant="corner-icon"`), mascot oval + CHESSCITO logo
  (avatar-lite-hub), ChallengeCard, Start Focus (dorado, label from
  `startFocusLabelByVariant` i18n map — **not** `ctaEN`, P1-C), Training Path
  horizontal row (`rewardTiles`, locked = no-op, else `/exercises?piece=`),
  dev-only +5 unlock button.
- New i18n keys: `startFocusLabelByVariant` in editorial.ts + `messages/{en,es}`
  + safe default (P1-C). Tests assert ES + EN render (parity), never raw `ctaEN`.
- RTL tests = the spec "Feature inventory" checklist as presence assertions
  (every item reachable). Plus Start Focus destination matrix (label per quota).
- **P1-A layout test:** at 390×640, Start Focus + challenge-card primary CTA are
  above the fold (no scroll); Training Path may sit at/just below it.

### Stage 3 — Switch + dead-branch removal
- `HubScaffoldClient`: `CHESSCITO_LITE_MODE ? <HubLiteScaffold {...liteVm}/> :
  <HubScaffold {...vm}/>`.
- Remove Lite-only branches from `HubScaffold` (focusPassport, nextStepCard,
  seasonPass CTA, the `!CHESSCITO_LITE_MODE` chip guards). Full path untouched.
- Run full suite — Full VR baseline unchanged, all hub tests green.

### Stage 4 — Asset + CSS + i18n + VR
- Optimize avatar asset (3 formats).
- CSS in `apps/web/src/styles/hub.css` (surface-scoped; globals only if shared).
- New copy keys: editorial.ts + messages/en.ts + messages/es.ts simultaneously
  (i18n parity). Anti-AI-prose: no em/en dashes.
- New Lite VR baseline (`pnpm test:e2e:visual`), refresh same PR.

## Guardrails honored
- Mobile-first 390px, touch ≥44px, `max-w-[var(--app-max-width)]`.
- No carousels, no new Lotties. Reuse canonical assets.
- Granular atomic commits per stage; run suite before each; report pass count.
- Rollback = revert the single switch line.
