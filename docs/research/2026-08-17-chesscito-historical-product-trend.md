# Chesscito — Revisión histórica de tendencia de producto

**Fecha:** 2026-08-17 · **Tipo:** pasada de evidencia **de sólo lectura**. Cero código, cero
migraciones, cero deploy, cero cambios de runtime.
**Herramienta:** `pnpm ops:query` (sesión `READ ONLY` del lado del servidor).
**Privacidad:** ningún wallet aparece completo. Todo identificador se leyó como `md5` truncado.

Etiquetas: **[FACT]** medido · **[INFERENCE]** derivado, con su razonamiento · **[UNKNOWN]**
no medible con lo que hay.

---

## 0. Las cinco cosas que cambian la lectura

1. **[FACT] La población cayó 82,5% y se volvió MÁS densa, no menos.** Wallets que vuelven
   otro día: 3,9% → 7,5%. Con ≥3 días activos: 0,86% → 2,8%. **No es sólo encogimiento: hay
   un núcleo formándose.**
2. **[FACT] El Daily es el único producto que ganó terreno normalizado**, y por mucho:
   25,4% → 38,5% de la población activa (+52% relativo).
3. **[FACT] El mint convierte 44× más que PRO.** En W2: 44 mints exitosos contra **1** PRO
   confirmado. PRO convierte al **0,42%** de sus impresiones.
4. **[FACT] El contenido más allá de la torre casi no existe para el jugador.** De 903
   wallets que empiezan `rook-1`, **22** llegan a `queen-1` y **16** a `king-1`. El 98% del
   catálogo autorado no se toca.
5. **[FACT] La corrección del Lote 2 ya se ve en producción.** El 2026-08-14 el reparto era
   `unknown` 17 / `insufficientFunds` 1; el 08-17, con el fix desplegado, es
   `insufficientFunds` **5** / `unknown` **2**.

---

## PARTE A — Ventanas históricas

**[FACT] El lanzamiento fue el 2026-08-03.** No es una etiqueta: `account_first_seen` pasa de
**1 wallet nuevo el 08-02** a **1.524 el 08-03**, 2.029 el 08-04 y 1.102 el 08-05.

| Ventana | Desde (UTC) | Hasta (UTC) | Días | Nota |
|---|---|---|---:|---|
| **PRE** | 2026-05-03 03:04 | 2026-08-03 00:00 | 92 | Pruebas internas. **NO comparable** |
| **W0 spike** | 2026-08-03 00:00 | 2026-08-06 00:00 | 3 | Sub-ventana de W1 |
| **W1** | 2026-08-03 00:00 | 2026-08-10 00:00 | 7 | Primera semana completa, incluye el pico |
| **W2** | 2026-08-10 00:00 | 2026-08-17 00:00 | 7 | Segunda semana completa, régimen estable |
| **W3** | 2026-08-17 00:00 | 2026-08-18 01:26 | **1,06** | ⚠️ **PARCIAL** |

⛔ **W3 no se compara contra una semana sin normalizar.** Donde aparece, va marcada y
dividida por 1,06 días si se la usa como tasa diaria.

⚠️ **PRE no es "el producto antes del lanzamiento":** son 92 días de desarrollo y pruebas con
un puñado de wallets. Meterla en una comparación semanal produciría una caída ficticia.

---

## PARTE B — Tendencia de producto

### B.1 Actividad [FACT]

| Ventana | Wallets | Sesiones | Filas | Filas/sesión |
|---|---:|---:|---:|---:|
| W0 spike (3d) | 4.659 | 5.880 | 155.769 | 26,5 |
| W1 (7d) | 5.351 | 7.055 | 194.206 | 27,5 |
| W2 (7d) | **934** | 1.261 | 45.324 | **35,9** |
| W3 (1,06d, parcial) | 148 | 192 | 6.331 | 33,0 |

**[FACT] −82,5% de wallets, pero +30% de eventos por sesión.** Menos gente, haciendo más por
visita.

⚠️ **[INFERENCE] "Filas/sesión" NO es una métrica de engagement limpia.** El evento más
frecuente del sistema, `peones_balance_viewed`, lo dispara el render y lo ven el 99,5% de los
wallets. Una sesión más larga sube ese contador sin que el jugador haga nada nuevo. La subida
27,5 → 35,9 es **consistente** con más profundidad, pero no la prueba sola.

### B.2 Días activos [FACT]

| Ventana | Wallets | 1 solo día | ≥2 días | ≥3 días | ≥4 días | % un solo día |
|---|---:|---:|---:|---:|---:|---:|
| W1 | 5.351 | 5.142 | 209 (3,9%) | 46 (0,86%) | 21 (0,39%) | **96,1%** |
| W2 | 934 | 864 | **70 (7,5%)** | **26 (2,8%)** | **13 (1,4%)** | **92,5%** |

**[FACT] Normalizado, el retorno se duplicó (1,9×) y la profundidad se triplicó (3,3×).**
El one-and-done sigue siendo la conducta mayoritaria, pero bajó 3,6 puntos.

### B.3 Retención D1/D3/D7 por cohorte diaria [FACT]

| d0 | cohorte | D1 | D3 | D7 |
|---|---:|---:|---:|---:|
| 08-03 | 1.524 | 51 (3,3%) | 15 | 17 |
| 08-04 | 2.029 | 52 (2,6%) | 13 | 10 |
| 08-05 | 1.102 | 20 (1,8%) | 10 | 7 |
| 08-10 | 115 | 4 (3,5%) | 0 | 1 |
| 08-11 | 114 | 6 (**5,3%**) | 1 | 0 |
| 08-13 | 116 | 4 (3,4%) | 1 | 0 |
| 08-15 | 116 | 5 (4,3%) | 0 | 0 |
| 08-16 | 114 | 4 (3,5%) | 0 | 0 |

⛔ **D7 está CENSURADO para toda cohorte posterior al 08-10** — no han pasado 7 días. Leer
esos ceros como "retención cayó a cero" sería un error de método, no un hallazgo.

**[INFERENCE] D1 no mejoró de forma concluyente.** Las cohortes post-pico oscilan 2,6%–5,3%
contra 1,8%–3,3% del pico; con n≈115 por día, un ±2 puntos es ruido. **La mejora de B.2 viene
de la mezcla de la población, no de una D1 mejor.**

### B.4 Profundidad — completions por wallet [FACT]

| Ventana | Wallets | 0 completions | 1–2 | 3–6 | 7+ |
|---|---:|---:|---:|---:|---:|
| W1 | 5.351 | 4.110 (76,8%) | 616 | 152 | 473 (**8,8%**) |
| W2 | 934 | 701 (75,1%) | 123 | 23 | 87 (**9,3%**) |

**[FACT] La distribución de profundidad es PLANA entre ventanas.** Tres de cada cuatro wallets
no completan nada, en las dos.

⚠️ **[INFERENCE] Esto y B.2 dicen cosas distintas y ambas son ciertas.** La profundidad
**dentro de un día** no cambió; lo que cambió es **volver otro día**. Son dos ejes, y sólo uno
se movió. Cualquier lectura que los mezcle en "los usuarios están más comprometidos" pierde el
matiz que importa para decidir.

---

## PARTE C — Tendencia por superficie

Normalizado sobre la población activa de cada ventana (W1 = 5.351, W2 = 934). **[FACT]**

| Superficie | W1 wallets | % W1 | W2 wallets | % W2 | Δ relativo |
|---|---:|---:|---:|---:|---:|
| `peones_balance_viewed` | 5.323 | 99,5% | 931 | 99,7% | — *(render)* |
| `play_hub_view` | 4.345 | 81,2% | 750 | 80,3% | −1% |
| **Arena** (`arena_game_start`) | 2.626 | 49,1% | 474 | 50,7% | **+3%** |
| **Daily** (`daily_tactic_started`) | 1.360 | 25,4% | 360 | **38,5%** | **+52%** |
| Arena terminada | 1.343 | 25,1% | 268 | 28,7% | +14% |
| **Coach** (`coach_preview_viewed`) | 1.343 | 25,1% | 268 | 28,7% | +14% |
| PRO impresión | 1.341 | 25,1% | 236 | 25,3% | +1% |
| Daily completado | 983 | 18,4% | 199 | 21,3% | +16% |
| Coach viewer | 911 | 17,0% | 182 | 19,5% | +14% |
| PRO tap | 810 | 15,1% | 141 | 15,1% | 0% |
| **Learn** (`training_exercise_started`) | 774 | 14,5% | 135 | 14,5% | **0%** |
| Shop item view | 521 | 9,7% | 115 | 12,3% | +27% |
| Learn completado | 639 | 11,9% | 110 | 11,8% | −1% |
| Play tactics | 513 | 9,6% | 107 | 11,5% | +20% |
| **Victory mint** | 432 | 8,1% | 98 | **10,5%** | **+30%** |
| Score save | 519 | 9,7% | 92 | 9,9% | +2% |
| **Laberinto** | 449 | 8,4% | 82 | 8,8% | +5% |
| Shop tap | 301 | 5,6% | 68 | 7,3% | +30% |
| Coach analyze | 264 | 4,9% | 62 | 6,6% | +34% |
| **Badge claim** | 79 | 1,5% | 26 | **2,8%** | **+88%** |

### C.1 Afinidad con usuarios profundos (≥3 días activos en W2, n=26) [FACT]

Línea base: 26/934 = **2,8%**. Todo lo que esté por encima está enriquecido.

| Evento | % deep | vs base |
|---|---:|---:|
| `peones_spent` | 23,5% | **8,5×** |
| `coach_viewer_ask_coach_tap` | 19,2% | **6,9×** |
| `badge_claim_tx` | 15,4% | **5,5×** |
| `score_submit_tx` | 14,3% | **5,1×** |
| `labyrinth_complete` | 12,2% | **4,4×** |
| `exercise_fail` | 11,9% | 4,3× |
| `exercise_complete` | 10,9% | 3,9× |
| `training_exercise_started` | 9,6% | 3,4× |

⚠️ **[INFERENCE, no causal]** Estos números dicen *quién usa qué*, **no** *qué produce
retención*. El laberinto puede atraer a los profundos o los profundos pueden llegar al
laberinto: la dirección no se decide con esta tabla. Distinguirlo requiere comparar la
conducta **antes** de la primera exposición, y con n=26 no alcanza.

### C.2 Superficies que NO se pueden medir

- **[UNKNOWN] Leaders.** No existe **ningún** evento con `leader`/`rank` en el catálogo. La
  superficie está viva en el producto y es **invisible** para la analítica.
- **[FACT] P2P.** 12 `duel_created`, 5 wallets, **sólo 08-15 y 08-16** — el smoke de dos
  dispositivos. ⛔ **Cero adopción orgánica, y no puede haberla**: el descubrimiento está
  cerrado por flag en producción. Estas filas **no son demanda**.
- **[UNKNOWN] Season Pass.** Sin evento propio distinguible en la ventana.

---

## PARTE D — Salud del contenido, ejercicio por ejercicio

Desde el 2026-08-03. `starts` = `training_exercise_started`. **[FACT]**

### D.1 Los más usados, y el desmoronamiento del embudo

| Ejercicio | Pieza | Starts | Wallets | Completions | % compl. | Replays | ★ prom | Movs sobre óptimo |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `rook-1` | torre | 1.042 | **903** | 762 | 73,1% | 62 | 3,00 | 0,00 |
| `rook-distance-1` | torre | 898 | 561 | 390 | **43,4%** | 24 | 2,96 | 0,04 |
| `rook-2` | torre | 782 | 724 | 711 | 90,9% | 37 | 2,92 | 0,12 |
| `rook-no-diagonal-1` | torre | 739 | 581 | 433 | 58,6% | 7 | 2,65 | 0,72 |
| `rook-4` | torre | 696 | 519 | 348 | 50,0% | 7 | 2,53 | 0,75 |
| `rook-9` | torre | 532 | 471 | 328 | 61,7% | 13 | 2,32 | 2,30 |
| `rook-10` | torre | 223 | 183 | 150 | 67,3% | 26 | 2,52 | 0,78 |
| `bishop-1` | alfil | 179 | **92** | 101 | 56,4% | 25 | 3,00 | 0,00 |
| `knight-1` | caballo | 78 | **48** | 43 | 55,1% | 3 | 3,00 | 0,00 |
| `queen-1` | dama | 41 | **22** | 21 | 51,2% | 11 | 3,00 | 0,00 |
| `pawn-1` | peón | 24 | **17** | 16 | 66,7% | 1 | 3,00 | 0,00 |
| `king-1` | rey | 24 | **16** | 15 | 62,5% | 1 | 3,00 | 0,00 |

**[FACT] La cascada, en wallets:** 903 → 724 → 581 → 519 → 471 → 183 → **92** (alfil) → **48**
(caballo) → **22** (dama) → **16** (rey).

**[INFERENCE] El 98,2% de quienes empiezan no llega a la dama.** El catálogo tiene 60
ejercicios instrumentados; **41 de ellos vieron menos de 30 starts en 15 días.**

### D.2 MAYOR FRICCIÓN (completion baja + replays altos)

| Ejercicio | Starts | % compl. | Replays | Lectura |
|---|---:|---:|---:|---|
| `rook-7` | 132 | **30,3%** | 38 (29%) | El peor del catálogo |
| `rook-6` | 180 | **34,4%** | 40 (22%) | Segundo peor |
| `rook-8` | 202 | 39,6% | 9 | Abandono sin reintento |
| `bishop-7` | 110 | 39,1% | 14 | +1,37 movs sobre óptimo |
| `bishop-fence-1` | 20 | 40,0% | 11 (55%) | Reintento altísimo, n bajo |
| `rook-distance-1` | 898 | 43,4% | 24 | ⚠️ **El 2º más jugado del juego** |

⛔ **`rook-distance-1` es el hallazgo caro:** 898 starts, 561 wallets, y **56,6% no lo
termina**. Está temprano en el carril obligatorio, así que su fricción **se paga sobre la
población entera**, no sobre una minoría que llegó lejos.

### D.3 MAYOR DERIVA (completan, pero muy lejos del óptimo)

| Ejercicio | % compl. | Movs sobre óptimo | ★ prom |
|---|---:|---:|---:|
| `knight-4` | 69,1% | **+4,82** | 1,68 |
| `knight-2` | 91,5% | **+4,09** | 2,72 |
| `knight-3` | 68,3% | +3,22 | 2,05 |
| `knight-10` | 87,5% | +3,14 | 2,14 |
| `knight-7` | 61,5% | +2,88 | 1,63 |

**[INFERENCE] El carril del caballo se completa pero no se entiende.** Alta completion con
+3/+5 movimientos sobre el óptimo describe a alguien que llega por tanteo. Es un perfil
distinto del de la torre, donde se falla o se resuelve limpio.

### D.4 TRÁFICO CASI NULO

**[FACT]** `pawn-10` (6 starts), `knight-10` (8), `pawn-9` (9), `king-8` (12), `pawn-7` (12),
`king-10` (13), `pawn-8` (13), `knight-9` (14), `king-2`/`king-9` (15).

⛔ **[UNKNOWN] No se puede concluir nada sobre su calidad.** Con n<30 y una tasa de llegada del
2%, estos números miden **exposición**, no dificultad ni interés.

### D.5 Qué evidencia haría falta para desambiguar

⛔ **La completion sola no distingue "difícil" de "confuso" de "mal expuesto" de "irrelevante"
de "n chico".** Para cada anomalía, lo que la separaría:

| Anomalía | Difícil | Confuso | Mal expuesto | Irrelevante | n chico |
|---|---|---|---|---|---|
| `rook-7`, `rook-6` (30–34%) | Tiempo hasta el abandono **alto** y muchos movimientos antes de salir | Abandono **temprano**, pocos movimientos, sin reintento | — | — | descartado: n=132/180 |
| `rook-distance-1` (43%, n=898) | Movs sobre óptimo altos | Salida en <10 s | — | — | descartado |
| Carril del caballo (+4 movs) | Consistente entre wallets | Varianza enorme entre wallets | — | — | descartado en `knight-2/3/4` |
| Dama, rey, peón | — | — | **Ésta**: 2% de tasa de llegada | — | no separable hoy |
| `bishop-fence-1` (55% replay) | — | — | — | — | **Ésta**: n=20 |

⚠️ **Lo que falta para contestarlo es UNA señal: tiempo hasta el abandono y movimientos antes
de salir.** Hoy `training_exercise_started` no tiene evento de abandono, así que
**"abandono" se infiere por resta** (start sin completed) y **es indistinguible de "cerró la
app"**. Ésa es la instrumentación que desbloquea toda la parte D — y **no se propone
construirla en esta pasada**.

---

## PARTE E — Qué sobrevivió al pico

| Superficie / Conducta | Lanzamiento | Actual | Tendencia | Afinidad profunda | Interpretación |
|---|---:|---:|---|---|---|
| **Daily** | 25,4% | **38,5%** | ▲▲ **+52%** | media | **[FACT]** Lo único que creció fuerte normalizado |
| **Victory mint** | 8,1% | 10,5% | ▲ +30% | media | **[FACT]** Y es el que convierte |
| **Badge claim** | 1,5% | 2,8% | ▲▲ +88% | **5,5×** | **[FACT]** Chico pero es conducta de núcleo |
| **Coach analyze** | 4,9% | 6,6% | ▲ +34% | **6,9×** *(ask)* | **[FACT]** Superficie de profundos |
| **Shop** | 9,7% | 12,3% | ▲ +27% | **8,5×** *(spent)* | **[INFERENCE]** Mira quien ya se quedó |
| **Laberinto** | 8,4% | 8,8% | ► plano | **4,4×** | **[FACT]** No crece, pero concentra núcleo |
| **Arena** | 49,1% | 50,7% | ► plano | baja | **[FACT]** La puerta de entrada, estable |
| **Learn (ejercicios)** | 14,5% | 14,5% | ► **plano** | 3,4× | **[FACT]** Ni ganó ni perdió terreno |
| **PRO** | 25,1% / 15,1% | 25,3% / 15,1% | ► plano | baja | **[FACT]** Se ve y se toca igual; **no se compra** |
| **P2P** | — | 5 wallets de test | n/a | n/a | ⛔ **No es demanda**: descubrimiento cerrado |
| **Leaders** | — | — | **[UNKNOWN]** | — | Sin instrumentar |

### Respuestas explícitas

1. **¿Qué fue conducta de pico y se apagó?** **[FACT]** En términos absolutos, todo cayó ~82%.
   **Normalizado, nada se apagó**: ninguna superficie perdió más del 1% de share. El pico no
   dejó una conducta muerta — dejó **menos gente haciendo lo mismo**.
2. **¿Qué permanece?** **[FACT]** Todo el repertorio: Arena (50,7%), Daily (38,5%), Coach
   (28,7%), Learn (14,5%), mint (10,5%). El producto **no perdió superficies**.
3. **¿Qué usa desproporcionadamente el núcleo?** **[FACT]** Peones gastados (8,5×), preguntar
   al Coach (6,9×), reclamar insignia (5,5×), subir score on-chain (5,1×), laberinto (4,4×).
   **Todas son conductas de consecuencia, no de consumo.**
4. **¿Encogimiento o núcleo estable?** **[FACT] Núcleo formándose.** Tres evidencias
   independientes: retorno 3,9%→7,5%, ≥3 días 0,86%→2,8%, y **9 días consecutivos de
   184–230 sesiones/día** (08-09 a 08-17) sin tendencia a la baja.
5. **¿Los que quedan son más profundos?** **[FACT] Sí en días, NO en completions.** Vuelven
   1,9× más, pero la distribución de completions por wallet es idéntica (75–77% en cero).
   ⚠️ **Son dos ejes y sólo se movió uno.**

---

## PARTE F — Tendencia de monetización

### F.1 Embudos [FACT], wallets distintos

| | W1 | % del anterior | W2 | % del anterior |
|---|---:|---:|---:|---:|
| PRO impresión | 1.341 | — | 236 | — |
| PRO tap | 810 | 60,4% | 141 | 59,7% |
| PRO `no-token` | 799 | **98,6%** | 135 | **95,7%** |
| **PRO confirmado** | **3** | **0,4%** | **1** | **0,7%** |
| Mint start | 432 | — | 98 | — |
| Mint éxito | 176 | **40,7%** | 44 | **44,9%** |
| Mint error | 175 | 40,5% | 41 | 41,8% |
| Mint cancelado | 145 | 33,6% | 38 | 38,8% |

**[FACT] PRO convierte 0,22% (W1) y 0,42% (W2) de sus impresiones.** El gate `no-token`
absorbe el 95,7–98,6% de los taps.

**[FACT] El mint mejoró: 40,7% → 44,9% de éxito.** Y en W2 produjo **44 conversiones contra
1 de PRO**.

⚠️ **[INFERENCE] La cancelación subió (33,6% → 38,8%).** Con n=98 eso es ±5 puntos de ruido;
no lo trataría como tendencia todavía.

### F.2 Clasificación del error del mint tras el Lote 2 [FACT]

| Día | `unknown` | `insufficientFunds` | `cooldownActive` | `revert` |
|---|---:|---:|---:|---:|
| 08-14 | **17** | 1 | 1 | 1 |
| 08-15 | 2 | 0 | 1 | 0 |
| 08-16 | 6 | 0 | 1 | 0 |
| **08-17** *(fix desplegado 01:45 UTC)* | **2** | **5** | 1 | 1 |

**[FACT] La corrección funciona en producción.** El 08-17 es el primer día donde
`insufficientFunds` supera a `unknown`. **[INFERENCE]** con n=9, es consistente con el
subconteo 21× medido, no una prueba de su magnitud.

### F.3 Estado de la evidencia PRO

⛔ **PRO EVIDENCE STATUS: COLLECTING**

- Filas `no-token` **anteriores** a la instrumentación **no tienen** `read_*` y **NO se
  combinan** con las nuevas: son instrumentos distintos midiendo el mismo evento.
- Observación actual: **5 intentos deduplicados de ~200** (`pnpm ops:no-token`).
- ⛔ **Ninguna recomendación de precio.** El 0,42% de conversión es un [FACT] que **no** se
  puede interpretar hasta saber si el gate ve saldos reales o lecturas fallidas.

---

## PARTE N — Decisiones de producto

**QUÉ SIGUEN HACIENDO** — **[FACT]** Arena (50,7%), Daily (38,5%), Coach (28,7%). El
repertorio completo sobrevivió; sólo hay menos gente.

**QUÉ HACEN DISTINTO LOS QUE VUELVEN** — **[FACT]** Conductas de **consecuencia**: gastar
peones (8,5×), preguntar al Coach (6,9×), reclamar insignia (5,5×), subir score (5,1×),
laberinto (4,4×). No consumen más contenido: **actúan sobre lo que consiguieron**.

**CONTENIDO SANO** — **[FACT]** `rook-1` (73,1%, 903 wallets), `rook-2` (90,9%), `rook-10`
(67,3%). El arranque del carril de la torre funciona.

**CONTENIDO DÉBIL / DESCONOCIDO** — **[FACT] Débil:** `rook-7` (30,3%), `rook-6` (34,4%),
`rook-distance-1` (43,4% sobre 898 starts). **[UNKNOWN]:** dama, rey y peón enteros — 2% de
tasa de llegada; su calidad **no está medida**.

**QUÉ POTENCIAR** — **[INFERENCE]** El **Daily**: única superficie que ganó terreno
normalizado y con la barrera de entrada más baja. Y el **mint**, que es el producto que sí
convierte.

**QUÉ MANTENER** — Arena como puerta de entrada. El laberinto: no crece, pero concentra 4,4×
al núcleo.

**QUÉ DEGRADAR** — ⚠️ **Nada, todavía.** Lo único con evidencia de daño es la fricción de
`rook-distance-1`/`rook-6`/`rook-7`, y eso es **arreglar**, no degradar.

**QUÉ SIGUE CONGELADO** — **P2P** (sin demanda observable, y no puede haberla con el
descubrimiento cerrado). **Precio de PRO** (evidencia en curso).

**QUÉ NECESITA UN EXPERIMENTO, NO UNA FEATURE**
1. **¿La fricción de `rook-distance-1` cuesta población?** Es el 2º más jugado y pierde 56,6%.
2. **¿El Daily como primera experiencia sube D1?** Creció solo; el experimento es si empujarlo
   mueve la retención.
3. **¿El carril del caballo enseña o se tantea?** +4,8 movs sobre óptimo con 69% de completion.
4. ⛔ **Ninguno se implementa en esta pasada.**

---

## Reconciliación con la pasada anterior (2026-08-15)

| Afirmación previa | Hoy | Veredicto |
|---|---|---|
| "95% one-and-done" | 96,1% en W1, **92,5% en W2** | ✅ Confirmada, y **mejorando** |
| "434 de 443 jugaron un solo día" | Misma familia | ✅ Confirmada |
| "El mint es el producto que convierte" | 44 contra 1 en W2 | ✅ **Reforzada** |
| "El contenido es plano: 21 ejercicios dan 3★ al 100%" | 12 ejercicios con ★=3,00 exacto | ✅ Confirmada |
| "PRO/Shop/Season Pass en FREEZE hasta resolver el balance" | Sigue en pie | ✅ Sin cambios |
| "El 95% one-and-done: ¿basura de adquisición o fallo de producto?" | ⚠️ **No contestable** | La adquisición quedó `[UNKNOWN]` estructural |

⚠️ **Matiz que la pasada anterior no podía ver:** miraba **una** ventana. Con dos, aparece que
la población **se densifica** en vez de sólo encogerse. **No contradice** nada previo; agrega
el eje que faltaba.

---

## Límites de esta pasada

- **[UNKNOWN]** Leaders no está instrumentado.
- **[UNKNOWN]** Abandono de ejercicio: no hay evento; se infiere por resta y se confunde con
  cerrar la app.
- **[UNKNOWN]** Adquisición dentro de MiniPay (ver el inventario del 2026-08-16).
- **[UNKNOWN]** D7 censurado para cohortes posteriores al 08-10.
- ⛔ **Ninguna correlación de este documento es causal.** La afinidad del núcleo dice **quién
  usa qué**, nunca **qué produce retención**.
