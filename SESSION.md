# Session Handoff — 2026-07-27 (Focus Days ledger, Stage 0)

## Completed

- **Corregido un hecho falso del handoff anterior.** Decía que "Day X of 21" avanzaba por
  reloj de pared. No: `challengeDayFromExpiry` se calcula (`use-hub-data.ts:418`) y viaja en
  el prop `dayOfChallenge`, pero **ningún componente lo lee**. La tarjeta renderiza
  `done = min(streak, 21)` (`challenge-card.tsx:128,215`). El defecto real es que el número
  **retrocede**: `streak` vuelve a 1 al saltear un día (`progress.ts:75`).
- **Spec A escrito, red-teameado en dos rondas y APPROVED**:
  `docs/specs/2026-07-27-focus-days-ledger{,-redteam}.md`. 30 acceptance criteria, 3 P0 y
  6 P1 cerrados, 2 firmas del founder al pie.
- **Stage 0 implementado con TDD estricto** (rojo verificado antes de cada implementación):

  | commit | qué | tests |
  |---|---|---|
  | `d4cb953a` | spec + red team + backlog | — |
  | `c2967f57` | migración `focus_day_ledger` + `focus_ledger_init` | 6 |
  | `272f7784` | módulo puro `focus-days.ts` | 22 |
  | `a1551220` | `seasonId` canónico en el entitlement | 9 |
  | `18b5525c` | gate Redis → env → off | 8 |

- **Bug preexistente destapado y archivado** (`docs/backlog/2026-07-10-backlog-index.md` §8):
  `verify-payment` no congela el `season_id` en el payload de Redis.

## Current State

- **Branch**: `feat/focus-days-ledger`, 5 commits, **sin mergear a `main`**
- **Build**: suite **6011 passing / 529 files, EXIT=0, 0 `Unhandled Errors`**, `tsc` limpio
- **Uncommitted work**: ninguno, árbol limpio
- ⏳ **`main` local sigue 10 commits adelante de origin** (el nudge de la llama). El founder pushea.

## Next Tasks — Stage 1

1. **Wirear `configuredSeasonId` en `app/api/season-pass/status/route.ts` y arreglar el orden
   del spread.** Hoy `response()` hace `{...resolveEffectiveTrainingPass(), ...details}`, y
   `details` (per-rama: `route.ts:65` config vs `:122` fila) **pisa** al `seasonId` canónico.
   Hasta arreglarlo el campo sale `null` en producción — inerte, nada lo consume.
2. **`POST /api/focus-day`**: 5 reglas de validación de `date`, `source` `daily`/`daily_retry`,
   rate limit 10 req/wallet/10min en Redis, logging con `hashWallet()`.
3. **`ensureFocusLedgerInitialized`**: backfill lazy e idempotente desde el `GET /status`, con
   el contrato **ausente ≠ cero** (AC13/AC28) y **un solo INSERT multi-row** (AC29).
4. **Stage 2**: UI (`use-hub-data` + `ChallengeCard`), i18n en los dos locales, y borrado del
   código muerto (`challenge-day.ts`, su test, `dayOfChallenge` y sus 11 referencias).

## Cola anterior, TODAVÍA ABIERTA (no la toqué)

Del `SESSION.md` del 2026-07-27 (challenge-card + VR). Detalle en
`docs/handoffs/2026-07-27-challenge-card-and-vr-handoff.md`.

1. **Refactor `HubLiteScaffold` → `dailySlot: ReactNode`.** Bloquea lo demás: hoy el scaffold
   monta `HubDailyTile`, que llama `useAccount()`, así que un probe `/dev` de LEARN renderiza
   un error overlay.
2. `/dev/learn-hub` + `vr18-learn-hub-*`, espejando `/dev/play-hub`.
3. `hub-clean` → `exercises-clean` + `mask` sobre tablero y objetivo.
4. Regenerar `vr9`–`vr17` (~39 fotos) revisando una por una.

⚠️ El punto 1 **choca con Stage 2**: los dos tocan la ChallengeCard y su host. Decidir orden
antes de empezar el que venga segundo.

## Blockers

Ninguno. El spec está firmado y no quedan preguntas abiertas.

## Notes

- **El `/status` es la ruta más caliente del producto.** La firma acepta que consulte Supabase
  en cada carga del Hub con entitlement activo. Invariante que protege: **una caída del ledger
  degrada el progreso, nunca el acceso pagado.** Sin caché del contador todavía, a propósito.
  Medir antes de optimizar: p50/p95, hit rate de Redis, frecuencia de `degraded`, lecturas por
  usuario activo, errores por ruta.
- **El gate arranca en `off`.** Precedencia Redis → env → off. Valor corrupto en Redis cae al
  default seguro **y se reporta**; una caída de Redis se lee como "sin override", nunca como off.
- **El backfill confía en un `streak` de localStorage manipulable.** Riesgo aceptado y declarado:
  preserva continuidad de UX para quien ya pagó y **no concede valor económico**. Las filas van
  marcadas `backfill_streak` para que cualquier sistema futuro las excluya.
- **Guardrail de recompensas en el spec**: Spec A no define, promete, calcula ni distribuye
  rewards, y el ledger es señal de actividad, no prueba de elegibilidad. **No debilitarlo.**
- **Spec B (21-en-30) NO está escrito.** Ahí vive el cambio de término comercial y la migración
  de los pases vivos. Sin él "12 of 21" sigue siendo incompletable tras un salteo, pero ahora
  **visible** — que era el punto de Spec A.
- El test de PII de la migración strippea comentarios antes de escanear: la nota de diseño
  nombra legítimamente la PII que la tabla se niega a guardar.
- **CI NO corre Playwright** (jobs: `web-tests`, `type-check`, `asset-drift`, `contract-tests`).
  VR local necesita `BASE_URL=http://localhost:3002 PORT=3002` o sale el banner de origin mismatch.
