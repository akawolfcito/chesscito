# El reto de 21 días — estado real al 2026-08-25

> **Read-only.** Nada se cambió: ni código, ni datos, ni configuración. Todas las
> consultas corrieron con `scripts/ops/read-only-query.ts`, que fuerza
> `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` en el servidor.

---

## Resumen ejecutivo

```
21-day challenge semantics:   21 FECHAS UTC DISTINTAS (no consecutivas)
                              dentro de una ventana de 30 días,
                              tras comprar el Season Pass de $0.99.
                              PRO = ventana ilimitada.
First possible completion:    2026-07-20  (primer comprador 2026-06-30 + 21 días)
Completed 21/21:              0
Currently at 20/21:           0
Currently at 19/21:           0
Currently at 18/21:           0
Started challenge:            17 wallets compraron el pase
                              (+1 wallet con PRO y sin pase = 18 elegibles)
% reaching D7:                5,6 %   (1 de 18)
% reaching D14:               0 %
% reaching D21:               0 %
First completion:             none
Measurement confidence:       MEDIUM
```

**Nadie completó el reto.** El máximo observado es **10 de 21**, y lo tiene una sola
wallet. La segunda mejor tiene **3**.

**Y no es un problema de tiempo.** La primera completion era posible desde el
2026-07-20, hace 36 días. Seis wallets compraron el pase en junio y julio con
tiempo de sobra: cinco de ellas tienen **cero** días registrados.

---

## 1. Semántica — qué significa técnicamente "completar 21 días"

Verificado en código antes de mirar datos.

**Fuente:** `apps/web/src/lib/season-pass/focus-days.ts`, `lib/payments/rail-config.ts:203`,
migración `20260728000000_focus_day_ledger.sql`.

| Pregunta | Respuesta | Evidencia |
| --- | --- | --- |
| ¿21 días calendario distintos? | **Sí** | `focus-days.ts:18` — *"Distinct UTC dates completed inside the active season"* |
| ¿21 Daily Focus completados? | Sí, pero **uno por fecha** | El write cuelga de `chesscito:daily-completed` |
| ¿21 consecutivos? | **No** | No hay lógica de consecutividad en el conteo |
| ¿Tolerancia por Shields? | **No** | Los shields protegen el **combo de ejercicios** (S1), no la racha diaria (S2). Son conceptos distintos con el mismo nombre |
| ¿Puede avanzar 2 veces en un día? | **No** | `UNIQUE (wallet, season_id, date_utc)` |
| ¿Qué representa la completion? | `completed >= goal` en `/api/season-pass/status` | `route.ts:187` |
| Goal | **21** | `rail-config.ts:207 challengeGoalDays: 21` |
| Ventana | **30 días** | `accessDurationDays: 30` — 21 días de esfuerzo dentro de 30 de acceso |
| Season | `21day-mind-challenge-2026-q3` | `rail-config.ts:209` |

### Los conceptos NO son intercambiables

| Concepto | Dónde vive | Qué mide |
| --- | --- | --- |
| **Focus Days** (el reto) | `focus_day_ledger` | Fechas UTC distintas. **La fuente de verdad** |
| **Daily streak** (la llama) | `lib/daily/progress.ts`, localStorage | Días **consecutivos**. Se resetea a 1 al fallar |
| **Exercise combo** | `lib/exercises/use-streak.ts` | Ejercicios seguidos sin fallar, dentro de una sesión |
| **Passport** | `passport_cache` | Presentación, no autoridad |

⛔ **Un jugador con 10 Focus Days NO tiene una racha de 10.** Se demuestra abajo.

---

## 2. Fuente canónica

**`focus_day_ledger`** — no analytics.

```sql
CREATE TABLE focus_day_ledger (
  id uuid PRIMARY KEY, wallet text, season_id text, date_utc date,
  source text CHECK (source IN ('daily','daily_retry','backfill_streak')),
  created_at timestamptz,
  UNIQUE (wallet, season_id, date_utc)
);
```

La UNIQUE hace que **el doble conteo por día sea imposible por construcción**, no por
disciplina. Verificado empíricamente: `duplicate_wallet_dates = 0`.

`focus_ledger_init` latchea el backfill por `(wallet, season_id)`.

---

## 3. Distribución completa

Ledger entero: **20 filas, 8 wallets, 1 temporada.**

| row_tag | días | short | primer día | último día | span | racha máx | rachas | daily | retry | backfill | días sin jugar |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `8200fe9b` | **10** | 11 | 07-31 | **08-25** | 26 | **4** | 6 | 10 | 0 | 0 | **0** |
| `b5a39139` | 3 | 18 | 07-30 | 08-06 | 8 | 1 | 3 | 3 | 0 | 0 | 19 |
| `0d6bb844` | 2 | 19 | 08-14 | 08-19 | 6 | 1 | 2 | 1 | 1 | 0 | 6 |
| `7e129289` | 1 | 20 | 08-03 | 08-03 | 1 | 1 | 1 | 0 | 1 | 0 | 22 |
| `aabf166c` | 1 | 20 | 08-03 | 08-03 | 1 | 1 | 1 | 0 | 0 | 1 | 22 |
| `fa98218f` | 1 | 20 | 08-04 | 08-04 | 1 | 1 | 1 | 0 | 1 | 0 | 21 |
| `59e9e8af` | 1 | 20 | 08-05 | 08-05 | 1 | 1 | 1 | 0 | 1 | 0 | 20 |
| `c1d33afb` | 1 | 20 | 08-05 | 08-05 | 1 | 1 | 1 | 0 | 1 | 0 | 20 |

### Buckets

| Bucket | Wallets |
| --- | ---: |
| 21/21 · 20/21 · 19/21 · 18/21 · 15–17 | **0** |
| 10–14 | 1 |
| 5–9 | 0 |
| 1–4 | 7 |
| 0 (compraron y no jugaron) | **10** |

**En la recta final (≥18 días): cero.**

### Embudo sobre los 18 elegibles

| Hito | Wallets | % |
| --- | ---: | ---: |
| Compró / elegible | 18 | 100 % |
| Registró ≥1 día | 8 | 44,4 % |
| ≥7 días | 1 | **5,6 %** |
| ≥14 días | 0 | 0 % |
| ≥18 días | 0 | 0 % |
| **≥21 días** | **0** | **0 %** |

---

## 4. Progreso acumulado ≠ racha — y acá se ve por qué importa

`8200fe9b` tiene **10 días completados**, y presentarlo como "racha de 10" sería falso:

- **26 días** entre su primer y último día
- **6 rachas separadas**
- **racha más larga: 4 días**

Es un jugador que vuelve seguido, no uno que encadenó. Ninguna otra wallet superó una
racha de **1**: todas sus apariciones son días sueltos.

⚠️ El `longest_streak` de esta tabla se deriva del ledger (islas por
`date - row_number()`), **no** del `DailyProgress.streak` del cliente, que vive en
localStorage y no es consultable desde el servidor.

---

## 5. Primera cohort (compras del 3 al 5 de agosto)

| Métrica | Valor |
| --- | ---: |
| Iniciaron el reto | **9** |
| Llegaron a 1 día | 5 (55,6 %) |
| Llegaron a 7 días | **0** |
| Llegaron a 14 días | 0 |
| Llegaron a 18 días | 0 |
| Llegaron a 21 días | 0 |
| **Activos en los últimos 7 días** | **0** |

Las cinco que jugaron registraron **exactamente un día**: el mismo de la compra. Ninguna
volvió. La cohort completa está inactiva hace 20+ días, con el pase todavía vigente
(expira entre el 2026-09-02 y el 09-04).

**Este es el hallazgo central: el reto no falló en el día 21, falló en el día 2.**

---

## 6. Confiabilidad de la medición — `MEDIUM`

### Lo que está sólido

| Verificación | Resultado |
| --- | --- |
| Fechas duplicadas por wallet | **0** — imposible por la UNIQUE |
| Más de una completion diaria | Imposible por construcción |
| Suma por wallet vs total del ledger | 20 = 20 ✓ |
| Timezone | Coherente: `date_utc` es `date`, y el servidor asigna la fecha (`use-focus-day-recorder.ts`: el POST de completion **no manda fecha**, para que un reloj adelantado no acuñe un día) |
| Volumen | 20 filas: auditable a mano, sin espacio para error estadístico |

### Lo que baja la confianza

**a) Preview y production comparten Supabase, y el ledger no tiene columna de entorno.**
El esquema es `(id, wallet, season_id, date_utc, source, created_at)` — **no hay señal
para separar**. Cualquier prueba hecha en preview con una wallet real es
indistinguible de un jugador. Con 20 filas esto es material: una sola fila de prueba
mueve el 5 % del corpus.

**b) `backfill_streak` no es un día ganado día a día.** Una fila (`aabf166c`) proviene
del backfill del streak previo, no de un Daily completado dentro del reto. Es el 100 %
del progreso de esa wallet.

**c) `daily_retry` reconcilia días que quizá nunca llegaron.** 5 de 20 filas (25 %).
Es un mecanismo legítimo — acepta sólo `[ayer, hoy]` — pero significa que un cuarto del
corpus se escribió en diferido.

**d) No pude identificar wallets internas o de testing.** No hay marca de usuario
interno en el esquema. Con 18 wallets, si dos son del equipo, el embudo cambia ~11 %.

**e) `focus_ledger_init` tiene 15 wallets latcheadas y sólo 3 filas sembradas.** Doce
wallets pasaron por el backfill y no aportaron ninguna fila. Es el comportamiento
esperado (no tenían streak previo), pero conviene saberlo antes de leer el latch como
"participantes".

### Anomalías investigadas y explicadas

| Observación | Veredicto |
| --- | --- |
| `b5a39139` tiene 3 días y **no compró el pase** | ✅ Legítimo: tiene **PRO** (expira 08-31). PRO otorga ventana ilimitada |
| `8200fe9b` registró días **15 días después de expirar su pase** (08-20, 08-22, 08-25) | ✅ Legítimo: también tiene **PRO** hasta 09-02 |

⚠️ **Corrección propia:** mi primer cálculo marcó a `8200fe9b` como `UNREACHABLE`
comparando contra el expiry del Season Pass. Está mal — `isUnreachable()`
(`focus-days.ts:74`) devuelve `false` siempre que la ventana sea `unbounded`, y PRO lo
es. Esa wallet **sí** puede completar según el modelo.

⚠️ **Un matiz que el modelo no cubre:** `8200fe9b` necesita 11 días más y su PRO expira
en 8. El sistema le dirá que es alcanzable porque `unbounded` ignora el vencimiento de
PRO. No es un bug del ledger, pero es una promesa que el producto puede no poder cumplir.

### Un error de análisis que vale documentar

Mi primera consulta reportó **60 días completados en un span de 26** — imposible bajo la
UNIQUE. La causa era mía: un `JOIN … USING (row_tag)` cruzaba cada día con cada isla de
racha y multiplicaba filas. Lo detectó el sanity check `ledger_rows = summed_per_wallet`.
**Toda consulta de agregación sobre este ledger debería llevar ese contraste**, porque
el resultado inflado se ve perfectamente plausible.

---

## 7. Comportamiento recurrente

Con lo que el ledger permite:

| Señal | Valor |
| --- | ---: |
| Wallets que volvieron ≥2 días distintos | **3 de 18** (16,7 %) |
| Wallets con un solo día | 5 |
| Wallets con cero días pese a haber pagado | **10** |
| Abandono tras D1 | 5 de 8 que jugaron (62,5 %) |
| Abandono tras D3 | 6 de 8 (75 %) |
| Retomaron tras romper racha | **1** (`8200fe9b`, 6 rachas distintas) |
| Activos en los últimos 7 días | **1 de 18** |

⛔ No pude cruzar con `analytics_events`: **esa tabla no tiene columna `wallet`**, así
que "volvió a la app pero no completó el Daily" no es medible por esta vía. Habría que
pasar por `session_first_seen` / `account_first_seen`, que no exploré.

---

## 8. Qué incorporar a `ops:health`

Hoy el monitor no dice nada del reto. Propuesta, en orden de valor:

1. **`challenge_funnel`** — elegibles / ≥1 día / ≥7 / ≥14 / ≥18 / 21. Una línea. Hoy
   requiere cuatro consultas manuales.
2. **`challenge_first_completion`** — timestamp de la primera completion, o `none`.
   Es un hito de producto que merece avisar solo.
3. **`challenge_at_risk`** — wallets con pase activo cuyo `days_owed > days_left`
   (unreachable), contando PRO como ilimitado. **Hoy son 15 de 17**, y nadie lo sabía.
4. **`challenge_paid_zero`** — compraron y tienen 0 días. **Hoy 10 de 17 (59 %)**:
   pagaron y no jugaron ni una vez. Es la métrica más accionable de todas.
5. **`ledger_sanity`** — `ledger_rows == summed_per_wallet` y `duplicate_wallet_dates == 0`,
   por lo que expliqué arriba.

⚠️ Los cinco heredan la limitación (a): **no separan preview de production**. El monitor
ya rotula Supabase como `SHARED DATABASE`; estas métricas deben ir bajo el mismo rótulo
o invitan a atribuir a producción algo que puede no serlo.

---

## Consultas usadas

En `scratchpad/`, corridas con `read-only-query.ts`:

| Archivo | Qué responde |
| --- | --- |
| `q1-ledger-overview.sql` | Volumen, procedencia, temporadas, latch |
| `q3-per-wallet-fixed.sql` | Progreso, rachas y sanity por wallet |
| `q5-cohort.sql` | Compradores del pase, expiry, alcanzabilidad |
| `q6-anomalies.sql` | PRO vs pase, días post-expiry, cohort 3–5 ago |

`q2-per-wallet.sql` queda como registro del error de JOIN descrito en §6.
