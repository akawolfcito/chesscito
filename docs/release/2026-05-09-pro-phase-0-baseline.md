# PRO Phase 0 Baseline — Clean Window

- **Status**: Scaffold / pending aggregation
- **Created**: 2026-05-03
- **Owner**: Wolfcito
- **Purpose**: documentar la ventana limpia de medición de Chesscito PRO (itemId 6, $1.99/30d) y dejar listos los placeholders para los agregados de `analytics_events`. **No** se extraen métricas en esta sesión: la ventana aún está abierta y no hay MCP Supabase activo.

---

## 1. Clean measurement window

| Field | Value |
|---|---|
| Start | **2026-05-02 23:30 UTC** |
| End (estimated close) | **2026-05-09 23:30 UTC** |
| Duration | 7 days |
| Day at scaffold time | 1 / 7 (today: 2026-05-03) |

La ventana limpia **no** empieza el 2026-04-29 (on-chain registration). Empieza el 2026-05-02, después de:
- ✅ Smoke pass end-to-end (`docs/reviews/pro-smoke-test-2026-05-02.md`).
- ✅ Verify-pro ABI hot fix `4c8748f` desplegado a producción.
- ✅ Dos compras PRO independientes validadas post-fix (compensación manual + compra fresh vía MiniPay).

---

## 2. Why the earlier window is contaminated

Entre **2026-04-29** (registro on-chain de itemId 6) y **2026-05-02 23:30 UTC** (deploy del fix):

- `/api/verify-pro` declaraba `ItemPurchased.token` como `indexed: false`.
- El contrato `ShopUpgradeable.sol` emite `address indexed token` (vive en `topics[3]`, no en `data`).
- Resultado: viem lanzaba `Data size of 128 bytes is too small for non-indexed event parameters` y el `try/catch { continue }` del decode loop tragaba el error en silencio.
- El endpoint devolvía `400 "No PRO purchase found in transaction"` aunque el tx on-chain estuviera confirmado.
- Redis (`coach:pro:<wallet>`) **nunca** se escribía. UI quedaba en estado inactive.

**Consecuencia para la telemetría**:
- `pro_purchase_started` se emite antes de la confirmación → quedaba registrado.
- `pro_purchase_confirmed` se emite tras `verify-pro` exitoso → **nunca se emitía** para purchases reales.
- `pro_purchase_failed{kind=verify-failed}` capturaba algunos fallos, pero la UX del retry no estaba expuesta.

**Regla**:
- ❌ **No** usar métricas 2026-04-29 → 2026-05-02 para baseline de conversión.
- ❌ **No** mezclar esa ventana con la ventana limpia bajo ningún cálculo agregado.
- ✅ Si se necesita mostrar el dato histórico, listarlo en sección separada con etiqueta explícita "pre-fix, contaminada".

Referencia: `docs/reviews/pro-smoke-test-2026-05-02.md` §6 (root cause + lecciones).

---

## 3. Events to aggregate when window closes

Cliente (`analytics_events` en Supabase, project ref `brsbdzpuvotxsadmcxyj`):

| Event | Source | Notes |
|---|---|---|
| `pro_card_viewed` | `<ProSheet>` mount | top of funnel — cuántos vieron la oferta |
| `pro_cta_clicked` | tap on "Start training" / "Extend training" | con `source: "sheet_buy"` o `"sheet_extend"` |
| `pro_purchase_started` | `executeProPurchase` antes del approve | iniciar el flujo on-chain |
| `pro_purchase_confirmed` | después de `verify-pro` 200 OK | **único evento de éxito real** |
| `pro_purchase_failed` | rama de error en `executeProPurchase` | con `kind: "approve-failed" \| "tx-failed" \| "verify-failed" \| "user-rejected"` |

`cancelled` intencionalmente **no** se trackea (derivable como `started − confirmed − failed`).

---

## 4. Pending SQL queries (placeholders)

Ejecutar **el 2026-05-09 o después**, con la ventana cerrada. Reemplazar los `[?]` cuando se peguen los resultados.

### 4.1 Funnel agregado

```sql
-- Top of funnel a conversión
SELECT
  event,
  COUNT(*) AS total,
  COUNT(DISTINCT wallet) AS unique_wallets
FROM analytics_events
WHERE event IN (
  'pro_card_viewed',
  'pro_cta_clicked',
  'pro_purchase_started',
  'pro_purchase_confirmed',
  'pro_purchase_failed'
)
  AND created_at >= '2026-05-02 23:30:00+00'
  AND created_at <  '2026-05-09 23:30:00+00'
GROUP BY event
ORDER BY total DESC;
```

Resultado:

| event | total | unique_wallets |
|---|---|---|
| pro_card_viewed | [?] | [?] |
| pro_cta_clicked | [?] | [?] |
| pro_purchase_started | [?] | [?] |
| pro_purchase_confirmed | [?] | [?] |
| pro_purchase_failed | [?] | [?] |

### 4.2 Conversion rates

- `cta_view_rate` = `pro_cta_clicked.unique / pro_card_viewed.unique` → **[?]%**
- `start_rate` = `pro_purchase_started.unique / pro_cta_clicked.unique` → **[?]%**
- `confirm_rate` = `pro_purchase_confirmed.unique / pro_purchase_started.unique` → **[?]%**
- `fail_rate` = `pro_purchase_failed.total / pro_purchase_started.total` → **[?]%**
- **Top-of-funnel-to-revenue** = `pro_purchase_confirmed.unique / pro_card_viewed.unique` → **[?]%**

### 4.3 Failure breakdown

```sql
SELECT
  COALESCE(payload->>'kind', 'unknown') AS kind,
  COUNT(*) AS count
FROM analytics_events
WHERE event = 'pro_purchase_failed'
  AND created_at >= '2026-05-02 23:30:00+00'
  AND created_at <  '2026-05-09 23:30:00+00'
GROUP BY kind
ORDER BY count DESC;
```

Resultado:

| kind | count |
|---|---|
| approve-failed | [?] |
| tx-failed | [?] |
| verify-failed | [?] |
| user-rejected | [?] |
| unknown | [?] |

**Trigger condicional ya documentado en `project_pro_phase_0`**:
- Si `verify-failed / pro_purchase_started.total > 1%` → ship retry-verify button (ya implementado en `b8bea6b`, validar tasa post-fix).

### 4.4 Confirmed purchases — sanity check on-chain

```sql
SELECT
  wallet,
  COUNT(*) AS confirmed_count,
  MIN(created_at) AS first,
  MAX(created_at) AS last
FROM analytics_events
WHERE event = 'pro_purchase_confirmed'
  AND created_at >= '2026-05-02 23:30:00+00'
  AND created_at <  '2026-05-09 23:30:00+00'
GROUP BY wallet
ORDER BY confirmed_count DESC;
```

Cross-check contra:
- Celoscan: `ShopUpgradeable.ItemPurchased` events con `itemId = 6` en el rango de bloques.
- Redis: keys `coach:pro:*` con `expiresAt` futuro al cierre de la ventana.

Si los tres números (Supabase confirmed / on-chain ItemPurchased / Redis active keys) **divergen**, hay otro bug no detectado por el smoke.

---

## 5. Decision gate

**Bloque B (Phase 0.5)** sigue **bloqueado** hasta que esta baseline tenga datos reales:

- ❌ C3 `<ComingSoonChip>` ("Soon" en EN) — no antes del baseline.
- ❌ C4 `PRO_COPY` refine (kicker "Training Pass" + bullet "FIDE Master + dev team") — no antes del baseline.
- ❌ Cualquier cambio a `pro-sheet.tsx` que afecte el funnel observado.

C3 y C4 deben mergearse **en par dentro de ≤48h** (ambos tocan `pro-sheet.tsx` + `editorial.ts.PRO_COPY`), pero **solo después** de que esta baseline esté completa.

Trabajo permitido en paralelo (no contamina la medición porque no toca el funnel PRO):
- ✅ Issue #108 RainbowKit SSR (infra).
- ✅ Phase 0.6 desktop polish informativo (brainstorm + spec, sin implementar).
- ✅ Bug fixes críticos en compra / verify-pro / activación / bypass / rollback (regla original del freeze).

---

## 6. Next action

Volver **el 2026-05-09 23:30 UTC o después**:

1. Ejecutar las cuatro queries de §4 contra Supabase (`brsbdzpuvotxsadmcxyj`, tabla `analytics_events`).
2. Pegar resultados reemplazando los `[?]` en este mismo archivo.
3. Cross-check on-chain (Celoscan + Redis) según §4.4.
4. Commit doc actualizado: `docs(release): fill PRO Phase 0 baseline with 7-day clean window aggregates`.
5. Decidir Bloque B (proceder con C3+C4) **o** abrir Phase 0.6 si los datos sugieren otro foco (e.g. fail-rate alta sigue dominando la pérdida).
6. Actualizar `project_pro_phase_0` con el verdict.

---

## 7. References

- Smoke test: `docs/reviews/pro-smoke-test-2026-05-02.md`
- Phase 0.5 Bloque A handoff: `docs/release/2026-05-03-phase-0.5-block-a-handoff.md`
- Phase 0 release checklist: `docs/release/2026-04-29-pro-phase-0-checklist.md`
- Phase 0 release handoff: `docs/release/2026-04-29-pro-phase-0-handoff.md`
- Telemetry wiring commit: `a63c1e1 feat(telemetry): wire Chesscito PRO funnel events`
- Verify-pro hot fix: `4c8748f fix(verify-pro): mark ItemPurchased.token as indexed (matches contract)`
- Memory: `~/.claude/.../memory/project_pro_phase_0.md`
