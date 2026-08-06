# Auditoría de capacidad de contenido — Chesscito

**Fecha:** 2026-08-05 · **Rama:** `main` (`cceed76b`) · **Alcance:** solo lectura.
Nada de contenido, flags, schema ni producción fue modificado.

**Cómo se midió:** catálogo desde `puzzles.generated.ts` + proyección de carril
(`lib/training/special-training-lane.ts`); semántica de ranking desde migraciones y
código de ruta; producción vía `psql` (Docker) contra el pooler de Supabase con
`default_transaction_read_only = on`. Wallets anonimizadas con `left(md5(wallet),8)`.

---

## Resumen ejecutivo

| Pregunta | Respuesta |
|---|---|
| ¿Alguien terminó todo el contenido único? | **No.** Máximo observado: 64 de 78 niveles (82%) y 149 de 177 estrellas (84%). |
| ¿Cuántos están ≥75% / ≥90% / 100%? | **1 / 0 / 0** por estrellas permanentes (de 457 wallets con progreso). |
| ¿Días que le quedan al más avanzado? | **< 1 día de juego activo.** A su ritmo medido (32 niveles nuevos por día activo) le quedan ~0,4 días. |
| ¿Techo real? | **177★ de ejercicios (+48★ de carril, decorativas) y 17.700 puntos de ranking.** |
| ¿El ranking deja de crecer al terminar? | **Sí, el all-time.** El semanal se reinicia y es re-ganable con 6 intentos por semana. |
| ¿P0, P1 o hay margen? | **P1 concentrado, con un P0 latente.** Detalle en Parte 5. |

---

# Parte 1 — Inventario del contenido

## 1.1 Qué está en código vs. qué es alcanzable

El catálogo tiene **siete buckets** (`CATALOG_POOL_KEYS`, `merged-catalog.ts:59`), pero
el jugador no ve los siete: `projectSpecialTrainingLane` **reemplaza** los laberintos
crudos de cada pieza por su juego firma cuando existe. Lo reemplazado sigue en el
contenido y deja de ser alcanzable.

| Bucket | Niveles en código | Alcanzables en prod | Nota |
|---|---:|---:|---|
| `GENERATED_EXERCISES` | 59 | **59** | El carril 1, el único que da estrellas de pieza |
| `GENERATED_LABYRINTHS` | 19 | **4** | Solo los 4 `rook-rail-*`; los otros 15 quedan tapados por la proyección |
| `GENERATED_DIAGONAL_RUN` | 3 | **3** | Alfil |
| `GENERATED_KNIGHT_TOUR` | 3 | **3** | Caballo — **starless** (no da estrellas) |
| `GENERATED_QUEENS` | 3 | **3** | Dama |
| `GENERATED_SAFE_PATH` | 3 | **3** | Rey |
| `GENERATED_PROMOTION_RUN` | 3 | **3** | Peón |
| **Total** | **93** | **78** | 15 laberintos crudos existen pero no se juegan |

Los 15 no alcanzables: `bishop-lab-3/4`, `knight-lab-1..5`, `pawn-lab-1/3/4/5`,
`queen-lab-1..3`, `king-lab-1`. No son bugs — es la decisión de producto
"el carril 2 es un juego por pieza, no laberintos" (2026-07-16). Se listan porque son
**contenido ya autorado y pagado que hoy rinde cero**.

## 1.2 Tabla por pieza (lo que ships hoy)

Modo: los dos productos (`learn` y `play`) sirven el mismo catálogo —
`/exercises` no está gateada por modo; solo se distinguen por `deployment_surface`.

| Pieza | Nivel | Ejercicios (carril 1) | ★ máx ejercicios | Score máx | Juego firma (carril 2) | Niveles | ★ carril | Gate |
|---|---:|---:|---:|---:|---|---:|---:|---|
| Torre | 1 | 10 | 30 | 3.000 | Rook Rails | 4 | 12 | 6★ + 3 ejercicios |
| Alfil | 2 | **9** | **27** | **2.700** | Pivot Challenge | 3 | 9 | idem |
| Caballo | 3 | 10 | 30 | 3.000 | Knight's Tour | 3 | **0** | idem + 2 de 3 con `training_pass` |
| Peón | 4 | 10 | 30 | 3.000 | Promotion Run | 3 | 9 | idem |
| Dama | 5 | 10 | 30 | 3.000 | N-Queens | 3 | 9 | idem |
| Rey | 6 | 10 | 30 | 3.000 | Safe Path | 3 | 9 | idem |
| **Total** | | **59** | **177** | **17.700** | | **19** | **48** | |

Los ejercicios son **únicos, no repetibles para sumar**: el score de la pieza es
`max(1, totalStars) × 100` (`exercises-screen.tsx:1071`) y el ranking toma
`MAX(score)` por nivel. Rejugar mejora la estrella hasta 3 y nada más.

## 1.3 Contenido repetible (no se agota)

| Contenido | Variantes | Repetible | ¿Suma al ranking? |
|---|---:|---|---|
| **Daily Tactic** (`DAILY_TACTIC_PUZZLES`) | 40 | Sí — 1 por día por hash de fecha, cicla indefinidamente | **No.** El Daily vive en `focus_day_ledger`, explícitamente fuera de `score_attempts` (D17) |
| Daily mate-en-1 (`DAILY_PUZZLES`) | 7 | Sí, mismo mecanismo | No |
| Extras PRO (viernes/domingo) | 2/semana, del mismo pool de 40 | Sí | No |
| Rejugar cualquier ejercicio | 78 | Sí | Solo si **mejora** la estrella |
| Ranking semanal | — | Sí, cada semana UTC | Sí, pero se reinicia |

**La única fuente de contenido infinito hoy es el Daily**, y no acredita ranking.

## 1.4 Los seis entregables pedidos

1. **Ejercicios únicos realmente jugables: 78** (59 ejercicios + 19 niveles de carril 2).
   De esos, **76 sin pagar**: `knight-tour-2` y `knight-tour-3` llevan `access: "training_pass"`.
2. **Por pieza:** torre 14 · alfil 12 · caballo 13 · peón 13 · dama 13 · rey 13.
3. **Estrellas máximas: 177** que cuentan (ejercicios) + **48** de carril que se muestran
   pero **nunca entran a `pieceStars` ni al score** (`path.ts:34`). Total visible 225.
4. **Ranking permanente máximo: 17.700 puntos** (Σ de 6 niveles × poolSize × 3★ × 100).
5. **Score semanal máximo: 17.700 puntos**, el mismo techo, re-ganable cada semana.
6. **Repetible tras terminar todo:** el Daily (40 puzzles rotando), rejugar los 78
   niveles sin ganancia, y volver a postear el semanal. Cero progreso permanente nuevo.

---

# Parte 2 — Semántica del ranking (verificada en código y migraciones)

## 2.1 La cadena, del tap al board

```
board reporta medición cruda (moves | failures | coverage)
  → use-attempt-outbox (latch exactly-once `${contentId}:${runKey}`)
  → POST /api/scores/save   [Bearer de sesión de escritura]
  → validateScoreSaveBounds (level 1..6, score ≤ 30.000, time ≤ 1h)
  → gradeAttempt(...)  ← el SERVIDOR calcula las estrellas (D12)
  → RPC save_score_attempt  (una transacción)
       ├─ save_basic_score → tabla score_saves
       └─ insert            → tabla score_attempts
```

**No hay "evento de completación".** Los eventos de analítica no acreditan nada; el
hecho persistido es la fila. Recordá que los nombres del funnel mienten
(`daily_focus_completed` ni se emite).

## 2.2 Dónde vive el progreso

| Dato | Dónde | Consecuencia |
|---|---|---|
| Estrellas por ejercicio | **localStorage** `chesscito:progress:{piece}` | El servidor **nunca** ve qué ejercicio completaste; se pierde al cambiar de device |
| Mejor marca de carril | **localStorage** `chesscito:labyrinth-best:{piece}` | Idem |
| Total de la pieza | `score_saves` (una fila por `(wallet, level, score)` distinto) | Es la **única** huella durable del progreso |
| Que jugaste | `score_attempts` (una fila por intento) | Desde 2026-07-29 |
| Cadena legacy | `scores` (on-chain) | 145 filas, se une al all-time |

Esto es lo que responde de verdad tu pregunta: **el progreso "permanente" del jugador
es local; lo permanente en servidor es un número por pieza, no una lista de ejercicios.**

## 2.3 Deduplicación

- `score_saves.save_id = lower("{wallet}:{levelId}:{score}")`, **UNIQUE**.
  Re-lograr el mismo puntaje devuelve `duplicate` y **no escribe fila**.
- `score_attempts`: `UNIQUE(wallet, attempt_id)` → un reintento del mismo POST es
  *replay*: no inserta y **no consume presupuesto**.
- Todo nivel del carril 2 vuelve `duplicate` en `score_saves` y **eso es correcto**:
  sus estrellas van al ledger, nunca al total de pieza.

## 2.4 ¿Repetir un nivel vuelve a sumar?

**No.** Ambos boards agregan `MAX(score)` por `(wallet, level_id)` y suman esos máximos:

- All-time — `leaderboard_combined_v` (`20260610000000`): `UNION ALL` de `scores` +
  `score_saves`, `MAX(score)` por `(player, level_id)`, `SUM` por jugador. **Top 10**,
  desempate por dirección de wallet ASC, scope **global** (sin `surface`).
- Semanal — `weekly_ranking(surface, week_start, week_end)` (`20260801000000`): lee
  **`score_attempts`** (no `score_saves`), `MAX(score)` por `(wallet, level_id)` dentro
  de la ventana, `SUM`. **Top 10**, desempate por **quién llegó primero**, scope
  **por superficie**.

No es primer score ni suma de corridas: es **máximo por nivel, sumado entre niveles**.

## 2.5 Corte semanal

Ventana **semi-abierta** `[date_trunc('week', now() at time zone 'utc') at time zone 'utc',
+7 días)`. El doble `at time zone 'utc'` es load-bearing: sin él la ventana se corre en un
servidor no-UTC. La vista de fallback siempre calcula la semana **actual** — no existe
board de semanas pasadas.

## 2.6 Techo matemático

| | Legítimo | Impuesto por el servidor |
|---|---:|---:|
| All-time | **17.700** | **180.000** (6 × `MAX_SUBMITTABLE_SCORE` = 6 × 30.000) |
| Semanal | **17.700** | 180.000, por semana |

**El hueco de 10× es real y ya dejó rastro.** `score.ts` lo documenta sin ambigüedad:
*"Nothing ties the `score` in the body to real progress… anyone can POST a maximal score
for a piece they never played"*. El bound es validación de entrada, no anti-cheat.

Evidencia en prod: el nivel 2 (alfil) tiene un `max(score)` de **3.000** cuando el techo
legítimo es 2.700 (9 ejercicios × 3★ × 100). Dos explicaciones compatibles: (a) el pool
del alfil tenía 10 ejercicios antes del audit de currículo B4.3 y esas cuentas quedaron
por encima del techo actual; (b) score inyectado. La cuenta afectada más antigua
(`8200fe9b`, primer save 2026-07-08) favorece la explicación (a), pero **la telemetría no
puede distinguirlas** — no hay dato que las separe.

---

# Parte 3 — Producción (solo lectura)

Consultas reproducibles en `docs/audits/2026-08-05-content-capacity-queries.sql`.

## 3.1 Universo

| Tabla | Filas | Wallets | Primera | Última |
|---|---:|---:|---|---|
| `scores` (on-chain) | 145 | 81 | 2026-04-23 | 2026-08-05 |
| `score_saves` | 3.177 | 456 | 2026-06-10 | 2026-08-06 |
| `score_attempts` | 5.959 | 443 | 2026-07-29 | 2026-08-06 |
| `focus_day_ledger` | 12 | 7 | — | — |
| `content_overlay` | 35 | — | — | — |

**El overlay no agrega contenido.** Las 35 filas son `kind='exercise'`, `stage='draft'`,
`disabled=false`, y **todas sus ids ya existen en el baseline** → son ediciones, no altas.
El catálogo de producción es exactamente el baseline: 78 niveles.

## 3.2 Distribución de progreso permanente (457 wallets)

Base: `stars = Σ MAX(score)/100` por nivel, sobre `scores ∪ score_saves`.
Denominador 177★ / 17.700 pts.

| Banda | Wallets | % |
|---|---:|---:|
| 100% | **0** | 0% |
| 90–99% | **0** | 0% |
| 75–89% | **1** | 0,2% |
| 50–74% | **8** | 1,8% |
| < 50% | **448** | 98,0% |

Máximo 14.900 pts (149★, 84,2%) · promedio 1.638 · mediana 1.200 (12★).

## 3.3 Top 20 más avanzados

| # | tag | Puntos | ★ | % techo | Ejercicios distintos¹ | Intentos | Días activos | Primer save | Última actividad |
|--:|---|---:|---:|---:|---:|---:|---:|---|---|
| 1 | `79ccfb5e` | 14.900 | 149 | 84,2% | 64 | 125 | 2 | 2026-08-04 | 2026-08-05 |
| 2 | `7cab9969` | 12.300 | 123 | 69,5% | 57 | 99 | 1 | 2026-08-05 | 2026-08-05 |
| 3 | `aabf166c` | 11.700 | 117 | 66,1% | 54 | 100 | 1 | 2026-08-03 | 2026-08-03 |
| 4 | `77743f9a` | 11.400 | 114 | 64,4% | 56 | 100 | 1 | 2026-08-04 | 2026-08-04 |
| 5 | `10ee4b70` | 10.800 | 108 | 61,0% | 47 | 95 | 1 | 2026-08-05 | 2026-08-05 |
| 6 | `bdf71fd5` | 10.700 | 107 | 60,5% | 55 | 100 | 1 | 2026-08-04 | 2026-08-04 |
| 7 | `70dcaa45` | 10.600 | 106 | 59,9% | 51 | 100 | 1 | 2026-08-03 | 2026-08-03 |
| 8 | `24c64ea0` | 10.300 | 103 | 58,2% | 52 | 100 | 1 | 2026-08-04 | 2026-08-04 |
| 9 | `8200fe9b` | 10.000 | 100 | 56,5% | 11 | 21 | 6 | 2026-07-08 | 2026-08-04 |
| 10 | `ba612695` | 6.800 | 68 | 38,4% | 0 | 0 | 0 | 2026-06-22 | 2026-07-20 |
| 11 | `da029473` | 6.500 | 65 | 36,7% | 29 | 60 | 1 | 2026-08-03 | 2026-08-03 |
| 12 | `e84270d6` | 6.500 | 65 | 36,7% | 30 | 51 | 1 | 2026-08-04 | 2026-08-04 |
| 13 | `a0c71b02` | 6.400 | 64 | 36,2% | 24 | 61 | 1 | 2026-08-03 | 2026-08-03 |
| 14 | `0304da9c` | 6.300 | 63 | 35,6% | 0 | 0 | 0 | 2026-06-18 | 2026-07-16 |
| 15 | `738d312a` | 5.900 | 59 | 33,3% | 30 | 53 | 1 | 2026-08-03 | 2026-08-03 |
| 16 | `74274610` | 5.700 | 57 | 32,2% | 26 | 50 | 1 | 2026-08-04 | 2026-08-04 |
| 17 | `3b5c6c58` | 5.500 | 55 | 31,1% | 28 | 47 | 1 | 2026-08-03 | 2026-08-03 |
| 18 | `9f3dd1ea` | 5.400 | 54 | 30,5% | 25 | 44 | 1 | 2026-08-03 | 2026-08-03 |
| 19 | `af9d5035` | 5.400 | 54 | 30,5% | 26 | 56 | 1 | 2026-08-05 | 2026-08-05 |
| 20 | `342192bd` | 5.300 | 53 | 29,9% | 30 | 51 | 1 | 2026-08-04 | 2026-08-04 |

¹ Solo mide desde 2026-07-29 (nacimiento de `score_attempts`). Los ceros de #10 y #14 son
cuentas anteriores a esa fecha, no inactividad total.

## 3.4 Dónde está el contenido sin tocar (top 10, ★ por pieza)

| tag | Torre /30 | Alfil /27 | Caballo /30 | Peón /30 | Dama /30 | Rey /30 | Total /177 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `79ccfb5e` | 30 | 27 | 20 | 21 | 26 | 25 | **149** |
| `7cab9969` | 27 | 24 | 18 | — | 27 | 27 | 123 |
| `aabf166c` | 24 | 24 | — | 24 | 24 | 21 | 117 |
| `77743f9a` | 23 | 21 | — | 22 | 26 | 22 | 114 |
| `10ee4b70` | 30 | 23 | 28 | 27 | — | — | 108 |
| `bdf71fd5` | 24 | 22 | — | 24 | 21 | 16 | 107 |
| `70dcaa45` | 30 | 24 | 16 | 24 | 12 | — | 106 |
| `24c64ea0` | 22 | 20 | 17 | — | 29 | 15 | 103 |
| `8200fe9b` | 30 | **30**² | 28 | 12 | — | — | 100 |
| `ba612695` | 27 | 15 | 17 | 9 | — | — | 68 |

² Sobre el techo actual de 27 — ver §2.6.

## 3.5 Sin ejercicios nuevos disponibles

**Ninguna cuenta agotó los 78 niveles.** Máximo 64 (82%).

Cuatro ids **nunca se intentaron en producción**:

| id | Por qué |
|---|---|
| `knight-tour-2` | `access: "training_pass"` — de pago |
| `knight-tour-3` | `access: "training_pass"` — de pago |
| `pawn-promotion-3` | Alcanzable, cola del carril del peón |
| `pawn-10` | Alcanzable, cola del pool del peón |

**Usuarios bloqueados por gate de pago:** 10 wallets llegaron a `knight-tour-1` y
**ninguna** pasó a `-2`/`-3`. Hay 15 `lite_season_passes` emitidos, así que la
entitlement existe — pero nadie con pase llegó hasta ahí. Es un gate que hoy corta a
**el 100% de quienes lo alcanzan**.

## 3.6 Usuarios que ya repiten contenido completado

- 3.401 intentos primera-vez vs **228 repeticiones** (6,3%).
- **74 wallets** ya repitieron al menos un nivel.
- Los más recurrentes del top: `a0c71b02` (24 repeticiones sobre 24 niveles distintos),
  `da029473` (18/29), `10ee4b70` (13/47), `24c64ea0` (12/52).

La repetición ya existe, pero es marginal comparada con el descubrimiento — señal de que
**nadie está todavía atrapado en el loop de repetición**.

## 3.7 Ritmo y forma de la actividad

Nuevos niveles resueltos por día, agregado:

| Día | Niveles nuevos | Wallets |
|---|---:|---:|
| 2026-07-29 → 08-01 | 9 | 3 |
| 2026-08-03 | 855 | 97 |
| 2026-08-04 | **1.592** | 235 |
| 2026-08-05 | 910 | 110 |
| 2026-08-06 (parcial) | 35 | 5 |

Distribución de días activos por wallet: **434 con 1 solo día**, 8 con 2, 1 con 6.

**El dato más importante de toda la auditoría está acá:** el 98% de las cuentas jugó
**un único día**. La restricción que hoy limita el producto no es el contenido — es la
retención del día 2.

## 3.8 Presupuesto de sesión

Seis wallets-día llegaron a **exactamente 100 intentos**, más uno a 99 y otro a 95.
100 es el límite exacto del presupuesto de sesión de escritura. Esas corridas
**tocaron el techo**; el spec ya advertía que ese número nunca se había medido contra
una sesión real de carril 2. Ahora sí: se alcanza.

---

# Parte 4 — Tiempo hasta agotamiento

## 4.1 Método y su límite

`días restantes = niveles nuevos restantes / ritmo de niveles nuevos por día activo`,
con restantes sobre **78**.

**No se pueden calcular ritmos de 3 y 7 días como pedís, y el motivo importa:** salvo una
cuenta, todo el top 20 tiene **un único día activo**, y todos caen dentro de la ventana
del 03 al 06 de agosto. No hay serie temporal para promediar. Un ritmo "de 7 días"
calculado sobre un día concentraría el burst y mentiría hacia arriba; uno "histórico"
dividido por días calendario mentiría hacia abajo. Reporto el ritmo por **día activo**,
que es el único honesto, y marco la incertidumbre.

## 4.2 Top 20 — días hasta agotar

Ordenado por **niveles distintos vistos**, no por score: para agotamiento el denominador
correcto es cuánto catálogo consumió, no cuántas estrellas sacó. Por eso hay tres tags
acá que no están en §3.3, y tres de §3.3 aparecen al pie.

| # | tag | Vistos | Restantes /78 | Ritmo (nuevos/día activo) | Días est. | Clasificación |
|--:|---|---:|---:|---:|---:|---|
| 1 | `79ccfb5e` | 64 | 14 | 32,0 | **0,4** | < 7 días |
| 2 | `7cab9969` | 57 | 21 | 57,0 | **0,4** | < 7 días |
| 3 | `77743f9a` | 56 | 22 | 56,0 | **0,4** | < 7 días |
| 4 | `bdf71fd5` | 55 | 23 | 55,0 | **0,4** | < 7 días |
| 5 | `aabf166c` | 54 | 24 | 54,0 | **0,4** | < 7 días |
| 6 | `24c64ea0` | 52 | 26 | 52,0 | **0,5** | < 7 días |
| 7 | `70dcaa45` | 51 | 27 | 51,0 | **0,5** | < 7 días |
| 8 | `10ee4b70` | 47 | 31 | 47,0 | **0,7** | < 7 días |
| 9 | `e84270d6` | 30 | 48 | 30,0 | **1,6** | < 7 días |
| 10 | `738d312a` | 30 | 48 | 30,0 | **1,6** | < 7 días |
| 11 | `46f060a9` | 30 | 48 | 30,0 | **1,6** | < 7 días |
| 12 | `342192bd` | 30 | 48 | 30,0 | **1,6** | < 7 días |
| 13 | `da029473` | 29 | 49 | 29,0 | **1,7** | < 7 días |
| 14 | `3b5c6c58` | 28 | 50 | 28,0 | **1,8** | < 7 días |
| 15 | `74274610` | 26 | 52 | 26,0 | **2,0** | < 7 días |
| 16 | `af9d5035` | 26 | 52 | 26,0 | **2,0** | < 7 días |
| 17 | `9f3dd1ea` | 25 | 53 | 25,0 | **2,1** | < 7 días |
| 18 | `361c2cb1` | 25 | 53 | 25,0 | **2,1** | < 7 días |
| 19 | `a0c71b02` | 24 | 54 | 24,0 | **2,3** | < 7 días |
| 20 | `bbcc5696` | 24 | 54 | 24,0 | **2,3** | < 7 días |
| — | `8200fe9b` | 11 | 67 | 1,8 (6 días activos) | **36,4** | > 21 días |
| — | `ba612695`, `0304da9c` | s/d | — | — | — | Sin ritmo estimable (pre-`score_attempts`) |

Clasificación agregada del top 20: **agotado 0 · < 7 días 20 · 8–14 días 0 ·
15–21 días 0 · > 21 días 0 · sin ritmo 2** (más `8200fe9b`, el único con historial
multi-día real, en > 21 días).

## 4.3 La distinción que pediste

- **Terminó el contenido único: nadie.** Cero cuentas en 78/78 y cero en 177★.
- **Puede repetir y competir: todos.** Ninguna cuenta perdió acceso a nada: el Daily
  sigue rotando, los 78 niveles se pueden rejugar, y el semanal se reinicia cada lunes UTC.
  Lo que se acaba no es la actividad — es el **progreso que se registra**.

## 4.4 Advertencia sobre estos números

Las ocho cuentas de cabeza comparten un patrón que no parece juego orgánico: primer save
y única actividad **el mismo día**, 47–64 niveles distintos en esa jornada, y varias
clavadas en exactamente 100 intentos. Un jugador nuevo que resuelve 60 tableros en una
sentada es un perfil de QA, de device de prueba o de sesión guiada, no de un usuario de
MiniPay. **Los días-hasta-agotar de arriba miden ese comportamiento**; si esas cuentas
son de prueba, el techo real está mucho más lejos para el usuario genuino. Decidilo vos
—yo no puedo distinguirlas sin desanonimizar, y no lo voy a hacer.

---

# Parte 5 — Veredicto

**1. ¿Alguien ya terminó todo?**
No. Máximo 64/78 niveles (82%) y 149/177★ (84%). Ninguna pieza está al 100% en más de
una cuenta a la vez, y ninguna cuenta tiene las seis completas.

**2. ¿Cuántos por encima de 75%, 90% y 100%?**
Sobre 457 wallets con progreso permanente: **1 sobre 75%, 0 sobre 90%, 0 en 100%.**
Ocho más entre 50% y 74%. El 98% está debajo del 50%.

**3. ¿Cuántos días le quedan al más avanzado?**
`79ccfb5e`: 14 niveles nuevos a 32/día activo → **menos de medio día de juego**.
En días calendario depende enteramente de si vuelve — y el 98% no vuelve.

**4. ¿Techo real de estrellas y ranking?**
177★ que cuentan + 48★ decorativas de carril = 225 visibles.
17.700 puntos all-time y 17.700 semanales. El servidor, en cambio, acepta hasta
180.000: el techo *impuesto* es 10× el *legítimo*.

**5. ¿El ranking deja de crecer al terminar los ejercicios?**
**El all-time, sí: se congela para siempre.** Es `SUM(MAX(score) por nivel)` y el score
es función de estrellas, que topean. Un jugador al máximo no vuelve a escribir una fila
de `score_saves` nunca más.
**El semanal, no:** se recalcula cada semana UTC sobre `score_attempts`, así que un
jugador maxeado re-postea sus 17.700 con **seis intentos por semana** (uno por pieza).
Pero eso significa que el semanal, en el límite, no ordena por esfuerzo sino por
"quién llegó primero" entre gente empatada en el techo.

**6. ¿P0, P1 o hay margen?**

**P1 con un P0 latente. Con margen — pero no donde parece.**

- **No es P0 de contenido.** Cero cuentas agotadas, 98% debajo del 50%, y el cuello de
  botella medido es la retención (434 de 443 wallets jugaron un solo día), no el
  inventario. Autorar 100 ejercicios más no movería a nadie que no vuelve al día 2.
- **Es P1 por la cabeza de la distribución.** 8 cuentas quemaron 60–80% del catálogo en
  una sesión. Si esas son reales y vuelven, se agotan esta semana. Y como el all-time se
  congela, el jugador que más invirtió es exactamente al que el producto deja de
  responderle.
- **El P0 latente es el hueco de validación**, no el contenido: `MAX_SUBMITTABLE_SCORE`
  admite 30.000 por nivel contra un techo real de 2.700–3.000, y el score sale de
  localStorage sin ninguna atadura al progreso. Cualquiera puede sentarse primero en el
  board all-time con un POST. Todavía nadie lo hizo (14.900 es el máximo, por debajo del
  techo legítimo), pero el board es público y es entregable del listing de MiniPay. Eso
  se rompe el día que alguien mire, no cuando se acabe el contenido.

Recomiendo, en ese orden: (a) cerrar el hueco de validación derivando el score server-side;
(b) recuperar los 15 laberintos ya autorados que hoy no son alcanzables — es contenido
gratis; (c) revisar el gate de `knight-tour-2/-3`, que hoy corta al 100% de quienes lo
alcanzan; (d) recién después, autorar volumen.

**7. ¿Cuántos ejercicios nuevos para dar 7, 21 y 30 días extra?**

Al ritmo del más activo (**32 niveles nuevos por día activo**):

| Objetivo | Niveles nuevos necesarios |
|---|---:|
| +7 días | **224** |
| +21 días | **672** |
| +30 días | **960** |

Ese número dice que **el volumen no es la palanca**: 960 niveles son ~12× el catálogo
entero y ninguna cadencia de autoría lo alcanza. Para contraste, al ritmo que el propio
producto pretende imponer (10 ejercicios por sesión diaria, `SESSION_EXERCISE_LIMIT`):

| Objetivo | Niveles nuevos necesarios |
|---|---:|
| +7 días | **70** |
| +21 días | **210** |
| +30 días | **300** |

Con 78 niveles, un jugador que respeta el ritmo de 10/día tiene **7,8 días** de contenido.
Ahí está la respuesta útil: **el problema no es cuánto contenido hay, es que el ritmo
diseñado no se está aplicando.** Los ocho de cabeza hicieron 47–64 niveles en un día
contra un límite nominal de 10. Antes de autorar 300 ejercicios, verificá por qué ese
gate no está frenando (ver ambigüedad A1).

---

# Ambigüedades y límites de esta auditoría

**A1 — El límite de sesión diaria no coincide con lo observado.** `SESSION_EXERCISE_LIMIT`
default es 10 (hard max 25 con dos packs pagos), pero ocho cuentas hicieron 47–64 niveles
distintos en un día. Tres explicaciones posibles, no las puedo separar desde acá:
`NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` está seteado alto en producción; el gate es
`liteMode`-only y esas sesiones no lo eran; o el estado vive en localStorage y se puede
resetear. **No pude leer el valor de producción** — el harness bloqueó la lectura del
`.env` y no quise tocar `vercel env`. Es la primera cosa a confirmar.

**A2 — El progreso por ejercicio no existe en servidor antes del 2026-07-29.** Todo lo que
digo sobre "qué ejercicios completó alguien" sale de `score_attempts`, que nació ese día.
Para cuentas anteriores solo tengo el total por pieza. Dos del top 20 aparecen con
0 ejercicios distintos por eso, no por inactividad.

**A3 — Estrellas → ejercicios no es invertible.** 24★ en la torre pueden ser 8 ejercicios
a 3★ o 10 a 2,4★. Los porcentajes de §3.2 son sobre **estrellas**, que es el denominador
correcto para "progreso permanente", pero no equivalen a "% de ejercicios vistos".

**A4 — El alfil por encima de su techo.** `max(score)` del nivel 2 es 3.000 contra un techo
de 2.700. Compatible con el pool histórico de 10 ejercicios (audit B4.3) y también con
score inyectado. No hay dato que las distinga.

**A5 — `CONTENT_STAGE` de producción no verificado.** Las 35 filas del overlay son
`stage='draft'`, así que si el floor de producción es `published` no se aplican. Da igual
para la capacidad —**ninguna fila agrega ids nuevos**, todas editan ejercicios existentes—
pero significa que el builder tiene 35 ediciones que quizá no estén vivas.

**A6 — Solo hay datos de `surface='learn'`.** Cero intentos en `play`. El techo de 17.700
aplica por igual a los dos, pero de `play` no hay nada que medir.

**A7 — Las ocho cuentas de cabeza podrían no ser jugadores.** Ver §4.4.
