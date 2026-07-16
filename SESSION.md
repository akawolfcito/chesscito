# Session Handoff — 2026-07-16 (Exercise lane closed · merged to preview)

> Retomamos EXACTAMENTE acá cuando el usuario diga **"continuemos"**.
> **Próxima tarea: Knight's Tour.** El contrato ya está cerrado — NO re-especificar:
> `docs/specs/2026-07-16-signature-games-spec.md`.

## Estado

- **`main` = `18e9168a`, pusheado. La rama `fix/exercise-obstacles-a0` se mergeó (fast-forward, 40 commits).**
- **Suite: vitest 5137/5137 (434 files) · `tsc --noEmit` limpio · VR minipay 58/1.**
  El rojo (`hub-shop-sheet-open`) es **preexistente** (env sin treasury → "Coming soon"). No perseguirlo.
- **Deploy VERIFICADO en preview**: `preview.chesscito.com` → `learn-preview.chesscito.com`.
  El copy curado del caballo está vivo ("The knight's leap", "The knight jumps over").

## Completed esta sesión

1. **Gap pedagógico CERRADO — las 6 piezas curadas.** Los 59 ejercicios tienen
   `principle`/`title`/`playerPrompt`/`learningObjective`. `CURATED_PIECES` = las 6, así que
   **el build de release ahora exige pedagogía completa**. Un commit atómico por pieza
   (`4bf29372` knight · `5399ccb2` pawn · `0509ebd5` queen · `cdf0a95e` king).
   Datos mecánicos verificados idénticos (FEN/mover/target/tier/tags/order sin tocar).
2. **Chip de misión → banda full-width slim** (`65637889`, `85653f23`). Salió del medio de la
   fila de 3 chips a una banda pegada debajo, estilo Diagonal Run. Zona superior ~105px → ~84px.
3. **Las DOS bandas se fusionaron en UNA** (`4a039ccf`). "Move to g1" + "Tap the bishop to
   begin." eran dos bandas apiladas. El DR ahora **hoistea** su línea al host vía `onBandChange`;
   la banda de misión la aloja y **adoptó los hooks `dr-band`/`dr-band-msg`/`data-phase`**, así que
   el E2E real sigue verde. Sin `onBandChange` (el spike `/dev`) el board renderiza su banda local.
4. **Audit de redundancia + su herramienta** (`b72baf63`): `pnpm -C apps/web exec tsx scripts/audit-redundancy.ts`.
5. **Spec de los 4 juegos** (`1b89fd44`) — decisiones del founder cerradas.
6. **La banda dice QUÉ es la misión** (`18e9168a`, feedback del founder ya cerrado):
   - Ejercicio: `Move to e2 · The king's single step` (antes solo "Move to e2").
   - Laberinto: `Two Turns · 8 moves` (antes un **"4" pelado**, un número sin decir de qué).
   - Modal MISSION: `min-height: 300px` (no se aplasta con una misión de una línea).
   - **La cola toma `title`, NO `playerPrompt`**: el título es corto e imperativo por
     construcción; el prompt es una frase entera que en 30px solo se trunca en ruido. El
     prompt se queda en el modal, que es donde entra.

## Next Tasks (en orden — arrancar acá)

### 1. [PRIMERA] Knight's Tour (`kind: "knight-tour"`)
Spec completo en `docs/specs/2026-07-16-signature-games-spec.md` §1. **Es el más barato y por eso va primero.**
Patrón a seguir: Diagonal Run, end-to-end (módulo puro → board que reusa `<GameBoard>` → `kind` en
`labyrinths.json` → host desde el catálogo runtime → i18n EN/ES → probe `/dev` → e2e).

### 2. N-Queens · 3+4. Safe Path + Promotion Run (JUNTOS, nunca separados)

## ⚠️ El hallazgo que ordena el trabajo (leer antes de estimar)

`MappedPuzzle` (`lib/game/fen-puzzle.ts:63`) lleva `obstacles`/`captureTargets` como
**`BoardPosition[]` — casillas SIN tipo de pieza**. Es el muro que A9 encontró y **rechazó a
propósito** (por eso existe el gate de caballos en `lint.ts`).

- **Una capa de amenaza NECESITA tipos** (una torre no ataca como un alfil) → **Safe Path y
  Promotion Run exigen la cirugía `{pos, piece}`** (plan §15.6.3). **NO son los baratos.**
- **Knight's Tour no necesita tipos** (caballo + muros; un muro es un muro) → va primero.
- **N-Queens tampoco** (todas son damas, sin ambigüedad).
- Safe Path y Promotion Run **comparten** la cirugía + la capa de ataque: **hacerlos seguidos**.

**Gap de grading:** `labyrinthStars(moves, optimal)` califica por movimientos. Tour y Queens
califican por **% de un conjunto**. Necesitan un segundo grader — **no doblar el existente**.

## Deuda registrada (NO aplicada, a propósito)

**4 duplicados reales** — `docs/audits/2026-07-16-exercise-redundancy-audit.md`:
`pawn-3/pawn-4` · `queen-6/queen-10` (el más fuerte: el mismo tablero espejado) ·
`king-2/king-4` · `king-6/king-9`. Son **4 ediciones de tablero para el builder**, no trabajo
de motor. El doc propone qué lección nueva pone cada uno en su lugar.

> **Medir le ganó al olfato:** 4 de mis 6 sospechas a ojo estaban mal en ambas direcciones
> (knight-6/9/10 escalan, no repiten; y los 2 reales no los vi). El tool también se equivocó
> primero — sin `reach` marcaba el par que el audit de torre creó a propósito.

## Blockers

- Ninguno funcional.
- ⚠️ **`hub-clean` VR pasa cambios sin verlos**: su `maxDiffPixelRatio: 0.005` son ~12k píxeles
  y la cola de la banda son ~4k. Su baseline quedó mostrando una banda que ya no se envía, y
  `--update-snapshots` NO lo reescribe porque **solo escribe cuando el test falla**. Deriva
  registrada, no perseguida.
- 📌 Los rails que el founder corrigió en `/dev/labyrinth-builder` viven en el **overlay de
  Supabase**, no en `content/labyrinths.json`. Las capturas locales muestran los placeholder
  viejos — es esperado, no un bug.
- **`contextual-header.spec.ts` falla 6/6 — PREEXISTENTE, no es regresión** (confirmado en HEAD
  sin cambios). El header no monta en `/`; probable gate del Hub Tour que su `bypassFirstVisit`
  no cubre (setea `onboarded`+`welcome-dismissed`, pero no `chesscito:hub-tour:v1`). Spec stale.
- **Deploy caveat**: regenerar el catálogo NO invalida el `unstable_cache` tag `"content"`.
  Un build fresco sí. E2E lo bypassa con `CONTENT_CACHE_DISABLED=1`.

## Notas

- Regenerar catálogo: `pnpm -C apps/web import-puzzles`; después `rm -rf apps/web/.next` antes de dev.
- La banda de misión es **el hogar del status line**: `missionStatus` en `MissionPanelCandy`.
  El contador de Queens (`<dama> ×N`) y el % del Tour van ahí.
- El founder pule niveles en `/dev/labyrinth-builder`. **Construir la mecánica, no perfeccionar niveles.**
