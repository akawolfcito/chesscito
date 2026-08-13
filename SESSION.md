# Session Handoff — 2026-08-13

## Completed
- **Star Sweep de punta a punta** — el builder autora 1–3 estrellas sin tocar JSON, el runtime
  del laberinto es sweep-aware (Etapa 0, `09d406af`), y `gradeLabyrinthRun` unificó los TRES
  sitios que graduaban laberintos por su cuenta.
- **Migración aplicada a producción** — `content_overlay` 14 → 16 columnas, 32 filas intactas.
- **Contenido: 49 de 79 tableros piden varias estrellas** (`ba002e9d`, `c6d40dc0`) — caballo
  9/10, dama 9/10, rey 9/10, torre 8/10, alfil 7/10; laberintos de torre 4/4, alfil 2/2, rey 1/1.
  El peón queda en 0 por diseño.
- **README alineado** (`8462cca8`) — las dos escalas de estrellas, 60 ejercicios, alfil 10.
- **Riesgo de `sign-badge` ACEPTADO** (`f0c9c5dc`) con la razón del founder y su disparador.
- **Landing** (`9dad8b2c`) — la slide dejaba fuera el 43% del arte en desktop.
- **Medición `/dev` + backlog de las tres siguientes** (`ffe3614b`).
- **Seis defectos encontrados USÁNDOLO**, ninguno visto por un test.

## Current State
- **Branch**: `main` — **6 commits sin pushear**
- **Build**: passing. Vitest web **643 archivos / 7871 tests**; landing **25 / 258**;
  `tsc` limpio; `next build` exit 0 en ambas apps; **VR 67/67** con `--update-snapshots=none`
- **Uncommitted work**: no
- **PRs abiertos**: ninguno

## Next Tasks
1. 🎯 **BUILDER DE EJERCICIOS — el tema de esta sesión** (decidido con el founder). Propuesta y
   mockups en `docs/backlog/2026-08-13-next-three-initiatives.md` §3. Lo que más cambia el día
   a día, y no es cosmético: **`Unsaved changes in <id>` + Discard** — hoy se puede cargar otro
   record encima y perder la edición sin ningún aviso. Después: nombre en la librería (no sólo
   id), badge de TIER con la tabla ordenada, fila en estado `Editing`, y un `Erase` explícito.
   ⚠️ Respetar: `targets` es **UI-owned** (en `extraFields` la copia cargada gana y quitar una
   estrella no hace nada) y el brush `Star` **se esconde** donde el sweep no corre.
2. **P2P** — sin spec. ⚠️ Si va a tener algo de valor en juego, su spec debe incluir
   server-verified progress: hoy el riesgo está aceptado *porque* nada vale.
3. **Theme builder** — marketplace de creadores; el más grande y el que menos urge.
4. **Terminar de convertir**: 30 tableros, sobre todo laberintos de caballo (5) y dama (3).

## Blockers
- None.

## Notes
- ⛔ **`/dev/*` NO se extrae a otra app todavía — MEDIDO**: build con `/dev` 90 s / 147 rutas,
  sin `/dev` 81 s / 108. Es el 26% de las rutas y el **10%** del tiempo (~$0.62 de los $6.20).
  Y **cero** beneficio de bundle: Next parte por ruta. El costo de separarlas es partir
  `buildCatalog` en dos copias — exigiría un `packages/core` primero.
  **La palanca del gasto es la FRECUENCIA de builds, no su tamaño**: medir si Vercel saltea el
  build del landing cuando sólo cambia `apps/web`.
- **Un tablero cuenta como completado con AL MENOS 1★**; 0★ es posible en sweeps y no suma
  (el tablero queda rejugable). Aceptado; la palanca sería `starFloor: 1`.
- **Rejugar mejora**: estrellas al MÁXIMO, récord de movimientos aparte al MÍNIMO. Agotada la
  cuota diaria, el replay ya no persiste.
- **La curva de dificultad NO es un criterio estricto** — no reordenar contenido por esos avisos.
- **Verificar el deploy es del founder**, salvo pedido explícito.
- **Contenido autorado no es un fixture**: TRES tandas de tests se rompieron por pinear ids.
  Los verificadores por pieza ya derivan del catálogo — por eso el rey entró sin romper nada.
- Handoff largo: `docs/handoffs/2026-08-11-sweeps-in-the-builder-handoff.md`
