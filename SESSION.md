# Session Handoff — 2026-07-22

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed
- [ PR #221 — **MERGED** ] Vertical mínima de UX: la economía de Peones ya es visible y comprensible
  - Bus `chesscito:peones-changed` → las 4 instancias de `usePeonesBalance` convergen **sin React Query, sin provider, sin polling** (edge-triggered)
  - Dispatch tras earn/spend **confirmado**; el spend entra por `submitPeonesSpend`, punto único de los 3 sinks
  - Saldo visible en `/exercises`, en la fila del tray encima del tablero (Z2 — el header sigue Account-only, no revierte la spec §6)
  - Delta flotante `+1 Peón` / `−2 Peones · Hint`, **derivado del saldo real**
  - Precio del Hint visible antes de pagar (ribbon del Coach, leyendo la tabla canónica)
  - **Fix:** una pista sin `firstStep` ya no cobra 2 Peones por nada (pin muerto, sin spend)
  - Pack de 50: saldo nuevo + para qué sirven, sobre la celebración que ya existía
- Post-merge, a pedido del founder (4 commits directos a `main`):
  - `86195eb` **fix:** el saldo no se veía en LEARN — gate `!CHESSCITO_LITE_MODE` mal puesto (ver Notes)
  - `fe7dfae` ribbon de costo en el rescate por escudo — dejaba de narrar el precio **3 veces en palabras**
  - `563022b` Hint habilitado en LEARN
  - `13aaaaf` saldo visible durante el match de PLAY (chip junto al timer)

## Current State
- **Branch**: `main` (`13aaaaf`). La rama `feat/peones-economy-visibility` se mergeó con `--no-ff` y se borró en origin + local.
- **Build**: passing — **5585 tests / 493 archivos, exit 0**, 0 unhandled errors; `tsc --noEmit` limpio; ESLint limpio.
- **Uncommitted work**: no (solo este `SESSION.md`).
- **PRs abiertos**: ninguno.

## Next Tasks
1. **Consumibles en PLAY** (acordado, no agendado). El founder quiere el botón de **deshacer jugada**
   —existe pero no está habilitado— y otros consumibles. **Es diseño antes que código**: definir
   ¿cuántos undos por partida? ¿cuenta como derrota parcial? ¿se puede en la última jugada?
   La superficie ya está lista: el saldo es visible en el HUD del match.
2. **Regenerar baselines de VR** — tarea propia, con revisión visual humana (ver Blockers).
3. **Hint en el carril 2** (safe-path, promotion-run, queens, labyrinth) — vertical independiente:
   cada juego tiene su propia noción de "mejor jugada" y `computeExerciseBfs` no aplica. Hoy no lo montan.

## Blockers
- **La VR está roja en `main` desde ANTES de este trabajo.** `test:e2e:visual` da **17 passed / 34 failed**.
  Verificado haciendo checkout de `main` limpio: `hub-clean` difiere en **28073 px** y `terms-page` en
  **7106 px** sin ningún cambio mío. Los baselines `-darwin` están derivados en esta máquina.
  **No acepté ni regeneré ninguno** — hacerlo dentro de un cambio de economía habría horneado el drift
  previo. Diffs en `apps/web/e2e-results/artifacts/**`.

## Notes
- **Lección cara de esta sesión** (en memoria: `feedback_lite_mode_is_learn_not_a_stripped_variant`):
  `CHESSCITO_LITE_MODE` es literalmente `mode === "learn"` (`lib/feature-flags.ts:49`). Gatear con
  `!CHESSCITO_LITE_MODE` **esconde el feature del modo PRINCIPAL**, no de una variante recortada.
  Varios comentarios afirman *"no Peones surfaces in Lite"* — **es falso**: el Hub monta el chip sin
  gate, y LEARN gana Peones (Daily + hitos) y los gasta (rescate por escudo).
  La suite pasó **5585 en verde con el feature invisible en producción**; lo detectó el founder mirando
  la pantalla, no un test.
- **Invariante que sostiene el feedback de transacción:** el delta se **DERIVA del saldo que realmente
  se movió**, nunca de lo que el llamador dice que gastó. Por eso "nada en duplicados idempotentes" y
  "nada en errores" se cumplen **por construcción**, no por disciplina. NO cambiarlo a un payload con
  el monto: sería una segunda fuente de verdad que puede contradecir al ledger.
- **Convención de wallet, reconfirmada dos veces:** los componentes fotografiables (`ArenaHud`,
  `MissionPanelCandy`) **NO montan hooks de wagmi** — reciben el chip como slot desde el caller que sí
  está bajo `WagmiProvider`. Montarlo dentro de `ArenaHud` rompió 13 tests.
- **Costos:** los tres sinks leen `SPEND_COST_BY_TARGET` (coach 10, hint 2, shield 5). **Nunca pinear un
  precio en copy** — ya se descartó una clave `cost: "2"` por eso.
- **Lenguaje de costo del producto:** sprite + número en un ribbon de esquina, **sin frases**. No escribir
  "tiene un costo de X Peones": el usuario ya lee el ribbon como "esto se paga".
- Artefactos visuales 390px en `docs/handoffs/2026-07-21-peones-ux/` (regenerables con
  `e2e/peones-chip-capture.spec.ts`). Faltan capturas de 3 vistas **wallet-gated**: fila completa con los
  4 chips, pin de Hint con precio, y overlay del pack — el harness e2e no tiene mock de provider.
- Docs de la vertical: `docs/audits/2026-07-21-peones-ux-visibility-audit.md` y
  `docs/handoffs/2026-07-21-peones-economy-visibility-handoff.md`.
