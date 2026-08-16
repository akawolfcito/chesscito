# Phase 0.5 — Auditoría de seguridad de las lecturas server-side a Supabase

**Fecha:** 2026-08-16 · **Audit previo:** `docs/audits/2026-08-16-supabase-fetch-cache.md`
**Alcance:** clasificar las lecturas restantes, verificar el mecanismo, resolver la hipótesis de
privacidad, y arreglar **sólo** lo que se pruebe P0.

---

## 0. ⛔ CORRECCIÓN AL AUDIT PREVIO — leer primero

El audit anterior afirmó como **hecho** que *"el Data Cache de Next servía lecturas viejas"*.
**Esa afirmación no sobrevive a la reproducción.**

`[FACT]` El duelo **sí** servía estado viejo, y el fix **sí** fue causal:

| momento | la fila (psql) | lo que contestaba la ruta |
| --- | --- | --- |
| antes del fix | `active / v2` | `awaiting-opponent / v1` |
| después del fix | — | `finished / v3` (dos escrituras adelante) |

`[FACT]` Pero una **segunda** ruta con el mismo cliente y la misma configuración de segmento
(`welcome-pack/status`, `.select()` filtrado por wallet) **NO reproduce el stale**: con una
fixture controlada, vio el cambio de inmediato.

`[UNKNOWN]` **Por qué difieren.** Las dos declaran `dynamic = "force-dynamic"`. El síntoma y el
arreglo están probados; **el mecanismo no**. Llamarlo "Data Cache" era una inferencia, y queda
degradada a eso.

⚠️ **Consecuencia directa:** no hay base para habilitar `freshReads` en masa. Ninguna otra
lectura demostró el defecto.

---

## 1. Inventario `[FACT]`

Generado del repo, no estimado. **31 archivos** contienen `.select(`; 1 es del duelo (ya
cubierto). **30 a clasificar.**

⚠️ El conteo previo de "~25" venía de un grep por archivo que **subcuenta**: una ruta puede leer
a través de un helper que recibe el cliente, y ahí el `.select(` no está en la ruta.

`[FACT]` **Las RPC quedan fuera del problema.** Leído en el fuente de `postgrest-js@2.100.1`:
`rpc()` usa `method = 'POST'` salvo `get`/`head` explícito, y en este repo **no hay ninguno**.
Next sólo cachea GET. Eso saca de la superficie a `peones_spend`, `save_score_attempt`,
`peones_balance_with_caps`, `consume_*`, `get_leaderboard`, `get_weekly_*` y `promote_content`.

### Clasificación

| clase | qué es | archivos |
| --- | --- | --- |
| **A — público, stale tolerable** | catálogo, agregados públicos | `content/merged-catalog`, `stats/public-aggregator`, `admin/lite-stats`, `supabase/queries` (boards) |
| **B — público, frescura requerida** | público pero rompe UX si atrasa | `access/capacity-config`, `control-tower` |
| **C — específico de usuario** | filtrado por wallet/cuenta | `welcome-pack/{status,claim}`, `focus-day`, `coach/*`, `access/browser-accounts`, `season-pass/read-season-pass-row`, `scores/spend-session-guard` |
| **D — pago / autorización** | decide si algo se permite o se cobra | `peones/{balance,earn}`, `shields/spend`, `coach/analyze`, `payment-intents/get-peones`, `verify-payment/*`, `peones/pro-bypass`, `peones/welcome-pack-server` |

⚠️ **La mayoría de las D deciden con una RPC** (`peones_spend`, `consume_*`), que es POST. Sus
`.select()` son de verificación previa o de lectura de saldo para mostrar.

---

## 2. Reproducción `[FACT]`

Sobre preview, build real.

**Stale:** insertada una fila sintética para una wallet que no es de nadie, `welcome-pack/status`
la vio de inmediato y la siguió viendo 3 s después. Fila borrada; verificado que quedaron 0.

```
1. antes de insertar     claimed=false   x-vercel-cache=MISS
2. despues de insertar   claimed=true    x-vercel-cache=MISS
3. otra vez, 3s despues  claimed=true    x-vercel-cache=MISS
✅ SIN STALE
```

---

## 3. Veredicto de privacidad `[FACT]`

> **NO REPRODUCIDA bajo las condiciones probadas.**

Probado A → B → A sobre `welcome-pack/status`, con dos wallets de estado **distinto** (una con
claim real, una sintética sin claim):

```
A (con claim)   claimed=true   claimed_at=2026-06-18…
B (sin claim)   claimed=false  claimed_at=null
A otra vez      claimed=true   claimed_at=2026-06-18…
```

`[FACT]` A y B recibieron respuestas **distintas y correctas**; A fue estable.

`[INFERENCE]` El mecanismo que lo explica: PostgREST pone el filtro en el **query string**
(`?wallet=eq.0x…`), así que la URL del `fetch` es **distinta por usuario** y no puede compartir
entrada de cache.

⚠️ **Alcance de esta afirmación:** una ruta, una tabla, dos usuarios, en preview. **No** es una
prueba de que ninguna lectura del repo pueda filtrar. Lo que sí descarta es la forma más obvia
del riesgo, y ninguna lectura del inventario filtra por fuera de la URL.

---

## 4. Arreglos `[FIX]`

**Ninguno nuevo.** El único cambio de esta pasada en el lado Supabase es la corrección del audit.

⛔ **Y eso es el resultado, no una omisión**: la política del cierre es arreglar lo probado. Nada
fuera del duelo demostró stale ni fuga.

---

## 5. Cache aceptado deliberadamente `[DEBT]`

Las 30 lecturas quedan como están.

| clase | por qué |
| --- | --- |
| A | Si algún día cachean, es deseable |
| B | No se reprodujo atraso; el disparador sería un síntoma observado |
| C / D | No se reprodujo ni stale ni fuga, y la URL es distinta por usuario |

**Disparador para volver:** cualquier síntoma de estado viejo o cruzado en una superficie
personalizada. El diagnóstico está escrito en §2 del audit previo y toma minutos.

---

## 6. Recomendación de política por defecto

**Recomiendo NO invertir el default todavía.** `[INFERENCE]`

- **30 call sites** afectados por una inversión.
- El beneficio es contra un defecto que **no se reprodujo** fuera del duelo.
- El costo es real: perder cache en agregados públicos (`public-aggregator` recorre seis tablas)
  es un cambio de performance que nadie midió.

⚠️ **Lo que sí recomiendo, y es más barato:** si el defecto vuelve a aparecer en una superficie
personalizada, invertir el default **para las clases C y D** con excepciones explícitas para A —
ahí sí la inversión sería más chica que mantener 30 opt-ins frágiles.

---

## 7. Verificación

- Suite **689 archivos / 8.453 tests**, `EXIT=0`, 0 errores de worker
- `tsc` limpio
- VR **67/67**, 81 baselines antes y después
- Probes contra **preview** (build real), no `next dev`
