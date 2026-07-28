# Session Handoff — 2026-07-27 (noche)

> 📌 Detalle: `docs/handoffs/2026-07-27-leaders-weekly-spec-handoff.md`
> Sesión previa del día: `docs/handoffs/2026-07-27-score-write-path-handoff.md`
> Este archivo es el checklist.

## Completed

- **Smoke del write path: PASÓ en device.** Firmar una vez, cerrar MiniPay del todo,
  reabrir → ya no re-pide firma. El fix de persistencia (`87e35e35`) hizo lo que prometía.
- **Release de scores preparado hasta el paso 4** del proceso canónico
  (`docs/release/release-process.md`): `production` local fast-forwardeado a `87e35e35`.
  **Falta el paso 5 — el push es del founder.**
- **Suite verde con evidencia fresca**: 543 archivos / 6284 tests, EXIT=0.
- **Spec + red-team de Slice 2** (ventana weekly en Leaders) escritos:
  `docs/specs/2026-07-27-leaders-weekly-window{,-redteam}.md`.
  **Verdict: NEEDS REVISION** (2 P0, 5 P1, 5 P2).
- **P0-1 encontrado y verificado en código**: el weekly no puede medir "jugó esta semana"
  con `score_saves` como está → **Slice 3 pasa a ser precondición de Slice 2** (decisión
  del founder). Registrado en el header del spec para que no se re-descubra.
- **Tres pendientes del handoff previo, cerrados**: Ignored Build Step (funcionando), y
  el "Mini App Test" del prompt es del visor de MiniPay — no hay nada que corregir en el
  repo, no era pedido del founder.

## Current State

- **Branch**: `main`. `origin/main` en `87e35e35`; local adelantado por commits de docs.
- **`production`**: local en `87e35e35`, **sin pushear**. `origin/production` sigue en
  `4f16d6c1` → prod corre el código anterior, que funciona por compatibilidad hacia atrás.
- **Build**: passing. 6284 tests / 543 archivos, EXIT=0.
- **Uncommitted work**: no (los specs + este handoff se commitean al cierre).
- **DB**: migraciones ya aplicadas en Supabase. VERIFY 11/11. Nada nuevo esta sesión.

## Next Tasks

1. **`git push origin production`** — dispara el deploy de producción. Paso 5 de 6; el 6
   (`git checkout main`) ya está hecho. Ahí los jugadores reales empiezan a firmar.
2. **Spec de Slice 3 — identidad de intento.** Es ahora el camino crítico. Decisiones que
   el spec debe resolver ANTES de tocar código:
   - Cómo cambia `save_id` sin romper el dedup que hoy sostiene el `MAX(score)` del
     leaderboard (`api/scores/save/route.ts:191`).
   - **Retención**: el volumen pasa de acotado (≤ 6 × puntajes distintos) a uno por
     intento. Sin respuesta a esto, la tabla crece sin techo.
   - Qué campos entran: `attemptIndex`, `hintsUsed`, y si el tiempo ya guardado alcanza.
3. **Revisar Slice 2 sobre Slice 3.** La ventana UTC, el desempate, la asimetría
   off-chain y los estados de UI del spec **sobreviven**; cambia la fuente de filas.
4. **P2 abierto del backlog**: `offerBenefitTrainings` muestra "Special Trainings" sin
   traducir en ES (backlog §2).
5. **Theme Builder** sigue siendo el frente grande elegido, sin agenda.

## Blockers

- **Slice 2 está BLOQUEADO por Slice 3** (P0-1). No mandarlo a `/tdd`: sus 16 acceptance
  criteria pasarían en verde con la feature fallando su propósito.
- **R1 sigue abierto en el carril on-chain** — `/api/sign-score` firma lo que le pidan,
  `/api/cache-score` acepta `player` del body. Por eso el weekly se especificó
  off-chain-only. Cuesta gas: frena el abuso masivo, no lo cierra.

## Notes

- **Orden de deploy no negociable**: `SQL → VERIFY → push`. Rollback: `ROLLBACK.sql`
  **antes** de revertir código. Para Slice 2/3 no hay SQL pendiente todavía.
- **El fast-forward de `production` se hizo a `87e35e35`, no a `main` local**: los commits
  de docs no estaban en `origin/main`, y el proceso prohíbe deployar un commit que no pasó
  por `origin/main` primero.
- **`pnpm -C` NO existe en pnpm 8** (ni `--dir` acá): la suite se corre con
  `pnpm --filter web test`. El `-C` de CLAUDE.md falla con
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`.
- **zsh `noclobber` mordió otra vez**: `>` sobre un log existente falla y el comando **ni
  corre**, dejándote leer el archivo viejo. Usar un nombre de archivo nuevo por corrida.
