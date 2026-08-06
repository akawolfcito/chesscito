# A1 resuelto + diseño para cerrar el hueco de ranking

**Fecha:** 2026-08-05 · **Rama:** `main` (`cceed76b`) · **Alcance:** solo lectura.
No se modificó código, schema, Vercel ni producción. Continúa
`docs/audits/2026-08-05-content-capacity-audit.md`.

---

## Titular

El límite existe, está deployado y vale **5** — más estricto que el default de 10.
**No falló: nunca se aplicó a esas sesiones.** Entrar por `?slot=daily` —que es el CTA
#1 del content loop y el hero del hub— apaga la única compuerta que lo aplica, mientras
el contador sigue sumando en silencio.

Y el hueco de ranking resultó **mucho más chico de lo que temíamos**: 3 filas de 2
wallets sobre el techo, todas explicables por el pool viejo del alfil. Nadie tocó el
headroom de 10×.

---

# Parte A — El límite efectivo de sesión

## A.1 Vercel (solo `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT`)

| Proyecto | ¿Existe? | Entornos | Valor efectivo | Última modificación | ¿El último deployment lo incorporó? |
|---|---|---|---:|---|---|
| `chesscito` (play) | Sí | Preview, Production | **`"5"`** | hace 40 días | **Sí** — último Production Ready hace 3 h |
| `lite-chesscito` (learn) | Sí | Preview, Production | **`"5"`** | hace 27 días | **Sí** — último Production Ready hace 3 h |

- **No está en Development** en ninguno de los dos. En local cae al default del código.
- Preview y Production tienen **el mismo valor** (5) en ambos proyectos.
- Listado sin filtro de entorno, como exige [[feedback_vercel_env_ls_filtered_hides_entries]].
  Valor leído con `vercel env run -e <target> --project <name>`, imprimiendo **solo esta
  variable**. No se pulló ningún `.env` ni se mostró ninguna otra clave.
- Es `NEXT_PUBLIC_*` ⇒ se inlinea en build. Ambos proyectos tienen Production Ready de
  hace 3 h, muy posterior a los 40/27 días de la variable ⇒ el build vivo la leyó.

⚠️ **El valor de producción (5) es la MITAD del default del código (10)**, que se subió a
10 en `624e67e7` (2026-07-09) con el mensaje "raise the session limit to 10 exercises".
La variable de `chesscito` es de hace 40 días — o sea **anterior** a ese commit. Producción
quedó pinneada en el valor viejo y el "raise" no llegó a ningún jugador.

## A.2 Traza en código — los 12 puntos

**1. Dónde se declara `SESSION_EXERCISE_LIMIT`**
`apps/web/src/lib/daily/session-quota.ts:30`.

**2. Dónde se lee la variable**
`session-quota.ts:31`, dentro de `parseSessionLimit(process.env.NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT)`.
Un solo lector. `parseSessionLimit` (`:25`) rechaza no-numérico y ≤0.

**3. Default y hard max**

| Constante | Valor | Con env=5 |
|---|---|---:|
| `SESSION_EXERCISE_LIMIT` | `parseSessionLimit(env)`, default **10** | **5** |
| `FREE_EXTRA_QUOTA` | `= SESSION_EXERCISE_LIMIT` | 5 |
| `PACK_EXTRA_SLOTS` | 5 | 5 |
| `MAX_PAID_PACKS` | 2 | 2 |
| `HARD_MAX_EXTRAS` | `FREE + 5×2` (comentario dice "15 by default") | **15** |

**4. ¿Solo lite/learn o también play?**
**Solo learn.** El contador se incrementa dentro de `if (CHESSCITO_LITE_MODE)`
(`exercises-screen.tsx:1771`) y el estado de display se calcula bajo
`if (!CHESSCITO_LITE_MODE || isFreeSlot) return` (`:757`). `CHESSCITO_LITE_MODE` **es**
`mode === "learn"`. **En play no existe límite alguno.** Hoy no importa —cero intentos
con `surface='play'` en producción— pero es la respuesta.

**5. Qué acción incrementa el contador**
Exactamente una: llegar al target de un ejercicio en `handleMove`, línea 1772:
`recordExtraConsumed(buildContentId("exercise", selectedPiece, currentExercise.id))`.
Es el **único** call site en todo el bundle.

**6. ¿Cuenta ejercicios, intentos, completaciones o niveles únicos?**
**Niveles únicos completados.** El estado guarda `consumedContentIds: string[]` y
`recordExtraConsumed` es idempotente por id: rejugar el mismo ejercicio no consume un
segundo slot. No cuenta intentos ni entradas — cuenta *ids distintos resueltos hoy*.

**7. ¿Incluye carril 2?**
**No, y es asimétrico.** `buildContentId` soporta `kind:"labyrinth"`, y el drawer
consulta ese id en `isLabReplayable` (`exercise-drawer.tsx:159`) — pero **nadie lo
escribe nunca**. Consecuencias:
- completar un juego firma **no gasta** slot;
- una vez al límite, todo nodo de carril 2 **no completado** queda bloqueado el resto
  del día, porque el id que lo desbloquearía no puede existir.

**8. ¿Se reinicia por día, sesión, navegador o instalación?**
Por **día UTC y por instalación de navegador**. `parseDailySession` devuelve estado
fresco cuando `parsed.date !== todayUtc()` (`:66`). No hay noción de "sesión": una
recarga conserva el contador. No está atado a la wallet — dos wallets en el mismo
navegador comparten contador; la misma wallet en dos navegadores tiene dos.

**9. Dónde se persiste**
`localStorage`, clave de `dailySessionStorageKey` (`lib/lite-progress-storage`). Cero
servidor. `focus_day_ledger` **no** es esto: ese es el Daily, y son cosas distintas (D17).

**10. Cómo puede omitirse o resetearse**
Cinco caminos, en orden de probabilidad real:

| # | Camino | ¿Requiere intención? |
|---|---|---|
| **a** | **Entrar con `?slot=daily` o `?slot=challenge`** | **No — es el flujo normal** |
| b | Borrar el site data / modo incógnito / otro navegador | Sí |
| c | Editar la clave de localStorage a mano | Sí |
| d | Jugar en `play` en vez de `learn` | No |
| e | Cruzar la medianoche UTC | No |

**11. Cómo ocho wallets registraron 47–64 niveles distintos en un día**

La causa es **(a)**, y no es un bug de borde: es el camino principal.

`isFreeSlot = slot === "daily" \|\| slot === "challenge"` (`exercises-screen.tsx:386`)
se usa en **un solo lugar** (`:757`): el `useEffect` que produce `quotaDisplayState`.
Ese estado es el **único** insumo de las dos superficies que aplican el límite —
el banner "Great focus today" (`:3645`) y el `quotaState` del drawer (`:4003`).
Con `slot=daily`, `quotaDisplayState` queda `null` para siempre ⇒
`quotaState={null}` ⇒ `isExerciseReplayable` devuelve `true` en la primera línea
(`exercise-drawer.tsx:146`) ⇒ **ningún nodo se bloquea nunca**.

Y `recordExtraConsumed` (`:1771`) **no** está gateado por `isFreeSlot` — solo por
`CHESSCITO_LITE_MODE`. Así que el contador sube igual: la sesión gasta slots que nadie
va a leer.

Quién manda a los jugadores ahí:
- `lib/hub/content-loop.ts:94` — variante `daily-pending`, **prioridad #1 de las diez**;
- `lib/hub/hero-cta.ts:47` — el CTA principal del hub.

O sea: **el botón más grande de la app entrega una sesión sin límite.** Basta entrar una
vez por ahí; el `slot` vive en la URL de la pantalla y la navegación entre ejercicios es
estado de cliente, así que no se pierde en toda la sesión.

Dos refuerzos que lo hacen indoloro cuando el límite *sí* aplica:
- `shouldFreezeScoring = liteMode && isReplay && isSessionOver` — **una resolución fresca
  nunca se congela** (`session-quota.ts:129`, commit `9644ce52`). Al límite se pierde el
  acceso a contenido nuevo por el drawer, pero nada de lo resuelto se descarta.
- `DailyLimitGuard` (`components/daily/daily-limit-guard.tsx`) —la pantalla dura de
  "Great focus today. Come back tomorrow"— **está desconectada**: `exercises/page.tsx:93`
  documenta su remoción en B2.3b. Es código muerto que todavía compila.

**12. Relación entre el límite y las jornadas de exactamente 100 `score_attempts`**

**Ninguna. Son dos presupuestos distintos que no se hablan.**

| | Límite de sesión diaria | Presupuesto de sesión de escritura |
|---|---|---|
| Qué mide | ids de ejercicio resueltos hoy | filas escritas por token |
| Valor | 5 (prod) | `max_saves = 100` |
| Dónde | `localStorage`, cliente | `score_write_sessions`, servidor |
| Alcance | por navegador, por día UTC | por token (2 h), por wallet+superficie |
| Cuenta carril 2 | no | sí |
| Cuenta reintentos | no (idempotente) | no (replay consume cero) |
| Se puede evitar | sí, con `?slot=daily` | no |

El 100 **no es** el límite de contenido: es el techo del token de escritura, y es lo
único que efectivamente frenó a esas wallets. De 1.008 sesiones de escritura en prod,
solo **6 se agotaron** (0,6%) — y **6 de esas 6 son de las 8 wallets extremas**.
Dicho de otro modo: **el único freno que funcionó fue el que ninguno de nosotros diseñó
como freno de contenido.**

(Nota: 7 sesiones viejas de 4 wallets todavía tienen `max_saves = 25`, de antes del
bump 25→100.)

---

# Parte B — Clasificación de las cuentas extremas

Definición operativa: las **8 wallets con ≥40 `exercise_id` distintos**. Todo con tags
`md5`; no se intentó desanonimizar y no se tocó ningún dato personal.

## B.1 Señales medidas

| Señal | Medición | Lectura |
|---|---|---|
| **Sesiones de escritura** | 1–7 por wallet, `max_saves`=100, 6/8 agotadas | Consumo real, no inyección |
| **Superficies** | `learn` 100%, `play` 0, una sola superficie por wallet | Sin cambio de superficie |
| **Duración de la ráfaga** | 20, 25, 29, 32, 41, 65, 101 min y una de 1.456 min (2 días) | 7 de 8 en **una sentada de 20–65 min** |
| **Gap mediano entre intentos** | 5,4 – 18,2 s | Plausible humano en contenido de 1–2 movimientos |
| **Gaps < 3 s** | 37–52 por wallet (≈40%) | Rápido, no imposible |
| **Gap mínimo** | 0,0 s | Ver B.2 — artefacto de dos carriles |
| **`time_ms` mediano** | 3,6 – 8,1 s | Coherente con resolución manual |
| **`time_ms` mínimo** | 1 ms | Artefacto de instrumentación, no bot (B.2) |
| **Origen del `attempt_id`** | ~60% `client`, ~40% `server` | Dos carriles del bundle, no dos clientes |
| **Reparto horario global** | Las 24 horas UTC, 5–20 wallets por hora | Tráfico mundial, no una granja |

## B.2 Dos señales que parecían delatoras y no lo son

**`time_ms = 1`.** `timerStart` se setea en el **primer movimiento**
(`exercises-screen.tsx:1723`), y un ejercicio de `optimalMoves: 1` llega al target *en*
ese movimiento ⇒ `elapsed ≈ 0` ⇒ `Math.max(1, elapsed)` = 1 ms. Lo produce el reloj, no
el jugador. Los 59 ejercicios incluyen varios de un solo movimiento.

**"Regresiones de score" (mi detector de wipe de localStorage).** Medí 37 regresiones en
6 niveles para la wallet líder y las vi en 20+ wallets. **El detector está roto**, y así
lo demuestra el corte por carril:

| Carril | Filas comparables | Filas que "regresan" | % |
|---|---:|---:|---:|
| `graded` / `client` (carril con **cola** persistida) | 3.380 | 1.563 | **46,2%** |
| `ungraded` / `server` (auto-save **directo**) | 2.049 | 1 | **0,0%** |
| `starless` / `client` | 21 | 0 | 0,0% |

Un 46% contra un 0% no es comportamiento de jugador: es **orden de llegada**. El carril
de intentos encola en `localStorage` y drena FIFO de a uno (`use-attempt-outbox.ts:252`),
mientras el auto-save de puntaje va directo. El snapshot de `score` se captura al
reportar (`:3117`) y además va **un solve atrasado** —`score` es un `useMemo` sobre estado
de React que todavía no se actualizó cuando corre `reportAttempt`—, así que una fila
encolada vieja se inserta después de una directa nueva y aparenta retroceso.
Confirmación por tamaño de caída: **1.457 de ~1.564 son de 100, 200 o 300 puntos**, o sea
exactamente el valor de un ejercicio. Y los 50 "resets al piso" (score=100 viniendo de
>500) son el mismo artefacto amplificado: 100 es lo que reporta el **primer** intento de
una pieza nueva, antes de que ninguna estrella esté en estado.

**Consecuencia honesta: no tengo forma de detectar resets de localStorage con estos
datos.** El campo que lo revelaría lo contamina el propio pipeline. Lo dejo como no
medible, no como negativo.

## B.3 Veredicto por hipótesis

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| **QA interna / device de prueba** | **Improbable** | 8 wallets distintas, en 3 días distintos, repartidas por todo el reloj UTC. Un QA reusa wallet y concentra horario. |
| **Automatización / bot** | **Improbable** | Gaps medianos de 5–18 s con cola larga hasta 480 s y `time_ms` mediano de 4–8 s. Un bot no varía así ni descansa 8 minutos. |
| **Uso humano orgánico, sesión larga** | **La explicación que sobrevive** | Ráfaga única de 20–65 min, cadencia irregular, contenido inicial trivial (1–2 movimientos), sin repetir superficie ni wallet |
| **Reset de localStorage** | **No medible** | Ver B.2 |
| **Múltiples sesiones de escritura** | **Confirmado, y es consecuencia** | 1–7 sesiones por wallet; se renuevan al agotar las 100 escrituras |
| **Cambio de superficie** | **Descartado** | 100% `learn`, una superficie por wallet |
| **Ráfagas temporalmente imposibles** | **Ninguna** | Gap mínimo 0,0 s explicado por el interleave de dos carriles; ningún tramo exige velocidad sobrehumana sostenida |

## B.4 ¿Deben influir en la planificación de contenido?

**Sí, pero como cota superior, no como perfil objetivo.**

Son consistentes con humanos reales que agarraron la app con `?slot=daily` y jugaron
hasta que el token de escritura los cortó. No hay que descartarlos de la planificación
—son señal genuina de apetito— pero tampoco dimensionar el catálogo para ellos: son
**8 de 443** (1,8%), y **434 de 443 jugaron un solo día**. Planificar para el 1,8% que
consume 60 niveles de una sentada produce el número absurdo de la auditoría anterior
(960 ejercicios para 30 días).

**La lectura correcta:** ese apetito es exactamente lo que el límite de 5 estaba pensado
para dosificar. No hay que autorar 960 ejercicios — hay que hacer que la compuerta que ya
existe efectivamente se aplique. Con el límite operativo, los 78 niveles rinden ~15 días
por jugador en vez de una tarde.

---

# Parte C — Diseño para proteger el ranking (propuesta, sin implementar)

## C.0 Lo primero: el hueco es mucho más chico de lo que dijimos

| Medición | Resultado |
|---|---|
| Filas sobre el techo legítimo, `score_saves` | **3** (2 wallets, todas `level_id=2`, todas exactamente 3000) |
| Filas sobre el techo, `score_attempts` | **0** |
| Filas sobre el techo, `scores` (on-chain) | **0** |
| Score máximo observado en cualquier tabla | **3.000** (= el techo de un pool de 10) |
| Filas con `score` no múltiplo de 100 | **0 de 9.317** |

Las 3 filas son alfil a 3000 = 10 ejercicios × 3★ × 100, el pool que tenía antes del
audit de currículo B4.3. **Es progreso legítimamente ganado sobre un catálogo más
grande, no abuso.** Nadie tocó el headroom de 30.000: el margen sin usar es de 10×, y
sigue intacto.

Esto reordena la urgencia: **no estamos conteniendo un incendio, estamos cerrando una
puerta antes de que alguien la pruebe.**

## C.1 Opción 1 — Parche mínimo: bound por pieza server-side

**Qué**: en `validateScoreSaveBounds` (`lib/scores/save-authorization.ts:136`), reemplazar
el `MAX_SCORE_PER_LEVEL` único por un techo por `level_id`.

**Techo legítimo por nivel** (baseline actual):

| `level_id` | Pieza | Pool | Techo ★ | Techo score |
|---:|---|---:|---:|---:|
| 1 | rook | 10 | 30 | 3.000 |
| 2 | bishop | 9 | 27 | 2.700 |
| 3 | knight | 10 | 30 | 3.000 |
| 4 | pawn | 10 | 30 | 3.000 |
| 5 | queen | 10 | 30 | 3.000 |
| 6 | king | 10 | 30 | 3.000 |
| | | | | **17.700** |

**⛔ El bound NO puede derivarse del catálogo merged.** Es el error que causó el incidente
del 2026-07-09 y `score.ts:20-26` lo documenta: `getMergedCatalog` es `unstable_cache`
(TTL 60 s, timeout de 2 s, fallback a baseline), así que la página y la ruta pueden
resolver catálogos distintos y el jugador honesto come un 400 intermitente sin repro.
Además pondría Supabase en el camino de guardado.

**El diseño que evita repetirlo**, en tres reglas:
1. El techo sale del **baseline compilado** (`GENERATED_EXERCISES[piece].length * 3 * 100`),
   determinístico por deployment, cero IO.
2. Se le suma un **headroom de overlay**: `mergeOverlay` puede **agregar** filas
   (`merged-catalog.ts:237`), así que un ejercicio publicado por el builder sube el techo
   real por encima del baseline del deployment. Sin headroom, el primer ejercicio nuevo
   rompe el guardado de esa pieza — la forma exacta del incidente. Propuesta:
   `techo = baseline + OVERLAY_HEADROOM_EXERCISES(≥10) × 3 × 100`, con
   `lib/content/pool-capacity.ts` (que ya proyecta el pool merged como **unión de
   conjuntos**) verificando en el write del builder que el pool no supere el headroom.
3. **Falla abierta hacia `MAX_SUBMITTABLE_SCORE`** si el techo por pieza no se puede
   resolver. Un guard que falla cerrado sobre el camino de guardado es peor que el hueco
   que cierra.

**Efectos**

| Superficie | Efecto |
|---|---|
| `score_saves` | Solo escrituras **nuevas**. Las 3 filas históricas quedan. |
| `score_attempts` | Ninguno hoy (0 filas sobre techo). Mismo bound, misma ruta. |
| All-time | Techo baja de 180.000 a ~17.700 + headroom. Ranking vivo **no se mueve**: el máximo real es 14.900. |
| Weekly | Idem, y como se recalcula por semana, se corrige solo. |

**Scores históricos sobre el techo: dejarlos.** Son 3 filas de 2 wallets que ganaron esas
estrellas de verdad sobre un pool que existía. Revocarlas castiga a un jugador honesto por
una decisión interna de currículo — el mismo principio que ya fijamos en
[[project_retired_lane_preserves_mastery]]. Si algún día molesta, se recorta **en lectura**
(la vista), nunca borrando filas.

**Tests**
- Tabla `level_id → techo` pinneada en test, como ya está `MAX_SUBMITTABLE_SCORE`
  (`score.test.ts`), para que subirla sea deliberado.
- Property: para cada pieza, `poolSize*3*100 ≤ techo(level)` sobre el baseline —
  falla el build si un pool crece más que el headroom.
- Frontera: `techo` acepta, `techo+1` rechaza con `invalid`, por los 6 niveles.
- Regresión del incidente: un pool que crece vía overlay dentro del headroom **sigue
  guardando** (es el test que no existía en 2026-07-09).
- Fail-open: catálogo irresoluble ⇒ se acepta hasta `MAX_SUBMITTABLE_SCORE`, no 400.

**Rollback**: una constante. Volver `techo(level)` a `MAX_SUBMITTABLE_SCORE` para los seis
restaura el comportamiento actual sin migración ni redeploy de schema.

**Limitación, y es la que importa**: **no es anti-cheat, es validación de rango.** El
progreso por ejercicio sigue en localStorage; el servidor nunca lo ve. Después del parche
cualquiera puede seguir posteando **17.700 sin haber jugado nada** — solo que ya no puede
postear 180.000. Baja el techo del fraude; no lo elimina. Decir otra cosa sería repetir la
afirmación falsa que `6b93469` metió en el repo y que `score.ts` tuvo que corregir.

## C.2 Opción 2 — Solución fuerte: crédito por ejercicio en servidor

**Qué**: el servidor ya calcula `stars_earned` por intento (`attempt-grading.ts`, D12) y
ya lo persiste en `score_attempts`. Falta el paso corto: **materializar el mejor por
ejercicio y derivar el score de ahí.**

- Tabla nueva `exercise_best(wallet, exercise_id, best_stars, updated_at)`,
  `UNIQUE(wallet, exercise_id)`, escrita con `ON CONFLICT ... DO UPDATE WHERE excluded >`
  dentro de **la misma transacción** de `save_score_attempt`.
- `score(wallet, level) := SUM(best_stars WHERE exercise_id ∈ pool(level)) * 100`,
  calculado en servidor.
- El `score` del cliente pasa a ser **ignorado** en el ranking (se puede seguir aceptando
  para telemetría, o dejar de pedirlo).
- Los boards leen el score derivado en vez de `MAX(score)` por nivel.

**Efectos**

| Superficie | Efecto |
|---|---|
| `score_saves` | Deja de ser fuente del ranking; queda como historial. La cuota free/peones que cuelga de ella hay que reubicarla. |
| `score_attempts` | Sin cambio de forma; gana un side-effect en la misma transacción. |
| All-time | `leaderboard_combined_v` se reescribe. ⚠️ Une `scores` (on-chain) — esas filas **no tienen `exercise_id`** y no se pueden derivar. Hay que decidir si el rail on-chain sobrevive, se congela o se abandona. |
| Weekly | `weekly_ranking` pasa a sumar estrellas ganadas en la ventana. Cambia lo que el board *significa* (deja de ser "tu total actual" y pasa a ser "lo que ganaste esta semana") — es un cambio de producto, no solo técnico. |

**Limitación estructural, y hay que decirla fuerte:** esto **no** recupera el progreso
existente. `exercise_best` solo puede reconstruirse de `score_attempts`, que
(a) nació el 2026-07-29 y (b) solo trae `exercise_id` en el **60%** de sus filas —
el otro 40% es el carril de auto-save, que no lo manda. Un backfill produciría
un ranking donde el jugador de junio aparece en cero. Hace falta un período puente
(máximo entre score declarado y score derivado) o aceptar el reset y comunicarlo.

**Tests**: monotonía de `best_stars` (nunca baja); idempotencia del replay (un reintento
no infla); suma derivada == suma de las estrellas del grader sobre un recorrido completo;
concurrencia de dos intentos del mismo ejercicio; equivalencia del board derivado vs. el
declarado durante el puente.

**Rollback**: caro. Una vez que los boards leen la tabla derivada, volver atrás exige
que `score_saves` haya seguido escribiéndose en paralelo todo el puente. Ese doble
escritura **es** el plan de rollback, y hay que sostenerlo hasta cortar.

## C.3 Comparación y recomendación

| | Opción 1 — bound por pieza | Opción 2 — score derivado |
|---|---|---|
| Cierra el 10× | Sí | Sí |
| Cierra el fraude | **No** (17.700 sigue posteable) | Sí |
| Toca schema | No | Sí (tabla + reescritura de boards) |
| Toca boards vivos | No | Sí (all-time y weekly) |
| Riesgo de romper a un honesto | Bajo, si falla abierta | Medio-alto (progreso previo a 07-29) |
| Rollback | Una constante | Doble escritura sostenida |
| Tamaño | ~1 día | Cluster |

**Recomendación: P1 para la Opción 1, ya. P1 diferido para la Opción 2, con spec propio.**

**Por qué no es P0.** El hueco existe hace meses y el máximo observado (14.900) está
**debajo** del techo legítimo: nadie lo probó. No hay premio, token ni pago atado al
ranking, así que hoy el daño es reputacional y no económico. Sube a **P0 el día que el
ranking pague algo** — y ese día no hay tiempo de hacer la Opción 2.

**Por qué tampoco es P2.** El board es público y es entregable del listing de MiniPay
([[project_stats_page_is_a_minipay_requirement]]). Un solo POST curioso lo pone en el
primer puesto con un número absurdo, y eso se ve.

**Secuencia propuesta:**

1. **Antes que todo esto: cerrar el bypass de `?slot=daily`** (Parte A, punto 11). Es
   media hora, es la causa medida de A1, y hasta que no esté, cualquier plan de contenido
   se dimensiona contra un ritmo que el producto no quería permitir. **Es el trabajo de
   mayor retorno de todo este informe.**
2. Opción 1 completa, con el headroom de overlay y el fail-open. Cierra el 10× sin tocar
   el schema ni a ningún jugador vivo.
3. Alinear el default del código (10) con producción (5) — o subir producción a 10.
   Hoy discrepan y el commit que subió el default nunca llegó a nadie.
4. Spec propio para la Opción 2, con la decisión de producto explícita sobre qué pasa
   con el rail on-chain y con el progreso anterior al 2026-07-29.

---

# Ambigüedades que quedan

**A1-bis — Por qué producción quedó en 5 y no en 10.** La variable de `chesscito` es
anterior al commit que subió el default. No sé si 5 fue una decisión deliberada o quedó
de una calibración vieja. **Es tuya la respuesta**, y define si el paso 3 sube producción
o baja el código.

**B-1 — Los resets de localStorage no son medibles** con el pipeline actual (ver B.2).
Si importa, hace falta un campo que el cliente no derive del mismo estado que se resetea.

**B-2 — Las 8 wallets son la explicación más simple, no una prueba.** Descarté bot y QA
por forma temporal, no por identidad. Si tenés contexto de que alguna es tuya o de un
partner, cambia el 1,8% y vale la pena que me lo digas.

**C-1 — El rail on-chain (`scores`, 145 filas, 81 wallets) no tiene camino a la Opción 2.**
Esas filas no llevan `exercise_id` y no se pueden derivar. Es una decisión de producto
pendiente, no un detalle de implementación.

**C-2 — La cuota free/peones de `save_basic_score` cuelga de `count(score_saves)`.**
Si la Opción 2 saca a `score_saves` del camino del ranking, hay que decidir qué mide esa
cuota. No lo diseñé acá.
