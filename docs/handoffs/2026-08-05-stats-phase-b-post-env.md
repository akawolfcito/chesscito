# Fase B — commit, variables de entorno y validación del cliente

**Fecha:** 2026-08-04 · **SHA de Fase B:** `e024658fe77ebc47ed8238d1fb2ea618ccb8000b`
**Rama:** `main` (= `origin/main`) · **Commit:** `feat(landing): add server-only Supabase client`

> **✅ El cliente server-only funciona de punta a punta contra producción y ni
> una credencial llega al bundle del navegador.** Verificado sobre un build de
> producción real, con el módulo **dentro del grafo de ejecución**.
> Las dos variables están en Preview **y** Production de `chesscito-landing`.
> **Nada consume las RPC todavía** — eso es Fase C.

---

## 1. Decisiones aprobadas y commiteadas

| Decisión | Estado |
|---|---|
| `@supabase/supabase-js@2.100.1` — pin exacto, misma versión que `apps/web` | ✅ |
| `server-only@0.0.1` — pin exacto | ✅ aprobado: Vite no resuelve el especificador sin el paquete, y un alias de tests no protegería `tsc` ni el build real |
| Plantilla en `apps/landing/.env.template` | ✅ aprobado: es configuración de `chesscito-landing` y no se mueve a `apps/web`. La plantilla raíz no se toca en esta fase |

**Commit `e024658f`** — 7 archivos, 832 inserciones. `SESSION.md` fuera del
stage, `git diff --cached --check` limpio, 0 hits en el scan de secretos.

---

## 2. Variables de entorno — presencia y scope, nunca valores

Proyecto Vercel **`chesscito-landing`** (`prj_DiR2FO5AJJQgqozSqmGWxdEGm1Lh`),
Root Directory `apps/landing`.

Auditado con **listado SIN filtro de environment** (`vercel env ls`), que es la
única forma fiable: `vercel env ls production` **oculta las filas scopeadas a
Preview** y ya produjo un reporte falso una vez.

| Variable | Preview | Production | Tipo | Prefijo `NEXT_PUBLIC_` |
|---|---|---|---|---|
| `SUPABASE_URL` | ✅ | ✅ | Encrypted / Sensitive | **no** |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | Encrypted / Sensitive | **no** |

Aparecen como **cuatro filas** (dos por variable, una por scope) — exactamente
el patrón que un listado filtrado escondería.

**Estado previo del proyecto:** cinco variables, **todas `NEXT_PUBLIC_*`**, cero
secretos. Éstas son las dos primeras credenciales de servicio que tiene.

**Origen de los valores:** los mismos que ya usa el proyecto `chesscito`, leídos
con `vercel env pull` a un archivo temporal fuera del repo, inyectados a
`vercel env add` por **stdin**, y borrados al terminar. **Nunca aparecieron en
una línea de comando, en un log, en la terminal ni en un archivo del repo.**
No se creó ninguna credencial nueva y no se rotó ninguna.

---

## 3. Deployments — y una corrección sobre lo que pasó

### ⚠️ El push a `main` disparó un deployment de **Production**, no una promoción mía

`chesscito-landing` tiene auto-deploy por git. El commit `e024658f` produjo
`chesscito-landing-6is6m81n9-goodwolf.vercel.app` · **Ready** · 47 s, sin que
mediara ninguna promoción explícita. **No fue una decisión, fue el
comportamiento por defecto del proyecto**, y conviene tenerlo presente: en este
repo *pushear a `main` es desplegar a producción*.

Es inocuo: en ese momento el scope Production no tenía las variables, así que
`getSupabaseServer()` devolvía `null`; y **nada importa el módulo todavía**.

### El preview por CLI no probó nada — y la causa no fue la que dije primero

Creé `chesscito-landing-2qtxkfron` por CLI con un probe temporal. La ruta
**no apareció** en la tabla de rutas del build. Mi primera lectura fue que el
CLI no había subido el archivo untracked. **Era falsa.** La causa real:

> La carpeta se llamaba `__phase-b-probe`, y **Next excluye del routing toda
> carpeta que empiece con `_`** (private folders). El mismo build local la
> omitía igual. No tenía nada que ver con el upload.

Ese deployment **fue eliminado** (`vercel remove`). No quedó nada expuesto.

### 🔻 Cambio de método: el resto se validó en LOCAL

Por indicación del founder —*reducir al mínimo los deploys que no sean
necesarios*— **no se hizo ningún deploy adicional**. La validación restante
corrió sobre un build de producción local, que es el **mismo artefacto** que
Vercel construye, y permite escanear `.next` **entero** en vez de sólo lo que
sirve un dominio.

**No se desplegó production después de cargar las variables**, y es
deliberado: son variables de servidor y **ningún código las lee todavía**. El
deploy de Fase C las tomará. Redesplegar hoy sería un deploy sin efecto
observable.

---

## 4. Prueba del cliente server-only — build de producción, credenciales reales

`next build` con la ruta probe registrada → **el módulo entra en el grafo**:

```
ƒ /api/phase-b-probe    0 B    0 B      ⬅ presente
○ /stats             8.87 kB  96.1 kB   ⬅ sin cambios
```

`next start` en `:3009` con los valores reales inyectados desde archivos fuera
del repo (nunca por línea de comando).

| Comprobación | Resultado |
|---|---|
| `/` | HTTP **200** |
| `/stats` | HTTP **200** · 16.206 bytes |
| probe **sin** token | HTTP **404** — la compuerta cierra |
| probe **con** token | HTTP **200** |

```json
{"clientCreated":true,"rpcError":null,"rows":1,
 "columns":["app_open_sessions_30d","app_opens_rows_30d","sessions_30d","sessions_7d"],
 "allNumbers":true}
```

**El cliente se crea y ejecuta una RPC contra producción sin error**, devolviendo
las cuatro columnas exactas del contrato de `stats_install_counts`. La respuesta
**no renderiza ni un valor** — sólo forma. Y en un probe aparte, previo:
`sin envs → null` ✅.

El probe estaba gateado por un token aleatorio de 24 bytes, **fue borrado** y
**nunca entró a git**.

---

## 5. Escaneo de bundle — ahora sí probatorio

Sobre el build local **con el módulo en el grafo**, buscando los **valores
reales** (no sólo los nombres):

```
scanned 128 files under .next (32 under static/)

SUPABASE_URL (real value)                static/:   0   elsewhere:   1
SUPABASE_SERVICE_ROLE_KEY (real value)   static/:   0   elsewhere:   0
literal name SUPABASE_SERVICE_ROLE_KEY   static/:   0   elsewhere:   2
literal name SUPABASE_URL                static/:   0   elsewhere:   2
phase-b sentinel                         static/:   0   elsewhere:   0
any NEXT_PUBLIC_SUPABASE                 static/:   0   elsewhere:   0

RESULT: no credential reaches the browser bundle
```

**Cero en `static/` en las seis búsquedas.** La service role key no aparece en
ningún archivo, ni siquiera del lado servidor.

### 🔬 El único hit del valor de la URL, y por qué importa para Fase C

```
HIT: .next/cache/fetch-cache/1160cfc7a507c255c52a44b127a8f589e98a348705fdf0f0c5d14ccfbcafe55e
```

Es la **caché de `fetch` de Next**, escrita en tiempo de request por la llamada
del probe: `supabase-js` usa `fetch`, y Next persiste la URL de la petición. No
es bundle, no es alcanzable por el navegador, y `.next/cache` no se sirve.

⚠️ **Pero es un dato para Fase C y Fase E:** las llamadas a las RPC pasan por el
`fetch` de Next y **dejan entrada en su Data Cache**. Hay que decidir
explícitamente si se cachean ahí o no, en vez de heredarlo por defecto — la
Data Cache **no se purga al desplegar**, y eso ya sostuvo un censo caído 18 h 34
min *y un deploy entero*.

El directorio `.next` local fue **borrado** al terminar, junto con los archivos
temporales de credenciales.

---

## 6. `/stats` — sin cambios, y sin consumidor

Build local, HTML servido:

```
bytes                    : 16.190
em-dashes (—)            : 2
menciona Learn / Play    : sí / sí      ⬅ el selector actual sigue ahí
noindex presente         : sí
alguna referencia a supabase : NO
algún nombre de RPC      : NO
```

Y en producción: `https://www.chesscito.com/stats` → **HTTP 200 · 16.687 bytes**.

**Ninguna aplicación consume las ocho RPC.** Es el estado esperado al cierre de
Fase B.

---

## 7. Estado de las RPC y del monitor

| Verificación | Resultado |
|---|---|
| `scripts/ops/verify-stats-rpcs.ts` | **1.084 / 1.084 · FAILED 0** — sin cambios |
| `pnpm ops:health` (production) | 🟢 **GREEN (partial)** · `play` y `learn` HTTP 200 · **5XX ninguno** |
| `pnpm ops:health:preview` | 🟢 **GREEN (partial)** · los dos dominios HTTP 200 |
| Credenciales del monitor | intactas (`SUPABASE_URL`, `SUPABASE_DB_PASSWORD`, `UPSTASH_*`, `VERCEL_TOKEN`, `LOG_SALT`) |
| Play / Learn | **sin cambios** — esta fase no toca `apps/web` |

---

## 8. Un efecto colateral de `vercel link` que hubo que revertir

`vercel link` **añadió `.env*` al `.gitignore` de la raíz**. Esa línea habría
dejado fuera del control de versiones a `.env.example` y a **todo
`.env.template` futuro** — justo la convención que el repo usa para documentar
nombres de variables. Los archivos ya trackeados no se pierden, pero el próximo
sí se habría perdido en silencio.

**Revertido** (`git checkout -- .gitignore`). `apps/landing/.env.template` sigue
trackeado y **no ignorado** — verificado con `git check-ignore`.

También se eliminaron el link de Vercel en la raíz del repo (apuntaba el root a
`chesscito-landing`, que confundiría un `vercel deploy` futuro) y el
`apps/landing/.gitignore` redundante que el link había creado.

---

## 9. Riesgos vigentes

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **Pushear a `main` despliega producción automáticamente** | media | pasó en esta sesión sin promoción explícita. Si Fase C debe validarse antes de ser pública, hay que separar la rama o apagar el auto-deploy del proyecto |
| 2 | **Las RPC pasan por el `fetch` de Next y dejan entrada en su Data Cache** | media | medido en §5. Decidirlo explícitamente en Fase C/E; la Data Cache **no se purga al desplegar** |
| 3 | **Production tiene las variables pero NO se redesplegó** | baja | deliberado: nada las lee. El primer deploy de Fase C las tomará. Si alguien espera que ya estén activas, se equivoca |
| 4 | **`chesscito-landing` sigue fuera de `ops:health`** | media | ahora tiene secretos **y** va a alojar la única página de estadísticas. El plan lo agenda en Fase H; con credenciales ya montadas, vale adelantarlo |
| 5 | **production y preview comparten la MISMA base** | media | toda cifra de las RPC es la suma de los dos entornos. Rotularlo donde se afirme el número |
| 6 | **15,5 % de filas con `surface`/`container` NULL** | media | un filtro no-null las excluye → las vistas filtradas **no suman** a la sin filtrar |
| 7 | **`census.total` sigue sin explicación** | media | intacto. **No cerrar `/stats` sin trazarlo** |
| 8 | **`week3` devuelve cohorte 0 hasta ~2026-08-20** | media | `session_first_seen` nació el 2026-07-23. La UI debe distinguir «cohorte vacía» de «nadie volvió» |

---

## 10. `git status --short` al cierre

```
 M SESSION.md
```

Árbol limpio salvo `SESSION.md`, que sigue **fuera del stage** como pedía el
encargo. El probe, el link de la raíz, el `.gitignore` modificado, el `.next`
local y los archivos temporales de credenciales **ya no existen**.

---

## 11. NEXT ACTION — **Fase C**

> **Agregador en el landing**: `types.ts`, port literal de `filters.ts`,
> `onchain.ts` y `players-census.ts`, y `aggregator.ts` llamando a las ocho RPC.
> Se borran `computeActivation`, `computeTopCountries`, `computeRetention`,
> `computeAccountLifecycle`, `computeHabitDepth` y `computeActivityTrend`.
>
> ⚠️ **Portar el guard de fuente**, no reescribirlo:
> `apps/web/src/lib/stats/__tests__/public-aggregator-truncation.test.ts`.
> ⚠️ **No reintroducir el `ONCHAIN_QUERY_MAX_ROWS` de 9.999.**
>
> **Referencia:** `docs/plans/2026-08-04-stats-consolidation-execution-plan.md`,
> Fase C. **Leerlo, no re-derivarlo.**

Al cerrar Fase C: **repetir el escaneo de §5**, que ahí pasa a cubrir el
agregador real y no un probe.

---

## 12. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-05-stats-phase-b-server-only-client.md` | el cliente: diseño, guards, contrafactuales |
| `docs/handoffs/2026-08-05-stats-rpc-phase-a-post-apply.md` | las ocho RPC en producción |
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **empezar acá para Fase C** |
| `scripts/ops/verify-stats-rpcs.ts` | correrlo antes y después de cualquier cambio de esquema |
