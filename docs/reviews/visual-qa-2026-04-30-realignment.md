# Visual QA — Chesscito post-realignment Phase 1 (commits 1–2)

Reviewed at 390px viewport (minipay project) using fresh snapshots from
`pnpm test:e2e:visual --project=minipay`.

Surfaces inspected: play-hub, landing, arena soft-gate, sheet-shop,
sheet-trophies, sheet-leaderboard, sheet-badges, victory-page, pro-sheet
(targeted capture).

---

## 1. Overall verdict

**Approve with fixes.** Phase 1 copy work landed cleanly, but **three
visual/UX issues block the user from actually experiencing the new
narrative.** None are caused by the realignment commits — they're
pre-existing, but they sit directly on top of the surfaces we just
rebranded, so they read as part of the same pass and need fixing before
calling the realignment "done."

The product has a coherent visual language (candy-frame + amber/cream
palette, friendly fantasy typography, generous spacing), and the dock
is dense but clear. The biggest enemy of the realignment isn't ugly UI
— it's friction layered on top of the right copy.

---

## 2. Top 5 visual issues

### Issue 1 — Mission Briefing modal overlaps every sheet on first load
**Severity: HIGH**
**Where**: `play-hub.png`, `sheet-shop.png`, `pro-sheet.png` all show the
yellow "Aprendes piezas con retos cortos" onboarding card stacked on
top of (and bleeding through) the actual sheet underneath.

**Why it matters**: The new PRO copy and Shop copy are both **invisible
to first-visit users** because the briefing modal sits on top. The
onboarding is also Spanish in an otherwise-English app, so the user
hits a language switch before seeing anything else. This is the worst
possible first impression for the realignment we just shipped.

**Fix**:
- Defer the mission briefing dialog if any Sheet/Dialog is already
  open (one conditional in `play-hub-root.tsx` — guard the
  `setShowMissionBriefing(true)` effect with `&& !anySheetOpen`).
- Or invert the logic: only auto-open briefing on the play-hub root
  view, never when a sheet has been opened.
- Side fix: the briefing copy is Spanish (`Aprendes piezas con retos
  cortos`) while everything else inside the app is English. Either
  translate the onboarding to English to match Phase 0, or commit to
  ES end-to-end.

### Issue 2 — `/victory/[id]` still leads with crypto framing
**Severity: HIGH**
**Where**: `victory-page.png` line 2 says
**"Learn chess moves, earn on-chain — a Celo MiniPay game"**, and
the performance line is **`Easy · 1:06 · 0xCc41…c2dD`** (raw wallet).

**Why it matters**: This is the **most viral surface in the product**
(shared to Twitter, Farcaster, friends in WhatsApp). Phase 1 cleaned
the in-app claim flow, but the public share page still leads with
"earn on-chain" — directly contradicting the new narrative on the
exact surface non-players see first.

**Fix**:
- In `editorial.ts`, locate `VICTORY_PAGE_COPY.shareTagline` (or
  similar) and rewrite to e.g. "Train your mind with pre-chess
  challenges — a Celo MiniPay game."
- Replace truncated wallet `0xCc41…c2dD` with a player handle when
  available, or hide it entirely on the public share view. Wallet
  addresses are crypto-native UX, not warm.
- Same for `VICTORY_PAGE_COPY.metaChallenge` flagged earlier ("claimed
  onchain"). All three live in the same OG-metadata block — single
  commit covers them.

### Issue 3 — Arena soft-gate sheet stacks 6 decisions on one screen
**Severity: MEDIUM**
**Where**: `arena.png` shows: warm-up question (2 CTAs) → prize pool
banner → color toggle (White/Black) → 3 difficulty cards → "Enter
Arena" primary CTA → "Back to Hub" secondary. That's **six distinct
decision blocks in a single 390-tall sheet**.

**Why it matters**: Cognitive load violates "calm, progress-oriented."
The player came to play; instead they're shopping for choices. The
secondary CTAs (warm-up softgate + back-to-hub) compete for primary
attention with the actual "Enter Arena" button.

**Fix**:
- Collapse the warm-up gate to a single inline link above the
  difficulty cards if no progress recorded ("New here? Try a
  2-minute warm-up first →"), instead of a full sub-card with two
  buttons.
- Move the prize pool banner to a smaller pill below the Arena title
  rather than a full row before color toggle.
- Default difficulty selection: pre-select Easy. Reduces "stare at 3
  cards" moment.

### Issue 4 — Top HUD on play-hub mixes 3 visual styles in one row
**Severity: MEDIUM**
**Where**: `play-hub.png` top: rounded `ROOK` badge (cream pill) + an
oblong `Move to h1` challenge pill + the `✦ PRO` chip (amber
gradient). Three different shapes, three different colors, three
different weights. Reads as patchwork.

**Why it matters**: The top of the screen is the user's anchor — it
should establish the calm, premium tone. Instead it competes with
itself. PRO chip in particular grabs attention with its gradient
right where the player's eye lands first.

**Fix**:
- Unify the badge + challenge pill into a single HUD row treatment
  (same height, same border-radius, same paper texture).
- Mute the PRO chip when the user **does not have PRO** AND **no
  conversion intent has been signaled** — keep it ghosted (border
  only, no fill) until the player wins a game or completes a piece.
  After that, restore the gold gradient.
- Consider moving PRO chip to the dock as a 6th item (or replacing
  one of the existing dock slots) so it lives in the persistent
  navigation, not the HUD.

### Issue 5 — Sheet visual stack collapses when modals overlap
**Severity: MEDIUM**
**Where**: `sheet-shop.png` shows the Shop sheet's "Founder Badge $0.10
Available" content visible BELOW and BEHIND the briefing modal, with
low contrast. Same in `pro-sheet.png`.

**Why it matters**: When two surfaces stack, the underneath one should
be either fully hidden or clearly inactive. Right now the shop content
bleeds through with weak alpha — a player can read part of "Founder
Badge" and "Support Chesscito with…" before being interrupted. That's
two pieces of information on top of each other.

**Fix**: Same root cause as Issue 1 — fix the briefing layering and
this clears up automatically. If briefing must coexist with sheets, at
minimum push the underneath sheet's opacity to ~10% (currently looks
~40%) and disable pointer events.

---

## 3. Quick wins (can ship in <30 min each)

| Fix | File | Effort |
|---|---|---|
| Update `VICTORY_PAGE_COPY.shareTagline` to drop "earn on-chain" | `editorial.ts` | 5 min |
| Update `VICTORY_PAGE_COPY.metaChallenge` to drop "claimed onchain" | `editorial.ts` | 5 min |
| Update `ARENA_COPY.prizePoolSoonHint` ("20% of every Victory mint" → without "mint") | `editorial.ts` | 5 min |
| Hide truncated wallet on `/victory/[id]` performance line | `app/victory/[id]/page.tsx` | 15 min |
| Pre-select Easy on arena soft-gate | `arena/difficulty-selector.tsx` | 15 min |
| Guard mission briefing against open sheets | `play-hub-root.tsx` | 20 min |

All six are below the threshold of needing a plan — atomic commits.

---

## 4. Smaller polish notes (not in top 5)

- **Landing**: vertical layout looks correct in thumbnail but I can't
  read full text at this size. Worth a focused review at 1× scale.
- **Trophies sheet**: not reviewed in detail — separate pass recommended.
- **Dock**: 5 items is at the upper limit for a 390px footprint. Adding
  a 6th (PRO) would force label truncation or dropping labels entirely.
  If we move PRO to the dock, drop a less-critical slot (Leaders?
  it's a destination, not a transaction).
- **Arena difficulty cards**: color dots (yellow/orange/red) vs the
  warm amber palette feel slightly arcadey. Consider muted icons
  (sparkle/swirl/flame) instead of dots.
- **Victory share page**: the empty bottom half (lines 920+ in the
  screenshot) suggests a desktop render. On true mobile (390×844)
  this is probably fine; verify.
- **PRO sheet `missionNote`**: visible in the screenshot ("Every PRO
  subscription helps us keep the free tier open…"). Renders correctly,
  spacing reads well.

---

## 5. Final recommendation

**Approve with fixes — needs one more pass before merging the realignment narrative as "done."**

Order of operations recommended:

1. **Block-fix Issue 2** (commit 3 of Phase 1: `/victory/[id]` copy purge — the public surface). This is the highest-leverage commit because it's the share asset.
2. **Continue Phase 1 as planned**: Shop subtitles (commit 3 of plan), Coach (commit 4), disclaimer footer (commit 5).
3. **Then patch Issue 1** as a single guard commit before Phase 2.
4. **Defer Issues 3, 4, 5** to a focused composition sprint after Phase 1 closes — they're cohesion fixes, not blockers.

The realignment narrative is right. The execution risk is **users not seeing it** because of the briefing overlap and the share page leaking the old framing. Fix those two, the rest is polish.
