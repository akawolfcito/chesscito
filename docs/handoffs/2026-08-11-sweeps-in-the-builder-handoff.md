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

## Qué sigue, en orden

1. **Aplicar la migración** (arriba) y **jugar el builder**: pintar un sweep de dos estrellas en
   un ejercicio nuevo, guardarlo, promoverlo y abrirlo en el teléfono. En la torre y en el alfil,
   jugar encontró lo que los tests no: cinco defectos y tres. No hay motivo para creer que acá no.
2. **Etapa 0 — el runtime del laberinto sweep-aware** (spec §2.3). Hoy está tapado por el
   validador (un laberinto con `targets` es un 400), así que ya no regala estrellas en silencio;
   pero mientras no exista, **ningún laberinto puede pedir dos estrellas**, que era la mitad del
   pedido original. El carril 1 ya tiene todas las piezas escritas y probadas: es conectarlas.
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
