# Distant screens inventory — 2026-06-04

Source: 12 captures in `errors/pantallas-lejanas/IMG_312{1,7,9}.PNG`, `IMG_313{0,1,2,6,7,8,9}.PNG`, `IMG_3143.PNG`, `IMG_3145.PNG`.

Goal: list surfaces that drifted from the current visual system (gold-leaf hub + cream secondary CTAs + green primary + candy material vocabulary). Calls out cluster-level fixes vs. one-shot polish.

Severity legend:
- **P0** — surface contradicts the established vocabulary, hurts trust (e.g. brown legacy CTA on a redesigned background).
- **P1** — surface drifts from the system but is still usable.
- **P2** — minor inconsistency, polish-only.

---

## 1. Coach game viewer split — `/coach/[gameId]` (P0, structural)

**Captures**: IMG_3121, IMG_3132.

Today the post-game flow paints **two separate screens** for the same context:
- **REVIEW** card: forest bg + cream tip box + brown `PLAY` + cream `PRO REVIEW` + underline `HUB`.
- **TAKEAWAYS** card: same bg + cream takeaways list + brown `PLAY` + cream `Past Sessions` + underline `manage history`.

Both render at full-screen scale with their own scroll, both end in a generic underline link, both reuse the brown CTA the rest of the app has retired. The user flagged this explicitly — "ahora tenemos 2 pantallas en lugar de tener 1 bien unificada y funcional".

**Fix shape** (cluster — separate spec): merge into one coach viewer page with a single CTA strip (Play Again / Pro Review / Past Sessions) at the bottom, scroll-stack TAKEAWAYS under REVIEW within one frame. Drop the brown buttons in favor of the new green primary + cream secondary tokens. Coach Viewer Cluster C handoff (`docs/handoffs/2026-05-29-coach-viewer-cluster-c-handoff.md`) is the natural follow-up sprint to fold this into.

## 2. Legacy brown CTA still rendering (P0, recurrent)

**Captures**: IMG_3121, IMG_3127, IMG_3129, IMG_3132, IMG_3136, IMG_3137, IMG_3138, IMG_3139, IMG_3143, IMG_3145.

The deep wood-grain brown button (`background: linear-gradient brown → dark-brown` with cream label) appears as the primary affordance on at least nine surfaces:

| Surface | Label | Should become |
|---|---|---|
| Coach Review | `PLAY` | `--cta-primary-green-*` (matches ENTER ARENA / TRAIN PIECES) |
| Coach Takeaways | `PLAY` + `Reanalyze` | green primary + cream secondary |
| Confirm Purchase sheet | `Confirm purchase` | green primary |
| Purchase Complete dialog | `Share` | cream secondary (sharing is opt-in, not the dominant action) |
| Score Saved dialog | `Share` | cream secondary |
| Save Error dialog | `Try again` | green primary (recovery action) |
| Daily Tactic intro | `PLAY` (when present) | green primary |

Trail spec: `docs/audits/2026-06-01-button-families-inventory.md` already inventoried the brown family. Step missing: actually retiring it from these dialog surfaces. Likely a one-cluster sweep.

## 3. Underlined `HUB` link as escape hatch (P1, vocabulary mismatch)

**Captures**: IMG_3131, IMG_3132.

Below the Coach Review and the public Challenge landing, the only escape lane is a plain text-underline `HUB` link, brown on cream. Looks like a default browser hyperlink — out of vocab against the rest of the app's pill/chip family.

**Fix**: convert to `.arena-result-back-link` (already in `globals.css:1063`, used by Arena results) or the cream secondary CTA template if the prominence needs lifting.

## 4. Purchase/Score footer micro-line (P2, polish)

**Captures**: IMG_3129, IMG_3137, IMG_3138, IMG_3145.

Dialog base shows `chesscito on Celo · Receipt on CeloScan` in tiny brown text. Status is fine but the typography reads as fine-print, not a confirmation. Pairs with the "Step 2 of 2 Confirming on-chain…" line that sits OUTSIDE the dialog (IMG_3145) — half attached, half floating.

**Fix**: lift the receipt link into a `.account-status-pill` (or the new chip family) inline with Continue/Share; pull the "step 2 of 2" progress chip into the dialog itself, not the parent surface, so the popup owns its status.

## 5. "Save failed" inline toast duplicates the error popup (P1, redundancy)

**Captures**: IMG_3136, IMG_3139, IMG_3143.

When `/exercises` save fails, the screen shows **both**:
- A "Couldn't save" popup (large, modal, brown Try again + cream Dismiss).
- A floating cream toast "Save failed. Try again." anchored to the bottom action row.

Two surfaces, same message. Either the popup or the toast should fire — not both.

**Fix**: keep the popup (it owns the recovery action). Suppress the toast when the popup is open. Single source of truth for the failure state.

## 6. Modal close button — red gradient circle X (P2, vocabulary review)

**Captures**: every dialog screenshot.

The close affordance is a deep red ⊗ disc with white X. Different palette from every other close in the app (the Account sheet, ContextualHeader, and dock sheets use a cream/pill close). It works as a signal, but the palette is the only place red appears in the kingdom.

**Fix**: confirm with you whether you want close to stay red (destructive-coded) or align with the cream-pill family used by ContextualHeader. Either way — pick one and remove the other from popup surfaces.

## 7. Public Challenge landing — `/api/og` driven? (P1, drift)

**Capture**: IMG_3131 (WhatsApp share preview opened as a landing on preview.chesscito.com).

This page shows:
- Cream background, no portal anchor.
- Large amber "Accept Challenge" green pill (good — matches the new token).
- Underlined HUB link below.

The button is on-brand but the page itself feels like a fallback OG-card preview rather than a designed surface — no Hub framing, no kingdom backdrop, no tagline pair. Worth a Phase B pass to make the challenge landing render the same kingdom hero the Hub does (kingdom-anchor playhub variant scaled down).

## 8. Badge artwork — gold-leaf wreath vs. candy palette (P2, art direction)

**Capture**: IMG_3130 (Share sheet showing the Badge card behind it).

The "BADGE" + "CHESSCITO • PLAY WITH ME" card under share uses a dark navy + gold-leaf wreath aesthetic (premium / heraldic). The rest of the new hub leans cream + candy + warm gold. These read as two different products.

**Fix shape**: not urgent — the Badge is a collectible identity and a heraldic register is defensible. But noting for a future art consolidation pass so the share preview reads as the same product the Hub does.

---

## Recommended sequencing

1. **Cluster 1 — Coach viewer unification + brown CTA retire** (covers items 1, 2, partially 3). Largest user-visible win.
2. **Cluster 2 — Dialog vocabulary normalization** (items 3, 4, 5, 6). All popup surfaces; one sprint of polish.
3. **Cluster 3 — Public challenge landing redesign** (item 7). Tied to share-conversion funnel.
4. **Deferred** — Badge art alignment (item 8).

Items 1 + 2 likely belong to the same Coach/Dialog cluster since both touch the same brown-CTA + escape-link vocabulary.
