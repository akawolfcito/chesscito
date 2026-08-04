# Auditoría — `/v1/usage` devuelve HTTP 400 con `VERCEL_TOKEN` configurado

**Fecha:** 2026-08-04 · **Commit auditado:** `d5c69d22` · **Estado:** investigación
cerrada, **sin implementar**.

> **Nada se modificó.** No hay commits, ni push, ni cambios en Vercel, ni rotación de
> credenciales. Los scripts de reproducción vivieron en el scratchpad de la sesión,
> fuera del repo.

---

## Índice de certeza

Cada afirmación de este documento lleva una de estas cuatro marcas:

| Marca | Significa |
|---|---|
| **[HTTP]** | Confirmado por una respuesta HTTP real, medida hoy |
| **[DOC]** | Confirmado por la especificación oficial de Vercel |
| **[INF]** | Inferencia a partir de lo anterior |
| **[HIP]** | Hipótesis pendiente de verificar |

---

## 1. Estado inicial

### 1.1 Verificación de repo

```
git status --short
 M SESSION.md
?? docs/handoffs/2026-08-04-launch-stabilization-handoff.md

git log -5 --oneline
d5c69d22 docs(ops): document monitor target selection
fb8b6331 feat(ops): add production and preview target profiles
5d6083f8 docs(ops): record launch monitoring audits and implementation
22b4e443 docs(ops): add launch health monitor runbook
eab10c33 feat(ops): add pnpm ops:health command
```

Sin cambios locales ajenos. `SESSION.md` **no se tocó**.

### 1.2 `pnpm ops:health` (production)

| Verificación pedida | Resultado |
|---|---|
| Deployments READY | ✅ `chesscito` y `lite-chesscito`, ambos `d5c69d2289a4`, READY |
| Target correcto | ✅ `target production ✓ · ref production ✓` en los dos |
| Dominios | ✅ `play.chesscito.com` 200 (565 ms) · `learn.chesscito.com` 200 (648 ms) |
| 5XX | ✅ ninguno, en ambos proyectos |
| `VERCEL_TOKEN` | ✅ `VERCEL_TOKEN=sí` |
| Error de usage | ✅ sigue siendo `usage endpoint returned 400` |

Veredicto: `🟢 GREEN (partial)`.

### 1.3 `pnpm ops:health:preview`

| Verificación | Resultado |
|---|---|
| Separación de targets | ✅ `TARGET: PREVIEW`, `target preview ✓ · ref main ✓` |
| Dominios | ✅ `preview.chesscito.com` 200 · `learn-preview.chesscito.com` 200 |
| Deployments | ✅ READY, `d5c69d2289a4` (production y preview coinciden en commit hoy) |
| 5XX | ✅ ninguno |
| Error de usage | ✅ idéntico — `usage endpoint returned 400` |

**Production y preview siguen separados y sanos.** El 400 es idéntico en ambos, lo
que ya descarta que dependa del target.

---

## 2. Inspección estática — el request actual

`scripts/ops/collectors/vercel.ts:551-586`, función `collectUsage`.

| Aspecto | Valor actual |
|---|---|
| **Endpoint** | `https://api.vercel.com/v1/usage` |
| **Método** | GET (implícito, sin `method`) |
| **Query parameters** | **ninguno** |
| **Headers** | sólo `Authorization: Bearer <token>` |
| **`teamId` / `slug`** | **no se envía** |
| **`projectId`** | **no se envía** |
| **Billing period** | **no se envía** |
| **Timestamps** | **no se envían** |
| **Formato de fechas** | n/a — no hay fechas |
| **Versión del endpoint** | `v1`, hardcodeada |
| **Body del error** | **NUNCA SE LEE** — ver §2.1 |
| **Redacción** | `sanitizeVercelError` sólo cubre errores *lanzados*; un 4xx no lanza |
| **Clasificación de 400/401/403/404/429** | **ninguna** — todo no-2xx colapsa al mismo `not_observable` |

### 2.1 El defecto que impidió diagnosticar esto antes

```ts
if (!response.ok) {
  return {
    status: "not_observable",
    reason: `usage endpoint returned ${response.status}`,   // ← sólo el número
    http_status: response.status,
  };
}
```

El colector lee `response.status` y **descarta el cuerpo**. Vercel venía devolviendo,
en cada corrida, un JSON que nombra la causa exacta. Ese texto se tiró a la basura en
todas las corridas desde que el token existe.

> Ésta es la lección estructural de la auditoría: un monitor que reporta el código
> pero no el mensaje convierte un error autoexplicativo en un misterio de tres
> sesiones.

### 2.2 Qué intenta leer la consulta

`/v1/usage` sin parámetros no declara **nada**: no pide usage de equipo ni de
proyecto, no acota billing cycle, y no nombra métrica. La intención declarada en el
código (`invocations` + Fluid Active CPU) **no está expresada en la request**.

Y como se confirma en §5: **ningún endpoint único expone las seis métricas**
(usage de equipo, usage de proyecto, billing cycle, Fluid Active CPU, Function
Invocations, Edge Requests). Requiere dos endpoints distintos, y una de ellas no
está disponible en absoluto.

---

## 3. Reproducción controlada — respuestas redactadas

Ejecutado fuera del flujo principal, reusando exactamente el mismo mecanismo de
carga de credenciales (`.env.local` → `apps/web/.env.local` → `process.env`). El
token nunca se imprimió: toda salida pasó por un redactor que lo reemplaza por
`[REDACTED_TOKEN]`.

### 3.1 Control: ¿el token sirve?  **[HTTP]**

```
GET https://api.vercel.com/v2/user
status: 200 OK
  content-type: application/json; charset=utf-8
  x-vercel-id: sfo1::ntq9h-1785856639712-eacb05cce088
  server: Vercel
body: [suprimido — payload de cuenta] 248 bytes

GET https://api.vercel.com/v2/teams
status: 200 OK
  x-vercel-id: sfo1::h2xsk-1785856640357-63dcb7aab89e
body: [suprimido — payload de cuenta] 21685 bytes
```

**El token es válido y tiene alcance de lectura sobre cuenta y equipos.** Queda
descartado, empíricamente, todo diagnóstico de credencial.

### 3.2 La llamada actual, tal cual  **[HTTP]**

```
GET https://api.vercel.com/v1/usage
status: 400 Bad Request
  content-type: application/json; charset=utf-8
  x-vercel-id: sfo1::87g5k-1785856640569-7189326eaa88
  server: Vercel
  cache-control: private, max-age=0
body:
{"error":{"code":"bad_request","message":"Invalid request: missing required property `from`."}}
```

**Ahí está la causa raíz, escrita por el propio Vercel.**

No hay header `x-vercel-error` ni `www-authenticate`. El request ID es el
`x-vercel-id` transcrito arriba. El código de error estructurado es `bad_request`.

### 3.3 El scope de equipo NO era el problema  **[HTTP]**

```
GET /v1/usage?teamId=goodwolf → 400 {"error":{"code":"bad_request","message":"Invalid request: missing required property `from`."}}
GET /v1/usage?slug=goodwolf   → 400 {"error":{"code":"bad_request","message":"Invalid request: missing required property `from`."}}
```

Mensaje idéntico. El scope de equipo no cambia nada mientras falte `from`.

### 3.4 Agregando `from` / `to`: el error avanza y después se traba  **[HTTP]**

| Request | Status | `error.code` | Mensaje |
|---|---|---|---|
| `?from=<epoch ms>` | 400 | `bad_request` | ``missing required property `to`.`` |
| `?from=<epoch ms>&to=<epoch ms>` | 400 | `invalid_from_date` | The provided from date does not match the required format. |
| `?from=2026-08-01&to=2026-08-04` (date-only) | 400 | `invalid_from_date` | ídem |
| `?from=…T…Z&to=…T…Z` **sin milisegundos** | 400 | `invalid_from_date` | ídem |
| `?from=<ISO completo>&to=<ISO completo>` | 400 | **`invalid_time_range`** | The provided timerange is not supported. |

**El formato aceptado es ISO 8601 completo con milisegundos** — es el único que pasa
la validación de formato y llega a la validación de rango. Epoch ms y date-only se
rechazan.

### 3.5 Ningún rango temporal es aceptado  **[HTTP]**

Con formato ISO válido, se probaron seis rangos. **Los seis** devuelven
`invalid_time_range`:

| Rango probado | Status |
|---|---|
| últimas 24 h | 400 `invalid_time_range` |
| últimos 7 d | 400 `invalid_time_range` |
| últimos 30 d | 400 `invalid_time_range` |
| inicio de mes calendario → ahora | 400 `invalid_time_range` |
| **inicio del ciclo de facturación real → fin del ciclo** | 400 `invalid_time_range` |
| **inicio del ciclo real → ahora** | 400 `invalid_time_range` |
| ciclo completo anterior | 400 `invalid_time_range` |

Los dos rangos de ciclo se construyeron con las fechas **reales** de la cuenta,
obtenidas de `GET /v2/teams/goodwolf` → `billing.period` = `{start: 1785826800000,
end: 1788505200000}`, es decir **2026-08-04T07:00:00Z → 2026-09-04T07:00:00Z**
`[HTTP]`.

> **`/v1/usage` no se arregla agregándole parámetros.** Es un callejón sin salida,
> y eso está medido, no supuesto.

---

## 4. Verificación contra fuente oficial

Fuente: la **especificación OpenAPI oficial de Vercel**, `https://openapi.vercel.sh/`
(HTTP 200, 9.952.906 bytes, **272 paths**).

### 4.1 `/v1/usage` no existe en la API pública  **[DOC]**

```
has /v1/usage? false
```

No figura entre los 272 paths. Es un endpoint **interno**, del dashboard: existe y
responde con errores estructurados, pero no forma parte de la superficie pública, no
tiene contrato publicado, y puede cambiar sin aviso.

**Esto reencuadra el problema entero.** La pregunta no era "¿qué parámetro le falta
a la llamada?" sino "¿es éste el endpoint correcto?". No lo es.

### 4.2 Endpoints oficiales relacionados con costo y uso  **[DOC]**

De los 272 paths, los relevantes:

```
/v2/observability/query          POST   ← consumo por métrica
/v2/observability/schema         GET    ← catálogo de métricas
/v1/billing/charges              GET    ← cargos (formato FOCUS)
/v1/billing/contract-commitments GET
```

### 4.3 Diferencia entre Usage, Billing y Observability  **[DOC]** + **[HTTP]**

| Superficie | Qué es | Estado para esta cuenta |
|---|---|---|
| **Usage** (`/v1/usage`) | vista interna del dashboard | ❌ no pública, y ningún rango aceptado |
| **Observability** (`/v2/observability/*`) | consumo por métrica con series temporales | ✅ **funciona hoy con este token** |
| **Billing** (`/v1/billing/charges`) | cargos monetarios del período | ❌ **404 `costs_not_found`** |

### 4.4 Requisitos del endpoint que sí funciona  **[HTTP]**

`POST /v2/observability/query?teamId=goodwolf`

| Requisito | Valor confirmado |
|---|---|
| **Método** | POST con `content-type: application/json` |
| **Scope requerido** | `{"type": "owner"\|"project", "ownerId": "<team_…>"}` |
| **`ownerId`** | el **id canónico** `team_…` (29 caracteres). El slug `goodwolf` se rechaza |
| **Rango temporal** | `startTime` / `endTime`, ISO 8601 |
| **Granularidad** | objeto de **duración**: `{"minutes":60}`, `{"hours":24}` |
| **Scopes de token** | los mismos que ya tiene — no hizo falta ninguno nuevo |
| **Plan Pro** | ✅ sin limitación observada |

Errores instructivos medidos por el camino:

```
scope sin ownerId → 400 {"code":"invalid_type","path":["scope","ownerId"],"message":"Required"}
scope sin type    → 400 {"code":"invalid_union_discriminator","options":["project","owner"]}
granularity {"value":1,"unit":"d"} → 400 "Granularity … is not valid. It must divide a day evenly or be a single week, month or year."
granularity "1d" (string)          → 400 "Invalid request: `granularity` should be object."
```

### 4.5 Fluid Active CPU **sí** está disponible por API pública  **[HTTP]**

`GET /v2/observability/schema?teamId=goodwolf` → 200, 9.588 bytes, ~100 métricas.
Las relevantes:

| Métrica | Qué da |
|---|---|
| `vercel.function_invocation.count` | **Function Invocations** |
| `vercel.function_invocation.function_cpu_time_ms` | **Active CPU** (ms) |
| `vercel.function_invocation.function_duration_gbhr` | GB-hr de duración |
| `vercel.function_invocation.provisioned_memory_mb` | memoria provisionada |
| `vercel.request.count` | **Edge Requests** |
| `vercel.middleware_invocation.count` | invocaciones de middleware |
| `vercel.isr_operation.*`, `vercel.image_transformation.*` | otras líneas de costo |

### 4.6 Lecturas reales obtenidas hoy  **[HTTP]**

Ventana: inicio del ciclo (2026-08-04T07:00:00Z) → ahora (~8,4 h).

```
invocations (owner, summary)                        28.881
Active CPU sumado (function_cpu_time_ms, sum)      634.839 ms
```

Desglose por proyecto — `groupBy: ["project_name"]`:

| Proyecto | Invocaciones |
|---|---|
| `chesscito` | 13.462 |
| `lite-chesscito` | 10.370 |
| `chesscito-landing` | 5.033 |
| `furinkazan` | 12 |
| `denscope-xr` | 6 |
| `xymyx-dasboard` | 1 |

### 4.7 El % de cuota **sigue sin ser observable**  **[HTTP]**

```
GET /v1/billing/charges?from=…&to=…&teamId=goodwolf
status: 404
body: {"error":{"code":"costs_not_found","message":"Costs not found"}}
```

Es **el mismo `Costs not found`** que devolvía `vercel usage` en la auditoría
original — el problema no era el plan Hobby, o al menos no sólo. Observability da el
**numerador** (consumo); el **denominador** (lo incluido en el plan) no sale de
ninguna API accesible con este token.

---

## 5. Dos trampas medidas que la implementación DEBE evitar

Ninguna de las dos produce un error. Las dos producen un número plausible y falso.

### 5.1 Los buckets gruesos están alineados al calendario y el `summary` cuenta el bucket ENTERO  **[HTTP]**

Misma ventana (`startTime` 07:00Z → ahora), sólo cambia la granularidad:

| Granularidad | `summary` | Buckets |
|---|---|---|
| `{"minutes":60}` | **28.881** | 9 |
| default (5 min) | **28.897** | 101 |
| `{"hours":24}` | **53.897** | 1, con `timestamp` **`2026-08-04T00:00:00.000Z`** |

El bucket de 24 h arranca a las 00:00Z — **siete horas antes del `startTime` pedido**
— y el `summary` suma el bucket completo. **Sobreestima un 87 %**, en silencio, con
HTTP 200.

> Un `{"hours":24}` es exactamente lo que uno elegiría para "el total del período".
> Y da un número inflado que no se distingue de un dato bueno.

### 5.2 El scope `owner` incluye proyectos que el monitor excluye a propósito  **[HTTP]**

El total del equipo (28.881) mezcla seis proyectos. Entre ellos
**`chesscito-landing`, que el runbook declara explícitamente fuera del monitor**, y
tres proyectos ajenos.

Atribuir el total del owner a Chesscito suma **5.052 invocaciones (~17,5 %)** que no
le corresponden. Y el sesgo no es estable: crece cada vez que se agregue un proyecto
al equipo, sin que nada lo señale.

> Es el mismo error de categoría que el monitor ya rechaza en Supabase con la
> etiqueta `SHARED DATABASE`: presentar la suma de dos sistemas como si fuera uno.

---

## 6. Matriz de diagnóstico

| Hipótesis | Evidencia a favor | Evidencia en contra | Veredicto |
|---|---|---|---|
| **Endpoint obsoleto o incorrecto** | `/v1/usage` **no figura** en los 272 paths de la spec oficial **[DOC]**; ningún rango temporal es aceptado **[HTTP]**; existe reemplazo documentado que funciona **[HTTP]** | responde con errores estructurados, o sea existe | ✅ **CONFIRMADA — causa raíz estructural** |
| **Parámetro obligatorio ausente** | el cuerpo del 400 dice literal ``missing required property `from` `` **[HTTP]**; agregar `from` mueve el error a `to` **[HTTP]** | agregarlos **no** desbloquea: pasa a `invalid_time_range` | ✅ **CONFIRMADA — causa raíz inmediata, insuficiente por sí sola** |
| **Team scope incorrecto** | — | `teamId=goodwolf` y `slug=goodwolf` dan el error idéntico **[HTTP]** | ❌ **REFUTADA** |
| **Rango temporal inválido** | los 7 rangos probados dan `invalid_time_range`, incluido el ciclo de facturación real **[HTTP]** | — | ✅ **CONFIRMADA como síntoma** de que el endpoint no es el correcto **[INF]** |
| **Métrica no soportada** | — | Observability expone invocations, CPU y edge requests, y devuelve datos reales **[HTTP]** | ❌ **REFUTADA** |
| **Endpoint interno / no público** | ausente de la spec oficial **[DOC]**; sin contrato publicado | responde con `error.code` estructurados | ✅ **CONFIRMADA** |
| **Token insuficiente** | — | `/v2/user` 200, `/v2/teams` 200, `/v2/observability/schema` 200, `/v2/observability/query` **200 con datos** **[HTTP]** | ❌ **REFUTADA — empíricamente** |
| **Plan sin acceso** | `/v1/billing/charges` → 404 `costs_not_found` **[HTTP]** | Observability responde 200 en el mismo plan Pro **[HTTP]** | ⚠️ **PARCIAL** — no aplica a consumo; **sí aplica al eje de costo/cuota** |
| **Cambio reciente en la API** | la respuesta pasó de 404 a 400 entre auditorías, sin cambiar el código | el cambio se explica por Hobby→Pro + token, no por la API | 🔸 **[HIP] no necesaria** para explicar lo observado |
| **Bug en serialización de parámetros** | — | no hay parámetros que serializar: la request no lleva ninguno **[HTTP]** | ❌ **REFUTADA** |

---

## 7. Causa raíz

**En dos capas, ambas confirmadas por respuesta HTTP:**

1. **Inmediata:** el colector hace `GET /v1/usage` **sin un solo query parameter**, y
   el endpoint exige `from` y `to`. El servidor lo dice textualmente. El colector
   **descarta el cuerpo de la respuesta**, así que ese mensaje nunca llegó al informe.

2. **Estructural — y es la que decide qué hacer:** `/v1/usage` **no es un endpoint
   público de Vercel**. Arreglar los parámetros **no** lo destraba: los siete rangos
   probados, incluido el ciclo de facturación real de la cuenta, devuelven
   `invalid_time_range`. El endpoint correcto es `POST /v2/observability/query`, que
   está documentado, funciona con el token actual y entrega justo las dos métricas
   que faltan.

**El token nunca estuvo mal.** Está confirmado por cuatro respuestas 200.

---

## 8. Opciones de solución y sus riesgos

| # | Opción | Qué entrega | Riesgos |
|---|---|---|---|
| **A** | **Migrar a `/v2/observability/query`, scope owner + `groupBy: project_name`, filtrando a los proyectos del perfil** | invocaciones y Active CPU reales, atribuidos correctamente | dos llamadas más por corrida (~+0,6 s); hay que resolver el `ownerId`; exige aplicar las dos trampas de §5 |
| **B** | Igual que A, pero con scope `project` por proyecto | atribución sin `groupBy` | requiere resolver `projectId` de cada proyecto → más llamadas y más superficie |
| **C** | Arreglar `/v1/usage` agregándole `from`/`to` | **nada** | ❌ **descartada por medición**: 7 rangos, 7 `invalid_time_range`. Y el endpoint no es público |
| **D** | Sólo leer y reportar el cuerpo del error | diagnóstico visible en el informe | no destraba el eje; **pero es correcto por sí mismo** y cuesta ~5 líneas |
| **E** | No tocar nada; seguir copiando del panel | — | el eje de costo más caro sigue ciego; el monitor sigue `(partial)` |

---

## 9. Recomendación mínima

**D + A, en dos etapas, en ese orden.**

**Etapa 1 (D) — leer el cuerpo del error.** Independiente del resto, valiosa aunque A
se posponga, y es la que impide que vuelva a pasar esto. ~10 líneas.

**Etapa 2 (A) — migrar el colector a Observability.** Scope `owner` con
`groupBy: ["project_name"]`, filtrado a los proyectos del perfil del target.

**Y una advertencia que no debe suavizarse:**

> **Esto NO va a sacar al informe de `(partial)`.** `classify.ts:243` decide el eje
> `vercel_cpu` sobre `cpu_percent`, y un porcentaje necesita un denominador —
> la cuota incluida en el plan — que **ninguna API accesible expone**
> (`/v1/billing/charges` → 404 `costs_not_found`). Después de A, `cpu_percent` sigue
> siendo `null` y `vercel_cpu` sigue siendo un eje crítico sin medir.
>
> Lo que cambia es real de todos modos: **hoy no hay ningún número; después de A hay
> consumo absoluto por proyecto, comparable entre snapshots.** Un delta de
> invocaciones entre dos corridas es exactamente la señal que faltó el 3 de agosto.
>
> Inventar un denominador para poder pintar un porcentaje sería la clase de dato con
> aspecto de verdad que este monitor existe para no producir.

---

## 10. Plan exacto de implementación

**Sin tocar** thresholds, clasificación global, snapshots, schema v2, targets,
Supabase, Upstash, telemetría, package scripts, infraestructura ni variables de
producción.

### Etapa 1 — `collectUsage` reporta el cuerpo del error

`scripts/ops/collectors/vercel.ts`

```ts
if (!response.ok) {
  // El cuerpo nombra la causa. Descartarlo convirtió un error autoexplicativo
  // en tres sesiones de investigación (auditoría 2026-08-04).
  const detail = await readErrorDetail(response);   // nuevo helper
  return {
    status: "not_observable",
    reason: detail
      ? `usage endpoint returned ${response.status}: ${detail}`
      : `usage endpoint returned ${response.status}`,
    http_status: response.status,
  };
}
```

`readErrorDetail` acotado: parsea `error.code` + `error.message`, tope de 200
caracteres, pasa por `sanitizeVercelError`, y **nunca lanza** (un cuerpo no-JSON
devuelve `null`).

### Etapa 2 — nuevo colector de Observability

Reemplaza `collectUsage` por:

1. **`resolveOwnerId(fetchImpl, token)`** — `GET /v2/teams/{slug}` → `.id`. Devuelve
   también `billing.period.{start,end}` y `billing.plan`, que dan la ventana honesta
   del período. Cachea por corrida.
2. **`queryObservability(metric, opts)`** — POST al endpoint, con
   `granularity: { minutes: 60 }` **fija** (§5.1: una granularidad gruesa alineada al
   calendario sobreestima), `groupBy: ["project_name"]`, y lectura de `summary`.
3. **Dos métricas:** `vercel.function_invocation.count` (default agg) y
   `vercel.function_invocation.function_cpu_time_ms` con `aggregation: "sum"`.
4. **Filtrado por perfil:** quedarse sólo con los `project_name` de
   `profile.projects`. Los demás se reportan agregados como `otros proyectos del
   equipo`, **nunca sumados a Chesscito** (§5.2).

Tipo nuevo, aditivo (no rompe el envelope v2):

```ts
export type VercelUsage =
  | {
      status: "observable";
      source: "observability";
      /** Ventana REAL consultada, no "el mes". */
      window: { start: string; end: string; billing_cycle_start: string };
      by_project: Array<{ project: string; invocations: number; cpu_ms: number }>;
      /** Suma SOLO de los proyectos del perfil. */
      in_scope_total: { invocations: number; cpu_ms: number };
      /** Lo que el equipo consumió fuera del alcance del monitor. */
      out_of_scope: { projects: string[]; invocations: number };
      /** Sigue null: no hay denominador. Ver §9. */
      cpu_percent: null;
    }
  | { status: "not_observable"; reason: string; http_status: number | null };
```

5. **`launch-health-snapshot.ts:200-207` y `:294`** — imprimir los números nuevos.
   `cpu_percent` sigue entrando como `null` al clasificador: **la clasificación no
   cambia**.
6. **Runbook §12** — reemplazar la fila `usage: 400` por lo resuelto, y agregar las
   dos trampas de §5.

### Orden de commits propuesto

| # | Commit | Contenido |
|---|---|---|
| 1 | `fix(ops): surface the Vercel error body in the usage result` | Etapa 1 + tests |
| 2 | `feat(ops): read invocations and Active CPU from the Observability API` | Etapa 2 + tests |
| 3 | `docs(ops): record the Vercel usage 400 root cause` | runbook + handoff |

---

## 11. Tests necesarios

Todos con `fetchImpl` inyectado — **nada sale a la red**, igual que hoy.

⚠️ El helper `fetchFor()` de `vercel-collector.test.ts:44` asume **un solo GET** a
`api.vercel.com`. Con la etapa 2 hay un GET (teams) y dos POST (query), así que el
fake debe rutear por URL y por método. Es el ajuste más invasivo de la tanda.

### Etapa 1

| Test | Fija |
|---|---|
| un 400 con cuerpo `{"error":{"code":"bad_request","message":"…`from`…"}}` deja el mensaje en `reason` | el defecto que causó esta auditoría |
| un 400 con cuerpo no-JSON degrada al mensaje viejo sin lanzar | robustez |
| un cuerpo de error que contenga el token **no** aparece en el resultado | redacción — extiende el test de `secret redaction` existente |
| el `reason` queda acotado en longitud | no volcar HTML de un gateway |
| los casos `[401, 403, 404]` existentes siguen pasando | no regresión |

### Etapa 2

| Test | Fija |
|---|---|
| el POST lleva `scope: {type:"owner", ownerId}` con el id `team_…`, **no el slug** | el 400 medido en §4.4 |
| la granularidad enviada es `{minutes: 60}` | **§5.1 — un `{hours:24}` sobreestimó 87 %** |
| `groupBy` incluye `project_name` | prerequisito de la atribución |
| un `summary` con seis proyectos produce `in_scope_total` sólo con los dos del perfil | **§5.2 — la trampa cara** |
| `chesscito-landing` aparece en `out_of_scope`, **nunca** en `in_scope_total` | el landing está fuera del monitor por decisión |
| el perfil **preview** filtra por los mismos dos proyectos | los proyectos no cambian con el target |
| `cpu_percent` sigue siendo `null` aunque haya datos | **no inventar el denominador** |
| la clasificación resultante sigue contando `vercel_cpu` como eje sin medir | los umbrales no se movieron |
| un fallo al resolver `ownerId` degrada a `not_observable`, no lanza | el monitor no se cae |
| un 200 con `summary` vacío no produce ceros: produce `not_observable` | ausencia ≠ cero |
| la `window` reportada trae `start`, `end` y `billing_cycle_start` | ningún número sin su ventana |

---

## 12. Criterios de aceptación

1. `pnpm ops:health` y `pnpm ops:health:preview` corren en ambos targets sin cambio
   de exit code respecto de hoy.
2. El informe imprime invocaciones y Active CPU **por proyecto**, con la ventana real
   y el inicio del ciclo de facturación explícitos.
3. El informe **nunca** presenta el total del equipo como consumo de Chesscito, y
   nombra los proyectos fuera de alcance por separado.
4. `cpu_percent` sigue en `null`; el informe sigue saliendo `(partial)` y sigue
   contando `vercel_cpu` entre los ejes críticos sin medir.
5. Ningún umbral, ninguna regla de clasificación y ningún campo del schema v2
   existente cambian de significado.
6. Ningún artefacto contiene el token ni ningún secreto; el backstop de redacción
   sigue activo.
7. Un fallo de Vercel degrada a `not_observable` con **el mensaje del servidor
   incluido**, y nunca tira la corrida.
8. La suite completa pasa, con el conteo reportado en el mensaje de commit.

---

## 13. Anexo — lo que quedó sin resolver

| Pregunta | Estado |
|---|---|
| ¿Existe alguna API que dé la **cuota incluida** del plan Pro? | **[HIP]** — `/v1/billing/charges` da 404; `billing.entitlements` del objeto de equipo no se inspeccionó a fondo. Es lo único que convertiría `vercel_cpu` en un eje medible |
| ¿Por qué `/v1/usage` rechaza incluso el ciclo real? | **[HIP]** — sin contrato publicado no hay forma de saberlo. Irrelevante: hay reemplazo oficial |
| ¿`groupBy` admite separar production de preview? | **[HIP]** — no se probó una dimensión de environment. Vale la pena en la implementación |
