# Session Handoff — 2026-08-19

## Completed

**Todo el trabajo está SIN COMMITEAR.** Cero commits esta sesión, cero push, cero deploy.

- **Spec de producto + evidencia de producción** — `docs/specs/2026-08-19-learn-minigames-peones-economy.md`.
  Hallazgo que reencuadró todo: **los minijuegos NO son impopulares** — los juega el
  77–97% de quien llega a la pieza. El muro es el **claim on-chain de insignia**
  (777 cuentas con ≥1 ejercicio de torre → 107 llegan al gate → **97** tocan alfil).
- **SLICE A+B implementado** — separación Exercises / Mini-games, superficie Early
  Access gratis, rotación destacada. `docs/specs/2026-08-19-learn-ia-minigames-early-access-implementation.md`.
- **Audit del smoke** — `docs/audits/2026-08-19-learn-minigames-smoke-remediation-audit.md`.
  El routing destacado resultó **correcto**; el bug era el post-completion.
- **Remediación aplicada** — `docs/audits/2026-08-19-learn-minigames-smoke-remediation-implementation.md`.

## Current State

- **Branch**: `main` @ `9ff0434f`
- **Build**: passing — **703 archivos / 8732 tests + 1 todo, EXIT 0** (183 s).
  `tsc` limpio. VR **67/67** con `--update-snapshots=none`.
  Baseline propio medido en árbol limpio al empezar: **694 / 8607**.
- **Uncommitted work**: **SÍ — 32 rutas.** 11 archivos/dirs nuevos (`src/lib/minigames/`,
  `minigames-section.tsx`, `minigames-slot.tsx`, 3 tests, `e2e/learn-hub-viewport.spec.ts`,
  4 docs) + 17 modificados + 4 baselines VR regrabadas a propósito.
- ⚠️ **`origin/main` sigue 4 commits DETRÁS de `origin/production`** (`d9eb9aec` vs
  `9ff0434f`). Sigue pendiente desde la sesión anterior.

## Next Tasks

1. **Smoke manual de los 4 flujos** antes de commitear. Checklist completo en
   `docs/audits/2026-08-19-learn-minigames-smoke-remediation-implementation.md`
   §MANUAL SMOKE CHECKLIST (A: featured → Continue → Learn Home; A2: la X;
   B: replay; C: regresión de Exercises; D: 360×640).
2. **Commitear en atómicos** (nada está commiteado). Corte sugerido:
   (a) `lib/minigames/*` + tests · (b) superficie hub + CSS + i18n ·
   (c) separación IA del drawer + quita del auto-advance · (d) deep link `?content=` ·
   (e) límite de completion + `completionOriginRef` · (f) docs.
3. **`git push origin main`** — dejar el remoto consistente (urgente, viene de antes).
4. **Correr `pnpm ops:no-token` cada día.** Iba en 35 de ~200 intentos; umbral estimado
   alrededor del **2026-08-28**.
5. **Decidir la bajada de Supabase Pro → Free** — runbook listo en
   `docs/runbooks/2026-08-18-supabase-free-downgrade-readiness.md`. Vale $20/mes.

## Blockers

- **Ninguno bloqueante.** Dos deudas registradas, ninguna en el camino crítico:
  - **Carrera de hidratación preexistente**: un `?content=` pelado se pierde si el
    jugador tiene progreso guardado (el efecto de restore consume el request antes de
    hidratar y no reintenta). **No afecta la superficie de Mini-games** — verificado:
    con `featured` sí abre. Registrada como `it.todo` en `featured-minigame-open.test.tsx`.
  - **Opción C del viewport** (detalle del Season Pass detrás de su CTA, ~28 px):
    disponible y es una deduplicación real de copy, pero toca 4 tests y la lista de
    beneficios. Decisión de producto, no parte de un arreglo de 14 px.

## Notes

- ⛔ **Antes de correr VR o Vitest: revisá que no haya server huérfano en 3002.**
  Esta sesión un `next-server` de 2 h que `reuseExistingServer` adoptó **sin los pins
  de `webServer.env`** produjo **12 rojas** incluyendo `about`/`terms`/`privacy` —
  páginas sin código en común. El `error-context.md` mostró que renderizaban el
  **gate de acceso web**. Bajándolo: 63 pasan y las 4 rojas eran las mías.
  `lsof -nP -iTCP:3002 -sTCP:LISTEN` antes de empezar.
- ⛔ **El fixture `/dev/learn-hub` fotografía sólo lo que le pasás.** La sección de
  Mini-games tenía **cero cobertura VR** hasta que la cablé ahí. `hub-clean` NO
  fotografía Learn Home — navega a `/exercises`.
- ⚠️ **`ThemeAssetPicture` necesita `pictureClassName` Y `className`.** Con sólo el
  primero el `<img>` conserva su tamaño natural y desborda: el título quedaba encima
  del sprite. Lo atrapó mirar el PNG, ningún test.
- ⚠️ **`markMilestonesSeeded()` no alcanza en tests**: sella el marcador sin persistir
  el set celebrado, así que la cola igual emite y tapa el tablero. Usar
  `seedMilestonesOnce(...)`. Y `giftAvailable` está **hardcodeado** a `CHESSCITO_LITE_MODE`
  (`exercises-screen.tsx:1413`), no lee el welcome-package.
- ⚠️ **En el overlay de fin de laberinto, la X y el CTA primario comparten nombre
  accesible** (`closeLabel={t("continue")}`). Seleccionar por nombre mezcla los dos.
- ⛔ **No encojas `.challenge-card-icon` para ganar alto**: se probó y da **0 px**.
  La altura de `challenge-card-top` (98 px) la fija la columna de texto, no el sprite (72 px).
- ⚠️ **En `IDENTICAL_TOKENS` del guard de traducción, el orden importa**: `PRO` muerde
  `PRO`motion Run. Los nombres de minijuegos van **arriba** de `"PRO"`.
- **Rotación**: 13 challenges sanas → **4 rotaciones** sin repetir. A cadencia quincenal,
  contenido nuevo hace falta **~2026-10-14**. Cambiar rotación = editar `ACTIVE_ROTATION_ID`.
- **Monetización de minijuegos: DIFERIDA.** El seam es `resolveMiniGamesAccess(rotation, player)`
  y hoy devuelve gratis para todos. ⛔ Balance mediano de Peones en prod = **1**; sólo
  **48 de 6.477** wallets tienen ≥5. H2 es casi intestable hasta que exista el top-up.
- **P2P sigue FROZEN.** `private/archive/` y `private/backups/` gitignoreados, no commitear.
