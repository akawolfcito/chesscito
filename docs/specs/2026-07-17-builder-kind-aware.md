# Spec — builder-kind-aware

**Date**: 2026-07-17
**Status**: revised (v2 — 4 P0 del red-team resueltos)
**Feature**: el builder deja de creer que hay dos kinds; el borrador se valida contra
**el mismo validador que gatea el guardado**, y se comprueba en el tablero REAL.

## Problem

El `/dev/labyrinth-builder` **destruye los niveles de los 5 juegos firma, en silencio.**

Medido el 2026-07-17 ejecutando `buildCatalog` sobre los 15 records reales de
`content/labyrinths.json`: **19 de 27 flujos realistas (kind × meta plausible) se escriben
sin un solo error.** Queens se corrompe con las 3 metas probadas. No hay ninguna
protección — la corrupción es el resultado por defecto de **hacerle caso a la UI**.

> ⚠️ Una versión anterior decía "12 de 15 fallan ruidoso, el nivel está a salvo". Artefacto
> de sonda: medía el record **sin meta**, y el builder **no deja guardar sin meta**
> (`validate.ts:21`, Save gatea por `result.ok`). El flujo medido no podía ocurrir.
> → `feedback_a_probe_that_ignores_the_ui_measures_nothing`

La causa es **un nombre para dos ejes**:

- **bucket** — en qué archivo vivís (`exercise` | `labyrinth`). Es lo que el builder llama `kind`.
- **routing kind** — qué juego SOS (`PuzzleKind`, 7 valores). Es lo que el record llama `kind`.

**La capa de juego ya distingue perfecto.** `fen-puzzle.ts` exporta `PuzzleKind`,
`isTargetlessKind`, `isCoverageKind`, `usesOwnSolver`, `isThreatKind`, `TypedEnemy`; y
`mapFenPuzzle` ya se ramifica por kind (`fen-puzzle.ts:197`). **El builder es la única capa
que todavía cree que hay dos.** No hay que construir el conocimiento: hay que dejar de tirarlo.

### Los cinco puntos de pérdida (código, no traza)

| # | Dónde | Qué pierde |
|---|-------|-----------|
| 1 | `baseline-write.ts:50` | Al LEER, estampa `kind:"labyrinth"` sobre el routing kind real. |
| 2 | `page.tsx:123` (`BUILDER_FIELDS`) | Al GUARDAR, `extraFields` tira `kind`. |
| 3 | `catalog.ts:459` | `rec.kind ?? "labyrinth"` rellena el hueco con la mentira. |
| 4 | `state.ts:51` (`toPuzzleInput`) | Hardcodea `kind:"labyrinth"` → **la validación en vivo también miente.** |
| 5 | `page.tsx:465` (toggle Disable) | Manda `{...rec}` del load list → escribe `kind:"labyrinth"` **explícito**. |

### Y una pérdida peor que el kind: el enemigo tipado

`buildFenBlock` (`state.ts:35-36`) serializa **muros → `N`** y **capturas → `p`**, siempre.
✅ **MEDIDO (etapa 1, 2026-07-17).** La afirmación era correcta y **corta**: no era solo la
torre. Con el serializador viejo, **6 de los 34 records** se reescriben mal —
los 3 de Safe Path y los 3 de Promotion Run:

| Record | El FEN dice | Un load→save escribía |
|--------|-------------|----------------------|
| `king-safe-1` | `n` caballo — *"The Knight Sees"* | `p` peón |
| `king-safe-2` | `n` caballo ×2 | `p` peón ×2 |
| `king-safe-3` | `b` alfil | `p` peón |
| `pawn-promotion-1/2/3` | `r` torre — *"el enemigo de la diagonal es la única puerta"* | `p` peón |

La causa no era una rama de código: era el **tipo**. `captures: string[]` **no puede** cargar
un tipo de pieza, así que `buildFenBlock` tenía que inventar uno, y inventaba `p`.

`deriveStateFromFen` vivía sin exportar dentro de `page.tsx` — por eso el par nunca se pudo
testear, y por eso la pérdida sobrevivió tanto. Ahora vive junto a su inverso y
`fen-round-trip.test.ts` corre los dos sobre los **34 records reales**. Verificado que el test
es load-bearing: al revertir el serializador a `"p"`, caen esos 6 y solo esos 6.

## Goal

Que el founder pueda **editar 4 de los 5 juegos firma sin degradarlos**, viendo el mapa de
amenazas mientras autora y comprobando el borrador **en el tablero que shippea**; y que Safe
Path entre por la misma puerta al cerrar su etapa.

## Non-goals

- **Crear juegos firma desde cero.** Ver "Restricción de diseño": gate de UI, **nunca** del modelo.
- Rediseñar los niveles. Esto es la herramienta, no el contenido.
- **Estabilidad byte-a-byte del JSON.** Ver AC-2: el criterio es igualdad **semántica**.
- El overlay/staging. `draft` → `publish` queda como está.
- **Extraer el tooling a un módulo aparte.** Visión del founder (2026-07-17), no se diseña acá.
- Desktop. El builder se usa en desktop; el lienzo no debe asumir 390px, pero no se optimiza.

### Restricción de diseño — crear después, sin romper (founder, 2026-07-17)

> "quisiera una nota para a futuro tener chance de crear nuevos desde cero y agregarlos sin
> romper y que se agreguen de manera fluida sin afectaciones"

**"Solo editar" se implementa como gate de UI, no como suposición del modelo.**
`BuilderState.kind` es `PuzzleKind` completo desde el día 1. Agregar creación después debe
ser **aditivo**: sumar un selector y un estado vacío por kind, no refactorizar contratos.
Cualquier atajo que haga `kind` opcional o lo derive del bucket viola esto y está prohibido.

### Regla de entornos (founder, 2026-07-17)

> "con que podamos tenerlos mapeados en /dev/* y que salgan en local, máximo a main ->
> preview; pero nunca a production"

**Hoy está al revés.** Medido: las páginas `/dev/*` y `/api/dev/labyrinth` gatean por
`NODE_ENV === "production"` → **404ean en preview** (el build de preview corre con
`NODE_ENV=production`). Pero `/api/dev/publish:76` gatea por `VERCEL_ENV === "production"`
→ **el endpoint que escribe SÍ está vivo en preview, y su UI no.**

- **Regla:** todo `/dev/*` y `/api/dev/*` gatea por **`VERCEL_ENV === "production"`**.
  Local + preview sí; producción nunca.
- ⚠️ **Límite físico: Save NO puede funcionar en preview.** `baseline-write.ts` escribe con
  `writeFileSync` sobre `process.cwd()`, y el filesystem del deploy de Vercel es
  **read-only**. En preview el builder **mira**; guardar a `content/*.json` es solo local.
  La UI debe **decirlo**, no fallar con un 500 (behavior 14).

## Contracts (SDD)

```ts
// ─── lib/content/overlay-types.ts ────────────────────────────────────────────
/** En qué ARCHIVO vive un record. NO es el juego. Antes `ContentKind`: ese
 *  nombre ES la causa raíz y se retira.
 *  ⚠️ `lib/daily/session-quota.ts:48` declara su PROPIO `ContentKind` de la misma
 *  forma. NO es un import: renombrar acá no lo toca. No unificarlos en este spec. */
export type ContentBucket = "exercise" | "labyrinth";

// ─── lib/content/baseline-write.ts ───────────────────────────────────────────
/** Record + el bucket del que salió. `kind` (routing) queda INTACTO: es del
 *  record; el bucket es otro eje. Reemplaza a KindedRecord, que los unía. */
export type BucketedRecord = LabyrinthRecord & { bucket: ContentBucket };

/** `root` inyectable (default `process.cwd()`): sin esto los tests de AC-2
 *  escribirían sobre el working tree real. Hoy las rutas son constantes de módulo. */
export function readBaselineRecords(filter?: ContentBucket, root?: string): BucketedRecord[];
export function writeBaselineRecord(
  bucket: ContentBucket,
  record: LabyrinthRecord, // su `kind` manda y se persiste tal cual
  root?: string,
): BaselineWriteResult;

// ─── lib/labyrinth-builder/state.ts ──────────────────────────────────────────
/** Enemigo en coordenadas de autor. El builder habla en álgebra ("c6");
 *  TypedEnemy habla en BoardPosition. */
export type AuthoredEnemy = { square: string; piece: PieceId };

export type BuilderState = {
  /** PRIMERA CLASE desde el día 1. Nunca opcional, nunca derivado del bucket. */
  kind: PuzzleKind;
  piece: PieceId;
  start: string | null;
  /** `null` es LEGAL cuando isTargetlessKind(kind). No es "todavía no lo puso". */
  goal: string | null;
  walls: string[];
  /** REEMPLAZA a `captures: string[]`, que serializaba TODO como peón negro. */
  enemies: AuthoredEnemy[];
  /** promotion-run: REQUERIDO ahí, ausente en el resto. */
  promoteTo?: PieceId;
  order: number;
  explanation?: string;
  tier?: ExerciseTier;
  tags?: string[];
  id?: string;
};

export function emptyState(piece: PieceId, kind: PuzzleKind): BuilderState;
/** Propaga s.kind (ya no hardcodea). Tira si falta start, o si falta goal Y el
 *  kind NO es targetless. */
export function buildFenBlock(s: BuilderState): { fen: string; target?: string; mover: string };
export function toPuzzleInput(s: BuilderState): PuzzleInput;

/** Extraído de page.tsx (hoy sin exportar → intesteable). Inverso de
 *  buildFenBlock; la etapa 1 los prueba como PAR sobre los 15 records reales.
 *  `kind` decide qué son los negros: enemigos tipados en isThreatKind(kind);
 *  en el resto, error explícito (hoy el catálogo los rechaza al guardar). */
export function deriveStateFromFen(
  fen: string, piece: PieceId, mover: string, kind: PuzzleKind,
): { ok: true; start: string; walls: string[]; enemies: AuthoredEnemy[] }
 | { ok: false; error: string };

// ─── lib/labyrinth-builder/validate.ts ───────────────────────────────────────
/** ⚠️ P0-4 — UN SOLO VALIDADOR.
 *  Hoy hay dos: `validateBuilder` gatea Save, `buildCatalog` decide de verdad —
 *  y divergen (diagonal-run: uno warning, `catalog.ts:212` error). Por eso el
 *  builder te deja pintar lo que Save rechaza.
 *  A partir de acá `validateBuilder` DELEGA en `buildCatalog` sobre un array de
 *  UN record: la validación en vivo ES la del guardado, por construcción. Los
 *  solvers propios, el lint de diagonal-run y el requisito de promoteTo salen
 *  gratis y no pueden divergir nunca más.
 *  Encima quedan solo los warnings de AUTOR (atajo vs tracedPath), que
 *  buildCatalog no conoce. */
export function validateBuilder(s: BuilderState, tracedPath?: string[]): ValidationResult;

// ─── lib/labyrinth-builder/authoring.ts (nuevo) ──────────────────────────────
/** Qué puede pintar cada juego. UNA tabla; la UI la lee, no la duplica.
 *  `showsThreatMap` NO es campo: se deriva de `isThreatKind(kind)` — dos campos
 *  que codifican el mismo hecho divergen
 *  (feedback_same_shape_number_wrong_meaning). */
export type KindCapability = {
  /** enemigos tipados pintables; [] = sin pincel de enemigos */
  enemyPieces: readonly PieceId[];
  /** false → se lista con el nombre de su juego, no abre (etapa pendiente). */
  editable: boolean;
};
export const KIND_CAPABILITY: Record<PuzzleKind, KindCapability>;
// needsGoal → isTargetlessKind(kind); showsThreatMap → isThreatKind(kind);
// needsPromoteTo → kind === "promotion-run". NO duplicar en la tabla.
```

## Behavior

### Preservación del kind (la raíz)

1. Dado un record con `kind:"queens"`, cuando `readBaselineRecords()` lo lee, devuelve
   `kind:"queens"` y `bucket:"labyrinth"` — dos campos, dos ejes.
2. Dado que se carga y se guarda un record sin editarlo, cuando se relee, el record es
   **semánticamente idéntico** (kind, tipo de enemigo, promoteTo, todo campo).
3. Dado un `BuilderState` de kind `K`, `toPuzzleInput` propaga `K`.
4. Dado el toggle Disable sobre un juego firma, se persiste su kind real (misma vía que
   Save, sin atajo).

### Validación: uno solo

5. Dado cualquier borrador, `validateBuilder` devuelve **exactamente** los errores que
   `buildCatalog` devolvería al guardarlo. **No existe borrador pintable que Save rechace.**
6. Dado `isTargetlessKind(kind)`, la meta ausente no es error y Save queda habilitado.
7. Dado `usesOwnSolver(kind)`, no corre el BFS genérico ni su "unsolvable (no path)".
8. Dado `kind:"promotion-run"` sin `promoteTo`, error que nombra el campo (vía delegación).

### Lienzo: pintar ↔ Preview

9. Dado `isThreatKind(kind)`, al pintar, las casillas vigiladas se marcan vía
   `attackedSquares` — el mismo dato que el juego computa.
10. Dado un borrador **válido**, tocar **Preview** monta el tablero REAL del kind con el
    borrador como `level`, y se puede jugar.
11. En Preview los taps **juegan**; en Paint **pintan**. Nunca las dos.
12. Dado `editable:false` (safe-path hasta su etapa), se lista **con el nombre de su juego**
    y no abre, diciendo por qué.

### Preview: contrato de host (P0-3)

13. El builder es host de un componente de PRODUCCIÓN y **no le presta semántica de juego**:
    - `onCaught` → línea de estado propia del builder ("caught on c6") + botón Reset
      (`resetKey++`). **Nunca** el overlay de TRY AGAIN, nunca escudos, nunca rachas.
    - `onBandChange` → se renderiza en el chrome del builder, no en la mission band del juego.
    - `onComplete` → línea de estado ("done in N, optimal M"). No celebra, no persiste.
    - Preview **deshabilitado** si el borrador es inválido (behavior 5 lo hace decidible para
      todos los kinds, incluidos los de solver propio).
    - **Si un tablero necesita UN prop nuevo para servir de preview, el non-goal ya se rompió**:
      va en **commit propio**, nombrado, antes de la etapa que lo pide.

### Entornos

14. Dado `VERCEL_ENV === "production"`, toda ruta `/dev/*` y `/api/dev/*` → 404.
15. Dado preview (fs read-only), el builder carga y valida, y **Save se muestra
    deshabilitado diciendo "baseline write is local-only"** — no intenta escribir ni tira 500.

## Edge cases

- **Meta ausente vs meta no puesta.** En targetless, `goal:null` es estado final legal;
  `buildFenBlock` no debe tirar. El bug de hoy es tratarlos igual.
- **Cambiar de bucket con borrador abierto** → descarta (comportamiento actual). Se conserva.
- **Un juego firma en `exercises.json`** → imposible por tipo, no por convención.
- **Enemigo sobre el mover / sobre un muro** → el último gana (`buildFenBlock:37` ya lo hace).
- **Kind desconocido en el JSON** (escrito a mano, o un juego futuro) → se lista, no se abre,
  no se le inventa default.
- **Records con `kind` ausente** (los 19 laberintos legítimos) → `?? "labyrinth"` sigue
  correcto para ELLOS. Compat intacta (AC-10).
- **Preview con borrador inválido** → nunca montar un tablero real con un level roto.

## Acceptance criteria

- [ ] **AC-1 (medir primero).** `deriveStateFromFen` extraído a la lib + test de round-trip
      sobre **los 15 records reales**: `derive → buildFenBlock` reproduce el FEN original.
      Se escribe **rojo** y se cierra **dentro de la etapa 1** (ver Etapas). Si sale verde,
      la torre→peón era falsa y el §Problem se corrige.
- [ ] **AC-2 (revisado, P0-1).** Cargar y guardar cada uno de los 15 sin editar deja el
      record **deep-equal** al original. **NO byte-idéntico**: `upsertRecord` reemplaza con
      el orden de claves del POST, así que un round-trip fiel en contenido igual difiere en
      orden — un criterio byte fallaría **con el código correcto puesto**. Corre con `root`
      inyectado a un tmpdir, jamás el working tree.
- [ ] **AC-3.** `readBaselineRecords()` devuelve `kind` real + `bucket`; `KindedRecord` ya no existe.
- [ ] **AC-4.** `toPuzzleInput` propaga los 7 kinds; ningún `"labyrinth"` literal en `state.ts`.
- [ ] **AC-5 (P0-4).** Test de **equivalencia**: para un set de borradores (uno por kind,
      válidos e inválidos), los errores de `validateBuilder` == los de `buildCatalog`.
      Es el test que impide que los dos validadores vuelvan a divergir.
- [ ] **AC-6.** El toggle Disable preserva el kind.
- [ ] **AC-7.** E2E: en `/dev/labyrinth-builder`, cargar `queens-1` → Save → el catálogo lo
      sigue teniendo en el bucket `queens`. Es el flujo que hoy lo destruye.
      ⚠️ **Limpiar `.next` antes**: regenerar `puzzles.generated.ts` no invalida el
      `unstable_cache` tag "content" → verde falso (`project_catalog_cache_staleness`).
- [ ] **AC-8.** E2E: Preview monta el tablero real del kind y responde a un tap como el juego.
- [ ] **AC-9.** Test: el overlay de amenazas pinta exactamente `attackedSquares(enemies)`
      (cubre behavior 9, que en v1 no tenía criterio).
- [ ] **AC-10.** Sin cambios de comportamiento en `exercise`/`labyrinth`: los 19 laberintos
      legítimos y los ejercicios round-trippean igual que antes.
- [ ] **AC-11.** `pnpm exec tsc --noEmit` limpio + suite verde (baseline 5352/454).

## Etapas (implementación)

Cada etapa mergea a `main` **verde**. No hay tests rojos entre etapas (P0-2).

| # | Etapa | Entrega |
|---|-------|---------|
| 0 | **Gates** | `VERCEL_ENV` en todo `/dev/*` + `/api/dev/*`; Save deshabilitado en preview con motivo (behavior 14-15). Independiente del resto. |
| 1 | **Medir + enemigo tipado** | `deriveStateFromFen` extraído, round-trip rojo sobre los 15, `AuthoredEnemy` + `buildFenBlock` fiel → verde. **Fusiona las viejas 1 y 3** (P0-2). |
| 2a | **Rename** `ContentKind`→`ContentBucket` | Commit PROPIO: cruza `api/admin/content{,/stage}` (input de red con token). Medido: 6 archivos. `session-quota.ts` declara el suyo — NO se toca. |
| 2b | **Raíz** | `BucketedRecord`, `root` inyectable, kind preservado en read/save/disable (AC-2,3,6). |
| 3 | **Un validador** | `validateBuilder` delega en `buildCatalog` + test de equivalencia (AC-5). ⚠️ Medir el costo: corre en cada cambio de estado; debounce si hace falta. |
| 4 | **Diagonal Run** | Primer juego editable de verdad. Casi gratis: ya era capaz. |
| 5 | **Queens / Tour / Promotion Run** | `KIND_CAPABILITY` + goal opcional + `promoteTo` (AC-7). |
| 6 | **Lienzo** | Overlay de amenazas (AC-9) + Paint/Preview + contrato de host (AC-8). |
| 7 | **Safe Path** | Pincel de negro tipado; `editable:true`. ⚠️ Ver riesgo abajo. |

**Riesgo de etapa 7 (red-team P1, aceptado):** safe-path es la última y la única con UI
nueva de verdad — y es la que motivó el rediseño. Si las etapas 0-6 mergean y el founder
cambia de frente, queda `editable:false` para siempre, con `KIND_CAPABILITY` haciéndolo
parecer intencional en vez de pendiente. **Mitigación:** `editable:false` lleva comentario
que apunta a este spec, y la etapa 7 entra al backlog como item propio al mergear la 6.

## Out of scope / future

- **Crear juegos firma desde cero** — habilitado por diseño, no agendado.
- **Extraer el tooling `/dev/*` a un módulo separable** (como el landing). Visión del
  founder 2026-07-17. ⚠️ Tensión a tener consciente: que el builder importe `SafePathBoard`
  crea dependencia **tooling → producto**. Sana para extraer (el módulo dependería del
  paquete del juego), pero es una flecha que hoy no existe.
- Pintar la REGIÓN de queens/knight-tour con su semántica: hoy se dibuja con el pincel de
  muros y **la etiqueta miente** (los `N` blancos son el cuarto a llenar, no obstáculos).
  Funciona; se lee mal. Renombrar por kind es cosmético.
- Unificar los dos `ContentKind` (overlay-types + session-quota). ⚠️ `buildContentId` usa el
  suyo para keyear la quota diaria: un juego firma se keyea hoy como su bucket. Fuera de alcance.
- Que los probes `/dev/{safe-path,queens,…}` escriban. Siguen read-only.

## Open questions

- **¿El pincel de enemigos ofrece las 6 piezas o solo las que cada juego usa hoy?**
  `KIND_CAPABILITY.enemyPieces` lo deja abierto. Propongo las 5 sin rey y verificar en la
  etapa 7 si `attack-map` ya computa un rey negro (puede ser gratis).
- **Costo de delegar en `buildCatalog` en vivo** (etapa 3). El probe midió ~260ms por
  catálogo completo de 22 records; un record suelto debería ser mucho menos, pero los
  solvers de queens/tour no están medidos. Si duele: debounce, no dos validadores.
