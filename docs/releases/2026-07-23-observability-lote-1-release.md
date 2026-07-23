# Release — Observabilidad Lote 1

**Fecha de release:** 2026-07-23 · **Fecha efectiva de inicio de cohortes: 2026-07-23**
**Estado:** desplegado y promovido a producción (Learn + Play).

> Fuente de verdad única del release. Desde el **2026-07-23** empiezan a acumularse eventos con
> dimensiones y cohortes; las métricas de retención sólo son interpretables a partir de esa fecha
> (ver §5 y §6).

---

## 1. Estado del release

- ✅ **Privacy Policy EN/ES publicada** — declara analítica de producto, identificador anónimo,
  país aproximado derivado de IP e IP completa NO almacenada.
- ✅ **Migraciones aplicadas** a producción:
  - `20260723040000_analytics_dimensions.sql`
  - `20260723041000_session_first_seen.sql`
- ✅ **Código de Observabilidad Lote 1 desplegado** (PRs #270 privacy + #271 código).
- ✅ **Learn y Play promovidos** a producción.
- ✅ **`/stats` funcionando** con filtros `surface` y `container`.
- 📅 **Fecha efectiva de inicio de cohortes: 2026-07-23.**

---

## 2. Capacidades activas

**Identidad / sesión**
- `session_id` — anonymous ID persistente (localStorage), nunca rota. Base de retención/cohortes.
- `visit_id` — id por visita/pestaña (sessionStorage).
- `app_opened` — evento raíz, **once-per-visit** (guard en sessionStorage).
- `session_first_seen` — tabla de cohortes (día 0 por install; sobrevive a la poda de 90 días).

**Dimensiones en `analytics_events`** (nullable, sanitizadas server-side)
- `surface` (`learn` | `play`)
- `container` (`minipay` | `browser`)
- `locale`
- `country` (ISO-3166-1 alpha-2, derivado del edge; nunca IP/ciudad/coordenadas)
- `source` (allow-list canónica)
- `campaign` (sanitizado, allow-list)
- `app_version` (build sha)

**Eventos canónicos mínimos** (mapeo read-time de alias; sin renombrar los ~120)
- `hub_viewed`
- `exercise_started`
- `exercise_completed`
- `daily_focus_completed`

**`/stats`**
- App Opens
- Funnel de activación (`app_opened → hub_viewed → exercise_started → exercise_completed → daily_focus_completed`)
- Top Countries
- Retención D1 / D7
- Filtros server-side (`surface`, `container`) por querystring, cacheados por combinación
- Fallback a `All` ante valores inválidos

---

## 3. Validaciones realizadas

| Validación | Resultado | Origen |
|-----------|-----------|--------|
| Suite completa | 5739 passing / 510 files, 0 fallas | CI local |
| Typecheck | `tsc --noEmit` limpio | local |
| Migraciones ensayadas localmente | aplican limpio, idempotentes, CHECK country OK | docker `supabase_db_web` |
| Dry-run de producción | exactamente las 2 migraciones esperadas | `supabase db push --dry-run` |
| Migraciones aplicadas sin errores | ambas aplicadas; `db push --dry-run` → "up to date" | prod |
| Privacy Policy live | EN + ES, "July 23, 2026", 4 declaraciones | preview |
| No-regresión | Learn, Play, Hub, `/exercises` y superficies de compra cargan sin crash | preview (render) |
| End-to-end `surface=learn` | `/stats?surface=learn` → App Opens (30d) = 1 (dato real) | preview `/stats` |
| End-to-end `app_opened` | confirmado conductualmente vía App Opens | preview `/stats` |
| End-to-end filtros `/stats` | learn/play/minipay/combinado OK; `bogus` → fallback a All | preview `/stats` |
| End-to-end `container=minipay` | confirmado en device MiniPay real | **producción (founder)** |
| End-to-end `country=CO` | evento real escribió `country=CO` (ISO-2) | **producción (founder)** |

---

## 4. Qué NO cambió

Este release es **exclusivamente de analytics y `/stats`**. NO modificó:

- pagos
- entitlements
- Season Pass
- PRO
- Peones
- Shields
- Coach
- ejercicios
- lógica de acceso
- transacciones on-chain
- rewards

**Analytics permanece fail-open:** cualquier fallo de telemetría es silencioso para el usuario y
nunca bloquea entrar, navegar, jugar, completar una acción o pagar.

---

## 5. Limitaciones conocidas

- **D1 no es interpretable** hasta que maduren las primeras cohortes (≈24–48 h post 2026-07-23).
- **D7 requiere 7 días** completos (interpretable ≈2026-07-30).
- **No hay datos históricos confiables de retención previos al 2026-07-23.**
- **Pagos y rewards siguen client-confirmed** en analytics (sin reconciliación server-authoritative).
- **Métricas on-chain completas** (network fees, failed-tx rate) quedan fuera.
- **No hay D3 / D21.**
- **No se normalizaron los ~120 eventos** (sólo los 4 canónicos del funnel, vía shim read-time).
- **No hay warehouse, SaaS externo, ni reconciliador.**

---

## 6. Watchlist de 7 días (2026-07-23 → 2026-07-30)

| Métrica | Qué mirar | Señal de alerta |
|---------|-----------|-----------------|
| App Opens | crecimiento y estabilidad | caída abrupta a 0 |
| MiniPay vs Browser | adopción real | MiniPay siempre en 0 |
| Learn vs Play | distribución | `surface` nula o inesperada |
| Activation | `app_opened → exercise_completed` | abandono fuerte sin explicación |
| Countries | códigos ISO-2 | valores inválidos o PII |
| D1 | desde el día siguiente | cohortes vacías tras tener volumen |
| Errors | fallos de `/api/telemetry` | impacto visible en UX |

---

## 7. Gate para abrir Lote 2

**No abrir Lote 2 automáticamente.** Considerarlo cuando:

- haya al menos **3–7 días de datos** (≈2026-07-26 a 2026-07-30);
- `surface`, `container`, `country` y `app_version` estén estables;
- no haya regresiones;
- exista suficiente volumen para interpretar el funnel;
- se identifique una **pregunta real de monetización**.

**Lote 2 esperado** (fuentes server-authoritative):

```text
offer_viewed
→ purchase_started
→ purchase_succeeded | purchase_failed
→ paid_feature_used
```

---

## 8. Próximas acciones operativas

- [ ] commit del release report
- [ ] backup post-release
- [ ] borrar ramas mergeadas
- [ ] revisar `/stats` diariamente durante 7 días
- [ ] revisar D1 después de 24–48 horas (≈2026-07-24/25)
- [ ] revisar D7 después de 7 días (≈2026-07-30)
- [ ] decidir siguiente vertical según datos

---

### Referencias
- Auditoría: `docs/audits/2026-07-23-product-observability-audit.md`
- Spec: `docs/specs/2026-07-23-observability-lote-1-spec.md`
- Runbook + smoke: `docs/ops/2026-07-23-lote-1-migration-runbook.md`
- Handoff: `docs/handoffs/2026-07-23-observability-lote-1-handoff.md`
