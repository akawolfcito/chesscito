# PLAY — comportamiento real y retorno

**Fecha:** 2026-08-27 · **Ventana:** 2026-07-23 → 2026-08-28 · **Read-only**
**Alcance:** PLAY como producto independiente. ⛔ El daily de PLAY **no** es un Focus Day y
en ninguna consulta de este documento toca `focus_day_ledger`.

Cada afirmación lleva su tipo: **[HECHO]** medido, **[INFERENCIA]** derivada de hechos,
**[HIPÓTESIS]** compatible pero no probada, **[NO MEDIBLE]** fuera del alcance de la
instrumentación actual.

---

## 1. Executive summary

**[HECHO] PLAY es ancho y superficial — y además tiene una cola profunda real que la mediana
esconde.** Las dos lecturas conviven: la mediana es **1 partida y 1 día**, y al mismo tiempo
34 personas jugaron 20+ partidas (máximo 120) y 8 volvieron 10+ días (máximo 24).

**[HECHO] El 4,6% vuelve otro día.** De 5.957 personas que llegaron a PLAY, 274 tuvieron
acción en un segundo día UTC. El 92,9% de quienes jugaron lo hicieron en un solo día.

**[HECHO] La caída más grande no es entrar, es terminar.** 61% de quienes llegan inician una
partida, pero sólo **52% de quienes inician la terminan**. Se pierden 1.746 personas entre
"empecé a jugar" y "terminé una partida".

**[HECHO] Coach y el daily de PLAY se asocian con ~4× más retorno.** Quien usó Coach vuelve
20,8% contra 5,0%; quien completó el daily vuelve 20,0% contra 4,5%.
⚠️ **[INFERENCIA, no causa]** también es cierto que volver da más oportunidades de usar
ambos. La dirección no se puede establecer con estos datos.

**[HECHO] Profundidad del primer día y retorno se mueven juntos.** De 1 partida (4,6%) a
3-4 partidas (17,3%) el retorno se multiplica por **3,8**; a 5+ partidas llega a **25,0%**.

**[HECHO] 1.096 personas en PLAY no tienen un solo stablecoin.** El evento
`pro_purchase_failed` es **100% `kind:"no-token"`**: no mide compras fallidas, mide billeteras
vacías. Son el **59,6%** de quienes vieron la hoja de PRO.

⛔ **[HECHO] PLAY no escribe una sola fila en `score_saves` ni en `score_attempts`.** Las
5.595 partidas guardadas de esas tablas son **todas de LEARN**. Todo lo que se sabe de PLAY
sale de `analytics_events`.

---

## 2. Measurement methodology

**Identidad.** Dos claves, y usarlas mal cambia las conclusiones:

| Clave | Qué es | Dónde sirve |
| --- | --- | --- |
| `session_id` | id persistente **por instalación**, en localStorage | dentro de una sola superficie |
| `account_ref` | HMAC-SHA256 de la wallet | **entre superficies** y para deduplicar personas |

⛔ **`session_id` NO cruza superficies.** localStorage es **por origen**, y PLAY y LEARN son
dominios distintos: la misma persona tiene dos `session_id`. Medido: el cruce por
`session_id` reportó **4 personas usando ambas (0,1%)**; por `account_ref` son **652 (12,1%)**.
La primera cifra es un artefacto y no se usa en este documento salvo para mostrarlo.

**Qué cuenta como acción.** ⛔ Renders y eventos automáticos quedan fuera:
`arena_mount`, `arena_fresh_reset_fired`, `peones_balance_viewed`, `app_opened`, `*_view(ed)`.
El set de acción de PLAY es:
`arena_start_tap`, `arena_game_start`, `arena_game_end`, `coach_analyze_request`,
`daily_tactic_started`, `daily_tactic_completed`, `victory_claim_tx`, `arena_difficulty_tap`,
`play_hub_arena_tap`, `play_hub_coach_tap`, `play_hub_shop_tap`.

**Días activos** = `count(DISTINCT (created_at AT TIME ZONE 'UTC')::date)` sobre acciones.

**Ventanas de retorno.** En las cohortes se excluye a quien no tuvo **7 días completos** de
oportunidad. Sin ese filtro, quien llegó anteayer cuenta como "no volvió".

**Joins.** No hay ninguno entre `analytics_events` y las tablas con wallet: es imposible sin
el secreto del HMAC (ver §15). Las secciones de compra usan **o** analytics **o** tablas de
wallet, nunca las dos unidas.

---

## 3. Population and instrumentation

**[HECHO] Volumen por superficie** (`analytics_events`):

| surface | eventos | personas (`session_id`) | desde |
| --- | ---: | ---: | --- |
| `play` | 199.409 | 6.070 | 2026-07-23 |
| `learn` | 103.924 | 3.626 | 2026-07-23 |
| `(null)` | 47.021 | 3.479 | 2026-05-03 |
| `full` | 1.794 | 397 | 2026-07-24 |

⚠️ **[HECHO] 47.021 eventos no tienen `surface`** y no son atribuibles a PLAY ni a LEARN.
Cubren 2026-05-03 → 2026-08-25 y representan el **13,4%** de todos los eventos. Todo lo de
abajo empieza el **2026-07-23**, que es cuando `surface` empieza a poblarse.

**[HECHO] Cohortes de llegada** (primer día con acción, ventana ≥7 días):

| Semana | Nuevos | Volvió otro día |
| --- | ---: | ---: |
| 2026-07-20 | 3 | 100% |
| 2026-07-27 | 3 | 66,7% |
| **2026-08-03** | **3.015** | **6,3%** |
| 2026-08-10 | 482 | 8,3% |
| 2026-08-17 | 315 | 5,1% |

**[HECHO] El 79% de toda la población de PLAY llegó en una sola semana** (la del 3 de
agosto). ⚠️ **[HIPÓTESIS]** coincide con la exposición del listado de MiniPay, pero no hay en
la base ningún campo que lo atribuya: `source` y `campaign` existen y no se usaron en esta
auditoría. Las dos primeras semanas (n=3 y n=3) son demasiado chicas para leer.

---

## 4. PLAY funnel

**[HECHO]** Dedup por `session_id`, superficie `play`:

| # | Escalón | Personas | % de quienes llegaron |
| --- | --- | ---: | ---: |
| 1 | Llegó a PLAY (`play_hub_view`) | **5.957** | 100% |
| 2 | Inició ≥1 partida | **3.636** | **61,0%** |
| 3 | Terminó ≥1 partida | **1.890** | **31,7%** |
| 4 | Guardó ≥1 partida | 1.889 | 31,7% |
| 5 | Inició 2+ partidas | 1.078 | 18,1% |
| 6 | Inició 3+ partidas | 501 | 8,4% |
| 7 | Terminó 2+ partidas | 676 | 11,3% |
| 8 | Usó Coach | 404 | 6,8% |
| 9 | Completó el daily de PLAY | 534 | 9,0% |
| 10 | Intentó reclamar Victory | 642 | 10,8% |
| 11 | Miró el Shop | 752 | 12,6% |
| 12 | **Volvió otro día UTC** | **274** | **4,6%** |
| 13 | 3+ días con acción | 77 | 1,3% |
| 14 | 7+ días con acción | 19 | 0,3% |

**[HECHO] La caída dominante está entre iniciar y terminar.** 3.636 → 1.890: **1.746
personas (48% de quienes empiezan) nunca terminan una partida.** Es la pérdida más grande del
embudo después de la entrada.

**[HECHO] Terminar y guardar son lo mismo.** 1.890 vs 1.889. No hay fuga entre completar una
partida y persistirla.

⚠️ **[NO MEDIBLE] Por qué abandonan a mitad de partida.** No hay evento de abandono ni de
duración de partida; `arena_x_close_fired` (1.243 personas) es lo más cercano pero no
distingue "cerré la pantalla" de "cerré la partida en curso".

---

## 5. Games per player

**[HECHO]** Entre quienes iniciaron ≥1 partida (n = 3.636).
⚠️ Se excluye a los 2.321 que llegaron y no jugaron: incluirlos aplasta todo percentil a cero.

| Métrica | Valor |
| --- | ---: |
| Media | 2,10 |
| **p50 (mediana)** | **1** |
| p75 | 2 |
| p90 | 3 |
| p95 | 5 |
| **Máximo** | **120** |

| Partidas | Personas | % |
| --- | ---: | ---: |
| **1** | **2.558** | **70,4%** |
| 2 | 577 | 15,9% |
| 3–4 | 286 | 7,9% |
| 5–9 | 142 | 3,9% |
| 10–19 | 39 | 1,1% |
| **20+** | **34** | **0,9%** |

**[HECHO] Las dos lecturas son ciertas a la vez.** PLAY es superficial por mediana (1
partida) **y** tiene una minoría profunda real: 34 personas con 20+ partidas, con un máximo
de 120. La mediana no las oculta por error — las oculta porque son el 0,9%.

⚠️ **[NO MEDIBLE por cohorte de compra]** No se puede partir esta distribución en
compradores / no compradores / PRO / Peones: requiere unir `account_ref` con `wallet`. Ver §15.

---

## 6. Active days and return

**[HECHO]** Mismo denominador (n = 3.636).

| Métrica | Valor |
| --- | ---: |
| Media | 1,15 |
| **p50** | **1** |
| p75 | 1 |
| p90 | 1 |
| p95 | 2 |
| **Máximo** | **24** |

| Días activos | Personas | % |
| --- | ---: | ---: |
| **1 día** | **3.379** | **92,9%** |
| 2 días | 182 | 5,0% |
| 3 días | 32 | 0,9% |
| 4–6 | 25 | 0,7% |
| 7–9 | 10 | 0,3% |
| 10+ | 8 | 0,2% |

**[HECHO] Intensidad y retorno son cosas distintas y hay que medirlas por separado.** El p95
de partidas es 5, pero el p95 de días es 2. Alguien puede jugar 5 partidas y no volver nunca.

---

## 7. First-day behavior

**[HECHO]** Cohorte con ≥7 días de ventana. "Volvió" = tuvo acción en un segundo día UTC.

| Partidas el 1er día | Personas | Volvieron | **% volvió** | usó Coach D1 | completó daily D1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 (sólo taps) | 494 | 40 | **8,1%** | 0,0% | **29,1%** |
| **1** | **2.431** | 113 | **4,6%** | 4,7% | 7,2% |
| 2 | 514 | 34 | 6,6% | 17,5% | 10,5% |
| **3–4** | 260 | 45 | **17,3%** | 28,1% | 19,2% |
| **5+** | 128 | 32 | **25,0%** | 46,1% | 21,1% |

**[HECHO] Existe una señal temprana y es fuerte.** De 1 partida a 3–4 el retorno se
multiplica por **3,8**; a 5+ por **5,4**.

⛔ **[HECHO] El bucket de 0 partidas vuelve MÁS que el de 1 partida** (8,1% vs 4,6%). No son
gente que no hizo nada: el **29,1%** de ellos completó el daily de PLAY. **[INFERENCIA]**
haber jugado exactamente una partida de arena es, descriptivamente, el peor predictor de
retorno de todo el primer día — peor que no haber entrado a la arena en absoluto.

⚠️ **[INFERENCIA, no causa]** todo lo anterior es asociación. Quien iba a volver de todos
modos también juega más el primer día. No se puede separar con estos datos.

---

## 8. Behavior associated with return

**[HECHO]** Grupos por días con acción. Incluye a quien jugó o completó el daily (n = 3.782).

| Grupo | Personas | Partidas prom. | Coach | Daily | Victory | Shop | Sin fondos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **A** · 1 solo día | 3.517 | 1,5 | 9,1% | 12,1% | 15,2% | 15,4% | 15,8% |
| **B** · 2 días | 189 | 4,3 | 22,2% | 33,9% | 37,6% | 36,0% | 25,4% |
| **C** · 3–6 días | 57 | 14,5 | 56,1% | 56,1% | 50,9% | 66,7% | 17,5% |
| **D** · 7+ días | 19 | **41,8** | 52,6% | **73,7%** | 42,1% | **84,2%** | 15,8% |

**[HECHO] Todas las mecánicas suben monótonamente con el retorno**, salvo Victory (pico en C)
y "sin fondos", que se mantiene plano (~16–25%) en todos los grupos.

**[INFERENCIA] La falta de fondos no explica el abandono.** Si vaciar la billetera fuera lo
que expulsa, el grupo A tendría mucho más "sin fondos" que el D. Tiene prácticamente el mismo
(15,8% vs 15,8%).

**[HECHO] El Shop es lo que más separa al grupo D**: 84,2% contra 15,4% del grupo A, un
factor de **5,5**.

---

## 9. Daily mechanic (de PLAY)

⛔ Mecánica **propia de PLAY**. No escribe en `focus_day_ledger` y no se compara con LEARN.

| Métrica | Personas |
| --- | ---: |
| Lo inició (`daily_tactic_started`) | **846** |
| Lo completó (`daily_tactic_completed`) | **531** |
| Lo completó en 2+ días distintos | 57 |

**[HECHO] Completion del daily: 62,8%** de quienes lo inician.
**[HECHO] Retorno: 20,0%** entre quienes lo completaron vs **4,5%** entre quienes no → **4,4×**.
**[HECHO] Partidas promedio: 3,2** (completaron) vs **1,8** (no) → **1,8×**.

⚠️ **[NO MEDIBLE] Impresión.** No existe evento de "vio el daily". Sólo se puede medir desde
`started`, así que **no se sabe cuánta gente lo vio y no lo tocó**. La tasa de 62,8% es
inicio→completado, nunca vista→completado.

⚠️ **[HECHO] `daily_tactic_completed` empieza el 2026-08-01**, ocho días después de
`daily_tactic_started` (2026-07-27). Cualquier lectura que cruce esa frontera subcuenta
completions.

---

## 10. Coach Review

| Métrica | Valor |
| --- | ---: |
| Se le ofreció (`monetization.coach_review_offered`) | **1.546** |
| Lo pidió ≥1 vez (`coach_analyze_request`) | **404** |
| Lo pidió 2+ veces | 82 |
| Lo usó en 2+ días distintos | 23 |
| Usos promedio entre quienes lo usaron | 1,34 |

**[HECHO] Conversión oferta → uso: 26,1%.**
**[HECHO] Repetición: 20,3%** de quienes lo usan lo usan otra vez.
**[HECHO] Retorno: 20,8%** (usó Coach) vs **5,0%** (no usó, habiendo jugado) → **4,2×**.
**[HECHO] En el top 5% por partidas, el 51,6% usó Coach** vs 11,1% en el conjunto.

⚠️ **[NO MEDIBLE] Separar free / Peones / stablecoin / PRO.** `coach_analyze_request` no
lleva el modo de pago en `props`. La tabla `coach_analyses` sí tiene wallet pero registra
**33 análisis de 5 wallets en total** y todos con `kind = 'full'` — es un orden de magnitud
distinto a los 404 solicitantes de analytics. **[HIPÓTESIS]** esa tabla sólo persiste un
subconjunto (¿los de la superficie `full`?); no se resolvió en esta auditoría.

⚠️ **[NO MEDIBLE] Intentos fallidos vs usos reales.** No hay evento de resultado del análisis,
así que `coach_analyze_request` cuenta solicitudes, no entregas.

---

## 11. Monetization before/after PLAY

⛔ **[NO MEDIBLE] La pregunta central de esta sección no se puede responder con la
instrumentación actual.** Requiere unir comportamiento (`account_ref`) con compras (`wallet`),
y ese puente necesita el secreto del HMAC. Concretamente **no** se puede saber hoy:

- si quien compró había usado PLAY antes, ni cuántos días ni cuántas partidas;
- las últimas acciones humanas antes de pagar (§9 del pedido);
- la primera acción después de pagar, ni en 10 min / 1 h / 24 h / 7 días (§10 del pedido);
- si comprar cambia la profundidad de uso.

Lo que **sí** se puede afirmar:

**[HECHO] La hoja de PRO se vio 1.838 veces en PLAY** y **1.096 de esas personas (59,6%) no
tenían stablecoin alguno.**

**[HECHO] `pro_purchase_failed` está mal nombrado.** Es **100% `kind:"no-token"`** — un
chequeo de saldo, no una compra fallida. Por eso hay 1.096 "fallos" contra **20**
`pro_purchase_started`. Cualquier lectura previa que lo tomara como conversión rota es falsa.

**[HECHO] `pro_purchase_confirmed` en PLAY: 5 personas.** Contra 7 wallets en
`pro_subscriptions`. La diferencia **[HIPÓTESIS]** son compras hechas antes de que `surface`
existiera (hay 8 confirmaciones más con `surface` nulo).

⛔ **[HECHO] Las compras de Peones no tienen NINGÚN evento.** No existe `peones_purchase` ni
equivalente en todo `analytics_events`. Las 14 compras que hay sólo constan en
`peones_ledger` (`source = 'pack_purchase'`). Es el pendiente #4 del backlog, y explica por
qué esta sección no puede cerrarse.

---

## 12. PRO repeat buyer — estudio de caso

**[HECHO] 7 personas, 8 filas, 1 renovación.** Es la **única recompra de todo el producto**;
el Season Pass tuvo **0 renovaciones en 17 ventas**. ⚠️ **N=1: descripción, no conclusión.**

| Caso | Tipo | Compró | Coach | Acciones | Días act. | Partidas LEARN | Victorias | Focus days | Orden |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **1** | **⭐ RECOMPRÓ** | 2026-07-02 | 1 | 21 | 8 | 18 | 4 | 3 | jugó sólo **después** |
| 2 | única | 2026-08-03 | **16** | **69** | **28** | **45** | **114** | **10** | jugó antes |
| 3 | única | 2026-07-16 | 0 | 13 | 3 | 22 | 1 | 0 | jugó antes |
| 4 | única | 2026-08-14 | 0 | 6 | 3 | 0 | 0 | 0 | jugó antes |
| 5 | única | 2026-07-23 | 1 | 3 | 1 | 3 | 1 | 0 | jugó antes |
| 6 | única | 2026-08-03 | 0 | 0 | 0 | 0 | 0 | 0 | **sin actividad** |
| 7 | única | 2026-08-03 | 0 | 0 | 0 | 4 | 0 | 0 | **sin actividad** |

⛔ **[HECHO] El recomprador NO es el usuario más profundo.** El caso 2 lo supera en todo
—3,3× las acciones, 3,5× los días, 28× las victorias, 16× el Coach— y **no ha renovado**.
⚠️ Su ventana sigue abierta (vence 2026-09-02), así que todavía puede hacerlo.

**[HECHO] Lo que distingue al caso 1 es el ORDEN**: es el único de los siete que **no había
jugado antes de comprar**. Los otros cinco activos ya jugaban; él compró primero y jugó
después.

**[HECHO] 2 de 7 compradores de PRO no registraron ninguna acción**, ni antes ni después.

⚠️ **[NO MEDIBLE] Su comportamiento en PLAY.** La tabla de partidas por wallet sólo cubre
LEARN, así que las columnas de arriba describen su actividad en LEARN y en el ledger de
Peones, **no** en PLAY.

---

## 13. Learn ↔ PLAY crossover

**[HECHO]** Dedup por `account_ref`, sólo acciones, desde 2026-07-23 (n = 5.398):

| Población | Personas | % | Días prom. | **Volvió otro día** |
| --- | ---: | ---: | ---: | ---: |
| Sólo PLAY | 3.496 | 64,8% | 1,07 | **4,5%** |
| Sólo LEARN | 1.250 | 23,2% | 1,03 | **2,1%** |
| **AMBOS** | **652** | **12,1%** | **1,69** | **23,0%** |

**[HECHO] Quien toca las dos superficies vuelve 5,1× más que quien sólo usa PLAY** y 11×
más que quien sólo usa LEARN.

⚠️ **[INFERENCIA con circularidad]** parte de ese 23% es mecánico: usar las dos superficies a
veces **requiere** más de una visita, así que "ambos" y "volvió" se contaminan mutuamente. No
se puede limpiar sin restringir a quien usó ambas **el mismo día**, que no se calculó acá.

**[HECHO] Entrada:** de los 652, **437 (67%) entraron por LEARN** y 215 (33%) por PLAY.

**[INFERENCIA] Son dos poblaciones, no un producto con dos loops.** El 88% de los usuarios
toca una sola superficie. ⚠️ Y el 12% que cruza es la parte del producto que retiene.

⚠️ **[NO MEDIBLE] Compradores por población** (PLAY only / LEARN only / ambos /
predominantemente uno). Requiere el puente `account_ref` → `wallet`.

---

## 14. Deep PLAY users

**[HECHO]** Entre quienes jugaron ≥1 partida, dedup por `account_ref` (n = 3.626):

| Grupo | Personas | Partidas | Días | Coach | Daily | Victory | Shop | Sin fondos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Todos | 3.626 | 2,1 | 1,15 | 11,1% | 10,6% | 17,6% | 17,0% | 15,9% |
| Top 10% por partidas | 494 | 7,9 | 1,81 | 38,1% | 25,1% | 45,3% | 36,6% | 19,0% |
| **Top 5% por partidas** | 213 | **14,1** | 2,59 | **51,6%** | 31,5% | 48,8% | 46,9% | 17,8% |
| Top 10% por días | 246 | 9,8 | **3,24** | 34,1% | **40,7%** | 41,9% | 46,3% | 21,1% |

**[HECHO] Los dos "top" no son la misma gente y llegan por caminos distintos.** El top por
**partidas** se distingue por **Coach** (51,6%); el top por **días** se distingue por el
**daily** (40,7%) y tiene la mitad de partidas. **[INFERENCIA]** hay al menos dos rutas a la
profundidad: sesiones largas apoyadas en Coach, y visitas cortas repetidas apoyadas en el
daily.

---

## 15. Instrumentation limitations

### Lo que podemos medir con confianza

- Funnel de PLAY por persona, con dedup por `session_id` o `account_ref`.
- Partidas iniciadas / terminadas / guardadas, días activos UTC, retorno.
- Coach: ofrecido, solicitado, repetido.
- Daily de PLAY desde `started` (y completions desde 2026-08-01).
- Cruce PLAY ↔ LEARN **con `account_ref`**.
- Compras de PRO y del pase por wallet, y sus fechas (tablas de la DB).

### Lo que podemos aproximar

- **Cohortes de llegada**: la semana del 2026-08-03 concentra el 79%, pero la causa
  (¿listado de MiniPay?) no está en la base. `source`/`campaign` existen y no se auditaron.
- **`pro_purchase_confirmed`**: 5 en PLAY vs 7 wallets en la tabla. La brecha es
  probablemente pre-`surface`, no una pérdida.
- **Secuencias de acción**: reconstruibles por `created_at`, pero ver el defecto de eventos
  duplicados abajo.

### Lo que NO podemos saber con la instrumentación actual

1. ⛔ **Unir comportamiento con compras.** `analytics_events` guarda `account_ref` (HMAC);
   las compras guardan `wallet`. Sin el secreto no hay join. **Esto anula por completo las
   secciones 8, 9 y 10 del pedido** (antes/después de comprar, últimas acciones previas,
   primera acción posterior).
2. ⛔ **Partidas de PLAY por wallet.** `score_saves` y `score_attempts` **no tienen una sola
   fila con `surface = 'play'`** (5.595 saves, todos `learn`). PLAY no persiste partidas por
   wallet en ningún lado.
3. ⛔ **Compras de Peones**: cero eventos de analytics. Sólo existen como filas de ledger.
4. ⛔ **Impresión del daily** y **resultado del Coach**: no hay eventos.
5. ⛔ **Abandono a mitad de partida**: no hay evento de abandono ni duración.
6. ⛔ **Modo de pago del Coach** (free / Peones / stablecoin / PRO).

### Defectos encontrados — documentados, no corregidos

| # | Defecto | Impacto cuantificado |
| --- | --- | --- |
| 1 | **`arena_start_tap` y `arena_game_start` son el mismo hecho logueado dos veces** — 7.645 eventos y 3.636 personas **idénticos** en ambos | Cualquier "path" que los ordene es arbitrario: se ven las dos secuencias con conteos casi iguales (693 vs 674). **Contar los dos como acciones distintas infla el volumen de acción ~2×** |
| 2 | **`pro_purchase_failed` no es un fallo de compra**: 100% `kind:"no-token"` | 1.096 personas mal clasificadas como conversión rota |
| 3 | **`session_id` no cruza orígenes** | Cruce PLAY↔LEARN reportado como 0,1% cuando es 12,1% — error de **120×** |
| 4 | **47.021 eventos sin `surface`** (13,4% del total) | Todo análisis por superficie ignora 2026-05-03 → 2026-07-22 |
| 5 | **`app_opened` casi no tiene `account_ref`** (7 de 5.963) | Dispara antes de resolver wallet: inútil para análisis por persona-wallet |
| 6 | **`daily_tactic_completed` nace 8 días después de `started`** | Completions anteriores al 2026-08-01 no existen |
| 7 | **`coach_analyses` tiene 5 wallets** contra 404 solicitantes en analytics | La tabla no es una fuente válida de uso de Coach |

⚠️ **Herramienta, no producto:** `pnpm ops:query` **rechaza cualquier archivo con un `;`
dentro de un comentario** — parte el script por `;` antes de quitar comentarios, y el primer
trozo queda vacío. El error dice `no statement found`, que no lo sugiere.

---

## 16. Product questions raised by the data

1. **¿Por qué la mitad de quienes empiezan una partida no la terminan?** Es la fuga más
   grande (1.746 personas) y no hay instrumentación para responderlo.
2. **¿Por qué jugar exactamente una partida predice peor retorno que no entrar a la arena?**
   El bucket de 0 partidas vuelve 8,1% y el de 1 partida 4,6%.
3. **¿Qué hacen los 1.096 sin stablecoin?** Son el 59,6% de quienes ven PRO. Hoy el producto
   les ofrece algo que no pueden comprar.
4. **¿Vale más el daily o Coach?** Los dos dan ~4× retorno pero llegan a poblaciones
   distintas (top por días vs top por partidas).
5. **¿Se puede hacer que el 88% que toca una sola superficie toque la otra?** El 12% que
   cruza retiene 5×.
6. **¿Por qué el único recomprador es el único que compró ANTES de jugar?** N=1, pero es la
   observación más rara del conjunto.

---

## Hallazgos cuantificados

1. **[HECHO] El 4,6% de PLAY vuelve otro día.** 274 de 5.957. El 92,9% de quienes juegan lo
   hacen un solo día.
2. **[HECHO] El 48% de quienes inician una partida nunca terminan ninguna** — 1.746 personas,
   la mayor fuga del embudo después de la entrada.
3. **[HECHO] Jugar 3+ partidas el primer día se asocia con 3,8× más retorno** (17,3% vs
   4,6%); 5+ partidas con 5,4× (25,0%).
4. **[HECHO] Coach se asocia con 4,2× más retorno** (20,8% vs 5,0%) y lo usa el 51,6% del
   top 5% por partidas, contra 11,1% del conjunto.
5. **[HECHO] El daily de PLAY se asocia con 4,4× más retorno** (20,0% vs 4,5%) y con 1,8×
   más partidas (3,2 vs 1,8). Completion inicio→fin: 62,8%.
6. **[HECHO] El 59,6% de quienes ven la hoja de PRO no tiene stablecoin** (1.096 de 1.838), y
   la falta de fondos es **plana** entre quienes vuelven y quienes no (15,8% en ambos
   extremos): no es lo que expulsa.
7. **[HECHO] Sólo el 12,1% usa ambas superficies, y ese grupo vuelve 23,0%** contra 4,5%
   (sólo PLAY) y 2,1% (sólo LEARN). El 67% de ellos entró por LEARN.
8. **[HECHO] La cola profunda existe y es del 0,9%**: 34 personas con 20+ partidas (máx. 120)
   y 8 con 10+ días activos (máx. 24), bajo una mediana de 1 partida y 1 día.
9. **[HECHO] Hay dos rutas distintas a la profundidad**: el top 5% por partidas se
   caracteriza por Coach (51,6%); el top 10% por días, por el daily (40,7%) con la mitad de
   partidas.
10. **[HECHO] El 79% de la población llegó en la semana del 2026-08-03**, con retorno de
    6,3% — indistinguible del resto de las cohortes.
