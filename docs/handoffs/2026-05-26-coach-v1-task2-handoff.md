# Handoff — Coach V1 Cluster A1 · Tasks 2/3/4 Closed (2026-05-26)

**Owner:** Wolfcito · **Co-pilot:** Claude
**Branch:** `main` — **12 commits sin push** (range `b15b90f8..b3e30a09`).
**Status:** Tasks 2, 3, 4 + pre-work cerrados. Tasks 5 + 6 quedan abiertos. Baseline tests 1971 → 2022.

---

## TL;DR

El post-game Coach está redibujado end-to-end:

1. **Persona renamed** Ella → Luz (en código + docs + auto-memory). `Luz` ("light") encarna mejor el "te muestro lo que no viste" del Coach.
2. **Anti-AI prose pass** sobre Coach scope: editorial.ts + es.ts + en.ts mirror + LLM prompt template — todos los em/en-dashes limpios.
3. **Counter visibility wired**: el CoachPreviewCard ahora muestra `"Ask Luz for your analysis (N free left)"` cuando hay créditos, `"... (need PRO or a pack)"` cuando se agotaron. PRO branch sin contador.
4. **Free user fix crítico**: el tap del CTA YA NO empuja a free users con créditos al ProSheet — ahora va directo a `handleAskCoach`. Solo cuando credits === 0 abre el paywall.
5. **First-call onboarding**: nuevo `<LuzOnboardingPanel>` reemplaza el legacy `<CoachWelcome>`. Lee el outcome del game (`win`/`lose`/`draw`) y muestra la intro empática + 2 CTAs ("Sí, mostrame" / "Ahora no"). Decline = soft dismiss (no persiste el welcome flag → Luz saluda de nuevo la próxima partida).
6. **`useCoachCredits` hook** disponible para cold-start cache (5-min TTL, localStorage). Aún NO adoptado en arena/page.tsx — el state local existente sigue funcionando; el hook lo usaremos cuando el LuzOnboardingPanel necesite credits sin esperar al fetch del page.

---

## Commits (12, en order)

| # | SHA | Scope |
|---|---|---|
| 1 | `b15b90f8` | chore(coach): strip em-dashes from editorial Coach copy |
| 2 | `a686032f` | chore(coach): strip em-dashes from LLM prompt template |
| 3 | `e31387d2` | chore(coach): strip missed em-dash in ES mirror |
| 4 | `5a09ee27` | feat(coach): add first-call onboarding intros (EN + ES) |
| 5 | `b60d20dc` | refactor(coach): rename persona Ella → Luz |
| 6 | `a8ecc3db` | feat(coach): useCoachCredits hook wired to /api/coach/credits |
| 7 | `0fe32a63` | chore(coach): sync en.ts ICU mirror with editorial em-dash strip |
| 8 | `6551ebfc` | feat(coach): add COACH_CTA_COPY for counter-aware post-game CTA |
| 9 | `66716528` | feat(coach): outcome resolver for Luz onboarding intro selection |
| 10 | `6dbe9cc4` | feat(coach): rewrite CoachPreviewCard with counter-aware Luz CTA |
| 11 | `2cc77e47` | feat(coach): LuzOnboardingPanel replaces CoachWelcome in welcome slot |
| 12 | `b3e30a09` | feat(coach): route free users with credits to Luz, not paywall |

---

## Decisions cerradas

- **Luz** sobre Kira (warm vs branded; aligned with "te muestro").
- **Decline = soft** (option C): no persiste welcome flag. "Ahora no" → "después sí".
- **Hook deferred**: `useCoachCredits` quedó shipped pero NO adoptado en arena/page.tsx; el state local existente cubre runtime. Se adopta cuando LuzOnboardingPanel necesite credits cold-start.
- **Editorial keys legacy**: `welcomeTitle/welcomeSub/welcomePack/welcomePackDetail/claimFree/welcomeNote` quedaron en editorial + en.ts/es.ts como dead copy. Cleanup safe, no riesgo.

---

## Tareas abiertas del cluster A1

| Task | Scope | Estimación |
|---|---|---|
| **5** | Paywall copy update "A con cierre cálido" en `coach-paywall.tsx`. Sample del discovery: *"Vi tu partida. Pero ya gastaste tus 3 análisis gratis. Yo sigo acá. Cuando quieras que conversemos más, sumá PRO."* | 1-2 commits |
| **6** | `/coach/history` page CTA cuando free user tiene 0 calls → *"Pedile a Luz tu próximo análisis"* → abre paywall. | 1 commit |
| **A2 cluster** | Packs en SHOP (catalog + UI + on-chain admin setItem 3/4). Bloqueo: admin wallet on-chain coordination. | 4-6h + async |
| **A3 cluster** | PRO Sheet hero update con headline locked ("Chesscito que crece con vos") + AccountSheet row "Mi Coach". | 2-3 commits |
| **A4 cluster** | Visual polish foundation — audit Sally co-piloto + 3 surfaces con PRO variants. | TBD |

---

## Open follow-ups (low priority)

1. **Editorial dead copy cleanup**: dropear `welcomeTitle/Sub/Pack/...` y `claimFree`/`welcomeNote` cuando se haga el siguiente content audit. Sin urgencia.
2. **Adopt `useCoachCredits` en arena/page.tsx**: reemplazar el state local + manual fetch por el hook. Beneficio: localStorage cache + write-through. Sólo cuando se justifique por la UX (cold start lento en MiniPay).
3. **Per-wallet welcome flag**: hoy `chesscito:coach-welcomed` es per-device. Si la misma persona conecta otra wallet, Luz NO saluda. Decisión deferred — discovery no pidió explícito. Si quieres, key by `:<wallet>` en una sesión futura.

---

## Próxima sesión — arrancar acá

1. Lee este handoff.
2. `git log origin/main..main` para confirmar 12 commits aún sin push.
3. Decisión:
   - **Push primero** (recomendado si el estado actual ya se validó en MiniPay manual).
   - **Seguir con Task 5** (paywall cierre cálido) en local, después push en bloque.
4. Si Task 5: leer `coach-paywall.tsx` actual + comparar con el sample del discovery `(b)` §5.

---

## Test trajectory

```
Pre-session:   1971 / 0 failing (post Ella commit, 5a09ee27)
After 2E:      2022 / 0 failing
Net new tests: +51 across 6 new files
```

Type-check clean. VR baselines no afectados (no UI hover sobre baselines existentes; el LuzOnboardingPanel es nuevo surface sin VR yet).
