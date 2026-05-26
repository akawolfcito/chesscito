# Handoff — Coach Demo Redesign + PRO Value-Prop V1 (2026-05-26)

**Owner:** Wolfcito · **Co-pilot:** Sally (UX) + Claude
**Session window:** 2026-05-26 (Sally discovery, no code touched)
**Branch:** `main` — **6 commits del 2026-05-25 todavía pendientes de push** (account refactor + vitrine HERO BAND). Esta sesión no agregó commits.
**Status:** Planning closed. Implementation pending.

---

## TL;DR

Sesión de discovery con Sally que arrancó como "¿dónde vive el Coach?" y terminó redefiniendo todo el value-prop de PRO. Tres specs cerrados:

1. **(b) Coach Free-Demo Redesign** — Reemplazar el stat-dump por análisis real de Ella con voz cálida (Escena 1), 3 calls free lifetime, contador siempre visible, paywall con cierre cálido, historial universal free re-read, packs x5/x20 surfaceados en SHOP.

2. **(a) PRO Value-Prop Matrix** — 4 frentes (visual polish / Coach AI / exercises depth / games catalog) con headline locked: **"Chesscito que crece con vos"**. V1 ship Coach + Visual polish; V2 Exercises; V3 Games; V4+ multiplayer/tournaments.

3. **Surface decision** — `<ProSheet>` existente como upsell hero, Coach CTA en post-game, `AccountSheet` row "Mi Coach" como re-entry. Dock se mantiene en 5 slots.

**Memoria nueva (2 hard rules):**
- `feedback_anti_ai_prose.md` — Coach + user-facing copy SIN em/en-dashes.
- `feedback_bundle_dont_defer.md` — adjacent 4-8h tasks van en el cluster actual, no a backlog.

---

## Discovery docs

| # | Doc | Cubre |
|---|---|---|
| b | `_bmad-output/planning-artifacts/coach-demo-redesign-discovery-2026-05-26.md` | Voz, trigger, anchor, paywall, packs, history |
| a | `_bmad-output/planning-artifacts/pro-value-prop-matrix-discovery-2026-05-26.md` | 4 frentes, headline, sequencing V1-V4 |
| c | `_bmad-output/planning-artifacts/surface-decision-coach-pro-2026-05-26.md` | Paths A/B/C resueltos |

---

## V1 Implementation cluster

Bundled into one feature branch (per `bundle-dont-defer` HARD RULE). ~3-4 días focused + on-chain admin coordination.

### Pre-work (audit)
1. Audit `editorial.ts` keys consumed por Coach voice — strip em/en-dashes (anti-AI prose pass).

### Coach demo redesign
2. Replace stat-dump en post-game screen con Coach CTA + contador.
3. Counter wired a `coach:credits:<wallet>` Redis key (ya existe).
4. Onboarding wrapper: first-game adaptive intro (3 templates EN + ES) en `editorial.ts`.
5. Paywall copy update a *"A con cierre cálido"* en `coach-paywall.tsx`.
6. History page CTA cuando free user tiene 0 calls.

### Packs en SHOP
7. Surface `COACH_PACK_ITEMS` en `SHOP_ITEMS` catalog en `shop-catalog.ts` (~4-6h, breakdown completo en doc b).
8. Art: 2 tiles (icon + bg) × triplet PNG/WebP/AVIF = 12 archivos. Usar `scripts/optimize-art-assets.sh`.
9. Wiring en `useShopSheetState`: branch para `COACH_PACK_ITEMS` → POST `/api/coach/verify-purchase` post-receipt.
10. On-chain admin (coordinación con admin wallet): `setItem(3, 50000, true)` + `setItem(4, 100000, true)` en Celo Mainnet.

### PRO Sheet hero update
11. Update `<ProSheet>` hero copy:
    - Headline: *"Chesscito que crece con vos"*
    - Subtitle: *"Mientras más jugás, más app desbloqueás."*
    - V1 bullets: *Análisis ilimitados con Ella* / *Avatares y board premium*
12. Echo del headline en Shop PRO tile + Coach paywall close.

### AccountSheet row
13. Add row *"Mi Coach"* en `AccountSheet` → routes a `/coach/history`.
14. Icon asset (triplet) para Coach en `apps/web/public/art/new-assets-chesscito/account/`.

### Visual polish foundation
15. Audit Arena, /pieces, /exercises, /play-hub para deltas free-vs-PRO visuales.
16. Ship 3 surfaces con variants PRO-distinct (prioridad TBD por audit).

### Tests
17. Update `shop-catalog.test.ts` + `use-shop-sheet-state.test.tsx` para nuevas entradas.
18. Nuevos tests: AccountSheet row + Coach CTA counter + paywall copy.
19. Full Vitest pass antes de commit. VR baseline pass si Polish surfaces tocan UI con baselines.

---

## Open items para próximas sesiones

| # | Item | Notes |
|---|---|---|
| 1 | Confirm V1 visual polish surfaces (top 3) | Audit pass con Sally co-piloto |
| 2 | Pack price revision | $0.05 / $0.10 puede estar bajo. Revisar antes de V2. |
| 3 | V2 Exercises depth — content design | 3-4 variants por grupo de movimiento. Sally + pedagogy. |
| 4 | Future: Coach call exit affordances | Share analysis, replay position, "pedile otra cosa". Out of scope V1. |
| 5 | Future: personality variants (Escena 2 técnica, Escena 3 sócratica) | PRO setting unlock o tier superior. Out of scope V1. |

---

## Next session — start here

1. Read este handoff.
2. Read los 3 discovery docs en orden: b → a → c.
3. Después, decidir:
   - **Implementar V1** — picar un sub-cluster (Coach demo / Packs SHOP / Visual polish) y ejecutar con TDD discipline.
   - **Visual polish audit** — Sally co-pilot para identificar los 3 V1 targets.

**Recordatorio:** los 6 commits del 2026-05-25 siguen pendientes de push manual a `origin/main`.
