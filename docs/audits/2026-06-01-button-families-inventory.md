# Button families inventory — 2026-06-01

Audit triggered after the green primary CTA unification (`--cta-primary-green-grad`
+ `--cta-primary-green-border` + `--cta-primary-green-bevel` + `--text-shadow`).
Goal: map every existing CTA family so we can decide which ones should adopt the
new green vocabulary (or a sibling color variant) and which should stay distinct.

Surface counts approximate — counted by selector occurrences in `globals.css`
and consuming components.

---

## 1. PRIMARY ACTION — green candy (UNIFIED ✅)

Token: `--cta-primary-green-grad` + bevel family.

| Class | Surface | Role |
|---|---|---|
| `.primary-play-cta--green-css` + `--arena-entry` | `/arena` entry PLAY | dominant CTA |
| `.arena-result-primary-cta--inset` | popup PLAY (resigned/victory/error) | dominant CTA inside popup |
| `.principal-button` (`<PrincipalButton>`) | trophies, PRO sheet, badge sheet, victory page, mission briefing, ask-coach, action-pin | shared connect / continue / claim |

**Status:** All twins. Bevel + border + gradient + text-shadow from CSS vars.

---

## 2. PRIMARY ACTION — amber candy (in-game popup PLAY/CTA)

Token: hard-coded amber gradients.

| Class | Surface | Notes |
|---|---|---|
| `.arena-result-primary-cta` (base) | popup base — `clamp(20px,4.8dvw,25px)` font, pill-shaped | parent of `--amber`, `--treasure`, `--inset` |
| `.arena-result-primary-cta--amber` | victory popup primary | amber gradient, gold rim |
| `.arena-result-primary-cta--treasure` | treasure / save CTAs | amber + treasure icon strip |
| `.victory-popup-primary-cta-price` | victory popup price ribbon | amber pill with price overlay |
| `.cta-principal` (sprite) | Save Victory / Mint button | sprite asset (`cta-principal*.{avif,webp,png}`) |
| `.profile-claim-cta` | profile claim | amber pill |
| `.premium-slot-cta` | premium slot tile | amber CTA |

**Candidate for green migration?** Only where the role is "primary action that
shares space with green primary" (rare). Amber is the canonical "rare item /
reward / mint" color, distinct semantic from green "play". Probably stay amber.

---

## 3. LANDING PAGE green CTA (separate green tone)

| Class | Surface | Notes |
|---|---|---|
| `.landing-green-cta` + `--medium` + `--large` | landing marketing page | uses `--landing-cta-green` vars (different green) |

**Candidate for green migration?** Possibly — could replace with
`--cta-primary-green-grad` so landing → app CTAs feel like one product.
Trade-off: landing currently uses a flatter, softer green. Today's choice is
brighter / more game-y. Worth a quick visual comparison.

---

## 4. SHOP BUY PILLS (candy-tray-pill family)

Token: own family — `.candy-tray-pill` base + color modifiers.

| Class | Color | Role |
|---|---|---|
| `.shop-item-tile-buy-pill` (base) | — | purchase pill base |
| `.shop-item-tile-buy-pill--green` | green | confirm USD purchase |
| `.shop-item-tile-buy-pill--yellow` | yellow | confirm CELO purchase |
| `.shop-item-tile-buy-pill--purple` | purple | Coach action (inside popup) |

**Candidate for green migration?** **No.** Lives in a 3-color sibling family
where green is the USD signal, yellow is CELO, purple is Coach. Replacing green
with the candy-CTA green breaks symmetry with yellow + purple peers. Keep.

---

## 5. HUD STATUS PILLS (informational — not actions)

| Class | Surface |
|---|---|
| `.candy-tray-pill` (base) | hub HUD pills |
| `.hub-hud-pill` + `--anchored-left` + `--pro` | hub HUD trophy / connect / PRO badge |
| `.hub-v2-status-pill` + `-coach` | hub v2 status |
| `.candy-stat-pill` | stat displays |
| `.journey-status-pill` | journey progress |
| `.fail-rescue-modal-stat-pill` + `-reward-pill` | fail rescue modal |
| `.fail-rescue-reward-pill--streak` | streak reward |
| `.account-status-pill` | account status |
| `.leaderboard-rank-pill` | leaderboard rank |

**Candidate for green migration?** **No.** These are informational chips, not
actions. They don't need the bevel + border + drop ledge of an action button.

---

## 6. ARENA action chips & selectors

| Class | Surface | Role |
|---|---|---|
| `.arena-action-bar` + `.arena-action-button` + label/icon | arena game HUD | resign / undo / hint actions |
| `.arena-action-pill` + label/icon/countdown | arena timer + difficulty chip | informational + tappable |
| `.arena-difficulty-pill-label` | difficulty selector | inside difficulty picker |
| `.arena-scaffold-color-pill` | color picker (white/black) | selection chip |
| `.arena-scaffold-difficulty-pill` | difficulty in scaffold | selection chip |
| `.arena-scaffold-soft-gate-actions` | gating actions | container |
| `.arena-action-banner` | arena banner | informational |

**Candidate for green migration?** **No.** Selectors / informational chips, not
dominant CTAs. They use the candy-tray family (HUD pills).

---

## 7. COACH CTAs (purple family)

| Class | Surface |
|---|---|
| `.coach-pro-card-cta` | coach PRO card |
| `.coach-review-signal-cta` | coach review signal |
| `.coach-preview-card-cta` | coach preview card |
| `.coach-analysis-cta` (Ask Coach) | popup / coach viewer |

**Candidate for green migration?** **No.** Coach owns the purple signature.
Switching to green collapses the Coach identity (image 4 popup shows the purple
Ask Coach pill — that's the canonical placement).

---

## 8. HUB SCAFFOLD CTAs

| Class | Surface | Role |
|---|---|---|
| `.hub-scaffold-practice-cta` | hub | practice entry |
| `.hub-scaffold-arena-cta` | hub | arena entry — should be GREEN |
| `.hub-secondary-cta` | hub | secondary actions |

**Candidate for green migration?** `.hub-scaffold-arena-cta` is a strong
candidate to adopt the green family — it's the same "enter arena" intent as the
arena entry PLAY itself. `.hub-scaffold-practice-cta` could match if we want
"play action" = green across hub. **Recommendation:** check first.

---

## 9. MODAL / RESCUE primary buttons

| Class | Surface | Role |
|---|---|---|
| `.fail-rescue-modal-cta-stack` (container) | fail rescue modal | actions row |
| `.fail-rescue-modal-primary` | fail rescue modal | primary CTA — was inspiration for `--green-css` |
| `.candy-button` + `-play` + `-undo` + `-ghost` | exercise board candy buttons | PLAY = green-ish |
| `.candy-nav-button` + `.candy-close-button` + `.candy-close-asset-button` | sheet/dock chrome | navigation, not action |

**Candidate for green migration?**
- `.fail-rescue-modal-primary` already inspired the green CTA — likely already
  matches or close. Audit visually.
- `.candy-button-play` (exercise board PLAY) — STRONG candidate for unification.
- `.candy-button-undo` / `-ghost` — secondary, keep distinct.
- Navigation buttons → no.

---

## 10. ACCOUNT / PRO / BADGE single-action CTAs

| Class | Surface | Role |
|---|---|---|
| `.account-manage-pro-cta` + icon | account sheet | manage PRO action |
| `.profile-claim-cta` | profile claim | claim reward (amber) |
| `.profile-name-dialog-actions` (container) | profile name dialog | actions row |
| `.badge-card-action` + `-claim-btn` | badge sheet | claim badge |
| `.tj-empty-state-cta` | trophy journey empty state | "earn first" CTA |
| `.gem-button` + icon + value | gem currency button | currency / shop link |

**Candidate for green migration?**
- `.badge-card-claim-btn` + `.tj-empty-state-cta` → could adopt green if we
  want "claim/start" to read as green primary across surfaces. Visual check
  needed.
- `.account-manage-pro-cta` → likely PRO-themed (gold/violet). Keep distinct.
- `.profile-claim-cta` → currently amber. Could stay amber (reward).
- `.gem-button` → currency, distinct.

---

## RECOMMENDED next-pass migrations (highest signal)

If we want to extend the green vocabulary, the **highest-value** candidates are:

1. **`.candy-button-play`** — exercise board PLAY button. Currently the "press
   play to start the rook lesson" CTA. Should read as the SAME green family as
   `/arena` PLAY so users learn one color = primary action.
2. **`.hub-scaffold-arena-cta`** — hub entry to arena. Same intent as `/arena`
   entry PLAY. Make it a twin.
3. **`.hub-scaffold-practice-cta`** — same logic but for practice. Visual
   check first — may want a sibling variant (lighter green) to differentiate
   practice vs competitive.
4. **`.landing-green-cta`** — adopt `--cta-primary-green-grad` so landing → app
   transition feels seamless.
5. **`.fail-rescue-modal-primary`** — the original inspiration. Confirm it
   matches; if not, migrate.

## Sibling color variants we could mint

If you want a "primary action family" with multiple color personalities
(green/amber/violet/red), we already have most of the pieces — just need to
mirror the green token structure for each:

- `--cta-primary-amber-*` — already exists informally in arena-result CTAs.
- `--cta-primary-violet-*` — coach actions.
- `--cta-primary-red-*` — danger / resign.

This would let any surface pick `--cta-primary-{color}-*` and get a coherent
candy-bevel CTA in that hue.

---

## Surfaces explicitly OUT OF SCOPE for green migration

These should stay distinct to preserve semantic meaning:

- Shop buy pills (`--green` / `--yellow` / `--purple`) — 3-color SKU family.
- Coach CTAs — purple is Coach's identity.
- HUD informational pills — not actions.
- Arena action chips (resign / undo / hint / countdown) — utility, not primary.
- Dock / sheet chrome (close, nav) — chrome, not action.
