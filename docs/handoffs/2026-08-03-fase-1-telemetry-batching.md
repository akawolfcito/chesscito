# Fase 1 — batching de telemetría

**Fecha:** 2026-08-03 · **Base:** `b784dd34` (Fase 0, ya en producción)
**Estado:** implementado, revisado y verificado, con límites de payload.

---

## 0. Respuesta a la pregunta previa: ¿se reintenta el 522?

**NO, en ninguna capa.** Verificado, no asumido:

| Capa | Retry | Evidencia |
|---|---|---|
| Cliente (`lib/telemetry.ts`) | no | `void fetch(...).catch(() => {})` — fire-and-forget, sin reintento |
| `@supabase/postgrest-js@2.100.1` | no | **cero** archivos en `dist/` contienen `retry`/`retries` |
| `@supabase/supabase-js` (config) | no | `createClient(url, key, { auth: { persistSession: false } })`, sin política de retry |
| Ruta `/api/telemetry` | no | un `await` por escritura, sin bucle |
| React Query | n/a | telemetría no pasa por React Query |

**Conclusión:** no había retry storm que eliminar. Lo que sí había era **volumen**:
1 request por evento × 1–3 escrituras cada uno.

El riesgo real era **introducirlo**: una cola que reencolara al fallar convertiría el
522 en una tormenta contra el recurso ya saturado. Por eso la política de la cola es
**descartar**, y hay tres tests que lo fijan.

---

## 1. Qué cambió

| Archivo | Cambio |
|---|---|
| `src/lib/telemetry.ts` | Cola + batching + los dos flags. `track()` **mantiene su firma** — los 227 call sites no se tocan |
| `src/app/api/telemetry/route.ts` | Acepta evento único **o** batch; un solo `insert` por lote; cohortes dedupeadas por lote; escrituras vía `afterResponse` |
| `src/lib/server/after-response.ts` | **NUEVO** — seam, hoy con ejecución **awaited** (ver §3) |
| `src/app/api/telemetry/__tests__/route.test.ts` | Mock cuenta **round-trips** además de filas; +20 tests |
| `src/lib/__tests__/telemetry-batching.test.ts` | **NUEVO** — 19 tests de cola, fallo, flags y rechazo 413 |

Orden de implementación, tal como pediste: kill switch → cola/batching → endpoint
retrocompatible → `waitUntil` (este último **descartado**, §3).

### Cola (cliente)

- Flush a los **20 eventos**, a los **5 s de inactividad**, o al salir
  (`visibilitychange → hidden` y `pagehide`, vía `navigator.sendBeacon`).
- **La cola nunca supera 20 por construcción** — todo push que llega al tamaño de lote
  hace flush sincrónico, y todo flush la vacía gane o pierda el request. No hace falta un
  cap aparte ni chunking (ver la corrección en §2bis).
- El throttle previo (100 por nombre de evento / 5 min) **queda intacto**: protege de
  otro fallo (un render loop) y los dos límites componen.
- `dims` y `account` viajan **por evento**, no por lote: un batch puede cruzar una
  navegación, y la wallet puede conectarse a mitad.

### Flags

| Flag | Default | Efecto |
|---|---|---|
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | ON | **Kill switch de emergencia.** OFF ⇒ `track()` es inerte: no encola, no arma timer, no emite. **No** vuelve a 1-request-por-evento — apagar telemetría tiene que *bajar* carga |
| `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED` | ON | OFF ⇒ comportamiento pre-Fase-1, 1 POST por evento. Escotilla de debug, **no** el freno de emergencia |

Ambos leen OFF sólo ante `"0"` o `"false"` explícitos: una env ausente **no** puede
cegar el funnel por accidente.

### Endpoint retrocompatible

Acepta las dos formas:

```
{ session_id, event, props, dims, account }   ← cliente pre-Fase-1
{ events: [ …los mismos objetos… ] }          ← batch
```

La forma única **no es deuda a limpiar después**: los navegadores cachean el bundle, así
que mientras haya una pestaña con el cliente viejo va a seguir posteando así. Quitarla
perdería su telemetría en silencio.

---

## 2. Medición (lo que pediste en E)

Verificado por test, no estimado:

| Métrica | Antes | Después |
|---|---|---|
| Requests HTTP a `/api/telemetry` por 20 eventos | **20** | **1** |
| Llamadas a `analytics_events` por 20 eventos | 20 | **1** (bulk insert de 20 filas) |
| Llamadas a `session_first_seen` (batch con 2 `app_opened`) | 2 | **1** |
| Llamadas a `account_first_seen` (20 eventos, misma wallet) | 20 | **1** |
| **Round-trips Supabase totales por 20 eventos** | 20–60 | **1** sin wallet · **2** con wallet |

Comportamiento ante 522, cubierto por test:
- la ruta responde **204** y no lanza;
- el cliente **no reencola**: N lotes fallidos = **exactamente N requests**;
- un 5XX se trata como entregado (el cliente nunca lee el status);
- `track()` **no lanza** ni siquiera si `fetch` explota sincrónicamente;
- `track()` **retorna sincrónicamente** — hay un test que deja el fetch sin resolver y
  verifica que la cola ya se vació y el control volvió: la navegación no puede bloquearse.

---

## 2bis. Límites de payload (revisión obligatoria previa al commit)

**Invariante de todo el bloque: un request rechazado cuesta CERO round-trips a
Supabase.** La validación corre antes de parsear el JSON completo y mucho antes de que
exista el cliente de Supabase.

| Límite | Valor | Al excederse |
|---|---|---|
| Body serializado | **64 KB** | `413`, cero llamadas a Supabase |
| Eventos por request | **20** | `413`, cero llamadas (se **rechaza**, no se trunca) |
| Evento serializado | **8 KB** | `413`, cero llamadas |
| `props` serializados | 4 KB | el **evento** se descarta, el batch sigue |
| String dentro de `props` | 512 chars | el evento se descarta |
| Clave de `props` | 40 chars | la clave se ignora |
| Valor de una `dim` | 128 chars | se anula esa dim (son cosméticas) |
| `session_id` / nombre de evento | 64 chars | el evento se descarta |

Decisiones que vale la pena justificar:

- **Rechazar >20 en vez de truncar.** Truncar descartaría eventos en silencio mientras se
  responde `204`. Un lote de 21 no es un cliente nuestro.
- **`props` sobredimensionados descartan el evento, no lo escriben con `props: null`.**
  El comportamiento anterior dejaba una fila que *parece* registrada y no lo está. Perder
  la fila es más honesto que conservar una mentira.
- **El contrato individual antiguo pasa por los mismos límites.** Un bundle cacheado es un
  cliente que aceptamos, no uno en el que confiamos.
- **Nada del payload inválido se registra.** Esta ruta no tiene logging de request: volcar
  un body inválido pondría direcciones de wallet crudas en el log drain, que es justo la
  fuga que `account_ref` existe para evitar. Ni el body ni una muestra truncada.

**Corrección durante esta revisión:** había puesto un cap de cola de 200 y chunking en el
cliente. Ambos eran **código muerto**: todo push que llega a 20 hace flush sincrónico, y
todo flush vacía la cola gane o pierda el request, así que la cola **nunca** supera 20.
Los tests que los cubrían sólo podían pasar vacuamente. Los eliminé y dejé un test que
fija la invariante real (el pico de la cola se mantiene por debajo de 20 bajo tráfico
sostenido con todos los flushes fallando).

---

## 3. `waitUntil` — DESCARTADO en este hotfix

**No está activo.** Next 14.2 no tiene `after()` (llega en 15) y `waitUntil` en Vercel
viene de `@vercel/functions`, que **no es dependencia de esta app**. Un
`import("@vercel/functions")` opcional **no** esquiva eso: vite y webpack resuelven los
imports dinámicos estáticamente. Lo intenté y **rompió el test run y el build**; está
documentado en el módulo para que nadie lo reintente.

Entonces `after-response.ts` expone el seam y **por defecto hace `await`**. Esperar es más
lento; nunca es incorrecto. La alternativa —disparar la promesa y volver— dejaría que la
plataforma congele la instancia a mitad de la escritura y se pierdan filas sin error en
ningún lado.

**Decidido por el founder: no se agrega `@vercel/functions` y no se activa `waitUntil` en
este hotfix.** `after-response.ts` queda con ejecución **awaited**, y su cabecera lo dice
en la primera línea: ⚠️ *hoy no ejecuta nada después de responder*. El nombre describe la
intención del seam, no el comportamiento actual — nadie debe leer una llamada a
`afterResponse()` como "esto está fuera del camino crítico". **No se disparan promesas sin
esperar.**

Y de todos modos compraría poco acá: saca la escritura del camino crítico (latencia y wall
time facturado), pero **la escritura a Supabase ocurre igual — no hace nada por el Disk IO
budget**. Lo que baja la carga real es el batching.

---

## 4. Verificación

| Comando | Resultado |
|---|---|
| `pnpm exec tsc --noEmit` | limpio |
| `pnpm exec vitest run` | **6866 passed / 578 archivos**, `EXIT=0`, 0 `Unhandled Errors` |
| `pnpm build` | `BUILD EXIT=0`, `/api/telemetry` compila |

Suite: 6827 → 6854 (+27 tests). Ningún test previo modificado en su intención; el mock de
la ruta ahora cuenta round-trips además de filas.

---

## 5. Impacto esperado

- **Invocations:** `/api/telemetry` 54K → **~3K** por 12 h (−94 %). Sobre el total de 82K
  eso es **−62 %** de todas las invocations del proyecto.
- **Escrituras Supabase de telemetría:** −95 % en round-trips. Es contención directa del
  incidente: la telemetría era el escritor más ruidoso sobre una base que está agotando
  su Disk IO budget.
- **Active CPU:** ~10 min → ~1.5 min en esta ruta.

No estimo mejora en la tasa de error mientras el 522 siga: esto **reduce la presión**, no
arregla la conexión API Gateway → origen.

---

## 6. Siguiente prioridad — D2.1, ALTA

**`GET /api/peones/balance` hace un INSERT en `peones_ledger` en cada lectura**
(`route.ts:88` → `ensurePeonesWelcomePack`), que para todo usuario recurrente falla con
`23505` y se descarta. Es 1 de cada 3 llamadas a Supabase del endpoint: **~5.9K escrituras
inútiles cada 12 h**, con conflicto de índice único cada una, sobre la base que está
agotando su I/O.

Aparece en tu propia evidencia como `POST /rest/v1/peones_ledger` con 522.

**Pasa a prioridad alta inmediatamente después de Fase 1.** El índice único sigue siendo
la garantía final de idempotencia — la corrección es sólo *cuándo* se intenta la semilla,
no *si* está protegida.

---

## 7. Validación inicial post-push (2026-08-03)

**Commit:** `8d995e81` · pusheado a `origin/main`.

### ⚠️ Producción NO está corriendo Fase 1

Los proyectos despliegan Production desde la rama **`production`**, no `main`
(alias `chesscito-git-production-goodwolf.vercel.app`, y los logs traen `branch:
"production"`). `origin/production` sigue en `b784dd34` = Fase 0.

El push a `main` generó **Preview** en ambos proyectos:

| Proyecto | Preview | Production actual |
|---|---|---|
| chesscito | `chesscito-6e1tdt0xo` ● Ready · `8d995e81` | `dpl_GPJCGu4wLNZtUEfs21swfaTy6GgD` · `b784dd34` |
| lite-chesscito | `lite-chesscito-f7vicv0sm` ● Ready · `8d995e81` | `dpl_8HuDa3fxPgsgcqP4nMwbfRSx5TwV` · `b784dd34` |

Avanzar `production` es tuyo. No lo hago yo.

### Smoke tests sobre Preview — VERIFICADO

| Caso | chesscito | lite |
|---|---|---|
| 21 eventos | **413** · 0.69 s | **413** · 0.93 s |
| body > 64 KB (82 KB) | **413** · 0.94 s | — |
| un evento > 8 KB | **413** · 0.37 s | **413** · 0.43 s |
| legacy individual > 8 KB | **413** · 0.37 s | — |
| JSON inválido | **204** · 0.39 s | — |
| 20 eventos válidos | timeout 25 s | timeout 20 s |
| legacy individual válido | timeout 25 s | — |

**El contraste es la prueba del requisito 7.** Los rechazados vuelven en menos de un
segundo; los válidos cuelgan 20–25 s. La única diferencia entre ambos es si el request
llega a Supabase. Es decir: **la validación de tamaño corre antes de cualquier escritura,
verificado en un deployment real**, no sólo en tests con mock.

El timeout de los válidos es el **incidente 522 en curso**, no una regresión de Fase 1:
la ruta ya esperaba sus escrituras antes de este commit. Lo que cambia es cuántas
invocaciones quedan colgadas — una por lote en vez de una por evento.

### Métricas de `/api/telemetry` en producción — NO OBSERVABLE

Invocations, errores, duración, 522 observados, requests por sesión y llamadas a
`analytics_events` / `session_first_seen` / `account_first_seen`: **no medibles todavía**,
porque el código no está en producción. Quedan pendientes de que avances `production`.

### Errores nuevos — ninguno

Los 413 son el comportamiento nuevo esperado. Los timeouts sobre payloads válidos son el
522 preexistente, idéntico al del deployment anterior.
