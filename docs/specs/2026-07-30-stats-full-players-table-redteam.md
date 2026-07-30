# Red team — Tabla completa de jugadores en `/stats`

**Spec revisado:** `2026-07-30-stats-full-players-table.md`
**Fecha:** 2026-07-30
**Veredicto:** **NEEDS REVISION** — tres bloqueantes. El más grave es que **la invariante
que el spec declara en §6 es falsa en producción**, y falla justo en la dirección que esta
tabla existe para cerrar.

---

## Bloqueantes

### F1 ⛔ La invariante de §6 no se sostiene: el hero es en vivo, la tabla es de hace una hora

§6 declara:

> *"El total que muestra la tabla y el total que muestra el hero de Leaders son el mismo
> número, porque son el mismo conteo sobre la misma relación."*

La segunda mitad es cierta y la primera no se sigue de ella. **Son el mismo conteo en
momentos distintos:**

- El hero de Leaders lo sirve `/api/leaderboard` **en cada request** — 17, medido hoy.
- `/stats` lo sirve el snapshot de `unstable_cache` con `revalidate = 3600`.

Entonces, durante **hasta una hora** después de que un jugador nuevo entre al ranking,
Leaders dice **18** y la tabla que existe para auditar ese número muestra **17 filas y
dice 17**. El jugador cuenta, no le da, y concluye que uno de los dos miente.

Es literalmente el defecto de [[feedback_an_unauditable_number_reads_as_a_lie]], reintroducido
por la capa de cache que el spec eligió — y con un agravante: acá el número que no cierra
está en **la pantalla que prometía dejarlo cerrar**.

**Corrección, dos partes:**

1. **El sello de tiempo va PEGADO al total de la tabla**, no sólo en el header de la página.
   La página ya trae *"Updated hourly · As of …"* arriba de todo (`stats-page.tsx:747`), pero
   la tabla vive ocho secciones más abajo: para cuando llegás, ese sello no está en pantalla.
   La regla que ya nos costó una ronda es que **la declaración va en la misma superficie donde
   se hace la afirmación**.
2. **Reformular la invariante** a lo que sí es verdad y sí es testeable: *el total de la tabla
   y el del hero salen de **la misma función de conteo sobre la misma relación**, y cualquier
   diferencia es antigüedad del snapshot, nunca método.*

### F2 ⛔ `stats-page.tsx` es un Server Component y el spec le pide estado de paginado

`components/stats/stats-page.tsx` **no tiene `"use client"`** — se renderiza desde el
Server Component de la ruta. El paginador de §5.1 (Prev/Next, `Page N of M`) necesita
`useState`, que ahí no existe.

El spec no menciona esto en ningún lado: ni en el contrato (§4), ni en el plan (§7), ni en
la frontera de cambio (§7.1), que lista `stats-page.tsx` como si agregar un bloque con
estado fuera lo mismo que agregar uno estático.

**Corrección:** un componente cliente chico y dedicado — `components/stats/players-table.tsx`
con `"use client"` — que recibe las filas ya derivadas por props. **No convertir
`stats-page.tsx` (1537 líneas) a cliente**: arrastraría todo el dashboard al bundle para
resolver un Prev/Next.

⚠️ Y agregar ese archivo **amplía la frontera de §7.1**, que hoy no lo contempla. Si no se
actualiza, la primera etapa que lo cree va a parecer un desborde del cluster según el propio
criterio del spec.

### F3 ⛔ Un conteo que falla esconde una tabla que sí tiene datos

§5 dice: *"Query falló (`playersFull: []` con `playersTotal: null`) → la sección se oculta
entera"*. Pero son **dos lecturas independientes**: las filas y el conteo. El spec sólo
contempla que fallen juntas.

Si las filas vuelven bien y **el conteo falla**, queda `playersFull: [17 filas]` con
`playersTotal: null` — y la regla escrita **esconde una tabla poblada**. Se pierde
exactamente el dato que el usuario vino a buscar, por no poder imprimir un número al lado.

**Corrección:** la tabla se oculta **sólo cuando no hay filas**. Con filas y sin conteo,
renderiza las filas y **omite el total** (no lo cae a `rows.length`, que es el defecto que ya
hay un source guard prohibiendo en Leaders).

---

## No bloqueantes

### F4 ⚠️ En all-time los empates se desempatan por **wallet**, y eso sólo se nota en un censo

`leaderboard_full_v` ordena:

```sql
RANK() OVER (ORDER BY SUM(sub.best_score) DESC, sub.player ASC)
```

El desempate es **la dirección de la wallet, ascendente**. En un podio de 10 no se nota. En
un censo, dos jugadores con el mismo score aparecen uno encima del otro y **la razón del
orden no está en la pantalla** — es un campo que prometimos no exponer nunca
([[project_custom_name_never_leaves_the_device]], Identity Lite).

Peor: **es inconsistente con la decisión de producto que ya tomamos para weekly**, donde el
desempate es *"quién llegó primero"*. Dos ventanas del mismo ranking desempatan con criterios
distintos, y una de las dos usa un dato invisible.

No bloquea porque hoy no hay empates visibles, pero **hay que decidirlo antes de que los
haya**, no después de que alguien pregunte.

### F5 ⚠️ Al techo de filas, ~30% de probabilidad de dos nicknames idénticos

El nickname sale de `deriveAvatarVariant`: 6 piezas × 6 estilos × 10000 números =
**360.000** combinaciones. Por cumpleaños:

| Jugadores | P(al menos una colisión de nombre) |
|---|---|
| 17 (hoy) | ~0,04 % |
| 100 | ~1,4 % |
| 500 (el techo) | **~29 %** |

En el podio de 10 es despreciable. En un censo —que **invita a escanear la lista**— dos filas
*"Golden Queen 4471"* se leen como duplicado o bug.

**Corrección (barata, ahora):**
- Las filas se keyean por **`rowId`, nunca por nickname**. Keyear por nombre haría que React
  colapse filas y avise en consola.
- **No deduplicar por nombre** en ningún punto. ⚠️ `aggregateTopMinters` **sí** deduplica por
  `rowId` — copiar ese patrón acá borraría jugadores.
- **No escribir un test que fije unicidad de nombres visibles**: sería afirmar algo falso.

🟢 **Descartado tras medirlo:** colisión de `rowId`. Es FNV-1a de 32 bits (`hashSeed`), espacio
~4,3e9 → ~3e-5 a 500 filas. No es un problema, y no hay que gastar nada en él.

### F6 ⚠️ El aviso de truncamiento se renderiza a ocho secciones de la tabla que describe

§4.1 dice que el techo *"reusa el aviso de `dataIntegrity` que la página ya tiene"*. Ese aviso
vive arriba de todo (`stats-page.tsx:759`), a propósito, porque describe lecturas de toda la
página. La tabla está al fondo.

Un lector que llega a la tabla truncada no tiene el aviso en pantalla. Es el mismo problema de
adyacencia que F1. **El techo se declara en el encabezado de la tabla**, y que el aviso global
siga haciendo lo suyo.

### F7 ⚠️ El test de §6 cruza la frontera que §7.1 declara

§6 propone comparar el total de la tabla contra *"el `total` del endpoint de Leaders"*. Eso
toca `/api/leaderboard`, que §7.1 pone explícitamente fuera del cluster.

Y además es la clase de test que **pasa en verde mientras los dos números divergen en
producción** (F1): mockeás la vista, los dos leen el mock, coinciden. El cache no está en el
test.

**Corrección:** hacer la invariante cierta **por construcción** — un solo
`countRankedPlayers` compartido — y testear eso: que el aggregator de `/stats` llama a la
**misma función** que alimenta el hero. Es una aserción sobre el acoplamiento, que es lo que
realmente queremos garantizar.

---

## Lo que verifiqué y está bien

- **Sin migración.** `leaderboard_full_v` existe desde `20260611120000` y es la relación sin
  cortar; `service_role` la lee (medido en prod 2026-07-29).
- **Los `rank` son únicos.** El `ORDER BY` incluye `sub.player`, así que la clave de orden es
  total y `RANK()` no produce números repetidos. **No hay estado "dos filas rank 5"** — lo
  descarto explícitamente para que nadie lo reabra. Lo que sí queda abierto es F4: los rangos
  son únicos, pero el criterio que los separa es invisible.
- **La decisión de que la tabla sea global** (§2) está bien fundada y medida: alltime es global
  y da 17, weekly es surface-scoped y da 4.
- **Identity Lite ya cubre el payload.** `LeaderboardIdentityRow` no lleva wallet y el mapeo es
  server-side.

---

## Cambios al plan de trabajo

| # | Etapa | Cambio |
|---|---|---|
| 1 | `fetchFullLeaderboardFromDb` | sin cambios |
| 2 | Identity Lite en el aggregator | + F3: filas y conteo son fallos **independientes** |
| 3 | Cache propia sin filtros | sin cambios |
| 4 | 🆕 `players-table.tsx` **cliente** | F2 — y actualizar la frontera de §7.1 |
| 5 | Render + paginado + adyacencia | + F1.1 (sello de tiempo pegado al total), F5 (key por `rowId`), F6 (techo en el encabezado) |
| 6 | Inserción después del podio | sin cambios |
| 7 | Invariante por construcción | F7 — reemplaza el test cruzado |

**Antes de la etapa 5, una decisión de producto pendiente:** F4, el criterio de desempate.
