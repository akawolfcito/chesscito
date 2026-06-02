# Handoff — M1 Monetization Funnel Cluster

**Date:** 2026-06-02
**Branch:** main (all 12 commits pushed + promoted to production via Vercel)
**Session goal:** ship the M1 monetization funnel — activate Luz as the conversion motor, position PRO as the recurrence destination, neutralize the broken prize-pool promise, hide the empty Founder Badge SKU, and instrument every commercial surface with namespaced telemetry — all without touching the purchase flow internals or shipping any new contract.

---

## What shipped (12 commits)

| # | Hash | Commit |
|---|---|---|
| docs | `f674c5d5` | docs(monetization): add M1 funnel direction and commit plan |
| 1 | `794bad3e` | chore(prize-pool): hide balance + remove prize promise copy |
| 2 | `7ec85251` | feat(arena): endgame loss/resign → Coach Review as primary CTA |
| 3 | `a2eb6602` | feat(coach-paywall): wire paywall in endgame for free users + preview |
| 4 | `1808352d` | feat(arena): endgame win/draw CTA order + Coach Review secondary in win |
| 5 | `ea118590` | feat(editorial): PRO copy → "Entrena con Luz todos los días" (value-before-price) |
| 6 | `db42378e` | feat(pro): days-remaining row + renew CTA when < 7 days |
| 7 | `bfc6ec4f` | style(shop): reorder tiles by value + hide Founder Badge |
| 8 | `cc7879f7` | docs(telemetry): document M1 monetization events |
| 9 | `5df098e5` | docs(monetization): audit PRO purchase consolidation + defer migration |
| VR | `483bfcbb` | chore(vr): refresh M1 baselines after funnel rework |

---

## Funnel direction shipped

| Layer | Role | Status post-M1 |
|---|---|---|
| Free | Hábito + retención D1/D7 | Sin paywall escondido, mercy paths preservados |
| Luz / Coach | Motor de **valor + conversión** | Paywall vivo en endgame loss/resign con preview + 3 tiers (pack 5, pack 20, PRO) + Later dismiss |
| PRO | Motor de **recurrencia** | Copy "Entrena con Luz todos los días" + value-before-price + days-remaining + renew CTA + Account row con state machine (active/expiring/expired) |
| Peones | Motor microconversión | Deferred a M3 (language layer change post-telemetry baseline) |
| Victory Cards | Retención + share | Save Victory primary en win; "¿Por qué ganaste?" Coach review secondary |
| Supporters | Comunidad / impacto | Founder Badge oculto del Shop (status/hook/contract intactos) |
| Prize Pool | — | Surface oculta hasta que exista distribución real |

---

## Telemetry shipped

**16 eventos `monetization.*` distribuidos en 9 archivos**, todos namespace `monetization.*`, sink existente `track()`, sin tocar purchase flow. Contrato canónico:

→ `docs/monetization/telemetry-events-m1.md`

Eventos en producción:

- `coach_review_offered`, `coach_review_tap`, `play_again_tap` (endgame surfaces)
- `coach_paywall_view`, `coach_paywall_preview_view`, `coach_paywall_dismiss`, `coach_paywall_convert`
- `save_victory_tap`, `save_victory_success`
- `pro_sheet_view`, `pro_chip_view`, `pro_chip_tap`, `pro_expiring_view`, `pro_expired_view`, `pro_renew_tap`
- `shop_item_view`

Context vocabularies: `endgame_loss | endgame_resign | endgame_draw | endgame_win`, `account_row | expiring_chip | expired_row`, `pack_5 | pack_20 | pro`, `endgame | save_success`, `explicit | backdrop`.

Legacy events preservados (no eliminados): `pro_card_viewed`, `pro_cta_clicked`, `pro_extend_tap`, `pro_training_card_viewed`, `coach_victory_analyze_tap`, `modal_open`, `hub_pro_chip_tap`, `shop_*` family. Coach `coach.*` namespace intacto.

---

## Pre-promote checks (todos OK)

| Check | Resultado |
|---|---|
| `CLAIM_IP_HASH_SALT` Production env tier | ✅ agregado (valor distinto al preview, server-only) |
| `items(6) = (1990000, true)` Celo mainnet (Shop `0x24846C772af7233ADfD98b9A96273120f3a1f74b`) | ✅ confirmado |
| Resto env vars (Celo addresses, Redis, Supabase, OpenAI, Upstash, NEXT_PUBLIC_APP_URL) | ✅ heredados de prod actual |
| Origin allowlist `chesscito.com` | ✅ pre-existing |
| M1 no introduce env vars nuevas | ✅ auditado (`process.env.X` grep) |
| VR baselines en sync (commit `483bfcbb`) | ✅ 5 baselines refreshed, 34 pasaron sin cambio |
| MiniPay smoke contra preview deploy | ✅ "se ve bien" (Wolfcito 2026-06-02) |
| Vercel preview → production promote | ✅ ejecutado (atomic swap) |

---

## Deuda explícita post-M1

### P0 — PRO purchase consolidation (deferred + documented)

**Status:** Commit 9 fue puramente documental. Pre-edit audit reveló que la consolidación es **structural refactor de revenue path** (~150-250 LOC en exercises-screen.tsx) con riesgo alto en MiniPay sin integration test harness. Decisión Opción 3 (defer + document) tomada en M1.

**Contrato canónico:** `docs/monetization/pro-purchase-consolidation-audit-m1.md`

**Por qué no es customer-facing bug:** server-side idempotency `coach:pro:processed-tx:{txHash}` con TTL 90 días previene double-charge. La duplicación es puramente client-side maintenance burden.

**Plan post-M1 documentado:** 8 steps en orden — integration test harness primero → telemetry parity verification → migrate Shop sheet → migrate PRO sheet → remove duplicate POST → add `pro_renew_success` event → MiniPay smoke → VR refresh.

### P1 — Eventos diferidos a M2

- `monetization.pro_renew_success { context, tx_hash }` — depende de tracking purchase flow callbacks, va naturalmente con la consolidación P0.
- `analytics_events` Supabase table + writer — M2 backend cluster (per audit §D4).

### P2 — Strings huérfanos en editorial (chore post-M1)

Preserved por scope durante M1 commits 3-7:

- `COACH_COPY.orQuickReview` (Commit 3 reemplazó por "Later" dismiss).
- `VICTORY_CELEBRATION_COPY.coachPillFree` + `coachPillPro` (Commit 4 reemplazó por `winCoachReviewCta`).
- `SHOP_COPY.coachPack` block legacy (Commit 7 reescribió subtitle pero SHOP_TILE_ASSETS no mapea esa key — sin consumer activo).

Acción futura: audit + purga en chore separado.

### P3 — Welcome Pack telemetry + Founder events

Out of scope M1 (componentes distintos al `ShopItemCard` canónico). Welcome Pack tap analytics requieren tocar `WelcomePackTile` lifecycle. Founder events no aplican mientras el SKU esté oculto del display.

---

## Pricing intacto

| SKU | Precio | Estado |
|---|---|---|
| Coach pack 5 (itemId=3) | $0.05 | configured + enabled mainnet |
| Coach pack 20 (itemId=4) | $0.10 | configured + enabled mainnet (now Hero FEATURED) |
| Retry Shield (itemId=2) | $0.025 | configured mainnet |
| Founder Badge (itemId=1) | $0.10 | configured mainnet, **hidden from Shop UI** |
| PRO (itemId=6) | $1.99 / 30 días | configured + enabled mainnet ✅ |
| Victory NFT mint | $0.005 / $0.01 / $0.02 (Easy/Medium/Hard) | deployed mainnet pre-M1 |

Cero cambios on-chain durante M1. Cero contratos nuevos. Cero pricing modifications.

---

## Open questions / next session intent

1. **Telemetry sink to Supabase `analytics_events`** — M2 backend cluster. Contrato listo (`telemetry-events-m1.md` §8). Decision pendiente: ¿propio writer o ingestion via existing Coach `analyze-telemetry.ts` sink?

2. **PRO purchase consolidation cluster** — cuando exista bandwidth para harness + refactor. Acceptance criteria en audit doc §5 (10 checkboxes).

3. **Welcome Pack telemetry + Founder Badge perks decision** — ¿Founder soulbound con perks reales (audit §E4) o convertirlo a Welcome Pack server-side bundle (audit §D5)?

4. **Peones language migration** — diferida a M3 con A/B test post-telemetry baseline. ¿Cuándo arrancar el A/B?

5. **VR CI integration** — VR sigue siendo local-only. Eventual: GitHub Actions job que corra VR contra preview deploys (similar al cron-cache-sync pattern).

6. **Founder Badge purga del catálogo** — actualmente oculto del display, pero `useFounderStatus` + Account inventory siguen derivando ownership. Decisión: ¿full retire post-Welcome-Pack migration?

7. **Prize pool re-introduction** — solo cuando exista distribución real. Audit doc actual `chesscito-monetization-direction-2026-06-01.md` §11 captura el frame correcto si vuelve.

---

## What NOT to touch next session

- Strings huérfanos sin audit consolidado (cleanup chore separado).
- exercises-screen.tsx purchase flow (deferred — ver P0 audit).
- Coach `coach.*` legacy telemetry namespace (Coach existing observability surface).
- Founder Badge data layer (hook + status + contract + API route — todo vivo para Account inventory).
- Pricing / duración / auto-renew (intactos por contrato del cluster).

---

## Reference docs (canonical)

- Direction: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Funnel map: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Inventory técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Commercial copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Parking lot: `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`
- Strategic audit (origen): `docs/monetization/2026-06-01-strategic-audit.md`
- Telemetry contract: `docs/monetization/telemetry-events-m1.md`
- PRO consolidation audit + defer: `docs/monetization/pro-purchase-consolidation-audit-m1.md`
- M1 commit plan: `docs/plans/chesscito-monetization-m1-commit-plan-2026-06-01.md`

---

## Test trajectory

- Pre-M1: 1765 passing baseline (per memory `account_inventory_rows` sprint trajectory).
- Post-M1: cluster touched 128–131 passing focused-suite tests in PRO/Coach/arena/profile/hub/shop suites (no regression detected). Pre-existing `localStorage.clear is not a function` flakes (use-display-name, hub-splash, sfx, use-save-score-state, use-is-pro-active) verified unchanged from HEAD pre-M1 — unrelated to cluster.

VR baselines: 39 total in `e2e/visual-regression.spec.ts-snapshots/`, 5 refreshed in commit `483bfcbb` (`hub-shop-sheet-open`, `vr9-arena-end-state-{checkmate,draw,resigned,stalemate}`), 34 passed unchanged.

---

## Cluster Closure Protocol checklist (per CLAUDE.md)

- [x] All M1 commits merged to main + pushed.
- [x] VR baselines refreshed + commit.
- [x] MiniPay smoke against preview confirmed.
- [x] Production promote executed.
- [ ] GitHub issues / milestone — N/A (cluster sin issue tracking previo, no aplica).
- [ ] README "What's live" — N/A (M1 no añade features public-facing nuevas, solo refina existentes; tagline + bullets actuales siguen siendo accurate).
- [x] MEMORY.md sync — entry added (`project_m1_monetization_cluster_complete`).
- [ ] Branch hygiene — single-branch flow (`main`), no feature branches to clean.
- [x] Handoff doc — este archivo.

---

## Quick post-promote sanity (manual)

After promote, validate on `https://chesscito.com`:

1. `/arena?fresh=1` → zero "Community prize pool" surface.
2. `/arena` post-loss → Coach Review primary "Vamos a ver qué pasó." + subtitle.
3. Hub → tap PRO chip → ProSheet con heading "Entrena con Luz todos los días.", perks ANTES de price, `$1.99 USD / 30 días` + `≈ 6 centavos al día`, CTA "Activar PRO".
4. Hub → Shop → Coach 20 hero FEATURED ★ + PRO segundo + Welcome + Coach 5 + Shield + ghost tail. Founder ausente.
5. Network tab: `/api/verify-pro`, `/api/coach/credits` respond 200.
6. Telemetry sink (if accessible): `monetization.*` events arriving.

**Status:** Cluster M1 LIVE en producción a partir de 2026-06-02.
