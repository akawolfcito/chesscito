# Estado de Chesscito — 2026-09-04

**Tipo:** medición read-only (`ops:health` + `ops:query` contra producción). Nada modificado.
**Contexto:** primer día completo después del downgrade Supabase Pro → Free (2026-09-03).

---

## 1. Infraestructura — 🟢 el downgrade no dolió

| | Antes (02-09, Pro) | Hoy (04-09, Free) |
|---|---|---|
| Estado | 🔴 RED | **🟢 GREEN** |
| `now()` | 5.358 ms | **4.941 ms** |
| Base | 245 MB | 246 MB |
| Conexiones | 1 activa / 7 idle | 1 activa / 5 idle |
| `play` / `learn` | 200 | **200 / 200, cero 5XX** |

**[HECHO] No hay evidencia de degradación.** ⚠️ La latencia de `now()` es ruidosa —ayer dio
7.645 y 3.605 con dos minutos de diferencia—, así que el número sirve para descartar un
desastre, no para afirmar una mejora.

Crecimiento: 3.078 filas/día → **51 MB a 30 días**. Con la retención de 90 días ya activa, la
tabla está en su techo. **No hay que podar nada.**

---

## 2. Cuántos usuarios hay

**~98 cuentas por día**, y bajando.

| Semana | Promedio diario |
|---|---:|
| 22–28 ago | **124** |
| 29 ago – 3 sep | **97,5** |

**[HECHO] −21% semana contra semana.** No es un derrumbe; es la erosión que ya veníamos
midiendo, sostenida.

**La composición es lo que importa, y no se movió:**

| | Por día |
|---|---:|
| Cuentas nuevas | **72–93** (≈75-80%) |
| Cuentas que vuelven | **20–33** (≈20-25%) |

⛔ **El grupo que vuelve lleva tres semanas plano en ~25/día.** No crece ni con 143 cuentas
diarias ni con 98. El producto vive del caudal de gente nueva, y ese caudal baja.

---

## 3. Retención — sin cambios

Cohortes desde el 2026-08-06 (post-pico, n=3.424):

| Días activos | Cuentas | % |
|---:|---:|---:|
| **1** | **3.180** | **92,3%** |
| 2 | 177 | 5,1% |
| 3 | 37 | 1,1% |
| 4+ | 30 | 0,9% |

El 92,3% contra el 93,4% medido el 02-09 no es una mejora: aquella cifra incluía el pico de
agosto. **Es el mismo número.**

---

## 4. Embudo, últimos 7 días (cuentas distintas)

| Evento | Cuentas | Conversión |
|---|---:|---|
| `peones_balance_viewed` (la puerta) | 608 | — |
| `play_hub_view` | 479 | 79% |
| `arena_start_tap` | 373 | 78% |
| `arena_game_start` | 373 | ✅ 100% |
| **`arena_game_end`** | **178** | **⛔ 48%** |
| `training_exercise_started` | 166 | — |
| `exercise_complete` | 124 | ✅ 75% |
| `hub_view` (LEARN) | 92 | 19% de PLAY |

**La fuga sigue exactamente donde estaba: una de cada dos partidas que empieza no termina.**

⚠️ **`first_move_made` da 233 sobre 373 = 62%, y NO hay que compararlo con el 87,7% del
2026-09-02.** Ese evento se desplegó el 31-08, así que tres de los siete días de esta ventana
no lo tienen. **El 62% es un artefacto de la ventana, no una caída.** La medición válida sigue
siendo la del 02-09 (n=302, apareada por `game_id`).

---

## 5. Desenlaces, últimos 7 días

| Dificultad | Partidas | Gana | **Tablas** | Le hacen mate |
|---|---:|---:|---:|---:|
| **easy** | 295 | 32,2% | **51,2%** | 4,7% |
| hard | 112 | 8,9% | 30,4% | 45,5% |
| medium | 90 | 21,1% | 8,9% | 62,2% |

**Sin cambios respecto del 02-09.** En `easy` —la que elige casi todo el mundo— el desenlace
más probable sigue siendo **un empate**.

---

## 6. Actividad económica — la caída más pronunciada

| Semana | Movimientos de `peones_ledger` | Sesiones con `tx_progress_done` |
|---|---:|---:|
| 03 ago (pico) | 6.874 | 1.349 |
| 10 ago | 1.171 | 268 |
| 17 ago | 1.104 | 245 |
| 24 ago | 851 | 191 |
| **31 ago** | **529** | **124** |

**−91% contra el pico, −54% contra la semana del 10 de agosto.** Cae más rápido que las
cuentas diarias (−21%), lo que sugiere que **la gente que queda participa menos de la economía**,
no sólo que hay menos gente.

⛔ **Caveat que invalida cualquier lectura de ingresos:** ni `peones_ledger` ni
`tx_progress_done` significan "compra". El ledger incluye Peones **ganados y regalados**
(welcome pack, recompensas), y `tx_progress_done` es cualquier transacción on-chain
completada, no necesariamente un pago. **Para ingresos reales hay que mirar la cadena**, no
estas dos series. Sirven como señal de actividad, no de plata.

---

## 6-bis. Ingresos REALES, leídos de la cadena

`node scripts/ops/onchain-revenue.mjs --since 2026-08-03` · 2.815 llamadas RPC por contrato.

**Desde el listing en MiniPay (03-08) hasta hoy — 33 días:**

| | |
|---|---:|
| **Volumen total** | **2,56 USDT + 0,09 cUSD + 0,03 USDC ≈ $2,68** |
| Victory mints pagos | 230 eventos · 177 wallets |
| **Compras de packs (Get Peones)** | **0** |
| Scores enviados (gratis) | 100 · 77 wallets |
| Wallets distintas en la cadena | **251** |

**Y la última semana, medida aparte:** 23 mints · 17 wallets · **$0,27**.

### Lo que dicen estos números

**[HECHO] El 51% de todos los mints del mes ocurrió en los primeros TRES días.**
Por día: 30 · 49 · 38 (03, 04, 05 de agosto) = 117 de 230. Después cae a 1-9 diarios y no se
recupera nunca. **No es un negocio corriendo: es una curiosidad inicial que se apagó.**

**[HECHO] Cero compras de packs en 33 días.** Los ítems de $1,00 y $1,99 están habilitados
desde el listing y **nunca se vendieron ni una vez**. Es la tercera medición independiente que
lo confirma (05-08, últimos 7 días, y ahora el mes completo).

**[HECHO] 251 wallets tocaron la cadena**, sobre ~7.700 cuentas que jugaron alguna vez = **3,3%**.
Y el ticket medio por wallet que pagó es **$0,015** — un centavo y medio.

⛔ **Esto invalida la lectura de "actividad económica" de la sección 6.** Ahí reporté 124
sesiones semanales con `tx_progress_done` como si fueran actividad de pago. La cadena dice
**23 mints pagos**. Ese evento cuenta algo mucho más amplio que una compra, exactamente como
advierte [[feedback_funnel_event_names_are_not_what_they_seem]].

### ⚠️ Dos caveats de la medición

1. **Es un PISO, no un total.** El escaneo reportó `2/2815 chunks FAILED` en Get Peones y
   `11/2815` en scores. Los victory mints no reportaron fallas, así que esa cifra sí es
   completa.
2. ⛔ **No reconcilia con la memoria del proyecto.** `project_onchain_audit_facts` registra una
   lectura del 05-08 con *"216 victory mints pagos · 149 wallets · ≈$2,60"*. Hoy el desglose
   por día da **117 mints** hasta el 05-08 y **230 en todo el mes**. Los montos en dólares sí
   coinciden ($2,60 vs $2,68), lo que sugiere que aquella corrida **escaneó desde el deploy del
   contrato en vez de desde el listing** y arrastró los mints de desarrollo del founder — que
   es precisamente el error contra el que esa misma memoria advierte. **La medición de hoy es
   la confiable**, porque tiene desglose diario verificable.



1. **La infra está sana y el downgrade fue correcto** — se paga menos por lo mismo.
2. **El problema no cambió y no va a cambiar solo:** entran ~75 personas nuevas por día, se van
   el 92,3%, y el núcleo que vuelve lleva tres semanas clavado en ~25.
3. **La fuga sigue siendo terminar la partida** (48%), y el desenlace sigue siendo un empate.
4. **Lo económico cae más rápido que la gente**, lo cual merece su propia mirada — pero contra
   la cadena, no contra estas tablas.

⚠️ Lo que sigue sin poder medirse: si el duelo P2P cambia algo, porque **ningún evento de
duelo lleva `account_ref`** y no se puede cruzar con retención (ver
`2026-09-02-duel-council-review.md`).
