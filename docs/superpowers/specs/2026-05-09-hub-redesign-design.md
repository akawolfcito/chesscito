# Hub Redesign — Discovery Spec

**Author**: Claude (drafting agent)
**Date**: 2026-05-09
**Status**: 🟡 DISCOVERY — needs user input on open questions before design lock
**Predecessors**:
- `docs/audits/2026-05-07-hub-audit.md` (current hub scaffold + sheet round-trip audit)
- `docs/handoffs/2026-05-09-vocabulary-unification-arc-handoff.md` §"P1 — feature work"
- `_bmad-output/planning-artifacts/ux-design-specification.md` (existing UX baseline)

## 0. Reading order

This is a **discovery-phase** spec. It does NOT lock the design. It frames what we know, surfaces what we don't, and proposes 2–3 directions for the user to pick from before we move into design-lock + red-team + TDD.

**Sequence the user is committing to**: discovery (this doc) → user picks direction + answers open questions → I refine into a design-locked spec → red-team review → TDD plan → granular commits → handoff.

## 1. Why this spec exists

The `/hub` route was rebuilt during the Game Home redesign (Story 1.x in `_bmad-output/planning-artifacts/epics.md`) and ships behind no flag — it's the live home-of-the-app. The 2026-05-07 hub audit found 11 issues spanning broken navigation (Play CTA bypassed `/arena`), missing Coach entry, sheet round-trips via `?legacy=1`, and mastery-tile destination collisions. **All P0 fixes from that audit shipped during the migration sprint** (commits `749a15c..bc9e3c3`).

What did NOT ship from the audit: the underlying observation that `<HubScaffoldClient>` is a "pure presentation skin" that delegates heavy logic to a legacy `<PlayHubRoot>`. The handoff's pending heavy ports list (`ProSheet`, `ShopSheet`, `BadgeSheet`) is still open.

In parallel, during the Sprint 4 eyeball (handoff §"P1 — feature work"), the user observed that `/hub` "necesita resolverse en algún momento" and gestured at a target structure: **splash overlay + main hub + PLAY CTA + masteries + training pass**. That's a redesign brief, not a bug fix list — it asks for a different mental model of what the hub IS, not just patches to the existing layout.

This spec answers: **what's the next mental model for `/hub`, what does it look like, and how do we ship it without breaking the live home-screen?**

## 2. Brief from the user (verbatim from handoff)

> ### P1 — feature work
> - **`/hub` redesign** (image #12): el usuario nota que "necesita resolverse en algún momento". Splash overlay + main hub structure con PLAY CTA + masteries + training pass. Surface entera, requiere su propio spec.

Four cues to unpack:

1. **"Splash overlay"** — implies a transient/cinematic surface layered ON the hub, not a full takeover route. Could be onboarding-only, every-session welcome, or a pull-down feature peek.
2. **"Main hub structure"** — current 3-zone HUD floats; the brief implies a more deliberate composition.
3. **"PLAY CTA"** — already dominant in current scaffold; the brief reasserts it.
4. **"Masteries + training pass"** — current `<RewardColumn>` (left strip, 3-tile cap) renders mastery progress; current `<PremiumSlot>` (right strip) renders Training Pass. The brief implies these deserve more presence than collapsed strips.

## 3. What we have today

```
URL          /hub
Render       <HubScaffoldClient> → <HubScaffold>
Layout       <main class="hub-scaffold">
               <header class="hub-scaffold-hud">
                 <div class="hub-scaffold-hud-top">
                   trophy chip · pro chip · coach chip · [connect]?
                 </div>
                 <HudSecondaryRow streak | stars | shields />
               </header>
               <section class="hub-scaffold-body">
                 <RewardColumn /> <KingdomAnchor /> <PremiumSlot />
               </section>
               <footer class="hub-scaffold-footer">
                 <MissionRibbon />
                 <PrimaryPlayCta />
                 <secondaryAction "Practice pieces"? />
               </footer>
             </main>
```

Strengths the redesign should preserve:
- **Wallet-aware rendering** — chips show `0` / "Connect" gracefully via prop-driven label paths.
- **PrimitiveBoundary wrappers** — single primitive crash does not blank the surface.
- **Pure-presentation contract** — caller owns navigation + telemetry; the scaffold is testable in isolation.
- **Editorial-driven copy** — every label/aria flows through `HUD_COPY`.

Weaknesses the redesign should address:
- **Collapsed mastery surface** — `<RewardColumn>` shows up to 3 tiles; the player has 6 pieces (rook/bishop/knight/pawn/queen/king). Two pieces are perpetually invisible (and Q/K have no exercises today). Mastery is core retention but the visual real-estate is minimal.
- **Training Pass legibility** — `<PremiumSlot>` is a right-side strip; PRO is a $1.99 funnel that deserves more room when active (sessions used) AND inactive (the upgrade pitch).
- **Sheet round-trips** — Trophy / PRO / Shields / Mastery taps still bounce through `?legacy=1`. Heavy ports of `ProSheet`, `ShopSheet`, `BadgeSheet` are queued in handoff.
- **No splash / no welcome** — the player lands on a static composition. No moment-of-arrival.

## 4. UX framing axes

Three independent axes the redesign decision will land on:

### 4.1 Splash overlay — what is it?

| Variant | Behavior | Tradeoff |
|---|---|---|
| **A — Onboarding-only** | First-ever-visit cinematic, dismissed forever after | Highest impact / one-time cost; low ongoing value |
| **B — Every-session welcome** | 1.2s hero animation on each `/hub` mount with PLAY breathing in | Gives every session a "moment of arrival"; risk of feeling slow on returning users |
| **C — Returning peek** | Animated banner at the top of the hub revealing "what's new since you last played" (new mission, expiring streak, fresh challenge) | Information dense; needs server-side "since-last-visit" state |
| **D — None** | Drop the splash idea; focus the budget on the hub composition itself | Cheapest; admits the brief was aspirational |

### 4.2 Mastery surface — how prominent?

| Variant | Layout | Tradeoff |
|---|---|---|
| **A — Status quo** | Left-column strip, 3-tile cap | Doesn't address the brief |
| **B — Promoted board** | A 2×3 mastery grid OR a horizontal carousel above the PLAY CTA, all 6 pieces visible | Visible-by-default for retention; competes with PLAY for visual weight |
| **C — Mastery section** | Distinct section "Masteries" between hero + PLAY, full-width 6-tile row that also shows lock state for unbuilt pieces (Q/K) | Telegraphs "more to come" + frames the PLAY as "your daily ritual" beneath; longer scroll |
| **D — Full mastery view** | Hub becomes a full mastery dashboard; PLAY is a docked persistent button | Most retention-coded; biggest divergence from current scaffold |

### 4.3 Training Pass — when active vs inactive

| Variant | Active state | Inactive state | Tradeoff |
|---|---|---|---|
| **A — Status quo** | Right-strip slot with kicker + progress | Right-strip slot with "Buy" label | Doesn't address the brief |
| **B — Banner band** | Dedicated band above masteries showing days-remaining + sessions; collapsed when expired | Banner with $1.99 + value props (3 perks) | More breathing room for active subs; clearer pitch when inactive |
| **C — Hero variant** | When PRO active, the hub hero shifts atmosphere (warmer wood tones, "Training Pass" wax-seal) | Same as A | Highest retention signal "you're a member"; biggest engineering scope |

These axes compose. A reasonable redesign might be Splash=B + Mastery=C + Training=B; or Splash=A + Mastery=B + Training=C. The user picks the combo.

## 5. Open questions (block design lock)

These need answers before we lock direction. Listed in priority order:

1. **The visual reference (handoff "image #12")** — the handoff cites it but it's not in the repo. The reference picture probably encodes 80% of the design intent. Without it, every direction below is speculation.
2. **Splash variant** — A/B/C/D from §4.1.
3. **Mastery prominence** — A/B/C/D from §4.2. Closely related: do we ship Q/K placeholder tiles ("coming soon") or hide them entirely?
4. **Training Pass treatment** — A/B/C from §4.3. Closely related: do we want PRO state to recolor the hub's atmosphere (warm-wood vs cool-stone) or just the slot?
5. **Coach entry on hub** — already shipped as a HUD chip during the migration. Should it stay HUD-only, or get a card-level home in the redesign? (Audit found Coach was "buried" pre-migration; the chip resolved it for now.)
6. **Migration strategy** — three options:
   - **In-place rewrite** — modify `<HubScaffold>` directly; ship the redesign as the new hub. Highest risk (live home-screen).
   - **Flagged variant** — `<HubScaffoldV2>` behind `?hub=v2` (mirroring the original Story 1.12 `?hub=new` precedent), promote when ready.
   - **Side-by-side route** — `/hub-next` for early access, swap path when ready.
7. **Heavy-ports relationship** — the handoff's pending `ProSheet` / `ShopSheet` / `BadgeSheet` direct ports — do we ship those FIRST (so the redesign opens sheets in-place from day one) or fold them into the redesign work?
8. **Scope boundary** — does this redesign include `/exercises` / `/arena` / `/trophies` shell visuals, or strictly the `/hub` route?
9. **Performance budget** — splash means assets (Lottie / video / static art). What's the budget on top of the current scene-rooted asset payload (148 KB)? The 2026-04-18 candy migration cut payload by 95%; we should not regress.
10. **Testing strategy** — current hub coverage: `apps/web/src/components/hub/__tests__/hub-scaffold{,-client}.test.tsx`. Redesign tests should preserve testids and ARIA contract (per the wrapper-span pattern adopted M3.5).

## 6. Direction sketches

Three composable directions to react to. Each is a starting point, not a final.

### Direction X — "Quiet upgrade"
Splash=D + Mastery=B (carousel) + Training=A (status quo).

Minimal intrusion. Treat the redesign as polish: convert `<RewardColumn>` from 3-tile strip to a 6-tile horizontal carousel under the HUD; everything else stays. Ship in-place. Preserves audit's strategy A direction (ship the heavy ports next, then revisit).

- **Pros**: low risk, ships fast, addresses the mastery weakness directly.
- **Cons**: doesn't honor the "splash" half of the brief; doesn't transform the hub's mental model.
- **Estimated commits**: ~6 (carousel + tests + heavy-port unblocks).

### Direction Y — "Welcome-and-ritual"
Splash=B (1.2s session welcome) + Mastery=C (full-width 6-tile row mid-hub) + Training=B (banner band).

The hub becomes a paced composition: brief moment-of-arrival animation, then masteries band, then PLAY ritual, with the training pass as a banner that articulates membership state. Ship behind `?hub=v2` flag; promote when QA-clean.

- **Pros**: hits all 4 cues from the brief; the moment-of-arrival pattern is industry-standard mobile (Duolingo, Pokemon Go) and reads "polished" without being heavy.
- **Cons**: bigger scope; the welcome animation needs editorial direction (what does it say? what art ships?); flag adds maintenance until cleanup.
- **Estimated commits**: ~14 (splash + composition + flag + heavy ports + tests + cleanup).

### Direction Z — "Mastery-first dashboard"
Splash=A (onboarding-only) + Mastery=D (full dashboard) + Training=C (atmosphere shift).

Reframe `/hub` as a mastery dashboard: dominant mastery board with progress visuals, atmospheric tone shift when PRO is active (warm wood / wax-sealed), persistent PLAY pill at the dock level. Splash is reserved for first-ever-visit only. Ships side-by-side at `/hub-next` for the duration of a stabilization sprint, then swap.

- **Pros**: most retention-coded; differentiates "I'm a regular" from "I'm a visitor" clearly; the atmosphere shift is a strong PRO signal.
- **Cons**: largest divergence; PLAY moves out of the main canvas which conflicts with current "PLAY is the dominant action" design system rule (DESIGN_SYSTEM.md §16); risk of overdesigning before product-market signal.
- **Estimated commits**: ~22 (full restructure + atmosphere palette + dock changes + flag + cleanup).

## 7. Recommended path forward

**Default recommendation: Direction Y (Welcome-and-ritual), behind `?hub=v2` flag, with heavy ports folded in.**

Why:
- Honors all 4 cues from the brief without overshooting product-market signal.
- The flag pattern matches the precedent set by Story 1.12; reduces risk of breaking the live home-screen.
- Folding heavy ports in lets us replace the round-trip pattern in one sweep, killing `<PlayHubRoot>` legacy code as part of the redesign instead of a separate cleanup.
- Splash=B (every-session welcome) is the lowest-risk splash variant — it's a 1.2s animation, not a multi-screen onboarding.
- Mastery=C (full-width 6-tile row) plus Training=B (banner band) gives both surfaces the room they need without competing for the PLAY slot.

If the user wants to stay tighter (single-session ship), Direction X. If the user has bigger product ambitions for `/hub` (e.g., daily-reward dashboard), Direction Z.

## 8. Implementation phases (assumes Direction Y)

| Phase | Work | Exit criteria |
|---|---|---|
| **0 — Discovery** (this spec) | Capture brief + open questions | User picks direction + answers questions |
| **1 — Design lock** | Refine spec into prescriptive design — final layouts, copy, asset list, motion timing | Spec marked READY; red-team scheduled |
| **2 — Red-team review** | Adversarial review (orphan states, race conditions, a11y regressions, performance budget, copy edge cases) | All P0 findings addressed; P1 logged |
| **3 — Heavy ports** | Port `ProSheet`/`ShopSheet`/`BadgeSheet` to scaffold (open in-place via React state, kill `?legacy=1` round-trips) | Sheets open without URL bounce; suite green |
| **4 — Splash primitive** | New `<HubSplash>` component (1.2s welcome animation; respects `prefers-reduced-motion`); editorial copy in `HUD_COPY.splash` | Component renders + dismisses + a11y-clean |
| **5 — Mastery band** | New `<MasteryBand>` (6-tile horizontal full-width); replaces `<RewardColumn>` in V2 path | Tile per piece (incl Q/K placeholder); locked vs in-progress vs mastered states |
| **6 — Training pass band** | New `<TrainingPassBand>` (active sessions / inactive pitch); replaces `<PremiumSlot>` in V2 path | Active + inactive + expiring states; suite green |
| **7 — V2 composition** | `<HubScaffoldV2>` composes splash + HUD + mastery band + PLAY + training band; behind `?hub=v2` | Side-by-side QA: parity for chips/aria/testids vs V1 |
| **8 — Promote** | Default `?hub=v2` to on; deprecate V1 with a 1-release window | Telemetry on V2 ≥ V1 baseline; rollback playbook |
| **9 — Cleanup** | Delete V1 + `<PlayHubRoot>` + `?legacy=1` branch | No path renders the legacy hub; rewrites updated |

Each phase exits with: type-check green, suite green, granular commits per logical change.

## 9. Risks & dependencies

- **Live home-screen regression** — `/hub` is the front door. Any V1→V2 swap risks blanking the app for the entire user base. Mitigation: flag-driven rollout + telemetry parity gate before promote.
- **Asset payload regression** — splash + mastery art could push past the 148 KB budget. Mitigation: declare hard budget in design lock; AVIF/WebP pipeline mandatory; Lottie over video.
- **Editorial drift** — splash copy + mastery copy + training band copy add ~30 strings. Mitigation: single editorial review pass at end of design lock.
- **MiniPay WebView quirks** — recent commits suggest MiniPay-specific behaviors (HMR flakiness, no SharedArrayBuffer). Mitigation: smoke test V2 in MiniPay before promote.
- **Q/K piece exercise gap** — masteries promote 6 pieces but only 4 ship exercises. Mitigation: explicit "coming soon" state per the audit's recommendation.
- **PRO atmosphere shift** (if Direction Z) — would require palette tokens. Out of scope unless we pick Z.

## 10. Out of scope

- `/exercises` / `/arena` / `/trophies` shell visuals (separate surfaces).
- Coach product features (paywall, history, fallback engine) — the redesign treats Coach as a navigation target, not a redesign target.
- Achievements grid (just shipped Sprint 4D); the redesign reuses the surface as-is.
- Spanish / multilingual copy (current app is EN-only per CLAUDE.md).
- Desktop layout — mobile-first remains the focus; desktop falls out of `--app-max-width` 390px container.

## 11. Acceptance criteria for moving from "Discovery" → "Design lock"

The user provides:

- [ ] Visual reference (image #12 or replacement)
- [ ] Direction pick (X / Y / Z) or freestyle combination of axes
- [ ] Splash decision (A / B / C / D)
- [ ] Mastery decision (A / B / C / D)
- [ ] Training Pass decision (A / B / C)
- [ ] Migration strategy (in-place / flag / side-by-side route)
- [ ] Heavy-ports timing (before / during / after redesign)
- [ ] Asset budget cap (default: 148 KB +20%)

Once received, I produce the locked spec with prescriptive layouts, copy, and TDD plan; queue red-team; start phase 3.
