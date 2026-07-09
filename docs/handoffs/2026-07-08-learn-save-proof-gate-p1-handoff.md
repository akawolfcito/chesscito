# Handoff — P1: LEARN "Save proof" gate decoupled from B2 auto-save (2026-07-08)

## TL;DR
El CTA dorado on-chain "Save proof" de LEARN estaba gateado por `scorePendingNew`,
el mismo flag que consume el auto-save off-chain silencioso de MiniPay Lote 2 (B2).
Apenas resolvía el POST del auto-save el gate se cerraba y el CTA desaparecía →
prácticamente inalcanzable en el happy path. **FIXED y mergeado a `main`**
(PR #183, merge commit `1a181d20`). Falta **smoke on-device** — no hay cobertura
automatizada del cableado.

## Completado
- [PR #183] `fix(learn): decouple on-chain Save proof CTA from off-chain auto-save gate`
  - Nuevo módulo puro `apps/web/src/lib/exercises/save-proof-state.ts`
    (precedente: `tx-toast-state.ts`).
  - 13 tests nuevos en `__tests__/save-proof-state.test.ts` (TDD rojo → verde).
  - Cableado en `exercises-screen.tsx` (import + derivación ~L1055 + prop L2308).

### El fix, en una línea
Gatear por la **ausencia de un receipt real**, no por el estado del save off-chain.
`useSaveScoreState` ya distinguía los dos caminos: el save off-chain persiste
`lastSavedTxHash` **vacío** (`exercises-screen.tsx:1674`), `submitScoreSigned`
persiste el hash real (`:1085`). Sin flag nuevo, sin round-trip al server.

```
hasOnchainProof = txHash no vacío && lastSavedScore >= localScore
canSaveOnChain  = canSaveScore && hasScoreboard && totalStars >= 1
                  && localScore > 0 && !hasOnchainProof
```

### Lote 2 intacto
No se tocaron el auto-save, `contextActionState.scorePending` ni el prop
`canSaveScore` del sheet. `handleSaveScoreOnChain` (`:1774`) ya se gateaba con
`canSaveScore` y no con `scorePendingNew`, así que funciona en paridad sin cambios.

## Estado actual
- **Branch**: `main` (sincronizado con origin; rama del fix borrada en el merge).
- **Build**: typecheck `tsc --noEmit` limpio.
- **Tests**: 4707 passing / 391 files.
- **VR**: 51 passed, **1 failed** → ver Blockers.
- **Uncommitted**: solo los dos handoff docs (este + el de permit/tx-map).
- **PRs abiertos**: ninguno.
- **Deploy**: Preview `chesscito-pjpyevcsh-goodwolf.vercel.app` = commit `1a181d20`,
  status success (GitHub deployment `5369130572`). Founder valida/deploya si hace falta.

## Próximas tareas
1. **Smoke on-device del CTA dorado** (ver script abajo). Es la única validación
   real del fix — nivel 3 sin cobertura.
2. Smokes on-chain pendientes de la sesión previa (sin PRO, sin Season Pass):
   PLAY win-save vía permit; LEARN Claim Badge / Save Score on-chain / Get Peones /
   Shop-Shield. Ver `2026-07-08-permit-preview-activation-and-tx-smoke-map-handoff.md`.
3. **Lote 2.5** — Tactical Day Gift + Proof of Consistency
   (`docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`).
4. Backlog LEARN/PLAY items 1–11 + PLAY dock 4-slot
   (`docs/backlog/2026-07-08-lote2-smoke-findings-learn-play-backlog.md`).

## Script de smoke (Preview, MiniPay, wallet en Celo mainnet)
1. Resolver un ejercicio hasta ganar ≥1 estrella y un score **nuevo** (mayor al
   anterior de esa pieza).
2. **Esperar a ver "✓ Score saved"** en el mission sheet. Esto valida la prueba:
   garantiza que el auto-save ya cerró la ventana del POST donde el CTA aparecía
   por accidente antes del fix.
3. **Assertion:** el bloque dorado "Save today's training proof" + botón
   "Save proof" visible **debajo** del "✓ Score saved". Pre-fix: no había nada.
4. Tap → MiniPay firma → tx gas-only `submitScoreSigned` al Scoreboard
   `0x1681aAA1`. En Celoscan: sin transfer ERC-20 más allá del gas.
5. Confirmado el receipt: el CTA **desaparece**, "✓ Score saved" queda. Cerrar y
   reabrir el sheet → no reaparece.
6. Superar ese score → el CTA **vuelve** a armarse.

**Control diferencial:** Producción todavía corre el código viejo. Mismos pasos allá
→ el CTA no aparece en el paso 3. Aísla que el cambio es la causa, no el ambiente.

## Blockers
- **Ninguno para el fix.**
- **VR stale baseline (preexistente, NO de este PR)**: `hub-shop-sheet-open` falla
  en `main`. Confirmado corriendo el test con el cambio stasheado. El baseline
  espera Coach Credits + PRO $1.99 + Streak Shield $0.03; la app hoy renderiza PRO
  "Coming soon" y ninguno de esos tiles. Es drift de varios commits. **No refrescado
  a propósito**: hornear el estado actual del Shop es una decisión de producto, no
  un chore. Requiere confirmación del founder antes de `--update-snapshots`.

## Open questions
- **Nivel 3 sin cobertura**: no existe `exercises-screen.test.tsx`. Los 13 tests
  cubren la función pura y `mission-detail-sheet.test.tsx:160-182` cubre el render
  dado el prop — pero **nadie testea qué se le pasa al prop**, que es exactamente
  donde vivía el bug. Founder eligió "solo smoke on-device" (2026-07-08); si la
  regresión reaparece en un refactor futuro, considerar el test de cableado.
- **Caveat cross-device (aceptado)**: el save state es localStorage por device, así
  que un device nuevo re-arma el CTA aunque el score ya esté en el Scoreboard.
  Re-probar cuesta gas, es inofensivo. Reconciliación vía
  `leaderboard_full_v.has_onchain` queda fuera de scope.

## Notas
- Founder dejó una PK de pruebas sin fondos en dotenv local (`ONLY_TEST_NO_FUNDS_PK`).
  No se usó ni se leyó en esta sesión. Confirmado que ese archivo está ignorado por
  git (patrón sin slash en `.gitignore:15` → matchea en cualquier nivel).
- Memoria actualizada: `project_learn_save_proof_gate_regression` marcada RESOLVED;
  índice `MEMORY.md` refleja P1 cerrado + nota del baseline stale.

Wolfcito 🐾 @akawolfcito
