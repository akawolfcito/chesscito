# Handoff — auditoría de `/stats` público

**Fecha:** 2026-08-04 · **Commit desplegado:** `e04d4b537180`
**Etapa que se cierra:** estabilización de lanzamiento + corrección del p95.
**Etapa que se abre:** auditoría de la página pública `/stats`.

---

## 1. Estado estable heredado

**Production y preview corren `e04d4b537180`.** Los cuatro dominios responden.

| Dominio | Proyecto | Target | HTTP |
|---|---|---|---|
| `play.chesscito.com` | `chesscito` | production (`ref production`) | **200** |
| `learn.chesscito.com` | `lite-chesscito` | production (`ref production`) | **200** |
| `preview.chesscito.com` | `chesscito` | preview (`ref main`) | **200** |
| `learn-preview.chesscito.com` | `lite-chesscito` | preview (`ref main`) | **200** |

| Eje | Estado |
|---|---|
| Deployments | **READY** en ambos proyectos y ambos targets |
| 5XX | **cero** en las validaciones finales |
| `/api/telemetry` | **sin errores** |
| Monitor | **🟢 GREEN (partial)**, exit 0 |
| **Supabase** | **Pro / Micro, sano.** ⚠️ `SHARED DATABASE`: production y preview escriben en la **MISMA** base |
| **Vercel — invocaciones** | ✅ **observables** vía Observability API, por proyecto |
| **Vercel — Active CPU** | ❌ no observable |
| **Vercel — % de cuota** | ❌ no observable |
| **Upstash — cuota** | ❌ no observable |

### El p95 quedó corregido

`p95` de eventos por sesión calculado **en PostgreSQL sobre la población completa
de 24 h**:

```
distribución 24h · p50 15 · p95 75 · máx 576 (población completa: 2,402 sesiones)
eventos/sesión (2026-08-04): 25.63
```

**El RED anterior fue un defecto del instrumento, no del sistema.** El percentil se
derivaba en el cliente sobre `top_sessions_1h`, un top-20, y devolvía la 2.ª sesión
más ruidosa de la hora bajo una etiqueta de p95. El umbral rojo es 200; el valor
real está a **2,7×** de distancia.

---

## 2. Decisiones cerradas — no reabrir en la próxima sesión

| Decisión | Estado |
|---|---|
| p95 usa **`percentile_disc(0.95) within group`** | cerrado |
| Ventana del p95: **24 h** | cerrado |
| `top_sessions_1h` es **sólo diagnóstico** — nunca se percentila | cerrado |
| Umbral rojo de p95: **200, sin cambios** | cerrado |
| **No** usar kill switch de telemetría | cerrado |
| **No** cambiar `session_id` ni `visit_id` en esta etapa | cerrado |
| **No** deduplicar todavía | cerrado |
| **No** inventar CPU, cuota ni costos de Vercel | cerrado |

> Sobre el último punto: el consumo se mide, **lo incluido en el plan no lo expone
> ninguna API** (`/v1/billing/charges` → 404 `costs_not_found`). Sin denominador no
> hay porcentaje, y fabricar uno sería producir un dato con aspecto de verdad.

---

## 3. Hallazgos diferidos

**Ninguno de estos bloquea la auditoría de `/stats`.** Están registrados para que
no se pierdan, no para que se atiendan ahora.

| # | Hallazgo | Detalle |
|---|---|---|
| 1 | **Duplicados exactos: 8,6 % de las filas** | 5.262 filas excedentes en 24 h; mismo evento y mismo `created_at`. `dock_tap` ×14 con span **0,0 s** |
| 2 | **`session_id` puede abarcar varias visitas** | 217 sesiones (9 %) multi-visita, hasta 8 visitas en 21 h |
| 3 | **Active CPU por proyecto no determinista** | tres llamadas idénticas devolvieron 1, 3 y 2 filas con valores moviéndose ~25 % |
| 4 | **Cuota de Upstash no observable** | faltan `UPSTASH_EMAIL` + `UPSTASH_API_KEY`; el colector ya está escrito y se activa solo |
| 5 | **Cron de poda mensual → diario** | a volumen real, la corrida del 1.º de septiembre borraría ~1,4 M filas en una transacción |
| 6 | **Índices: observar ≥ 7 días** | los contadores se resetearon con el cambio de plan; `idx_scan = 0` hoy no dice nada |

> ⚠️ **Los hallazgos 1 y 2 sí son relevantes como contexto** para `/stats`: si la
> página cuenta sesiones o eventos, hereda ambas ambigüedades. Relevante ≠
> bloqueante — no hay que arreglarlos para poder auditar.

---

## 4. El problema de `/stats`

### 4.1 Valores públicos observados

| Tarjeta | Valor observado |
|---|---|
| Sesiones (7 días) | **~46** |
| App opens (30 días) | **~42** |
| Cuentas históricas | **exactamente 1.000** |
| Cuentas de la semana | **exactamente 1.000** |
| Cuentas inactivas | **~966** |

### 4.2 Valores directos ya confirmados — **2026-08-03**

| Métrica | Valor |
|---|---|
| Eventos | **46.337** |
| Sesiones | **1.930** |
| Cuentas identificadas | **1.526** |
| Eventos/sesión | **24,01** |
| `app_opened` | **> 2.000** |

### 4.3 ⚠️ Cómo NO leer estas dos tablas

**Los valores de §4.1 y §4.2 son de días distintos y de ventanas distintas.**
Ponerlos lado a lado y restar produciría una "discrepancia" inventada.

Lo que sí se puede afirmar hoy:

- Una tarjeta que dice **46 sesiones en 7 días** es difícil de reconciliar con
  **1.930 sesiones en un solo día** dentro de esos siete días. La forma del
  desacuerdo es demasiado grande para ser un efecto de ventana — **pero eso es una
  observación, no una medición**.
- **Dos tarjetas distintas devolviendo exactamente 1.000** es un número
  sospechosamente redondo. **Sospechoso no es probado.**

> **Esto es evidencia inicial de una discrepancia, no una causa raíz.** El primer
> trabajo de la próxima sesión no es explicar el desacuerdo: es **establecer qué
> afirma cada tarjeta** — qué cuenta, sobre qué ventana, con qué definición — y
> recién entonces comparar contra SQL sobre **la misma ventana**.

---

## 5. Hipótesis iniciales — **ninguna confirmada**

Todas pendientes de auditoría. Ninguna debe tratarse como diagnóstico.

| # | Hipótesis | Qué la probaría o refutaría |
|---|---|---|
| 1 | **Truncamiento en 1.000 filas** | encontrar el límite en el código o en la respuesta; que el número se mueva al cambiarlo |
| 2 | **Falta de paginación** | una consulta que devuelve una sola página y se cuenta como total |
| 3 | **`DISTINCT` en cliente sobre una muestra** | el conteo único se hace después de recortar, no en el servidor |
| 4 | **Ventanas temporales incompatibles** | la etiqueta dice 7 días y la consulta usa otra cosa (o zona horaria distinta) |
| 5 | **Definición distinta de sesión/visita** | la tarjeta agrupa por `visit_id` mientras el SQL directo agrupa por `session_id`, o viceversa |
| 6 | **Eventos antiguos o filtros equivocados** | un filtro por `event`, `surface` o `container` que excluye la mayoría del tráfico |
| 7 | **Caché o revalidación** | `unstable_cache` con tag `content`, ISR o `revalidate` sirviendo una foto vieja |
| 8 | **Fallback silencioso** | la página cae a un valor por defecto o a un dataset estático sin decirlo |

⚠️ La hipótesis 7 tiene precedente en este repo: regenerar el catálogo **no**
invalida el `unstable_cache` con tag `"content"`. Un valor viejo puede sobrevivir a
un deploy.

⚠️ **`1.000` no implica truncamiento hasta demostrarlo.** Puede ser un `LIMIT`, y
también puede ser una coincidencia, un valor sembrado o una cifra redondeada a
propósito. Hay que ir a buscar la causa, no asumirla.

---

## 6. Restricciones de la próxima sesión

- **Sólo lectura al principio.** SQL `SELECT`, lectura de código, inspección de
  respuestas HTTP.
- **No modificar datos.**
- **No cambiar schema.**
- **No tocar telemetría** (ni cliente, ni endpoint, ni flags).
- **No tocar el monitor.**
- **No modificar cron, retención ni índices.**
- **No corregir etiquetas ni cifras antes de establecer el contrato.** Ajustar un
  número antes de saber qué debía significar produce una tarjeta que coincide con
  el SQL y sigue midiendo lo que no se quería.
- **No asumir que 1.000 implica truncamiento hasta demostrarlo.**
- **No imprimir `account_ref` ni wallets sin hashear.** Usar `left(md5(...), 10)`,
  igual que en la auditoría del p95.

### Recordatorios operativos

- ⛔ **`/stats` abierta y sin wallet es un ENTREGABLE del listing de MiniPay (§8),
  no una fuga.** Gatearla o moverla a admin **rompe el listing**. El defecto de
  indexación ya se cerró con `noindex` + fuera del sitemap: **alcanzable ≠
  indexable**.
- ⚠️ **Supabase es compartida** entre production y preview: cualquier cifra de la
  base es la suma de los dos entornos.
- 🩺 Correr **`pnpm ops:health`** antes de abrir paneles a mano. ⚠️ `pnpm run`
  colapsa los exit codes no-cero a 1.

---

## 7. NEXT ACTION

> Auditar de extremo a extremo la página pública /stats, establecer el contrato
> real de cada tarjeta, comparar sus valores con consultas SQL directas y demostrar
> o refutar truncamiento, paginación incompleta, definiciones incompatibles y
> caché obsoleta. Detenerse antes de implementar.

---

## 8. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-04-launch-stabilization-handoff.md` | estado de la etapa que se cierra, pendientes priorizados |
| `docs/audits/2026-08-04-telemetry-session-p95-audit.md` | distribución real de eventos por sesión, duplicados, persistencia de `session_id` — **y las consultas SQL reutilizables** |
| `docs/audits/2026-08-04-vercel-usage-http-400-audit.md` | por qué `/v1/usage` fue retirado y qué mide Observability |
| `docs/runbooks/launch-health-monitor.md` | **empezar acá para operar el monitor** (§7ter: el p95 poblacional) |
| `docs/specs/2026-08-04-launch-health-monitor-design.md` | registro de diseño y límites de observabilidad por proveedor |

> La auditoría del p95 trae en su §11 las consultas ya escritas y con hashing —
> percentiles poblacionales, bandas, duplicados, identidad. **Reusarlas antes de
> escribir SQL nuevo** ahorra la mitad del trabajo de `/stats`.
