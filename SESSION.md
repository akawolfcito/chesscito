# Session Handoff — 2026-08-12

## Completed
- **Star Sweep en el builder** — el founder autora 1, 2 o 3 estrellas sin tocar JSON.
  Ejercicios y laberintos, cinco piezas (el peón queda fuera: `computeSweepOptimal` lo
  rechaza porque nunca retrocede). Los 15 juegos firma también, cada uno con su solver.
- **Etapa 0** (`09d406af`) — el runtime del laberinto es sweep-aware: colecciona por
  `sweep-run.ts` y completa sólo en la última estrella. Antes terminaba en la primera y
  graduaba media corrida contra el óptimo entero: 3★ por medio laberinto, en silencio.
- **`gradeLabyrinthRun`** — un único despacho para los TRES sitios que graduaban laberintos
  por su cuenta (pantalla, bucket de intentos, ruta de firma).
- **Migración APLICADA a producción** — `content_overlay` 14 → 16 columnas.
- **Contenido: 42 de 79 tableros piden varias estrellas** (`ba002e9d`) — caballo 9/10,
  dama 9/10, torre 8/10, alfil 7/10, rey 3/10; laberintos de torre 4/4 y alfil 2/2.
- **README alineado** (`8462cca8`) — las dos escalas de estrellas, 60 ejercicios, alfil 10.
- **Riesgo de `sign-badge` ACEPTADO** (`f0c9c5dc`) con la razón y su disparador en el backlog.
- **Landing** (`9dad8b2c`) — la slide dejaba fuera el 43% del arte en desktop.
- **Seis defectos encontrados USÁNDOLO**, ninguno visto por un test: el Export perdía las
  estrellas, el toast se borraba solo, el catálogo servía datos viejos, y tres tandas de
  verificadores que fallaban en los niveles CORRECTOS (torre, alfil, dama).

## Current State
- **Branch**: `main` — **3 commits sin pushear**
- **Build**: passing. Vitest web **643 archivos / 7871 tests**; landing **25 / 258**;
  `tsc` limpio; `next build` exit 0 en ambas apps; **VR 67/67** con `--update-snapshots=none`
- **Uncommitted work**: no
- **PRs abiertos**: ninguno

## Next Tasks
1. **P2P** — el tema de la próxima sesión. Sin spec todavía.
2. **Terminar de convertir a sweep**: rey 3/10 es el más flojo; quedan 11 laberintos
   (alfil 0 pendientes, caballo 5, dama 3, rey 1) y los ejercicios sueltos de cada pieza.
   Local: `NEXT_PUBLIC_CHAIN_ID=42220 CONTENT_STAGE= ADMIN_TOKEN= PORT=3002 pnpm dev`.
   Commitear SIEMPRE los dos archivos: el `content/*.json` **y** `puzzles.generated.ts`.
3. **Spec del sweep para Diagonal Run** — bloqueado por una decisión de diseño: la dirección
   del pivote se elige por cercanía **a la estrella**, así que con varias hay que decidir
   hacia cuál se orienta. ⚠️ `computeSweepOptimal` no sirve ahí; la forma correcta es un BFS
   sobre `(casilla, recogidas)`, que también resolvería las capturas como objetivo.
4. **Decoder de custom errors** (1–3 h) — `BadgeAlreadyClaimed`, `CooldownActive` y
   `DailyLimitReached` salen los tres como "Try again". El extractor ya está escrito.

## Blockers
- None.

## Notes
- **Un tablero cuenta como completado con AL MENOS 1★** (`completedExerciseCount` filtra
  `stars > 0`). Con el sweep, 0★ es posible y 34 de 36 ejercicios sweep no tienen `starFloor`:
  terminar dando vueltas **no suma** al 80% de la insignia y el tablero queda rejugable.
  **Aceptado por el founder** — la palanca, si alguna vez molesta, es `starFloor: 1`.
- **Rejugar mejora**: las estrellas guardan el MÁXIMO, y el récord de movimientos va aparte
  como MÍNIMO, porque la estrella satura en 3 y el conteo no. ⚠️ `shouldFreezeScoring` es
  `liteMode && isReplay && isSessionOver`: agotada la cuota del día, el replay no persiste.
- **La curva de dificultad NO es un criterio estricto** (decisión del founder): un tablero
  más fácil después de uno duro es un respiro. No reordenar contenido por esos warnings.
- **Verificar el deploy es del founder**, no mío, salvo pedido explícito.
- **Reglas al autorar un sweep**: ★1 (`goal`) tiene que ser la estrella BARATA o el validador
  lo rechaza por colapso; en el alfil, todas del color de la salida. El brush `Star` se
  esconde solo donde el sweep no corre.
- **Contenido autorado no es un fixture**: TRES tandas de tests se rompieron por pinear ids
  del catálogo. Los verificadores por pieza ya derivan del catálogo y separan las dos formas.
- Handoff largo: `docs/handoffs/2026-08-11-sweeps-in-the-builder-handoff.md`
