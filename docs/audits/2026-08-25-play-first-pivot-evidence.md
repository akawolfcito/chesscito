# Pivot Play-First — evidencia y decisión

> **Read-only.** No se cambió código, datos, configuración ni se envió nada.
> Consultas vía `scripts/ops/read-only-query.ts` (read-only forzado en servidor).
> Ventana: 7 días para comparación entre superficies, 14 para retención.

---

## Executive decision

```
Learn decision:              ITERATE   (⚠️ no DE-EMPHASIZE — ver §1)
Play signal:                 WEAK
Minigame signal:             TOO EARLY  (promisorio, n insuficiente)
Recommended MiniPay narrative: Play-First con los MINIJUEGOS al centro,
                             no la Arena. Learn sobrevive como el motor de
                             profundidad, sin la narrativa de hábito.
Reward current 7+ day user:  YES — 1 wallet, $0.33, transferencia manual
Recommended reward structure: 7/14/21 → $0.33 c/u, sólo días 'daily' y
                             'daily_retry'. Excluir 'backfill_streak'.
Microeconomy V0:             Retry pack $0.10 · Piece skin $0.25 · Peones $0.10
Regional pricing readiness:  INSUFFICIENT DATA
Expand to other chains now:  NO
```

⛔ **La hipótesis no se confirma como se planteó, y el matiz importa.** La evidencia
no dice "la gente no quiere ejercicios". Dice que **Learn tiene la mejor profundidad
de la app** y que **el RETO DE 21 DÍAS fracasó**. No son lo mismo, y la decisión debe
separarlos.

---

## §1 · El hallazgo que reordena la pregunta

**Learn ≠ reto de 21 días.** El reto es la narrativa de hábito montada encima; los
ejercicios son el contenido. Los datos los separan con claridad:

| | Reto de 21 días | Ejercicios de Learn |
| --- | --- | --- |
| Completions | **0 de 18** | 1.114 en 7 días |
| Usuarios | 8 con ≥1 día | 106 |
| Profundidad | 10/21 el máximo | **p50 = 4, p95 = 16** |
| Quien entra, ¿repite? | No | **100 % (106/106)** |

**El reto de 21 días es lo que fracasó. Los ejercicios son la superficie más profunda
que tiene el producto.** Retirar Learn por el fracaso del reto sería tirar el motor
por culpa de la carrocería.

---

## §2 · Learn vs Play vs Minigames

**Base: 1.206 usuarios activos, 1.506 visitas (7 días).**
"Usuario" = `session_id`, que pese al nombre es un **id persistente por instalación**
en localStorage. `visit_id` es el per-visita. (Documentado; el nombre engaña.)

### Reach

| Superficie | usuarios | % de activos |
| --- | ---: | ---: |
| PLAY · partida iniciada | **423** | **35,1 %** |
| LEARN · daily iniciado | 357 | 29,6 % |
| LEARN · daily completado | 243 | 20,1 % |
| MINI · sección abierta *(view)* | 238 | 19,7 % |
| LEARN · ejercicio iniciado | 167 | 13,8 % |
| LEARN · ejercicio completado | 106 | 8,8 % |
| MINI · laberinto completado | 90 | 7,5 % |
| MINI · juego iniciado *(sección)* | 57 | 4,7 % |

**Play gana el alcance.** Pero alcance no es uso.

### Depth — acá se invierte el resultado

| Superficie | usuarios | p50 | p75 | p95 | máx | **solo 1 vez** | 2–3 | 4–10 | >10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PLAY | 423 | **1** | 2 | 7 | 81 | **296 (70 %)** | 76 | 40 | 11 |
| LEARN ejercicios | 106 | **4** | 6 | 16 | 20 | **10 (9 %)** | 28 | 58 | 10 |
| MINI laberinto | 90 | 2 | 4 | 10 | 14 | 26 (29 %) | 28 | 33 | 3 |
| MINI sección | 57 | 2 | 3 | 9 | 12 | 25 (44 %) | 18 | 13 | 1 |

⛔ **El 70 % de quienes tocan la Arena juegan UNA partida y no vuelven a tocarla.**
En Learn, sólo el 9 %. La mediana de Play es 1; la de Learn es 4.

**Play tiene el alcance más ancho y el uso más superficial de las tres.**

### Recurrence — nadie vuelve, en ninguna superficie

Retención por superficie de **primer contacto** (14 días):

| Primera superficie | usuarios | D1 | D1–D3 | algún día | días activos prom. |
| --- | ---: | ---: | ---: | ---: | ---: |
| PLAY | 822 | 34 (**4,1 %**) | 45 (5,5 %) | 63 (7,7 %) | 1,17 |
| LEARN | 454 | 27 (**5,9 %**) | 35 (7,7 %) | 43 (9,5 %) | 1,31 |
| MINI | 25 | 4 (**16,0 %**) | 4 (16,0 %) | 4 (16,0 %) | **1,80** |

⚠️ **MINI tiene la mejor retención D1 por un factor de 4× sobre Play — pero n = 25.**
Con esa muestra, dos usuarios mueven el resultado 8 puntos. Es la señal más interesante
del informe y **no alcanza para decidir**.

⛔ **El problema real no es Learn vs Play. Es que la retención D1 está entre 4 % y 6 %
en todo el producto.** Pivotar de una superficie con 4 % a otra con 6 % no arregla eso.

### Cross-surface (7 días)

| Combinación | usuarios |
| --- | ---: |
| Sólo Play | **381** |
| Sólo Learn | 133 |
| Learn + Mini | **96** |
| Learn + Play | 42 |
| Sólo Mini | 13 |
| Play + Mini | **0** |
| Los tres | **0** |

⛔ **Play y Minijuegos no se cruzan en un solo usuario.** Los minijuegos hoy se consumen
desde Learn (96) y casi nunca solos (13). **Un pivot "Play-First" que ponga Arena al
centro no hereda la audiencia de los minijuegos: son públicos disjuntos.**

---

## §3 · Minijuegos en detalle

⚠️ Corrección de encuadre: los minijuegos **no llevan 5 días**. `labyrinth_complete`
existe desde el **2026-08-04** (3.239 eventos, 529 installs). Lo que lleva 6 días es la
**sección** que los expone (`minigames_open`, desde 08-19). El contenido tiene 21 días
de historia; la superficie, 6.

### Por juego (desde la sección, 7 días)

| game_id | starts | jugadores | starts/jugador | jugaron ≥2 | % ≥2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `n-queens` | 39 | 20 | **1,95** | 13 | **65 %** |
| `pivot-run` | 42 | 29 | 1,45 | 13 | 45 % |
| `rook-rail` | 71 | **45** | 1,58 | 18 | 40 % |
| `safe-path` | 6 | 3 | 2,00 | 3 | 100 % *(n=3)* |

**`n-queens` genera la mayor repetición; `rook-rail` el mayor alcance.** `safe-path`
está prácticamente sin exponer (3 jugadores).

### Curiosity vs engagement vs retention

```
curiosity  → 238 abrieron la sección
engagement →  57 iniciaron un juego   (24 % de los que abrieron)
retention  →   4 volvieron otro día   (7 % de los que jugaron)
```

⛔ **El embudo de entrada es el problema: 3 de cada 4 abren la sección y no juegan
nada.** Antes de expandir el pool o llevarlo a otra chain, ese 24 % es lo que hay que
mover.

### De dónde entran

| entry | starts | jugadores |
| --- | ---: | ---: |
| `featured` | 114 | **50** |
| `replay` | 29 | 12 |
| `library` | 12 | 7 |
| `library_replay` | 3 | 3 |

**La biblioteca es irrelevante (7 jugadores).** Todo pasa por el destacado.

---

## §4 · El usuario líder — NO MEDIBLE como se pidió

⛔ **No puedo cruzar wallet con analytics de forma confiable, y no lo voy a forzar.**

`account_ref` es `HMAC-SHA256(wallet minúscula, TELEMETRY_ACCOUNT_SECRET)`
(`lib/analytics/account-ref.ts:7`). Es determinista, así que el cruce **es
técnicamente posible** teniendo el secreto — pero esa separación existe a propósito:
el propio `route.ts:25` la describe como "exactamente la fuga que `account_ref` existe
para prevenir".

**Revertirla es una decisión tuya, no mía.** Si la autorizás explícitamente, el cruce
son ~20 líneas y reconstruyo las cuatro wallets que pediste. Sin esa autorización,
cualquier perfil que te entregue sería inventado.

Lo que **sí** sé del líder, desde el ledger (fuente canónica):

| | Líder | 3 días | D1-only | paid_zero |
| --- | ---: | ---: | ---: | ---: |
| Focus Days | 10 | 3 | 1 | 0 |
| Rachas distintas | **6** | 3 | 1 | — |
| Racha máxima | **4** | 1 | 1 | — |
| Span | 26 días | 8 | 1 | — |
| Último día | **hoy** | hace 19 d | hace 20–22 d | nunca |
| Entitlement | Pass + **PRO** | **PRO** | Pass | Pass |

**La diferencia observable más fuerte no es la racha: es PRO.** Las dos únicas wallets
con más de 2 Focus Days son las dos únicas con PRO. Con n=2 no es una conclusión, pero
es la hipótesis que yo probaría primero.

---

## §5 · Cierre del experimento de 21 días

**Veredicto sobre el RETO (no sobre Learn): `RETIRE` como narrativa principal.**

- 0 completions en 36 días de posibilidad
- 10 de 17 pagaron y **nunca** registraron un día
- La cohort 3–5 ago: 9 compraron, 5 jugaron exactamente el día de la compra, **0 volvieron**
- La muerte está en `purchase → D1 → D2`, confirmado

**Veredicto sobre LEARN: `ITERATE`.** Los ejercicios tienen p50=4, 100 % de repetición
y la segunda mejor retención. Lo que falla es la envoltura de "hábito saludable de 21
días", no el contenido.

### Recompensa de la cohort

**Sí, pero alcanza a una sola wallet.**

| Umbral | Califican hoy | Costo |
| --- | ---: | ---: |
| ≥7 Focus Days | **1** | $0,33 |
| ≥14 | 0 | $0 |
| ≥21 | 0 | $0 |
| **Techo total de la cohort** | | **$0,33** |

- **Sólo `daily` y `daily_retry`.** `backfill_streak` es progreso sembrado desde el
  streak previo, no esfuerzo dentro del reto — y es el 100 % del progreso de una wallet.
  Pagarlo premiaría un import.
- El único elegible tiene los 10 días como `daily`. Califica limpio.
- **Manual, como preferís.** Con $0,33 de exposición, construir claim on-chain cuesta
  órdenes de magnitud más que el premio.
- ⚠️ Edge case: el elegible tiene el Season Pass **expirado** (2026-08-10) y sigue
  jugando con PRO. La regla debe pagar por **días registrados**, no por pase vigente,
  o el único ganador queda excluido por un tecnicismo.

---

## §6 · El problema de PRO — severidad ALTA

**Semántica real de `unbounded`** (`focus-days.ts:22`): *"PRO: access with no season
deadline, so no countdown and nothing that can become unreachable."*

`isUnreachable()` (`focus-days.ts:74`) devuelve `false` **siempre** que la ventana sea
`unbounded`, sin mirar cuándo vence PRO.

**La inconsistencia, con números reales:** el líder tiene 10/21, necesita **11 días**, y
su PRO vence el **2026-09-02** — dentro de **8**. Matemáticamente no puede terminar. La
UI le dirá que sí puede.

| | |
| --- | --- |
| **Severidad** | **ALTA** — promete al único usuario comprometido algo imposible |
| **Causa** | `unbounded` significa "sin ventana de Season Pass", pero se usa como "sin fecha límite" |
| **Comportamiento correcto** | PRO debería producir una ventana `expiring` derivada del vencimiento de PRO, no `unbounded`. `unbounded` debería reservarse para un entitlement que de verdad no expire |
| **Alcance hoy** | 2 wallets con PRO en el ledger. Bajo volumen, alto daño reputacional |

No lo arreglé, como pediste.

---

## §7 · Play-First — propuesta de estructura

⚠️ Con una corrección grande respecto de tu borrador: **la Arena no debe ser el centro.**
Tiene el peor uso por usuario (p50=1, 70 % una sola vez) y **cero solapamiento** con los
minijuegos. Poner Arena al centro es apostar a la superficie más superficial.

```
Chesscito
↓
PLAY EVERY DAY
├── Minijuegos            ← el centro. Mejor retención D1 (16%) y repetición
│   └── destacado del día (el 72% de los starts ya entra por ahí)
├── Daily challenge       ← 29,6% de alcance, la puerta más ancha que existe
├── Arena                 ← accesible, NO destacada
└── Scores / Rewards
```

| Superficie | Decisión | Por qué |
| --- | --- | --- |
| **Minijuegos** | **Al home, destacado** | Mejor D1 (16 %), mejor días-activos (1,80), 65 % de repetición en n-queens |
| **Daily challenge** | **Mantener visible** | 357 usuarios: la puerta más ancha del producto |
| **Ejercicios (Learn)** | **Accesible, no destacado** | p50=4 y 100 % de repetición: es el motor de profundidad para quien engancha |
| **Arena** | **Secundaria** | 70 % juega una vez. Alcance sin uso |
| **Reto de 21 días** | **Fuera de la narrativa** | 0/18 |
| **Biblioteca de minijuegos** | **Fuera del home** | 7 jugadores en 7 días |
| **Season Pass $0.99** | **Pausar la venta** | 59 % de compradores nunca jugó. Seguir vendiéndolo es vender una promesa que el producto no cumple |

**Cómo evitar dos productos compitiendo:** hoy ya no compiten — están **separados**
(Play y Mini con 0 usuarios en común). El riesgo real no es competencia por atención,
es que el minijuego, que es lo que retiene, **está enterrado detrás de Learn**: 96 de sus
109 usuarios llegan desde ahí.

**Learn más adelante:** el aprendizaje ya ocurre dentro del minijuego — un laberinto de
torre *es* práctica de movimiento de torre. La vía natural es que Learn deje de ser una
sección y pase a ser la **progresión implícita** del contenido de los minijuegos.

---

## §8 · Microeconomy V0 — tres candidatos

Marco: el 98,2 % de los intentos de compra muere por saldo insuficiente
(`ops:no-token`, 166/200 observaciones), y **95 de 166 tienen USDT por debajo del
precio, no en cero**. No es "no tienen billetera": es "no les alcanza para $1.99".

| # | Producto | Precio | Utilidad | Costo impl. | Riesgo gameplay | Repetible | Qué aprendemos |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| **1** | **Retry pack** (3 reintentos de minijuego) | **$0.10** | Directo sobre la fricción que ya existe: `sweep_replay_started` sólo 47 en 7d frente a 339 CTA mostrados | **Bajo** — el rail de Peones ya existe | **Medio** — hay que evitar pay-to-win en scores | **Alta** | Si el ticket de 10¢ cruza la barrera que $1.99 no cruza |
| **2** | **Piece skin** (1 pieza, no set) | **$0.25** | Cosmético puro. El catálogo de temas y el resolver de assets **ya están construidos** | **Bajo** | **Nulo** | Media | Si hay demanda cosmética sin tocar balance |
| **3** | **Peones pack chico** | **$0.10** | El consumible que ya entienden; hoy sólo se gana | **Muy bajo** — existe | Bajo | **Muy alta** | Elasticidad de precio pura |

**Mi orden: 1 → 3 → 2.** El retry pack ataca una fricción medida; los Peones son el
experimento de precio más barato de montar. El skin es el que menos riesgo tiene pero
también el que menos enseña sobre el bloqueo real, que es económico.

⛔ **Descartar tournament entries y hints en V0**: ambos exigen construir mecánica
nueva antes de saber si alguien paga centavos.

---

## §9 · Regional pricing — INSUFFICIENT DATA

`analytics_events` **sí** tiene columna `country`, y `ops:no-token` **sí** registra
lecturas de saldo. Pero:

| Necesario | ¿Existe? |
| --- | --- |
| País por evento | ✅ `country` |
| Saldo leído por intento | ✅ `read_usdc/usdt/cusd` |
| **País ↔ saldo en la misma fila** | ❌ **No.** Las observaciones de `no-token` no llevan país |
| Volumen por país | ⚠️ Sin medir |
| Poder adquisitivo real | ❌ No inferible del país |

**Lo que falta para decidir con responsabilidad:** agregar `country` a la observación de
`no-token` y esperar volumen por mercado. Con 166 observaciones **sin país**, cualquier
tier sería una corazonada con formato de tabla.

⚠️ Y como advertís: país ≠ poder adquisitivo. La evidencia que sirve es la **distribución
de saldos por mercado**, no el mercado.

---

## §10 · Otras chains — NO, todavía no

El loop `play → repeat → return → reward → purchase` **se corta en el segundo paso**.

| Paso | Estado hoy |
| --- | --- |
| play | ✅ 57 jugadores en la sección |
| repeat | ⚠️ 56 % repite, pero 44 % juega una sola vez |
| **return** | ❌ **4 usuarios volvieron otro día** |
| reward | ⚠️ existe, sin señal |
| purchase | ❌ 98,2 % no puede pagar |

**Evidencia mínima para un "go":**

- retención D1 de minijuegos **≥ 20 % sostenida sobre n ≥ 200** (hoy: 16 % sobre n=25)
- open → start **≥ 50 %** (hoy: **24 %**)
- ≥ 30 % de jugadores con ≥2 días distintos (hoy: 7 %)
- al menos **un** producto pagado con conversión medible ≠ 0

**Señal de "todavía no": cualquiera de esas cuatro sin cumplir.** Hoy fallan las cuatro.
Expandir a otra chain multiplicaría la superficie de un loop que todavía no cierra.

---

## Risks / unresolved questions

1. ⛔ **`score_save_failed`: 2.332 eventos en 32 installs (72,9 por install), y el peor
   generó 1.871 él solo.** Es un loop de reintentos, no un fallo normal. Contamina el
   volumen de telemetría (es el 3.º evento más frecuente del producto), quema
   invocaciones de Vercel y **degrada la experiencia de los 32 afectados** — que son el
   perfil de usuario que sí llega a guardar un score. **No lo investigué; merece su
   propia sesión.**
2. **Preview y production comparten Supabase y `focus_day_ledger` no tiene columna de
   entorno.** Nada de este informe puede atribuirse a producción con certeza.
3. **n = 25 en la retención de minijuegos.** Es la base de la recomendación más fuerte
   del informe y es su mayor debilidad.
4. **No hay marca de usuario interno** en ningún esquema.
5. El cruce wallet ↔ analytics existe pero requiere revertir una separación deliberada.

### Sanity checks aplicados

- Retención por *primer contacto*, no por evento suelto — evita contar dos veces a quien
  usa varias superficies.
- Ventana común de 7 días para las tres superficies: comparar Learn de 14 días contra
  minijuegos de 6 habría inflado Learn.
- `minigames_open` tratado como **view**, nunca como consumo, según pediste.
- ⚠️ En la revisión anterior un `JOIN` mío infló un conteo 6×. Acá evité agregaciones
  con join múltiple; las comparaciones salen de una sola pasada con `FILTER`.

---

## Recommended next actions

1. **Arreglar el embudo de entrada de minijuegos (24 % open → start).** Es el número más
   accionable del informe: 181 personas abrieron y no jugaron. Antes de pivotar la
   narrativa, hacer que la superficie que ya existe convierta.
2. **Corregir la semántica de `unbounded` para PRO.** Severidad alta y afecta al único
   usuario comprometido que tiene el producto.
3. **Investigar `score_save_failed`.** 1.871 eventos de un solo install es un bug con
   costo real.
4. **Pausar la venta del Season Pass de $0.99** y pagar los $0,33 al único elegible,
   manualmente. Seguir vendiendo un reto con 0/18 completions es el riesgo reputacional
   más concreto que hay hoy.
5. **Instrumentar `country` en las observaciones de `no-token`** y lanzar UN producto de
   $0.10. Es el experimento más barato que responde la pregunta económica de fondo.

⛔ **Lo que NO recomiendo todavía: retirar Learn, poner Arena al centro, ni expandir a
otra chain.** Los tres tienen evidencia en contra en este mismo informe.
