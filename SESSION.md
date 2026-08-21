# Session Handoff — 2026-08-21

## Completed

Todo mergeado y **pusheado** a `origin/main` (`37b8ba20`). Sin PRs abiertos.

- **Top-up flexible de Peones** — 5…100 de a 5 a $0,01/Peón, carril **legacy
  únicamente**. `PEONES_PACKS` se genera desde cuatro constantes;
  `peones_pack_50` se reproduce byte a byte. Hoja con stepper `[−] $0,25 [+]`,
  trabado mientras hay transferencia en vuelo.
  → `docs/audits/2026-08-20-flexible-peones-topup-implementation.md`
- **Cola personal de mini-juegos + Biblioteca + separación final de Exercises**
  — `rotation.ts` eliminado; `?featured=<rotationId>` → `?from=featured|library`;
  `/minigames`; LEARN dejó de dibujar filas lane-2.
  → `docs/audits/2026-08-21-minigames-personal-queue-library-separation.md`
- **Cuota diaria personal (3 por ventana UTC) + fila de estado compacta** —
  `[ VIEW ALL ] n/3 today · 18h`; el total del catálogo salió del Home; la
  Biblioteca agrupa por disponibilidad y **no puede saltear la ventana**; el pin
  "Enter Labyrinth" oculto en LEARN (abría un 4.º desafío esquivando la cuota).
  → `docs/audits/2026-08-21-minigames-personal-daily-allowance.md`
- **Atribución Celo ERC-8021** — `@celo/attribution-tags` vía `dataSuffix` en 8
  familias de escritura / 4 fronteras compartidas. **Verificado on-chain** con tu
  pago de $0,05. ⛔ El canary va **sin atribuir a propósito**.
  → `docs/audits/2026-08-21-celo-erc8021-attribution-implementation.md`
- **Review de herramientas de ops + fix** — la password viajaba en el argv de
  `docker run` en **6** scripts que prometían lo contrario. Cerrado con
  `scripts/ops/lib/child-env.ts` + guard.
  → `docs/reviews/2026-08-21-ops-tooling-review.md`

## Current State

- **Branch**: `main` (= `origin/main`, `37b8ba20`)
- **Build**: passing — `tsc` limpio · suite **713 archivos / 9045 passed / 1 todo**
  (161 s) · VR **68/68** con `--update-snapshots=none` (82 baselines, ninguna
  tocada) · smoke dirigido **11/11** contra build de producción LEARN
- **Uncommitted work**: no — árbol limpio

## Next Tasks

1. **Verificar los deploys visualmente** (LEARN, PLAY y LANDING). LANDING es un
   rebuild no-op: se dispara por el `package.json` de la raíz, no por código
   suyo. Es tuyo, no mío (CLAUDE.md).
2. **Ventana de medición de 5 días** — es para lo que existe la cuota diaria.
   Pregunta: *¿un jugador que agotó su cuota vuelve a buscar más el mismo día?*
   La responde `minigames_library_open` (`window_id`, `completed_today`,
   `slots`, `upcoming`); el resto sale de `minigame_start` /
   `labyrinth_complete` filtrando `previous_best is null`.
3. **Decidir el truncado de títulos en la baldosa de 50px.** La mayoría de los
   títulos reales se cortan a ~10 caracteres ("Turn to the Star", "The Knight
   Sees", "The Quiet Room"). Vino del cambio de nombre de baldosa aprobado sin
   foto; la geometría está sana. Arreglarlo es títulos más cortos o baldosa más
   alta: decisión de producto.
4. **Expandir el pool de 13 → 18+.** Verificado el 2026-08-21: **no necesita
   cambios de código** — ningún `13` del código de mini-juegos es un valor, son
   todos comentarios; todo deriva de `resolveChallengePool(pools)`, y un jugador
   con asignación guardada no necesita migración.
   ⚠️ **Pero primero decidí la SECUENCIA**: a 3 por ventana, 13 desafíos duran
   justo los ~5 días de la medición (tarea 2). Expandir antes cambia lo que se
   está midiendo a mitad de vuelo, y después no se puede distinguir si el límite
   era la cuota o era el contenido. **Recomendado: medir primero, expandir con
   el dato.**
   Dos caminos, con costos muy distintos:
   - **(a) autorar niveles** para los 4 motores sanos → ⛔ medir ANTES si
     `20260811150000_content_overlay_sweeps.sql` está aplicada en prod, o
     **todo guardado del builder da 500**;
   - **(b) graduar `knight-tour` / `promotion-run`** → ya tienen 3 desafíos cada
     uno (16 ó 19 sin escribir nada), pero su `coming-soon` es un veredicto de
     **grading**: knight-tour es `starless` (una carta completada no tendría
     puntaje) y `optimalMoves` no gradúa promotion-run. Flipear el status sin
     arreglar eso manda cartas que no pueden mostrar resultado.
   Menores al expandir: `entitlement-free.test.ts` va a exigir que los nuevos
   tampoco lleven `access` (a propósito), y la tabla de retención del header de
   `catalog.ts` queda vieja. **El VR no se mueve** (el fixture usa cartas
   literales).
5. **Aceleración con Peones** — sólo diseñado, nada implementado.
   `resolveConsumptionPolicy` ya es la costura; el badge (`[♙] 5`, esquina
   superior derecha del grupo, sólo en 3/3) está especificado y **oculto**.

## Blockers

- **Ninguno para el código.**
- ⚠️ Máquina: `ANECompilerService.xpc` estuvo 3h46m al 99% de CPU y **tiró tres
  corridas de suite** (705/709/708 archivos contra 712, con `Failed to start
  forks worker`). Ya se calmó. Si vuelve: el conteo de ARCHIVOS es lo que lo
  delata, no el de tests.

## Notes

- ⛔ **El canary de Get Peones no lleva atribución, y no es un olvido.**
  `verifyCanaryTransaction` compara el calldata con igualdad estricta; un sufijo
  lo haría rechazar **después** de que la plata se movió — pagado y no
  acreditado. Es opt-in por env y cubre sólo `peones_pack_50`.
- ⚠️ `NEXT_PUBLIC_*` se inlinea en **build time**: tras cambiar el tag hay que
  rebuildear; un server levantado no lo ve.
- ⚠️ El formato que ilustra `BUILDERS.md` (`celo_`+8 hex) es **más angosto** que
  lo que Celo emite. El primer guard anti-fuga usó el ejemplo de la guía y era
  ciego al código real.
- ⚠️ `pnpm theme:coverage` **escribe** aunque le pases `--check` — el
  `writeFileSync` no está detrás del flag.
- ⚠️ Los tests de `scripts/ops/**` corren dentro de la suite de `apps/web` (el
  `include` los trae desde la raíz): 15 archivos / 453 tests.
- ⚠️ Antes de correr el VR: bajá tu dev server. `reuseExistingServer` adopta el
  tuyo y no recibe los pines de `webServer.env`.
