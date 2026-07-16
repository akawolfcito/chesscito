# Session Handoff — 2026-07-16

> Decí **"continuemos"** y el agente lee este archivo y sigue.

## Completed

- **N-Queens — el juego firma de la dama, end to end** (merge `2d42d53b`, 13 commits atómicos).
  Módulo puro con **techo EXACTO por solver** · catálogo · 3 niveles · board · host · i18n EN/ES ·
  probe `/dev/queens` · e2e 12/12. **Detalle: `docs/handoffs/2026-07-16-n-queens-handoff.md`.**
- **Regla del founder**: los bloques **rompen los rayos** → `queens-3` mete **9 damas** en un 8×8
  que solo admite 8. El e2e lo asegura de punta a punta.
- **3 bugs preexistentes arreglados de paso**: el unlock decía "Guide the rook" a **5 de 6 piezas**;
  el chip enmarcaba juegos de cobertura con "Move to" (el tour decía "Move to Cover 80%"); el ruteo
  i18n del drawer no tenía tests (extraído a `lib/content/special-training-labels.ts` con guardián).
- **Review del founder aplicada**: sin puntos de casillas seguras (eran la respuesta, no una pista),
  sin peaje de selección, chip contador + banda con el objetivo.

## Current State

- **Branch**: `main`, sincronizado con `origin/main`. Sin PRs abiertos, árbol limpio.
- **Build**: vitest **5212/5212 (444 files)** · `tsc --noEmit` limpio · e2e queens **12/12**
  (`--project=minipay`).

## Next Tasks

1. **Niveles de queens**: los 3 son andamio (construidos para medir, se ven literales). El founder
   los afina en `/dev/labyrinth-builder`. **No requiere código** — el techo se recalcula solo.
2. **Overlay TRY AGAIN + feedback al fallar, para TODAS las piezas** (founder, 2026-07-16): un beat
   corto + el objetivo en una línea. Capa sobre la mecánica, no la mecánica.
3. **Safe Path (rey) + Promotion Run (peón)** — spec §3/§4. **JUNTOS, nunca separados**: comparten
   la cirugía `{pos, piece}` + capa de ataque (plan §15.6.3). **No son los baratos.**
4. **Cluster closure de N-Queens**: issues/milestone, README sync, MEMORY.md sync.

## Blockers

- **Maestría de la dama**: quien completó `queen-lab-1..3` y reclamó el badge **pierde la maestría**
  (el pool ahora exige `queens-1..3`). Mismo caso que alfil y caballo. **Decisión del founder.**
- **`contextual-header.spec.ts` falla 6/6 — PREEXISTENTE**, no es regresión.
- **VR `hub-shop-sheet-open` roja también en `main`** (env sin treasury). No perseguir.
- ⚠️ **`hub-clean` VR pasa cambios sin verlos** (`maxDiffPixelRatio: 0.005` ≈ 12k píxeles).

## Notes

- ⚠️ **El patrón del hermano es un mal default — leer el spec primero.** Tres veces esta sesión el
  spec decía una cosa y se implementó el patrón del Knight's Tour: los puntos de casillas seguras,
  el chip ("counter chip" era literal), y la puerta de selección ("mini-tour" era un momento
  instructivo, no un peaje). El founder cazó las tres.
- ⚠️ **Techo exacto vs cota superior**: el de queens es exacto (backtracking) → sus niveles NO
  necesitan filtro como los del tour. **Derivar N del solver, jamás autorearlo**: medir salvó un
  nivel 6×6 cuyo techo real era 5 (ninguna solución 6×6 tiene dama en esquina).
  → [[feedback_reachable_is_not_achievable]]
- ⚠️ **`getRookMoves` corta el rayo ANTES del bloqueador** (modela piezas propias). Para "¿está
  atacada esta casilla?" hay que pasar **solo los bloques**, nunca las otras damas.
- 📌 **Los deploys los verifica el founder, visualmente. NO hacerlo por iniciativa propia** →
  `CLAUDE.md` §"Verificación de deploys".
- 📌 **El carril 2 es UN JUEGO por pieza.** El juego firma REEMPLAZA los laberintos crudos de su
  pieza en el carril (`specialTrainingCatalog`); los `*-lab-N` sin título quedan en contenido, sin
  seleccionar. → [[project_signature_games_per_piece]]
- ⚠️ **Metacaracteres de zsh en `git commit -m`** (`?? []`, backticks) mutilan el mensaje en
  silencio. Usar `git commit -F <archivo>`.
- ⚠️ **`git checkout -- <archivo>` se lleva TODO lo no commiteado de ese archivo** — no sirve para
  revertir una mutación puntual.
- **Deuda**: el probe de Diagonal Run forkeó el board en un spike copiado
  (`components/dev/diagonal-run-spike.tsx`). Los probes del tour y de queens renderizan el board REAL.
- **Deuda**: 4 duplicados de ejercicios (`docs/audits/2026-07-16-exercise-redundancy-audit.md`).
- Regenerar catálogo: `pnpm -C apps/web import-puzzles`; después `rm -rf apps/web/.next`.
  Regenerarlo **NO** invalida el `unstable_cache` tag `"content"`; un build fresco sí.
- El founder pule niveles en `/dev/labyrinth-builder`. **Construir la mecánica, no perfeccionar niveles.**
