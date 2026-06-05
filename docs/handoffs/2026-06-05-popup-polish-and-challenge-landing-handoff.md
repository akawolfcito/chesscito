# 2026-06-05 — Popup vocab polish (Cluster 2) + Challenge landing redesign (Cluster 3)

## TL;DR

Shipped 6 commits across `5ba8ae7a..b7f0f0f2`. Production + main are at `b7f0f0f2`. Closed Cluster 2 (popup vocabulary normalization — items 3/4/5/6 of `docs/audits/2026-06-04-distant-screens-inventory.md`), repaired the Phase 2 test fixture that was leaking red on main, then rebuilt `/victory/[id]` (Cluster 3 — item 7) as a panel-mision share landing with `avatar-confiado` in place of the off-brand trophy Lottie. 39/39 VR + 842/842 affected vitest suites green throughout.

## What shipped

### Cluster 2 — Popup vocabulary normalization

| Commit | Surface |
|---|---|
| `5ba8ae7a` | `/exercises` score-submit error path dropped the duplicate `showToast("Save failed. Try again.")` that fired alongside the ResultOverlay error popup. Popup owns the failure surface (Try Again + Dismiss CTAs). Removed the now-orphan `submitFailed` EN+ES i18n entries — single source of truth. |
| `b04c4318` | Public Challenge landing `/victory/[id]` HUB escape link migrated from plain `text-sm font-semibold underline underline-offset-2` to `.arena-result-back-link` chip (already used by Arena results). Preserved `min-h-[44px]` tap target. |
| `87a25130` | ResultOverlay receipt micro-text `chesscito · on Celo · Receipt on CeloScan` rebuilt: brand text stays inline, **Receipt becomes a `.account-status-pill[data-tone="celo"]` amber-gradient chip** matching CeloScan brand. Plus suppression: floating "Step 2 of 2 — Confirming on-chain…" `TxProgressSteps` toast hides while `resultOverlay !== null` so the popup owns its own status (capture IMG_3145 read as "half attached, half floating"). |
| `31f0cb2b` | Inventory audit §6 closed as `CLOSED — already unified to red`. Verified `.candy-close-asset-button` + `close-icon.{avif,webp,png}` is the SINGLE close vocabulary across popups AND sheets (`ContextualHeader.close-control` delegates to the same sprite). The 2026-06-04 captures pre-dated the unification. No code change. |

### Phase 2 test fixture repair

| Commit | Surface |
|---|---|
| `1ce57bdd` | `GET /api/games/[id]` cache-hit test failed on main since Phase 2 commit `6f98ffd1` because the blanket `redisGet.mockResolvedValue(record)` returned `record` for the second redis.get call (analysis key) too, so `getCachedAnalysisWithFallback` returned a defensive `{...record, locale: "en"}` and `getGameRecord` inlined it as `body.analysis`. Switched to a key-scoped `mockImplementation` that returns `null` for any `coach:analysis:*` key. The record-only contract is the intent of THIS test; the analysis-inlining contract belongs to a dedicated `game-persistence` suite. |

### Cluster 3 — Public Challenge landing redesign

| Commit | Surface |
|---|---|
| `b7f0f0f2` | `/victory/[id]` rebuilt in the panel-mision register. Same visual recipe as `arena-end-state` CHECKMATE popup (capture refs: `arena-end-state-win-celebration` + `win-cancelled`). |

Cluster 3 changes in detail:
- **Backdrop**: `mission-shell secondary-page-scrim` → `.arena-bg` (canonical Hub/Coach forest scene), full-bleed.
- **Card shell**: cream-with-leaf-corners `panel-bg1.{avif,webp,png}` background-image (same asset every panel-mision popup uses), max-w 340px, `.arena-result-popup-content` interior padding overridden top: 12% (vs default 18%) since there's no close X to clear on a destination route.
- **Headline**: `.arena-result-title` (fantasy-title brown) sized down to clamp(24px, 5dvh, 32px) so "Checkmate in N moves" fits one line.
- **Stat pills**: `.arena-result-stats-row--missionpills` with three `.candy-stat-pill` chips — star + difficulty / pawn + moves / time icon + formatted time.
- **Challenge block**: `.arena-result-coach-section` pattern. `challengeLine` ("Can you beat this?") as focal `.arena-result-coach-headline`, existing `tagline` as supporting body, `avatar-confiado` (confident wizard, fist clenched, slight smirk) floats right via `.arena-result-coach-avatar`. Reads as "Sí, alguien lo logró — ¿tú puedes?" — addresses the VISITOR (share-funnel target), not the sharer.
- **CTAs preserved**: `AcceptChallengeButton` → `/arena?fresh=1`, `.arena-result-back-link` HUB chip.

Drops:
- `<VictoryTrophy />` Lottie component + `victory-trophy.tsx` + `public/animations/trophy.json` (off-brand vs current graphic line per user feedback; grep confirmed zero other consumers).

Reuses (no new assets):
- `/art/new-assets-chesscito/paneles/panel-bg1.{avif,webp,png}` (existing panel asset).
- `/art/new-assets-chesscito/fun/avatar-confiado.{avif,webp,png}` (existing avatar variant — also used by `arena-end-state` draw + `victory-claiming`).
- `/art/redesign/pieces/w-pawn.{avif,webp,png}` (existing piece icon).

Avatar emotion rationale: 8 emotions exist (`asombrado / confiado / feliz / feroz / interrogativo / pensativo / asustado / triste`). `confiado` chosen because (a) `feroz` reads intimidating to a first-time visitor, (b) `feliz` mirrors the sharer's joy but doesn't address the visitor, (c) `interrogativo` reads uncertain. Confiado's body language (fist clenched, smirk) carries the challenge tone without aggression.

## State at session end

- `origin/main` = `origin/production` = `b7f0f0f2`.
- 39/39 VR baselines green on every commit. Affected vitest suites green (262 in Cluster 2, 52 in route test, 842 in Cluster 3).
- tsc clean across all commits.
- Inventory `2026-06-04-distant-screens-inventory.md` status: items 3 / 4 / 5 / 6 / 7 closed. Items 1 / 2 closed in prior sessions (Coach viewer unification + brown CTA retire). Item 8 (Badge art consolidation, P2) deferred indefinitely per audit recommendation.

## How to verify in production

1. **Save failed dedup** — `chesscito.com/exercises` on a connected wallet. Trigger a save failure (reject sign in MiniPay). The "Couldn't save" popup must render WITHOUT a cream "Save failed. Try again." toast underneath.
2. **CeloScan chip** — `/exercises` → buy 20 Coach Credits → success popup. Footer should show "chesscito · on Celo" as text and a separate amber-gradient pill labelled "RECEIPT ON CELOSCAN". Floating "Step 2 of 2" toast must NOT render while the popup is open.
3. **Challenge HUB chip** — `/victory/1` → HUB link below Accept Challenge should be the chip style (uppercase, letter-spaced, brown text-shadow), not a plain underlined link.
4. **Challenge landing redesign (Cluster 3, the user-flagged surface)** — `chesscito.com/victory/1` on MiniPay Android:
   - Forest backdrop full-bleed (no cream `secondary-page-scrim`).
   - Cream card with leaf-corner foliage (panel-mision shell).
   - Headline "Checkmate in 24 moves" (or equivalent) in fantasy-title brown.
   - Three pills row: Difficulty / Moves / Time.
   - Wizard `avatar-confiado` floats right of the challenge text block.
   - Accept Challenge green primary CTA.
   - HUB chip below.
   - **No trophy Lottie anywhere.**
5. **OG share preview** — paste `https://www.chesscito.com/victory/1` into WhatsApp / Telegram / Twitter. The OG card itself (`/api/og/victory/1`) is unchanged; only the landing target was redesigned.

## Open questions / deferred work

1. **Item 8 — Badge artwork consolidation (P2)** — the heraldic dark-navy + gold-leaf wreath Badge card reads as a different product from the cream-candy Hub. Audit explicitly deferred. No action planned.
2. **Inventory `2026-06-04-popup-vocabulary-migration.md` Phase 1+** — Cluster 1 (Coach viewer + brown CTA retire) closed in prior sessions; Cluster 2 (this session) closes the popup register. No active follow-up.
3. **`/victory/[id]` VR coverage** — no baseline captures this route because it requires a live mainnet token ID. Smoke is the only gate today. Belongs to a future Playwright wallet-mock spec hardening pass.
4. **Phase 2 `getGameRecord` analysis-inlining test** — the route test now scopes to the record-only contract. A dedicated `game-persistence.test.ts` suite for the analysis-inlining shape would close the audit gap. Tracked as a small follow-up, not blocking.
5. **MiniPay submission packet** — Cluster 3 polish improves the share funnel readiness profile but does not unblock anything in `docs/audits/2026-06-03-minipay-submission-readiness-audit.md`. Submission still gated on the packet documental work (~3-5h).

## Files in flight (gitignored, OK to leave)

Same set as the previous handoff — Lighthouse JSON reports from earlier sessions (`apps/web/lh-*.json`, root `lh-prod-post-p0-3-r{2,3}.json`).

## Memory entries to consider adding next session

- `feedback_avatar_emotion_selection` — when picking a wizard emotion for a new surface, audit existing `arena-end-state` / `victory-*` callsites first (8 emotions, 6 already wired). The grid: asombrado=wow, confiado=challenger, feliz=celebrate, feroz=intimidate, interrogativo=question, pensativo=think, asustado=fear, triste=sad. Pick by who the surface ADDRESSES (visitor vs sharer), not by what happened.
- `project_panel-mision-as-destination-pattern` — reusing the `panel-bg1` background + `.arena-result-popup-content` padding pattern OUTSIDE a modal scrim. Override `padding-top` (default 18% reserves the close X corner) when the surface has no dismiss affordance. Reference: `/victory/[id]` 2026-06-05.
