# Handoff — Chesscito Lite v1 SHIPPED

**Date:** 2026-06-21
**Branch/commit:** `main` = `production` = `e60cb62b`
**Status:** SHIPPED TO PRODUCTION ✅

---

## Qué se shippeó

### Fix bloqueante — Focus Passport + Content Loop refresh inmediato (`57e36d43`)

**Síntoma:** Después de completar Daily Focus, el Hub volvía correctamente pero
Focus Passport no mostraba la nueva llama y Content Loop no avanzaba hasta que
el usuario navegaba a Exercises y volvía.

**Root cause:** `HubScaffoldClient` leía `getDailyProgress()` de localStorage
solo una vez al mount (useEffect con deps vacíos). `HubDailyTile.handleSolve()`
escribía localStorage y actualizaba su estado local, pero no había mecanismo
para notificar al componente padre.

**Fix (patrón espejo de `shield-events.ts`):**
- `lib/daily/events.ts` — nuevo bus CustomEvent in-tab:
  `dispatchDailyProgressChanged()` / `subscribeToDailyProgressChanges()`
- `lib/daily/progress.ts` — `recordDailyCompletion()` despacha el evento
  después del write (o incluso si el write falla por quota/privacy mode)
- `hub-scaffold-client.tsx` — nuevo `useEffect` suscribe al evento y llama
  `setDailyProgress(getDailyProgress())`, re-derivando `focusPassport` y
  `contentLoopAction` inmediatamente

**Tests nuevos (4248/4248):**
- Focus Passport refleja llama color sin navegación
- Content Loop pasa de `daily-pending` a siguiente variante sin navegación

### Commits docs commiteados (`e60cb62b`)

- `docs/reviews/2026-06-18-celopedia-ecosystem-fit-and-grants-strategy.md`
- `docs/reviews/2026-06-19-lite-transactional-loop-audit.md`
- `docs/reviews/2026-06-21-lite-v1-release-qa.md`
- `docs/reviews/2026-06-21-score-rating-model-audit.md`
- `docs/specs/welcome-package-lite.md` + red-team
- `docs/specs/exercises-save-flow-simplification.md` + red-team

---

## Estado del repo post-ship

- `main` = `production` = `e60cb62b`
- tsc clean, 4248/4248 tests
- Sin commits pendientes, sin untracked relevantes

---

## Próximos pasos (en orden)

1. **Smoke manual Lite v1 en 390px / MiniPay** — confirmar:
   - Daily Focus → Focus Passport actualiza llama inmediatamente
   - Content Loop pasa a siguiente acción sin navegación
   - Full Mode sin regresiones (arena, coach, shop, leaderboard)

2. **Welcome Package / Claim Gift**
   - Spec: `docs/specs/welcome-package-lite.md`
   - Red-team: `docs/specs/welcome-package-lite-redteam.md`
   - Estado: `ready-for-tdd` — implementar tras aprobación founder

3. **Exercises Save Flow Simplification**
   - Spec: `docs/specs/exercises-save-flow-simplification.md`
   - Red-team: `docs/specs/exercises-save-flow-simplification-redteam.md`
   - Estado: revisado (P0 findings resueltos en spec) — implementar tras aprobación founder

4. **VR baseline refresh**
   - Pedestal pins + post-lab routing cambiaron el layout
   - Correr: `rm -rf .next && PORT=3947 pnpm dev` + `BASE_URL=http://localhost:3947 pnpm test:e2e:visual --update-snapshots`
   - Validar diffs antes de commitear

5. **Smoke post-lab end-state en 390px**
   - knight-lab-1 completo → Continue → knight-lab-2
   - Último lab completo → Continue → `PieceCompletePrompt`

---

## Open questions

- ¿Cuándo quiere Wolfcito arrancar Welcome Package? (spec y red-team listos)
- ¿El smoke Lite v1 pasa en MiniPay real o solo en Chrome DevTools 390px?
