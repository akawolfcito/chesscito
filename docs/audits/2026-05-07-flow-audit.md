# Flow Audit — 2026-05-07

> Source of truth for "what should happen" vs. "what actually happens". Built from the manual smoke run on 2026-05-06/07 (PRO subscriber session). Updated as fixes ship.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Aligned: behavior matches expected |
| ⚠️ | Regression: known divergence — has fix or planned fix |
| 🚧 | Unimplemented or partially implemented; needs design or scope |
| 💡 | Polish: works but UX is suboptimal |

---

## 1 · Hub Entry (`/hub`)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Trophy chip | Tap → `/trophies` (My Victories) | Same | ✅ |
| Shield ×N chip | Tap → opens shop sheet (where you bought them) | Same — Arcane Store sheet | ✅ (intentional) |
| 26-day PRO chip (top) | Tap → opens `<ProSheet>` with active state | Sheet opens; CTA inside doesn't navigate | ⚠️ → see B2 |
| Pass Training card / details panel | "Play in Arena" CTA navigates to `/arena` | Stays stuck after click | ⚠️ B2 |
| Queen Mastery button | Routes to a queen-specific badges/path detail | Routes to generic `/badges` | 🚧 B7 |
| King Mastery button | Routes to king-specific detail | Routes to generic `/badges` | 🚧 B7 |
| Pawn Mastery (locked, transparent) | Tap shows lock state or upsell | Routes to `/badges` | 🚧 B7 |
| Main "Play" button | Routes to unified `/arena` flow | Routes to legacy `/play-hub` layout | ⚠️ B5 |
| Main "Play" button visual | Uses `design/new-assets-chesscito/principalbutton.png` | Uses generic styled button | 💡 B6 |

## 2 · Pass Training (PRO upsell modal)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Open via 26-day chip | Bottom sheet with active perks + days remaining + "Play in Arena" CTA | Sheet opens correctly | ✅ |
| "Play in Arena" CTA | `router.push("/arena")` + close sheet | Click does nothing visible — sheet stays open, no nav | ⚠️ B2 (root cause unconfirmed) |
| Perks list ("Active perks") | Shows AI Coach + Personalized coaching + contribution | Same | ✅ |
| Roadmap list ("Coming later") | Shows 3 roadmap items with SOON chips | Same | ✅ |
| "Got it" CTA when sheet opened from `/arena` | Closes sheet only (no nav) | Same | ✅ |
| Close button (X) | Returns to current screen | Returns correctly | ✅ |

## 3 · Free Play / Arena (`/arena`)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Difficulty Selector (first visit) | Shows easy/medium/hard + color picker | Same | ✅ |
| Auto-launch (returning user) | Skips selector, uses last difficulty from localStorage | Same | ✅ |
| Game in progress | Board renders, AI moves, HUD shows time | Same | ✅ |
| Resign | Ends game with `resigned` status | Same | ✅ |
| Win (checkmate AI) | `<ArenaEndState>` with Save Victory + Play Again + Share + Ask Coach | Same | ✅ |
| Loss / draw | `<ArenaEndState>` without Save Victory | Same | ✅ |

## 4 · Victory Claim (`/arena` win → mint NFT)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Save Victory CTA | Prompt wallet for sign + approve + mint | Same | ✅ |
| User cancels wallet prompt | Friendly "saved for later" message in amber, trophy stays full chroma | Was: rose+accusatory "You declined the wallet prompt" | ⚠️ Fixed in `cd9eb1a` (2026-05-07) |
| Mint success | "Victory Saved" + Token ID + share + Ask Coach | Same | ✅ |
| Mint network/timeout error | Rose error overlay + retry CTA | Same | ✅ |
| Disconnected wallet during error | "Wallet disconnected — reconnect to try again" copy | Same | ✅ |

## 5 · Coach (free user)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| First-ever click on "Ask the Coach" | `<CoachWelcome>` modal with Claim Free CTA | Same | ✅ |
| After claiming free analysis (3 credits seeded) | Coach run on game → `<CoachPanel>` with summary + mistakes + lessons | Same | ✅ |
| Out of credits | `<CoachPaywall>` with 5 / 20 packs + Quick Review escape | Same | ✅ |
| Close paywall | Returns to `<ArenaEndState>` with Ask Coach re-available | ✅ Re-entry works (verified in code: `coachPhase === 'idle'` re-enables CTA) | ✅ |

## 6 · Coach (PRO subscriber) — **regression caught**

| Surface | Expected | Actual (pre-fix) | Status |
|---------|----------|------------------|--------|
| Click "Ask the Coach" with 0 credits | Bypass paywall → loading → `<CoachPanel>` (PRO has unlimited) | Dropped on `<CoachPaywall>` showing 5 / 20 credit packs | ⚠️ Fixed in `154f806` (2026-05-07) |
| `<CoachPanel>` rendered for PRO | Footer shows "Reviewing N past games · Manage" | Same | ✅ |
| First-run banner ("Personalized coaching is live") | Shows once for PRO, dismissable, hidden on reload | Same (PR 5 ebccb27) | ✅ |
| Coach disappears after dismiss | Re-tap "Ask the Coach" available again | ✅ With fix, PRO never sees paywall, so dissolves | ✅ |
| `/coach/history` page | Lists past analyses, delete-all CTA | Same | ✅ |
| `/privacy` Coach section | Renders 4 paragraphs of `PRIVACY_COACH_COPY` | Same (PR 5 04db1bc) | ✅ |

## 7 · Trophies (`/trophies`)

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Hall of Fame grid | Top victories from leaderboard | Same | ✅ |
| Achievements grid | 7 derived badges (locked/claimable/claimed) | Same | ✅ |
| My Victories list | Player's minted NFTs sorted by recency | Same | ✅ |

## 8 · Shop / Coach credits / Shields

| Surface | Expected | Actual | Status |
|---------|----------|--------|--------|
| Founder Badge (item 1) | $0.10 purchase, soulbound | Same | ✅ |
| Retry Shield (item 2) | $0.025 × 3 uses, localStorage tracked | Same | ✅ |
| Coach 5-pack (item 4) | Buy → +5 credits | Same | ✅ |
| Coach 20-pack (item 5) | Buy → +20 credits | Same | ✅ |
| PRO subscription (item 6) | $1.99 / 30 days | Same | ✅ |

## 9 · Routing

| Path | Expected | Actual | Status |
|------|----------|--------|--------|
| `/` | → `/play-hub` (current) or `/hub` (target) | Redirects to `/play-hub` | 💡 (target redesign WIP) |
| `/hub` | New unified hub | Renders new redesign | ✅ |
| `/play-hub` | Should ALIAS to `/hub` once redesign closes | Lives as separate legacy layout | ⚠️ B5 |
| `/arena` | Free Play, full chess | Same | ✅ |
| `/coach/history` | PRO history page | Same | ✅ |
| `/privacy` | Legal + Coach disclosure | Same | ✅ |
| `/trophies` | Hall of fame + achievements + my victories | Same | ✅ |

---

## Open Items (from this audit)

| ID | Severity | Status | Owner / Plan |
|----|----------|--------|--------------|
| B1 — Coach PRO gate | P0 | ✅ Fixed (`154f806` 2026-05-07) | shipped |
| B4 — Claim cancel copy + tone | P1 | ✅ Fixed (`cd9eb1a` 2026-05-07) | shipped |
| B2 — Pass Training "Play in Arena" stuck | P0 | 🔬 Needs Playwright repro | Phase 3 |
| B3 — Coach re-entry | P0 | ✅ Resolved by B1 + existing paywall escape | none |
| B5 — `/play-hub` legacy alias | P1 | 📋 Backlog | next sprint |
| B6 — `principalbutton.png` integration | P1 | 📋 Backlog | next sprint |
| B7 — Mastery per-piece destinations | P2 | 📋 Backlog | next sprint |

---

## Tooling Recommendations

1. **Playwright E2E** (Phase 3 of triage plan) — to catch wallet/UI integration regressions before they hit prod. Initial scope: nav-only (no wallet) covering hub/arena/coach/privacy/trophies surfaces.
2. **`vercel curl` smoke** — automated post-deploy script that asserts new copy/sections render in HTML. Already validated `/privacy` + `/coach/history` manually; codify as a CI step.
3. **`/api/pro/status` health probe** — route exists; add it to the smoke loop alongside `/privacy` and `/coach/history`.
4. **Visual regression** — `visual-qa` skill for the candy-game aesthetic surfaces (hub, arena end state, coach panel).
