# Handoff — sweeps en el builder (etapas 1 y 2 cerradas)

**Fecha:** 2026-08-11 · **Rama:** `main` LOCAL, sin pushear
**Spec:** `docs/specs/2026-08-11-sweeps-in-the-builder-and-labyrinths-spec.md`
**Commits de esta sesión:** `22a13802`, `747acea8`, `0af78962`

---

## ⛔ BLOQUEANTE antes de abrir el builder: falta aplicar la migración

`apps/web/supabase/migrations/20260811150000_content_overlay_sweeps.sql` **está escrita
pero NO aplicada**. La ruta de escritura ahora incluye `targets` y `star_floor` en **toda**
fila que guarda — también en una de un objetivo, donde van `null`. Contra una tabla sin esas
columnas, PostgREST responde *"Could not find the 'targets' column"* y el builder ve un **500**
en **cualquier** guardado, no sólo en un sweep.

- **Entorno:** la Supabase de **producción** (es la que sirve el overlay; el builder local
  escribe ahí).
- **Qué cambia:** dos columnas nullable sin default + dos CHECK. Ninguna fila existente cambia
  de significado.
- **Reversible:** sí — `alter table content_overlay drop column targets, drop column star_floor;`
  mientras nadie las haya escrito.
- **Cómo:** `psql` por Docker contra el pooler `aws-1` en session mode
  (`project_prod_db_access_via_docker_psql`). **No la apliqué**: toca prod y es tu llamada.

---

## Qué quedó hecho

### Etapa 1 — el validador y el overlay aprenden sweeps

**Un solo validador** (`buildCatalog`), el mismo que corre `pnpm import-puzzles`. La ruta admin
no tiene una segunda copia de las reglas. Cuatro caminos que antes no llegaban al autor:

| antes | ahora |
|---|---|
| `targets` en un laberinto: **descartado en silencio** | error que nombra el runtime y qué hacer |
| peón / >5 objetivos: **throw** → 500 sin motivo | 400 con la regla |
| estrella de alfil del color contrario: "unreachable" | dice **COLOR**, y de qué color mover |
| pierna a `targets[0]` no más barata: sólo lo miraba un test | regla de autoría: el builder no puede escribirla |

Y la regla del overlay **se estrechó**: de *"una fila no puede pisar un sweep"* a *"una fila
**sin** `targets` no puede pisar un baseline **con** `targets`"*. Editar y crear sweeps desde el
builder ahora es legítimo; degradarlos sigue prohibido, en la lectura **y** en la escritura.

`optimal_moves` lo sigue midiendo el servidor: un `optimalMoves` del cliente se ignora.

### Etapa 2 — el formulario multi-estrella

- Brush **`star`**: pinta las estrellas 2..5; la ★1 es el `goal` de siempre, así
  `target === targets[0]` vale por construcción.
- El **óptimo se recalcula en vivo** y dice qué mide: *el mejor orden sobre N estrellas*.
- ⛔ **En un sweep el tablero deja de dibujar la ruta BFS.** Esa ruta va sólo a `targets[0]`;
  dibujarla bajo un tablero de varias estrellas se lee como "así se resuelve el nivel", que es
  un nivel distinto y más corto. Por lo mismo se calla el aviso de "hay un camino más corto".
- El brush se **esconde** donde el sweep no corre (fuera del bucket `exercise`, y en el peón).
- `targets` pasa a ser **UI-owned**: si viajara en `extraFields`, la copia cargada ganaría sobre
  la editada y **quitar una estrella no haría nada**.
- El armado del record de Save salió de `handleSave` a `state.ts` (`buildSaveRecord`): qué campo
  posee la UI y cuál sólo viaja verbatim es una regla con dos modos de falla silenciosos.

**Tests:** 33 nuevos en 3 archivos. Suite completa **640 archivos / 7858 tests**, exit 0
(baseline medida en `main` limpio antes de empezar: **638 / 7825**).

---

### Smoke del builder — hecho, 13/13

Recorrido con Playwright contra la página real (`localhost:3002`, sin base, sin `ADMIN_TOKEN`,
`CONTENT_STAGE` vacío → baseline-only, cero escrituras). Verificado: el óptimo del sweep (3, no
la pierna de 1), el rótulo que dice qué mide, que no se dibuja ruta, el rechazo del duplicado
sobre el goal, el **un-sweep** al quitar la última estrella, el colapso rechazado en vivo con
`Save draft` deshabilitado, y que el brush desaparece en el peón. Sin errores de consola.

⚠️ **Y encontró un defecto que ningún test tenía:** el bloque **Export (copy)** mostraba
`fen/target/mover` y nada más, así que copiarlo pegaba un sweep como tablero de un objetivo.
Arreglado en `538c84a5` (`exportBlock()` en `state.ts`, con test). Tercer camino paralelo por el
que se caían los `targets` — después del record de Save y del validador en vivo.

### Etapa 0 — el runtime del laberinto ya es sweep-aware (2026-08-12, `09d406af`)

`handleLabyrinthMove` terminaba el nivel al pisar `targetPos`, que en un sweep **es
`targets[0]`**. Ahora colecciona por `sweep-run.ts` y completa sólo en la última estrella. Un
laberinto normal es un sweep de UN objetivo, así que los 19 existentes y los cinco juegos firma
toman el mismo camino de siempre — nada ramifica por `isSweep`.

⚠️ **El hallazgo del día: TRES sitios gradaban laberintos por su cuenta** — la pantalla, el
bucket de intentos y la ruta de firma —, los tres llamando `labyrinthStars` directo. Migrar dos
de tres tipa perfecto y deja al jugador mirando una nota mientras la tabla guarda otra: las dos
escalas son `(number, number) => number`. Con óptimo 12, una corrida de 15 vale **2★ relativas
y 1★ fija**. Ahora hay un despacho único, `gradeLabyrinthRun`, gemelo de `gradeExerciseRun`.

**Verificado jugando** (Playwright, proyecto minipay, laberinto de prueba autorado con el
builder y revertido después): el laberinto **monta con las dos estrellas pintadas**, el HUD dice
`optimal path 3 moves` (el óptimo del sweep, no la pierna de 1) y el contador vivo existe con
`data-total="2"`.

⛔ **Lo que NO pude verificar: la victoria en la última estrella.** Los clicks del tablero no
prosperan por Playwright (timeout al mover la pieza), así que el tramo "primera estrella no
completa → segunda sí" quedó sin ejercitar de punta a punta. La lógica es `collectAt`, probada
en el carril 1, pero **eso no es lo mismo que haberlo jugado**. Es el primer punto del playtest.

Para reproducir el tablero de prueba en 20 segundos: builder → **Labyrinth** → rook → `start`
a1, `goal` a8, `star` h1 → Save draft. Óptimo 3. Después `git checkout -- apps/web/content
apps/web/src/lib/game/generated`.

## Qué sigue, en orden

1. **Trabajo en LOCAL, sin base** (decidido con el founder): `pnpm dev` con `CONTENT_STAGE`
   vacío. El save escribe `content/exercises.json` + regenera el módulo **primero**; el overlay
   es el paso 2 y su fallo es parcial. Un sweep autorado así llega a prod **por el baseline**,
   en el commit. La migración se aplica al final, antes del push.
   ⚠️ Con `ADMIN_TOKEN` apuntando a prod, ese paso 2 intenta escribir en prod: dejalo vacío.
2. **Guardar un sweep de verdad y jugarlo** en el teléfono. En la torre jugar encontró 5
   defectos que los tests no vieron; en el alfil, 3; en el builder, 1 (el Export).
3. ✅ **Etapa 0 hecha** (`09d406af`) — pero **jugá la victoria**: que la primera estrella NO
   complete y la última sí es el único tramo que no pude ejercitar.
3. **Medir los 15 laberintos convertibles** (densidad, óptimos, alcance) y recién ahí convertir,
   con el builder. Los 4 del peón y los 15 juegos firma quedan fuera.
4. **Tercera pieza** con el patrón de 9 pasos. Caballo, peón, dama y rey tienen avisos de curva;
   el rey es el peor.

## Preguntas abiertas

- **`starFloor` no tiene control en el builder.** La columna existe y la API lo acepta; la UI no
  lo expresa, así que un record que ya lo trae lo conserva (viaja en `extraFields`) y uno nuevo
  no puede fijarlo. ¿Hace falta el control, o el piso se decide sólo por JSON?
- **El cap es 5** (`MAX_SWEEP_TARGETS`, el solver enumera órdenes). Nada pide más hoy.
- **El push a `origin/main` sigue pendiente y es tuyo.** Son **50** commits locales
  (`git rev-list --count origin/main..main`), acumulados desde el cierre de la torre.
