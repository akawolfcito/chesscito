# Fase 1 — validación post-deploy

**Fecha:** 2026-08-03/04 · **Ventana:** ~6 min post-deploy · **Sin commit.**
**Veredicto: MANTENER Fase 1.** Reducción de volumen verificada, cero regresiones.

---

## 1. Deployments

| | chesscito | lite-chesscito |
|---|---|---|
| Deployment ID | `dpl_71eG17QQHgUvewHBahAHUAz5jUEC` | `dpl_HEvagZoCeT4tEtGNKLSZd1wbbqZB` |
| Estado | ● Ready | ● Ready |
| Target | production | production |
| Alias | `play.chesscito.com` | `lite.chesscito.com`, `learn.chesscito.com` |
| Creado | 2026-08-03 20:43:30 −05 | 20:43:31 −05 |

**VERIFICADO.** Ambos Ready, ambos Production, ambos desde Git (no desde working tree —
el push disparó el build; nunca corrí `vercel deploy`).

### ⚠️ Discrepancia en la premisa: `origin/main` ≠ `origin/production`

Pediste confirmar `origin/main = origin/production = 03452db7`. **No se cumple:**

```
origin/production  03452db7   ← desplegado
origin/main        8d995e81   ← un commit ATRÁS
```

`origin/production` está **adelante** de `origin/main` por `03452db7`. Causa: cometí
`03452db7` local y nunca lo pusheé a `main`; el fast-forward de `production` lo tomó de
tu working tree. **Es inofensivo** — `03452db7` toca **un solo archivo `.md`** y cero
código (verificado con `git diff --stat origin/main origin/production`), así que el
binario desplegado es idéntico al de `8d995e81`. Pero deja `main` sin un commit que sí
está en producción. Se arregla con un `git push origin main`; no lo hago yo.

**Divergencia real: ninguna.** No hay commits en `main` ausentes de `production`.

---

## 2. Smoke tests — VERIFICADO (14/14)

| Caso | play.chesscito.com | lite.chesscito.com |
|---|---|---|
| 21 eventos | **413** · 0.47 s | **413** · 0.46 s |
| body > 64 KB (82 KB) | **413** · 0.56 s | **413** · 0.56 s |
| un evento > 8 KB | **413** · 0.42 s | **413** · 0.41 s |
| legacy individual > 8 KB | **413** · 0.38 s | **413** · 0.39 s |
| JSON inválido | 204 · 0.35 s | 204 · 0.36 s |
| batch válido de 20 | timeout 30 s | timeout 30 s |
| legacy individual válido | timeout 30 s | timeout 30 s |

**El contraste prueba que los payloads inválidos no llegan a Supabase:** los rechazos
vuelven en <0.6 s, los válidos cuelgan 30 s. La única diferencia entre ambos casos es si
el request alcanza la base. El timeout es el 522 en curso, **no** una regresión: la ruta
ya esperaba sus escrituras antes de Fase 1, y su respuesta al cliente sigue siendo 204.

---

## 3. Reducción de volumen — VERIFICADO

El tráfico absoluto no es comparable entre ventanas de distinta duración y carga, así que
normalizo: **requests a `/api/telemetry` por cada request a otro endpoint `/api/*`** en la
misma ventana. (Vercel emite dos líneas de log por request — edge y serverless — así que
todo está deduplicado por `requestId`, y mis 4 smoke tests 413 por host están excluidos.)

| Proyecto | Antes (Fase 0) | Después (Fase 1) | Δ |
|---|---|---|---|
| chesscito | 3.00 | **0.81** | **−73 %** |
| lite-chesscito | 2.13 | **0.20** | **−91 %** |

La telemetría pasó de ser 2–3× el resto de la API a ser una fracción. La proyección de
−94 % del plan sigue en pie: lo que queda arriba de cero son en buena parte **bundles
cacheados** que todavía postean un evento por request — bajará solo a medida que los
clientes se actualicen.

**Sin muestra suficiente** para dar un número absoluto de invocations por 12 h: la ventana
son ~6 min. La proporción sí es sólida porque compara dentro de la misma ventana.

---

## 4. Métricas pedidas

| Métrica | Estado | Dato |
|---|---|---|
| Invocations `/api/telemetry` | **verificado (relativo)** | −73 % / −91 % normalizado |
| Invocations absolutas 12 h | sin muestra suficiente | ventana de 6 min |
| **Active CPU `/api/telemetry`** | **no observable** | `vercel logs --json` no trae campo de duración ni de CPU; sólo está en el panel |
| Errores de `/api/telemetry` | **verificado** | **cero 5XX**. Sólo 204 y 413 (los 413 son míos) |
| Timeouts de `/api/telemetry` | **verificado** | el cliente corta a 30 s; el servidor responde 204. Preexistente al 522 |
| Requests a `analytics_events` | **no observable** | requiere el panel de Supabase; el log de Vercel no lista queries |
| Requests a `session_first_seen` | **no observable** | ídem |
| Requests a `account_first_seen` | **no observable** | ídem |
| 522 de Supabase | **verificado, sigue activo** | ver §5 |
| Errores nuevos | **verificado: ninguno** | ver §6 |
| Navegación / flujos | **verificado** | ver §7 |

---

## 5. El 522, confirmado desde nuestros propios logs

Los logs traen la evidencia directa: el `errMessage` que Supabase devuelve **empieza con
`<!DOCTYPE html>`**. Es decir, el API Gateway está respondiendo una **página HTML de
error** donde el cliente espera JSON. Eso confirma tu diagnóstico sin ambigüedad: el fallo
es en la conexión gateway→origen, no en una query ni en RLS — una query mal formada o un
permiso denegado devolverían un error JSON de PostgREST, no HTML.

Rutas afectadas, idénticas antes y después: `welcome_pack_claims`,
`peones_balance_with_caps`, `lite_season_passes`, `score_sessions`.

---

## 6. Errores nuevos: NINGUNO — VERIFICADO

5XX por endpoint, deduplicado, misma metodología en las dos ventanas:

| Endpoint | play antes | play después | lite antes | lite después |
|---|---|---|---|---|
| `/api/welcome-pack/status` 500 | 3 | 5 | 3 | 2 |
| `/api/peones/balance` 500 | 2 | 1 | 3 | 1 |
| `/api/peones/earn` 500 | 1 | 0 | 0 | 0 |
| `/api/season-pass/status` 503 | 0 | 0 | 2 | 2 |
| `/api/scores/session/challenge` 503 | 0 | 0 | 1 | 1 |
| **`/api/telemetry`** | **0** | **0** | **0** | **0** |

Mismos endpoints, mismas causas, ningún tipo de error nuevo. Las diferencias de conteo
son ruido de tráfico entre ventanas de distinto largo.

### 🔴 Hallazgo colateral: `/api/peones/balance` escribe la wallet COMPLETA en los logs

No lo introdujo Fase 1 ni Fase 0 — verifiqué que ya estaba en `b784dd34^`. Lo destapó el
522: `rpc_failed` ahora se dispara constantemente y el problema quedó a la vista.

```ts
// api/peones/balance/route.ts:121
log.error("rpc_failed", { wallet, code: capError.code, message: capError.message });
//                        ^^^^^^ dirección cruda, sin hashear
```

Igual en `supabase_unavailable` (:87) y `peones_welcome_pack_seeded` (:104). El contraste
con `/api/season-pass/status`, que sí hace `hashWallet(wallet)`, se ve en la misma
ventana de logs: uno emite un digest de 16 hex, el otro la dirección entera.

**Es la única ruta de `app/api` con este patrón.** El arreglo es una línea por call site
(`hashWallet(wallet)`, ya importado en otras rutas). Conviene hacerlo **junto con D2.1**,
que toca exactamente ese archivo.

---

## 7. Regresión funcional: NINGUNA — VERIFICADO

| Ruta | play | lite |
|---|---|---|
| `/` | 200 · 1.25 s | 200 · 1.15 s |
| `/exercises` | 307 (redirect de modo, correcto) | 200 · 0.60 s |
| `/arena` | 200 · 0.61 s | 200 · 0.94 s |

Navegación intacta. `track()` no puede bloquearla: retorna sincrónicamente y traga todo
error (cubierto por test).

**Clientes legacy aceptados: VERIFICADO** — el evento individual válido llega al mismo
camino que un batch (cuelga por el 522, igual que el batch, en vez de rechazarse), y el
individual excesivo devuelve 413 igual que en batch. Ambos contratos vivos y sujetos a
los mismos límites.

**Ausencia de retry/reencolado: VERIFICADO por diseño y por test**, no por logs — con
esta ventana no hay volumen para verlo estadísticamente. La cola se vacía *antes* de
emitir el request y no hay ruta de reintento en ninguna capa (§0 del doc de Fase 1).

---

## 8. Veredicto: **MANTENER Fase 1**

Sin rollback. La evidencia:

- volumen de telemetría **−73 % / −91 %** normalizado, en ambos proyectos;
- **cero 5XX** en `/api/telemetry`;
- **cero errores nuevos** en cualquier endpoint;
- límites de payload funcionando en producción, 14/14, con la prueba de que un payload
  inválido no toca Supabase;
- navegación y clientes legacy intactos.

Fase 1 hizo exactamente lo que debía: **bajó la presión sobre Supabase sin arreglar el
522**, que es lo que se esperaba de ella.

**Lo que falta medir** (necesita horas, no minutos): invocations absolutas por 12 h, Active
CPU, y el conteo de requests a `analytics_events` / `session_first_seen` /
`account_first_seen` — este último sólo desde el panel de Supabase.

### Siguiente

1. **D2.1** — sacar el INSERT recurrente de `peones_ledger` del GET de balance.
2. **Hashear la wallet en los logs de `/api/peones/balance`** (§6). Mismo archivo, mismo
   commit, una línea por call site.
3. `git push origin main` para alinear `main` con `production`.
