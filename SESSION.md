# Session Handoff — 2026-08-12

## Completed
- **Star Sweep en el builder** — el founder autora 1, 2 o 3 estrellas sin tocar JSON.
  Ejercicios y laberintos, cinco piezas (el peón queda fuera: `computeSweepOptimal` lo
  rechaza porque nunca retrocede). Los 15 juegos firma también, cada uno con su solver.
- **Etapa 0** (`09d406af`) — el runtime del laberinto es sweep-aware: colecciona por
  `sweep-run.ts` y completa sólo en la última estrella. Antes terminaba en la primera y
  graduaba media corrida contra el óptimo entero: 3★ por medio laberinto, en silencio.
- **`gradeLabyrinthRun`** — un único despacho para los TRES sitios que graduaban laberintos
  por su cuenta (pantalla, bucket de intentos, ruta de firma). Migrar dos de tres compila
  perfecto y muestra al jugador una nota mientras la tabla guarda otra.
- **Migración APLICADA a producción** — `content_overlay` 14 → 16 columnas (`targets`,
  `star_floor`), 32 filas intactas. Schema antes del deploy, en ese orden.
- **Contenido** (`47320e92`) — torre completa (4 laberintos + ejercicios) y parte del alfil.
- **Cinco defectos encontrados USÁNDOLO**, ninguno visto por un test:
  - `538c84a5` el bloque Export perdía las estrellas al copiarlo.
  - `b5f6dc56` el toast se borraba solo (el save recarga la página que lo muestra).
  - `8a175e47` el juego servía el catálogo viejo (la invalidación colgaba del overlay, que
    en local está apagado a propósito).
  - `9feccb6f` + `276b8913` los verificadores fallaban en los niveles CORRECTOS.
  - `9dad8b2c` el landing recortaba el **43%** del arte en desktop.

## Current State
- **Branch**: `main` — **ya pusheado** (`origin/main` en `9dad8b2c`, 0 pendientes)
- **Build**: passing. Vitest web **643 archivos / 7870 tests**; landing **25 / 258**;
  `tsc` limpio; `next build` exit 0 en ambas apps; iconos sin drift;
  **VR 67/67** con `--update-snapshots=none` (81 baselines antes y después)
- **Uncommitted work**: no
- **PRs abiertos**: ninguno

## Next Tasks
1. **Convertir el contenido que falta**, con el builder: **11 laberintos** (alfil 2,
   caballo 5, dama 3, rey 1) + ejercicios de caballo, dama y rey.
   Local: `NEXT_PUBLIC_CHAIN_ID=42220 CONTENT_STAGE= ADMIN_TOKEN= PORT=3002 pnpm dev`.
   Commitear SIEMPRE los dos archivos: el `content/*.json` **y** `puzzles.generated.ts`.
2. **Spec del sweep para Diagonal Run** (pedido, no construido). Bloqueado por una decisión
   de diseño: `resolvePivot(from, pivot, blockers, target)` elige la dirección de salida por
   cercanía **a la estrella**, así que con varias hay que decidir hacia cuál se orienta.
   ⚠️ `computeSweepOptimal` no sirve ahí (mide piernas con el BFS libre, no con pivotes).
   La forma correcta es un BFS sobre `(casilla, recogidas)` — también resuelve las capturas.
3. **Opcional, landing**: el pie de la slide cae sobre el margen blanco del asset y la torre
   lo cruza. Se resuelve cambiando el anclaje sólo en desktop. Cosmético.

## Blockers
- None.

## Notes
- **La curva de dificultad NO es un criterio estricto** (decisión del founder): un tablero
  más fácil después de uno duro es un respiro. Los avisos de pacing son información y nunca
  bloquearon un guardado — no reordenar contenido por ellos.
- **Verificar el deploy es del founder**, no mío, salvo pedido explícito.
- **Reglas al autorar un sweep**: ★1 (`goal`) tiene que ser la estrella BARATA o el
  validador lo rechaza por colapso; en el alfil, todas del color de la salida.
- **El brush `Star` se esconde solo** donde el sweep no corre: si no aparece, ese tablero no
  lo admite. No hay nada que recordar.
- **Apagar un paso en local apaga lo que colgaba de él** — causa de dos de los cinco
  defectos de hoy. Al apagar algo, preguntar qué más vivía en esa rama sin pertenecerle.
- **Contenido autorado no es un fixture**: dos tests se rompieron por pinear `rook-9` y los
  ids de los laberintos. El builder existe para cambiarlos; los tests ya derivan del catálogo.
- Handoff largo con el detalle: `docs/handoffs/2026-08-11-sweeps-in-the-builder-handoff.md`
