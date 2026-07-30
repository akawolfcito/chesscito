# Spec — `/stats`: noindex + recorte de internals

**Fecha:** 2026-07-30
**Estado:** DRAFT — pendiente de red team
**Decisión del founder:** opción 2 (noindex + recorte). No gatear la página entera.

---

## 1. El problema, correctamente planteado

El backlog registraba esto como *"`/stats` publica retention/funnels/países Y está en
`sitemap.ts` — métricas de negocio indexables por Google"*, y la primera lectura fue
"hay que gatear la página". **Esa lectura era falsa.**

MiniPay **exige** esa página. De los requisitos oficiales de listing
(`minipay-requirements.md` §8, snapshot del PDF *"Build for MiniPay: Developer
Requirements"*, 2026-05-13):

> Stand up a **public-or-shared stats / analytics page** … DAU, MAU, **retention
> D1/D7/D30**, **top countries**, transactions per day/week/month/lifetime by method,
> unique on-chain users, volume per stablecoin, network fees, failed-tx rate.
> *"Where to publish: a `/stats` page inside the Mini App (read-only, no wallet
> required)."*

Y aparece en el checklist de pre-listing como ítem con casilla. El código ya lo sabía:
`public-aggregator.ts:184` comenta *"§8 on-chain block (MiniPay Stage-2)"* y la página
tiene un bloque **Tracked today / Coming next** escrito contra esa lista.

⚠️ **Verificar en la próxima llamada con MiniPay.** El requisito viene de un snapshot
del PDF, no de `docs.minipay.xyz`. Si §8 cambió, esta clasificación se revisa.

**Entonces son dos defectos distintos, y sólo uno es real:**

| | Estado | Veredicto |
|---|---|---|
| La página es alcanzable sin auth | Requisito de MiniPay §8 | **Correcto. No tocar.** |
| La página está en `sitemap.ts` e indexable | Nadie lo pidió | **Defecto. Arreglar.** |
| Publica internals que MiniPay **no** pide | Deriva de scope | **Defecto. Recortar.** |

---

## 2. Clasificación campo por campo

Criterio: **público = lo que MiniPay §8 pide, más el volumen de producto que hace de
proxy de "transactions per period"**. Todo lo demás es interno.

### 2.1 Público (se queda visible, sin token)

| Campo de `PublicStats` | Bloque en pantalla | Por qué |
|---|---|---|
| `totalVictories`, `victories7d/30d` | Executive Snapshot + Activity windows | tx counts per period (§8) |
| `uniqueMintersLifetime` | Activity windows | unique on-chain users (§8) |
| `activeSessions7d/30d`, `appOpens30d` | Snapshot | DAU / MAU (§8) |
| `activityTrend30d` | Activity trend, last 30 days | serie temporal de DAU (§8) |
| `retention` | *3 · Do they come back?* | **retention D1/D7 — pedido explícito (§8)** |
| `topCountries` | Top countries | **pedido explícito (§8)** |
| `onchain` | On-chain Activity | tx by method, unique users, volumen (§8) |
| `welcomePacksLifetime/7d` | Activity windows | tx by method (§8) |
| `victoriesByDifficulty` | Progress difficulty mix | composición de producto, inocuo |
| `topMinters`, `leaderboardTop10` | Top Active Wallets · Community Leaderboard | vitrina Identity Lite, **sin wallets** (`aggregateTopMinters` descarta la address) |
| `dataIntegrity` | Aviso de truncamiento | es un *caveat*, ocultarlo empeora la lectura |
| `generatedAt`, `filters` | Header + controles | — |

### 2.2 Interno (detrás del token)

| Campo | Bloque | Por qué se recorta |
|---|---|---|
| `accessFunnel` | *1 · Do they get in?* | Embudo de login con `failedSessions`. Publica la **tasa de falla del gate de acceso**: es una señal operativa, y en manos ajenas, un mapa de dónde duele. |
| `activation` | *2 · Do they reach value?* | Embudo paso a paso de la primera sesión. Es el diseño del onboarding expuesto como número. |
| `accountLifecycle` | *4 · Who are they?* | new / active / **dormant** / **inactive**. La cifra de churn no se publica. |
| `habitDepth` | *5 · Is it becoming a habit?* | Días activos por install: el techo real de la promesa de 21 días. |
| `challengeFunnel` | (hoy no renderizado) | Embudo de viralidad. Mismo criterio. |

**Nota sobre `retention`:** es lo más sensible de la lista y **se queda público** — porque
MiniPay lo pide por nombre. No es una omisión.

**Nota sobre "Tracked today / Coming next":** `COMING_NEXT` nombra *"Retention D30 · D3 /
D21 cohorts"* y *"Monetization funnel"*. Es un roadmap de instrumentación, no un dato.
Se queda público.

### 2.3 Verificado: no hay fuga por derivación

`computePlatformSignals` (`stats-page.tsx:634`) sólo lee `victories*` y
`victoriesByDifficulty`. **No toca ningún campo interno** — no hay que filtrarlo.

---

## 3. Contrato (SDD — se escribe primero)

### 3.1 El tipo se parte en dos

```ts
// lib/stats/public-aggregator.ts
export type PublicStats = { /* … §2.1 … */ };

/** Bloques que sólo se computan y sólo viajan con token válido. */
export type InternalStats = {
  accessFunnel: AccessFunnel | null;
  activation: ActivationFunnel | null;
  accountLifecycle: AccountLifecycle | null;
  habitDepth: HabitDepth | null;
  challengeFunnel: ChallengeFunnel | null;
};

export type StatsPayload = {
  public: PublicStats;
  /** `null` = el visitante no tiene token. NO es "falló la query". */
  internal: InternalStats | null;
};
```

⛔ **`internal: null` y un `InternalStats` con todos los campos en `null` significan
cosas distintas y no deben colapsarse.** El primero es "no autorizado" (la sección no
se renderiza); el segundo es "autorizado, pero las queries fallaron" (la sección
renderiza sus vacíos, como hoy). Un solo `null` para ambos borra la diferencia entre
"no tenés permiso" y "el sistema está roto".

### 3.2 El aggregator no computa lo que no va a viajar

`getPublicStats(filters, { includeInternal })`. Con `includeInternal: false` **no se
lanzan** las queries de §2.2. Motivos, en orden de importancia:

1. **Seguridad.** En un Server Component, no renderizar un campo **no lo saca del
   payload RSC**. Si el aggregator lo computa, viaja al cliente y se lee en el HTML.
   El recorte tiene que pasar antes, en la capa de datos.
2. Costo: son 5 escaneos de `analytics_events` menos por request público.

### 3.3 ⛔ El cache key DEBE incluir el flag

```ts
unstable_cache(fn, ["public-stats", surface, container, includeInternal ? "int" : "pub"], …)
```

Sin esa cuarta clave, **el primer request con token cachea el payload con internals y
lo sirve durante una hora a todo visitante anónimo con los mismos filtros.** El bug
sería invisible en desarrollo (cache frío por request) y catastrófico en prod. Es el
riesgo #1 de este cambio.

---

## 4. Mecanismo del gate

### 4.1 Secreto

`STATS_INTERNAL_TOKEN` — server-only. **Nunca** `NEXT_PUBLIC_`.
Un solo valor compartido entre learn y play (dos deployments, misma env var): el
recorte no es por superficie, y dos tokens duplican la rotación sin comprar nada.

**Fail closed:** si la env no está definida, `internal` es `null` para todos.
Consecuencia deseada: **el deploy oculta los internals inmediatamente**, sin que haya
que configurar nada primero.

### 4.2 Entrada: route handler, no la página

Un Server Component no puede setear cookies en Next 14. Entonces:

- `GET /api/stats/unlock?key=<token>` → compara timing-safe (mismo patrón que
  `api/admin/lite-stats/route.ts:69`), setea cookie `chesscito_stats_key` httpOnly /
  Secure / SameSite=Lax / 30 días, y redirige 302 a `/stats`.
- Token inválido, o env ausente → **redirige igual a `/stats`, sin cookie y sin
  mensaje**. No se confirma si el token existe ni si la env está puesta.
- `GET /api/stats/unlock?lock=1` → borra la cookie y redirige. Es la salida.

La cookie guarda el token, no un booleano: **rotar `STATS_INTERNAL_TOKEN` invalida
todas las sesiones abiertas**, que es lo que uno espera de una rotación.

`export const runtime = "nodejs"` (usa `node:crypto`), y `dynamic = "force-dynamic"`.

### 4.3 Lectura: la página

```ts
const unlocked = statsUnlocked(cookies().get("chesscito_stats_key")?.value);
const payload = await loadStats(filters, unlocked);
```

`cookies()` es **síncrono** en Next 14.2.35 (ver el estado de 2026-07-29: el hook que
pide `await` se equivoca). Ya es dinámica por `searchParams`, así que no cambia el
modo de render.

### 4.4 noindex

- `apps/web/src/app/sitemap.ts` → sacar `"/stats"` de `STATIC_PATHS`.
- `apps/web/src/app/[locale]/stats/page.tsx` → `metadata.robots = { index: false, follow: false }`.
- `apps/landing/src/app/stats/page.tsx` → mismo `metadata.robots`. **La página se
  queda** (la decisión previa de borrarla queda anulada por §1: es el índice de las dos
  dashboards y MiniPay quiere que sean alcanzables). El sitemap del landing no la
  lista, pero el landing sí la enlaza (`landing-page.tsx:830`) y el landing está
  indexado — sin `noindex` en el destino, Google llega igual.

⚠️ `noindex` no desindexa lo ya indexado de inmediato; Google tiene que recrawlear.
Si urge, va por Search Console y **eso lo hace el founder**.

---

## 5. Estados de UI

| Estado | Qué se ve |
|---|---|
| Anónimo (caso normal) | §2.1 completa. Los bloques 1, 2, 4 y 5 **no existen**: sin encabezado, sin hueco, sin "restringido". La numeración `1 ·`…`5 ·` de los sub-bloques **se recalcula** — un público que ve sólo "3 · Do they come back?" queda preguntando por 1 y 2. |
| Desbloqueado | Todo, idéntico a hoy, más un chip discreto **"Internal view"** en el header con enlace a `?lock=1`. Sin el chip no hay forma de saber qué estás viendo. |
| Desbloqueado + query rota | La sección interna renderiza sus vacíos actuales (`null` por campo). Se distingue del caso anónimo. |
| Env ausente | Igual que anónimo, para todos. |

**Edge cases**
- Token en la URL con la cookie ya puesta → idempotente, re-setea y redirige.
- Cambiar filtros con la cookie puesta → sigue desbloqueado (la cookie no depende del querystring).
- Cookie con un token viejo tras una rotación → se trata como anónimo. No se limpia sola; `?lock=1` la borra.
- La `<h3>` "Do they get in, reach value, and come back?" **describe los cinco bloques**. En vista anónima queda mintiendo sobre lo que hay debajo → necesita copy propia para ese estado.

---

## 6. Plan de trabajo (TDD, commits atómicos)

| # | Etapa | Test primero |
|---|---|---|
| 1 | `noindex` + fuera del sitemap | `sitemap.test.ts` (no existe hoy): `/stats` ausente y el resto intacto. `page.test`: `metadata.robots.index === false`. Landing igual. |
| 2 | Partir el tipo + `includeInternal` en el aggregator | Con `false`: `internal === null` **y** los 5 fetches no se llamaron (spy). Con `true`: se llaman. |
| 3 | Cache key | Que `unstable_cache` reciba el flag en la key. **Regresión explícita**: dos cargas con distinto `includeInternal` no comparten entrada. |
| 4 | `/api/stats/unlock` | Token válido → cookie + 302. Inválido → 302 sin cookie. Env ausente → 302 sin cookie. `?lock=1` → borra. Timing-safe. |
| 5 | Render | Anónimo: los 4 encabezados internos ausentes **y** ninguno de sus valores en el HTML serializado. Desbloqueado: presentes + chip. |
| 6 | Copy + renumeración | Encabezado alternativo y numeración correcta en vista anónima. |

**Verificación final** (una sola corrida, no por etapa): suite completa de `web`,
`pnpm exec tsc --noEmit`, `content:audit`.

---

## 7. Riesgos

1. ⛔ **Envenenamiento de cache** (§3.3). El único que puede filtrar los datos que este
   spec busca proteger. Test de regresión obligatorio.
2. ⚠️ **Payload RSC.** Recortar en el render y no en los datos no arregla nada. Por eso
   la etapa 2 va antes que la 5, y el test de la 5 revisa el **HTML**, no el árbol.
3. ⚠️ **`e2e/grant-shots.spec.ts:259` (`09-stats-public`)** fotografía `/stats` para
   aplicaciones a grants. Tras el cambio, la foto sale recortada. Un grant **sí** quiere
   ver retention y funnels → ese test debería setear la cookie de unlock. **Pregunta
   abierta para el founder** (§8).
4. ⚠️ Un `redirect()` dentro de un `try` en un route handler de Next se traga la
   excepción de control. Redirigir fuera de cualquier `try`.
5. 🟢 Sin migración, sin cambios de schema, sin contratos. Reversible con un revert.

---

## 8. Preguntas abiertas

1. **¿`grant-shots` va con la cookie puesta?** Mi recomendación: sí — las capturas van a
   una aplicación a grant, no a la web. Requiere el token en el env de CI/local.
2. **¿El chip "Internal view" es visible o silencioso?** Recomiendo visible: sin él,
   una captura de pantalla interna es indistinguible de la pública, y esa confusión ya
   costó una ronda ([[feedback_an_unauditable_number_reads_as_a_lie]]).
3. **¿Confirmar §8 con MiniPay?** El snapshot es de 2026-05-13. Si la lista cambió,
   `retention` y `topCountries` podrían no tener que ser públicos.
