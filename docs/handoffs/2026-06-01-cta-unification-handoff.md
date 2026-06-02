# Handoff — CTA Token Unification Cluster

**Date:** 2026-06-01
**Branch:** main (all commits pushed)
**Session goal:** unify the primary action / secondary / treasure / popup-title vocabularies under a single CSS-token system so every popup, hub CTA, landing CTA, and rescue surface reads as one room.

---

## What shipped

### Token families minted

All live in `apps/web/src/app/globals.css` `:root`:

| Token family | Semantic | Reference surface |
|---|---|---|
| `--cta-primary-green-*` (grad/border/bevel/bevel-pressed/text-shadow) | practice / continue / play | `.primary-play-cta--green-css` (Arena PLAY) |
| `--cta-primary-blue-*` (mirror of green in blue) | compete | `.hub-scaffold-arena-cta` (Hub → Arena) |
| `--cta-secondary-cream-*` (grad/border/bevel/color/text-shadow) | secondary / "no compite" | `.fail-rescue-modal-secondary` ("Retry anyway") |
| `--cta-primary-gold-*` (grad/border/bevel/bevel-pressed/color/text-shadow) | win / unlock / premium / PRO | `.fail-rescue-reward-pill` (×3 STREAK) — kept as visual template reference |
| `--popup-title-color`, `--popup-title-text-shadow` | every centered popup headline | `.arena-result-title` ("You resigned") |

### Surfaces migrated

**Green (8 surfaces):** `.primary-play-cta--green-css`, `.primary-play-cta--arena-entry`, `.arena-result-primary-cta--inset` (popup PLAY), `.arena-result-primary-cta--amber` (twin of inset), `.principal-button` (`<PrincipalButton>` — 8 consumers), `.hub-scaffold-practice-cta`, `.landing-green-cta` (+ `--medium` / `--large`), `.fail-rescue-modal-primary`, `.arena-scaffold-soft-gate-primary` ("PIECES"), `.tj-empty-state-cta` ("Start training").

**Blue (1 surface):** `.hub-scaffold-arena-cta` (Hub → Arena).

**Cream (4 surfaces):** `.fail-rescue-modal-secondary` ("Retry anyway"), `.arena-scaffold-soft-gate-secondary` ("ARENA"), `.arena-result-secondary-action` (Play again / Share / PLAY in error popup — icons removed in victory-celebration / victory-claim-success / victory-claim-error), `.candy-tray.connect-prompt-toast-panel` (Save your progress on-chain — fixes the fantasmal-over-forest UX issue).

**Gold (3 surfaces):** `.coach-pro-card-cta` ("COACH" / "JOURNAL"), `.arena-result-primary-cta--treasure` ("Save Victory" — sprite dropped, gradient-driven), `.profile-claim-cta` ("Claim" — pivot from rojo crimson to gold).

**Popup titles (7 consumers):** `.arena-result-title`, `.arena-result-coach-headline`, `.fail-rescue-modal-heading`, `.promotion-overlay-title`, `.candy-card-title`, plus the two inline `h2` titles in `mission-detail-sheet.tsx` ("MISSION") and `soft-gate-sheet.tsx` ("WARM UP").

### Casing rule shipped

Documented at `docs/design-patterns/cta-casing-rule.md`:

- 1-word verb / destination → ALL CAPS (`PLAY`, `RETRY`, `CONTINUE`, `ARENA`, `PIECES`, `CONNECT`)
- 2+ words action → Sentence case (`Try again`, `Play again`, `Share trophy`)
- Game proper nouns inside multi-word → capitalized (`Save Victory`, `Ask Coach`, `Back to Hub`)
- Modal-dismissive (`Cancel` / `Dismiss`) explicitly LEFT in Title (out of scope; open for a future pass).

editorial.ts standardization pass aligned `tryAgain`, `retry`, `continue`, `connectWallet.compactLabel` across all namespaces. Test in `contextual-action-slot.test.tsx` updated.

### Component changes

- **`<SoftGateSheet>` rewritten** from Radix bottom-sheet to MISSION-pattern centered modal (`apps/web/src/components/arena/soft-gate-sheet.tsx`). New editorial key `ARENA_COPY.softGateModalTitle = "Warm up"` (ES: "Calienta"). Forest-frame panel-mission-icon background + red close X + Coach wolf avatar anchor + adorno divider + the 2 CTAs stacked.
- **`<PrincipalButton>` simplified**: probe `useEffect` / `useState` / `useRef` / `setRefs` machinery dropped (it was scaffolding for the dead sprite placeholder check). Now forwards ref directly.

### Dead code dropped

- `apps/web/src/components/redesign/candy-button.tsx` (`<CandyButton>` — never imported)
- `apps/web/src/components/hub/secondary-cta.tsx` (`<SecondaryCta>` — `HubScaffold` uses `.hub-scaffold-arena-cta` directly)
- `apps/web/src/components/hub/__tests__/secondary-cta.test.tsx`
- `apps/web/public/art/scene-rooted/principalbutton.{avif,webp,png}` (sprite + `--principal-button-bg` var + `.principal-button.is-placeholder` rule)
- CSS rules: `.candy-button*` (7), `.hub-secondary-cta*` (3), `.coach-review-signal-cta*` (2), `.arena-scaffold-soft-gate*` legacy banner (4 — primary / secondary preserved for the new modal)

### Dev tooling shipped

- **`apps/web/src/app/dev/button-gallery/page.tsx`** — single-page mobile-first gallery rendering every CTA family with real production text, class names, role, and verdict tag (UNIFICADO VERDE / AZUL / CREMA / DORADO / KEEP DISTINCT / etc.). 18 cards across sections. Anchored at `/dev/button-gallery`.
- **`docs/audits/2026-06-01-button-families-inventory.md`** — full audit of every `*-cta` / `*-button` / `*-pill` class with migration verdict.
- **`docs/design-patterns/cta-casing-rule.md`** — canonical casing rule.

### Test trajectory

- Unit: 2322 → 2317 (lost the 2 `<SecondaryCta>` tests + 3 misc adjustments from the editorial standardization).
- VR: 39/39 across all rounds. Baselines refreshed for `vr9-arena-end-state-*` (2 rounds), `vr12-rescue-modal-a/b/c/d` (2 rounds), `about-page`, `landing-page`. All drifts verified visually before refresh.

---

## What's NOT done

### Still rogue (deferred — not yet a token-family member)

- `.account-manage-pro-cta` (Manage PRO button in `<AccountSheet>`) — purple/gold PRO payment vocabulary. Likely keep distinct.
- `.coach-preview-card-cta` (tertiary inset card cta) — likely keep distinct.
- `.gem-button` (currency button with painted asset) — keep distinct.
- `.tj-empty-state-title`, `.candy-card-title` non-popup consumers — sheet headers, not popups. Untouched.
- `.fantasy-title` (legacy frosted display class — still consumed by surfaces outside the popup family).
- Sheet headers via `<MissionHeaderCandy>` / `<ContextualHeader>` — different chrome vocabulary; not audited.
- ShareModal, confirm-cancel modals, account / pro / badge sheet titles — not inventoried this round.

### Casing pass — deliberately deferred

- `cancel: "Cancel"` and `dismiss: "Dismiss"` — left in Title Case (modal-utility verbs that read more politely Title across iOS/Material patterns). Open for a future pass.

### Dev gallery cleanup

`/dev/button-gallery` is still mounted. Per the README at the bottom of the page: delete the route when the migration sprint feels closed. Several surfaces still to inventory before that.

### Animations / interactions

No animation changes this cluster. Press-state physics across the green/blue/gold tokens follow the same pattern (`translateY(2px)` + bevel-pressed). Cream uses `scale(0.98)` (no ledge). Untouched.

---

## Open questions / next-session prompts

The user closed this session with "continuamos la siguiente sesion con algo importante" — the topic is **not** pre-committed in this handoff. Surface the question at the top of the next session:

1. **What's the "algo importante"?** Could be content/monetization track (per memory `next-session-content-monetization` set 2026-05-31), could be a different polish pass, could be a brand-new feature. **Ask before assuming.**
2. **Delete `/dev/button-gallery`?** Only when the user confirms the rogues backlog is closed.
3. **Apply `Cancel` / `Dismiss` to the casing rule?** Out of scope this round; pending Wolfcito decision.
4. **Audit sheet titles (MissionHeaderCandy / ContextualHeader / account / pro / badge / shop sheet)?** Untouched this round.

---

## Files of note (for next session orientation)

- `apps/web/src/app/globals.css` — token definitions live at `:root` (~line 349 forward). All 5 families + popup-title pair.
- `apps/web/src/app/dev/button-gallery/page.tsx` — visual reference of every unified surface.
- `docs/audits/2026-06-01-button-families-inventory.md` — exhaustive class inventory.
- `docs/design-patterns/cta-casing-rule.md` — casing canonical.
- `apps/web/src/components/arena/soft-gate-sheet.tsx` — MISSION-pattern modal reference (use as template when adding new centered popups).
- `apps/web/src/components/exercises/mission-detail-sheet.tsx` — the original MISSION modal template.

---

## Commit log (cluster)

20 commits between `3123cf2d` (prior `style(cta): consolidate green primary-action buttons under CSS variant`) and `bf48a4da` (`style(popup): mint --popup-title-color / --popup-title-text-shadow tokens`). Full range:

```
bf48a4da style(popup): mint --popup-title-color / --popup-title-text-shadow tokens
4df14fbe style(popup): align fail-rescue + promotion-overlay titles to canonical brown
a4cb43a0 style(arena): align victory-claim-error title to canonical brown
22760b2f fix(arena): drop refresh icon from victory-claim-error secondary PLAY
34d4b37a chore(vr): refresh vr9-arena-end-state-win baselines
6b1f40a8 chore(dev): gallery v3 — gold verdict + ronda 3 marked unified
efeca9d4 feat(cta): mint --cta-primary-gold-* + close CHECKMATE/connect/treasure rogues
dd337356 chore(vr): refresh vr12-rescue-modal baselines after cream tokenization
85aa6c94 chore(dev): button-gallery v2 — semantic rule + cream verdicts
04f0ef4c feat(cta): mint --cta-secondary-cream-* + migrate soft-gate / fail-rescue-secondary
10f62c88 feat(arena): rewrite soft-gate as MISSION-pattern modal (centered)
25850f01 docs(design-patterns): canonical CTA casing rule
07f948d2 refactor(copy): standardize CTA casing per canonical rule
d0b426ce refactor(cta): align soft-gate dimensions to fail-rescue twin family
25ffe0d8 chore(vr): refresh vr12-rescue-modal baselines after green migration
69a05614 feat(cta): migrate .fail-rescue-modal-primary to green token family
23310435 chore(vr): refresh baselines after CTA unification
6137a172 docs(audit): button families inventory + CTA migration map
ec01453b chore(dev): add /dev/button-gallery for CTA family review
190e5abb feat(cta): unify primary CTAs under green/blue token families
```
