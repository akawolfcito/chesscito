# Spec — sweeps en el builder, y laberintos que piden dos estrellas

**Fecha:** 2026-08-11 · **Estado:** propuesto, sin construir
**Pedido del founder** (playtest del alfil, 2026-08-11), en sus dos partes:

> "así como subimos el esfuerzo en las jugadas nos hace falta lo mismo pero en los laberintos
> […] para todas las piezas incluyendo la torre que lo olvidamos, por defecto debe iniciar con
> 2 estrellas no con 1"
> "esto sería más sencillo con el builder y que hacerlo con la generación que la haces vos"

Aclarado en sesión: **2 estrellas que RECOGER** (sweep), no piso de recompensa.

---

## 1. Por qué el builder va PRIMERO

Hoy un sweep sólo se puede autorar editando `content/exercises.json` y corriendo
`import-puzzles` — o sea, **sólo yo**. El builder lo rechaza con un 400 explícito, y no por
capricho: `content_overlay` **no tiene** columnas `targets` ni `starFloor`, así que una fila
suya no puede representar un sweep. Está bloqueado en lectura (`mergeOverlay` conserva el
baseline) **y** en escritura, porque sólo con el de lectura guardar era un no-op silencioso.
→ `project_overlay_cannot_express_a_sweep`

Convertir 19 laberintos por JSON sería repetir a mano exactamente el trabajo que el founder
pide dejar de delegarme. **El builder primero; los laberintos después, con él.**

## 2. Alcance

### 2.1 El builder aprende sweeps

- **Migración**: `content_overlay` suma `targets text[]` (nullable) y `star_floor smallint`
  (nullable). Nullable y no default, para que las 32 filas `draft` y todo lo publicado sigan
  significando exactamente lo mismo.
- **Lectura**: `mergeOverlay` deja de conservar el baseline a la fuerza cuando la fila trae
  `targets`; el guard de "una fila no puede degradar un sweep" pasa a ser "una fila **sin**
  `targets` no puede pisar un baseline **con** `targets`". La degradación silenciosa sigue
  prohibida.
- **Escritura**: `POST /api/admin/content` acepta `targets` y valida en el MISMO validador que
  ya usa el import, sin una segunda copia de las reglas:
  1. `target` debe ser `targets[0]`;
  2. mínimo 2 objetivos, máximo `MAX_SWEEP_TARGETS` (5);
  3. sin repetidos y sin la casilla de salida;
  4. todos alcanzables → `computeSweepOptimal` no devuelve `null`;
  5. ⛔ **la pierna a `targets[0]` debe ser estrictamente más barata que el óptimo del sweep**,
     o el nivel colapsó a un tablero de un objetivo (lo exige `exercise-bfs.test.ts`);
  6. ⛔ **`optimalMoves` NUNCA se autora** — lo calcula el servidor al guardar.
  7. Para el alfil, además: **toda estrella del color de la salida**
     → `project_bishop_targets_must_share_start_colour`. Es consecuencia de (4), pero el
     mensaje de error tiene que decir *color*, no *inalcanzable*.
- **Formulario**: modo multi-estrella — agregar/quitar objetivos sobre el tablero, con el
  óptimo recalculado y visible al lado. El orden en la lista es presentacional salvo el primero.
- **Rechazos legibles**: el motivo viaja al builder sólo en 400 (`/api/dev/publish`); un 500
  trae `error.message` de Supabase y puede filtrar un connection string. No tocar eso.

### 2.2 Los laberintos piden dos estrellas

- **Alcance: los 19 laberintos normales.** Los 15 juegos firma quedan **fuera**: tienen solver
  propio y el BFS genérico no responde su pregunta, la responde con confianza sobre otro juego.
  → `feedback_the_decorative_wall_audit_cannot_judge_a_sweep`
  | pieza | normales | juegos firma |
  |---|--:|--:|
  | torre | 4 | 0 |
  | alfil | 2 | 3 (`diagonal-run`) |
  | caballo | 5 | 3 (`knight-tour`) |
  | peón | 4 | 3 (`promotion-run`) |
  | dama | 3 | 3 (`queens`) |
  | rey | 1 | 3 (`safe-path`) |
- ⛔ **El peón está bloqueado por diseño**, y no es un detalle de implementación:
  `computeSweepOptimal` lo **rechaza a gritos** porque un peón nunca retrocede, sus piernas no
  son independientes y la suma por pares no es el óptimo. Un óptimo mal calculado no es un
  nivel lento: es una corrida perfecta inalcanzable y un experimento que mide una mentira.
  → `project_pawn_never_retreats_makes_it_cheap`. **Los 4 laberintos de peón quedan fuera**
  hasta que exista un solver que conozca el peón. Quedan **15** convertibles.
- **Antes de convertir, medir**, igual que en las piezas: densidad, óptimos y alcance por
  laberinto. El orden de los escalones sale de la medición, no del gusto.
### 2.3 ⛔ ETAPA 0 — el runtime del laberinto NO es sweep-aware (verificado 2026-08-11)

La tarea 1 se corrió, y la respuesta cambia el orden del trabajo: **hoy autorar `targets` en un
laberinto no es "no soportado", es una falla SILENCIOSA que además regala estrellas.**

Cuatro evidencias, todas en el código actual:

1. **La victoria termina en la PRIMERA estrella.** `handleLabyrinthMove`
   (`exercises-screen.tsx:3581`) compara la casilla contra `activeLabyrinth.targetPos`:
   ```ts
   const reached = position.file === activeLabyrinth.targetPos.file &&
                   position.rank === activeLabyrinth.targetPos.rank;
   if (!reached) return;
   ```
   Y en un sweep **`targetPos` ES `targets[0]`**. Es exactamente el error que el carril 1 tiene
   documentado en mayúsculas sobre su propio handler (`exercises-screen.tsx:1805`:
   *"⛔ NOT `position === currentExercise.targetPos` […] ends the level on the FIRST star"*).
   El laberinto hace literalmente eso.
2. **El tablero no pinta las otras estrellas**: `sweepBoardTargets` y `sweepBoardCollected` se
   pasan como `undefined` cuando hay laberinto activo (línea 2987), a propósito y por una razón
   buena (que una casilla del ejercicio no atenúe la meta del laberinto).
3. **El contador vivo está apagado**: `!activeLabyrinth && sweepRun.totalCount > 1`.
4. **El grader es otro**: `labyrinthStars(moves, activeLabyrinth.optimalMoves)`, no las bandas
   relativas de `sweepStars`.

**Y la capa de CONTENIDO sí sabría.** `catalog.ts:339` calcula `computeSweepOptimal` para
cualquier entrada con `targets.length > 1`, sin mirar el bucket — así que un laberinto con dos
estrellas quedaría con el óptimo **alto y correcto**, la pantalla mostraría **una**, el nivel
terminaría al pisarla, y `labyrinthStars` compararía los movimientos contra un óptimo que el
jugador nunca tuvo que recorrer: **3★ por medio nivel, en silencio, y el best guardado
envenenado**. Sin un solo error en consola.

⛔ **Por eso la Etapa 0 va antes que la migración y antes que todo contenido**: hacer el runtime
del laberinto sweep-aware (colección con orden libre + dedup vía `sweep-run.ts`, completion sólo
en la última estrella, tablero con todas las metas y las recogidas atenuadas, contador, y el
grader correcto). El carril 1 ya tiene todas esas piezas escritas y probadas; el trabajo es
**conectarlas**, no inventarlas.

⚠️ Mientras la Etapa 0 no exista, el guard barato es que el validador **rechace `targets` en el
bucket `labyrinth`**. Un 400 explícito es infinitamente mejor que 3★ regaladas en silencio.

## 3. Lo que NO entra

- Los 15 juegos firma.
- Los 4 laberintos de peón (ver arriba).
- Tocar `rook-1` / `bishop-1`: son las puertas del producto y los controles del experimento.
- **Agregar ejercicios** a un pool de 10: el gate de la insignia es 80% y de 10 a 11 sube de 8
  a 9, dejando `locked` a quien la tenga ganada sin reclamar.

## 4. Riesgos

1. **La migración toca la tabla que sirve el contenido en prod.** Columnas nullable, sin
   default, desplegadas antes que la ruta que las escribe.
2. **El validador duplicado.** Si el builder se escribe su propia copia de las reglas, el JSON
   y el builder empiezan a diferir y el bug aparece meses después, en una fila publicada. Un
   solo validador, importado por los dos.
3. **El linter de muros decorativos ya está exento de sweeps** — si el builder muestra ese
   audit, tiene que respetar la exención o volverá a mentir con seguridad.

## 5. Orden

0. ⛔ **ETAPA 0 — hacer sweep-aware el runtime del laberinto** (§2.3). Ya no es una pregunta:
   se verificó que no lo es, y que autorar `targets` ahí hoy regala estrellas en silencio.
   Guard barato mientras tanto: el validador rechaza `targets` en el bucket `labyrinth`.
1. Migración (`targets`, `star_floor`) + validador compartido + API.
2. Formulario multi-estrella.
3. Medir los 15 laberintos convertibles.
4. Convertir, **con el builder**, y jugar.

⚠️ Las etapas 1 y 2 (el builder) **no dependen** de la Etapa 0 si el validador rechaza
`targets` en laberintos: se puede construir el builder para EJERCICIOS y abrir los laberintos
después. Es la forma de que el founder empiece a autorar sweeps sin esperar al runtime.
