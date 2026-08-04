# Plan ejecutable — `/stats` robusta en `chesscito-landing`

**Fecha:** 2026-08-04 · **Base:** `ebdc5c1` (hotfix mínimo aplicado)
**Auditoría:** `docs/audits/2026-08-04-public-stats-accuracy-audit.md`
**Secuencia aprobada:** D — hotfix ✅ hecho → robusta directo en landing → 307 → observación → 308 + retirada.

> **Nada de este plan está ejecutado.** Es el paso 3 del encargo: diseño, no
> implementación. Ninguna fase toca `/api/profile/stats`, monitor, telemetría,
> cron, retención ni índices.

---

## Estado de partida

| | |
|---|---|
| `b7b070c` | auditoría |
| `ebdc5c1` | hotfix mínimo — las tarjetas capadas ya salen `—` |
| Sin pushear | ambos commits son locales |
| Canonical destino | `https://www.chesscito.com/stats` |
| Techo real | **1.000 filas**, inamovible desde el cliente |

**Lo que el hotfix NO hizo, a propósito:** no recuperó ni una métrica. Apagó las
falsas. Las fases A–C son las que las devuelven, con el número correcto.

---

## Fase A — Migración SQL y privilegios

**Objetivo:** mover cada `count(distinct …)` a PostgreSQL. Es la fase que corrige
el defecto; todas las demás son transporte y presentación.

### Archivos

| Archivo | Qué |
|---|---|
| `supabase/migrations/2026-08-05-stats-aggregation-rpcs.sql` | **nuevo** — 8 funciones |
| `supabase/migrations/__tests__/stats-rpc-privileges.test.ts` | **nuevo** — guard de privilegios |
| `scripts/ops/verify-stats-rpcs.ts` | **nuevo** — validación contra la base real |

### Las ocho funciones

Todas `SECURITY DEFINER`, `SET search_path = public`, y todas toman
`p_surface text default null` + `p_container text default null` (null = sin filtro).

| Función | Devuelve | Reemplaza |
|---|---|---|
| `stats_install_counts` | `sessions_7d`, `sessions_30d`, `app_opens_rows_30d`, `app_open_sessions_30d` | tarjetas 11–13 |
| `stats_activation_funnel` | `(step text, sessions bigint)` — **scopeada a la cohorte de `app_opened`** | tarjeta 14 |
| `stats_access_funnel` | `(step text, sessions bigint)` + `failed_sessions` | tarjeta 15 |
| `stats_top_countries` | `(country text, sessions bigint)` limit 8 | tarjeta 16 |
| `stats_retention` | `(bucket text, returned bigint, cohort bigint)` para `d1`, `d7`, `week3` | tarjeta 17 |
| `stats_account_lifecycle` | `known`, `new_today`, `new_7d`, `active_7d`, `dormant`, `inactive`, `resurrected_7d` | tarjetas 18–24 |
| `stats_habit_depth` | `(min_days int, installs bigint)` + `cohort` + `median_active_days` | tarjeta 25 |
| `stats_activity_trend` | 30 filas densas: `day date`, `sessions`, `new_installs`, `returning_installs` | tarjetas 26–28 |

**Reglas que las funciones deben respetar** (todas ya establecidas y verificadas):

- `session_id` nulo o vacío **excluido**; `account_ref` nulo **excluido**.
- El embudo de activación **scopeado a la cohorte**, para que sea monótono por
  construcción. Hoy `App opened 37 < Hub viewed 41`.
- `new_today` = `first_seen >= date_trunc('day', now() at time zone 'UTC')`.
- `new_7d` = **ventana móvil de 7 días**, y la etiqueta lo dice — no "this week".
- `active_7d + dormant + inactive = known`, invariante verificable en SQL.
- `week3` = **ventana días 15–21**, no día 21 exacto. El nombre ya es correcto.
- Los buckets del trend son **densos**: 30 filas siempre, ceros incluidos.

### Privilegios

```sql
revoke execute on function public.stats_<n>(text, text) from public;
revoke execute on function public.stats_<n>(text, text) from anon;
revoke execute on function public.stats_<n>(text, text) from authenticated;
```

⛔ **Los tres.** `REVOKE ... FROM PUBLIC` **no alcanza en Supabase**: los default
privileges otorgan `EXECUTE` explícito a `anon` y `authenticated`, y revocar sólo
de `public` deja la función expuesta. La página lee con **service role**, que
pasa por `postgres` y no necesita ninguno de los tres.

### Dependencias

Ninguna. No depende del landing ni de las envs.

### Tests

| Test | Qué fija |
|---|---|
| `stats-rpc-privileges.test.ts` | la migración contiene los **tres** `REVOKE` por función |
| `scripts/ops/verify-stats-rpcs.ts` | ⚠️ **contra la base real**: `has_function_privilege('anon', …, 'EXECUTE')` es `false` para las ocho, leído de `proacl`. Un regex sobre el `.sql` pasa en verde con la función expuesta |
| paridad de valores | cada función comparada contra el SQL manual de la auditoría §6, misma ventana, tolerancia sólo por deriva de minutos |
| invariante de partición | `active_7d + dormant + inactive = known` |
| monotonía | ningún paso del embudo supera al anterior |
| densidad | `stats_activity_trend` devuelve exactamente 30 filas |

### Rollback

`drop function` de las ocho. Nada las llama todavía — el agregador no cambia en
esta fase. **Rollback de costo cero.**

### Criterio de aceptación

- [ ] Las ocho existen y devuelven las columnas del contrato §13 de la auditoría.
- [ ] `has_function_privilege` verificado **en la base real**, no en el texto.
- [ ] Cada valor coincide con el SQL manual de §6 sobre la misma ventana.
- [ ] La partición cierra y el embudo es monótono.

### Commit

```
feat(stats): add server-side aggregation RPCs
```

---

## Fase B — Cliente server-only en el landing

**Objetivo:** que `chesscito-landing` pueda leer Supabase sin que una sola clave
toque el bundle del cliente.

### Archivos

| Archivo | Qué |
|---|---|
| `apps/landing/package.json` | **+1 dep**: `@supabase/supabase-js`, **pin exacto** (convención del equipo) |
| `apps/landing/src/lib/supabase/server.ts` | **nuevo** — port de `apps/web/src/lib/supabase/server.ts` |
| `apps/landing/src/lib/supabase/__tests__/server-only.test.ts` | **nuevo** — guard |
| `.env.template` | documentar las dos variables (**nombres, nunca valores**) |

### Variables

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, en el proyecto `chesscito-landing`,
**production y preview**.

⛔ **Sin prefijo `NEXT_PUBLIC_`.** El landing hoy no tiene ni un secreto y no
tiene cliente Supabase en el bundle: esa propiedad hay que **conservarla**, no
recuperarla después.

⚠️ Son variables de servidor, así que **no** requieren redeploy por horneado —
pero sí requieren un deploy para que el código nuevo las lea.

### Dependencias

Fase A no es estrictamente previa, pero **no tiene sentido montar el cliente sin
tener qué llamar**. Orden natural: A → B.

### Tests

| Test | Qué fija |
|---|---|
| `server-only.test.ts` | `getSupabaseServer()` devuelve `null` sin envs y **no lanza** |
| guard de bundle | ningún archivo bajo `src/components/**` importa `lib/supabase/**` |
| guard de nombres | ninguna variable de Supabase aparece con prefijo `NEXT_PUBLIC_` |

### Rollback

Borrar las dos variables. El cliente devuelve `null`, el agregador cae a
`EMPTY_PUBLIC_STATS`, la página renderiza em-dashes. **Sin 500.**

### Criterio de aceptación

- [ ] `pnpm -C apps/landing build` verde.
- [ ] La service role **no** aparece en ningún chunk de `.next/static`.
- [ ] Sin envs, la página renderiza y no rompe.

### Commit

```
feat(landing): add server-only Supabase client
```

---

## Fase C — Agregador en el landing

**Objetivo:** una fuente de verdad, alimentada por RPC. Cero `new Set()` sobre
filas de telemetría.

### Archivos

| Archivo | Qué |
|---|---|
| `apps/landing/src/lib/stats/types.ts` | **nuevo** — el contrato, port de `PublicStats` |
| `apps/landing/src/lib/stats/filters.ts` | **port** literal desde `apps/web` (parser + fallback a `all`, ya fijados por test) |
| `apps/landing/src/lib/stats/aggregator.ts` | **nuevo** — 8 RPC + los `count: "exact"` que ya son correctos |
| `apps/landing/src/lib/stats/onchain.ts` | **port** — el bloque §8 de MiniPay, sin cambios de lógica |
| `apps/landing/src/lib/stats/players-census.ts` | **port** |
| `apps/landing/src/lib/stats/__tests__/**` | **nuevos** |

### Lo que se porta sin tocar

`onchain.ts`, `filters.ts`, `players-census.ts` y `identity-lite`. Son correctos
hoy y sus tests viajan con ellos. ⚠️ `ONCHAIN_QUERY_MAX_ROWS` viaja ya
corregido — **no reintroducir el 9.999**.

### Lo que se borra al portar

`computeActivation`, `computeTopCountries`, `computeRetention`,
`computeAccountLifecycle`, `computeHabitDepth`, `computeActivityTrend`. Sus
tests se convierten en tests de **forma del contrato de la RPC**, no de
derivación en JS.

`computeAccessFunnel` **conserva su regla de scoping**, ahora expresada en SQL.

### Guard de fuente — el que impide la reincidencia

Un test que **falla** si en `apps/landing/src/lib/stats/**` aparece:

- `.range(` sobre `analytics_events`, `account_first_seen` o `session_first_seen`;
- `new Set(` sobre filas de esas tres tablas;
- el texto `explicit range bypasses` o `dodge PostgREST`.

> Es la única defensa real. La constante falsa y **su comentario falso** se
> copiaron juntos entre dos archivos: la prosa se replica igual que el código.
> Ya existe la versión de este guard en
> `apps/web/src/lib/stats/__tests__/public-aggregator-truncation.test.ts` —
> portarla, no reescribirla.

### Dependencias

A y B.

### Tests

| Test | Qué fija |
|---|---|
| paridad con SQL | cada campo contra §6 de la auditoría |
| guard de fuente | arriba |
| fallback | RPC caída → ese campo `null`, el resto vive |
| `EMPTY_PUBLIC_STATS` | sin Supabase, la página renderiza entera en em-dashes |
| filtros | `surface`/`container` llegan a las 8 RPC; valor inválido → `all` |
| on-chain intacto | los valores del bloque §8 no cambian |

### Rollback

Revert del commit. El landing vuelve al selector, que sigue en el historial.

### Criterio de aceptación

- [ ] Cada tarjeta coincide con el SQL de referencia sobre la misma ventana.
- [ ] Cero `new Set()` sobre telemetría.
- [ ] El bloque on-chain devuelve exactamente lo mismo que hoy.

### Commit

```
feat(landing): aggregate public stats from server-side RPCs
```

---

## Fase D — UI y filtros

**Objetivo:** una página, con el desglose Learn/Play adentro.

### Archivos

| Archivo | Qué |
|---|---|
| `apps/landing/src/app/stats/page.tsx` | **reescrito** — el selector de dos botones desaparece |
| `apps/landing/src/components/stats/**` | **port** de `stats-page.tsx`, `stat-card.tsx`, `players-table.tsx` |
| `apps/landing/src/app/layout.tsx` | `metadataBase` + canonical |
| CSS del landing | verificar/portar `mission-shell`, `stats-page-scrim`, `paper-tray`, `paper-divider` |

### Locale

- **`/stats` sigue fuera del matcher del middleware.** Sin `/es/stats`: dos URLs
  indexables para el mismo contenido, y el listing sólo puede declarar una.
- Idioma por `Accept-Language`, sobreescribible con `?locale=en|es`.
- `?locale=` **no entra en la clave de caché de datos** — es formato, no dato.
  Mismo patrón que `nicknameTokens`, que ya se construye fuera del cacheado.

### Filtros Learn/Play

- Se conservan los chips actuales de `surface` y `container`, con el mismo parser
  y el mismo fallback a `all`.
- **Se añade** una fila **Learn / Play / Total** en las tarjetas de installs, para
  que el desglose se lea sin cambiar de URL. Ésa es la forma que reemplaza a las
  dos apps.
- ⚠️ **18.688 filas de 30 d tienen `surface` NULL** (15,5 %). Un filtro
  `surface=learn` las excluye. La página debe declararlo donde afirma el número,
  no en otra pantalla.

### Copy heredado del hotfix

`—` para lo no medible, aviso de integridad con el techo real, sello de snapshot
en vez de "Updated hourly", y el `asOf` del censo visible también cuando está
caído. **Todo eso ya existe en `ebdc5c1`: se porta, no se rediseña.**

### Dependencias

C.

### Tests

| Test | Qué fija |
|---|---|
| metadata | `robots: index:false, follow:false` + canonical `https://www.chesscito.com/stats` |
| sitemap | `/stats` **ausente** |
| pública | renderiza sin sesión, sin wallet, sin gate |
| filtros | los chips navegan preservando el otro filtro |
| desglose | la fila Learn/Play/Total suma al total |
| `—` | `null` nunca renderiza `0` |

### Rollback

Revert. `git revert` de un commit.

### Criterio de aceptación

- [ ] `https://www.chesscito.com/stats` renderiza el dashboard completo.
- [ ] Sin wallet, sin auth, `noindex`, fuera del sitemap.
- [ ] Learn/Play visibles sin cambiar de URL.

### Commit

```
feat(landing): render the public stats dashboard
```

---

## Fase E — Caché

### Archivos

| Archivo | Qué |
|---|---|
| `apps/landing/src/app/stats/page.tsx` | `revalidate = 900`, `unstable_cache` con tag `"public-stats"` |
| `apps/landing/src/app/api/revalidate-stats/route.ts` | **nuevo** — `revalidateTag`, protegido por token |

### Decisiones

| Eje | Valor | Por qué |
|---|---|---|
| `revalidate` | **900 s** | el TTL es un **piso**: con SWR la primera petición pasada la ventana todavía recibe la foto vieja. Medido: 5 h 22 min bajo `revalidate: 3600` |
| Tag | **`"public-stats"`**, único | ⛔ **nunca `"content"`** — ése es el catálogo de puzzles y ya causó un falso verde |
| Clave | `(surface, container)` | una entrada por combinación; `locale` **fuera** |
| Censo | entrada propia, `asOf` propio | dos relojes distintos, dos sellos distintos |
| Invalidación | `revalidateTag` vía Route Handler con token | ⚠️ **la Data Cache de Next NO se purga al desplegar** — un censo caído sobrevivió 18 h 34 min *y un deploy entero* |
| Fallback | `null` por campo → `—`, **nunca 0** | la página no 500ea |

### Tests

| Test | Qué fija |
|---|---|
| clave | dos combinaciones de filtros → dos entradas |
| `locale` | no aparece en la clave |
| tag | es `"public-stats"` y **no** `"content"` |
| Route Handler | sin token → 401; con token → invalida |
| degradado | un fallo cachea y **muestra su edad** |

### Rollback

`revalidateTag("public-stats")` y revert. **Un deploy no alcanza** — ése es el
punto del Route Handler.

### Criterio de aceptación

- [ ] Dos peticiones con filtros distintos → `generatedAt` independientes.
- [ ] El Route Handler refresca sin desplegar.
- [ ] Un fallo transitorio se ve en pantalla, con su edad.

### Commit

```
feat(landing): cache the stats snapshot under a single tag
```

---

## Fase F — Validación

**Sin código nuevo. Es la fase que decide si se puede redirigir.**

### Procedimiento

1. Correr el SQL de referencia (auditoría §21bis, consultas 1–8) contra la base.
2. Capturar `https://www.chesscito.com/stats` y extraer cada tarjeta.
3. Comparar **sobre la misma ventana**, tolerando sólo la deriva de minutos.
4. Repetir con `?surface=learn`, `?surface=play`, `?container=minipay`.
5. Confirmar: `noindex`, ausencia en el sitemap, sin wallet, sin auth.
6. Confirmar que el bloque on-chain **no cambió** respecto de hoy.
7. Escribir `docs/audits/2026-08-XX-stats-consolidation-validation.md`.

### Criterio de aceptación — **es el gate de la fase G**

- [ ] Cada tarjeta coincide con SQL.
- [ ] Cero em-dashes salvo los declarados como no medibles.
- [ ] Partición cerrada, embudo monótono, cohortes distintas de cero.
- [ ] Países en el **mismo orden** que el SQL (hoy KE sale 8.º y es 3.º).
- [ ] On-chain idéntico.

### Commit

```
docs(stats): validate the consolidated dashboard against SQL
```

---

## Fase G — Redirects

⚠️ **No empezar hasta que F esté verde.** El link del listing de MiniPay apunta
al destino: redirigir hacia una página a medias apunta el tráfico del reviewer a
un error.

### Archivos

| Archivo | Qué |
|---|---|
| `apps/web/next.config.js` | `async redirects()` |
| `apps/web/src/app/[locale]/stats/page.tsx` | **borrado** (lo cubre el redirect) |
| `apps/web/e2e/grant-shots.spec.ts` | repuntar al landing — **antes** del redirect |
| `apps/web/src/app/__tests__/redirects.test.ts` | **nuevo** |

### Las seis reglas

| Origen | Destino | Código |
|---|---|---|
| `learn…/stats` | `www.chesscito.com/stats?surface=learn` | **307** |
| `learn…/en/stats` | `…?surface=learn&locale=en` | **307** |
| `learn…/es/stats` | `…?surface=learn&locale=es` | **307** |
| `play…/stats` | `…?surface=play` | **307** |
| `play…/en/stats` | `…?surface=play&locale=en` | **307** |
| `play…/es/stats` | `…?surface=play&locale=es` | **307** |

**Reglas:**

1. Los query params entrantes se preservan enteros.
2. `surface` se inyecta **sólo si no viene**. Un `?surface=all` explícito gana.
3. **307, no 308.** Un 308 lo cachea el navegador de forma casi irreversible.
4. ⛔ **En `next.config.js`, no en el middleware** — el de `apps/web` es de
   `next-intl` y mezclar ruteo de idioma con migración de URLs los acopla.
5. Sin loops: `www` es otro proyecto y no reenvía.

### Tests

| Test | Qué fija |
|---|---|
| las 6 reglas existen y son 307 | |
| `?container=minipay` sobrevive | |
| `?surface=all` **no** es sobreescrito | |
| ningún destino apunta a `learn.` o `play.` | (imposibilidad de loop) |
| `/api/profile/stats` **no matchea** ninguna regla | comparte el substring y nada más |

### Rollback

Revert de `next.config.js`. **Como son 307, los navegadores no cachearon** — el
rollback es efectivo de inmediato. Con 308 no lo sería.

### Criterio de aceptación

- [ ] Las seis responden 307 al destino correcto.
- [ ] Los params sobreviven.
- [ ] `/api/profile/stats` intacto.

### Commit

```
feat(stats): redirect the app stats routes to the canonical page
```

---

## Fase H — Retirada del código antiguo

⚠️ **≥7 días después de G, y sólo si el monitor y el listing están limpios.**
Es el **punto de no retorno**.

### Archivos a borrar

```
apps/web/src/lib/stats/public-aggregator.ts
apps/web/src/lib/stats/funnels.ts
apps/web/src/lib/stats/onchain.ts
apps/web/src/lib/stats/players-census.ts
apps/web/src/lib/stats/filters.ts
apps/web/src/lib/stats/__tests__/**
apps/web/src/components/stats/**
```

### Lo que NO se borra

| | Por qué |
|---|---|
| `apps/web/src/app/api/profile/stats/**` | **es el perfil del jugador**, privado y por wallet. Comparte el substring `stats` y nada más |
| `apps/web/src/hooks/use-profile-stats.ts` | ídem |
| `apps/web/src/lib/supabase/queries.ts` | lo usan Leaders y el perfil |
| `apps/web/src/lib/identity/identity-lite.ts` | lo usa toda la app |
| `apps/web/src/app/sitemap.ts` + su test | el `/stats` ausente sigue siendo correcto |

### Además

- Promover los seis redirects **307 → 308**.
- **Añadir `chesscito-landing` al monitor `ops:health`.** Hoy está fuera, y pasa
  a alojar la única página de estadísticas del producto.

### Tests

Suite completa. `PLAYERS_TABLE_CEILING` y `fetchFullLeaderboardFromDb` **siguen
vivos** — los usa Leaders.

### Rollback

`git revert`. A partir de acá el rollback es de commit, no de configuración: si
hay dudas, **no ejecutar esta fase**.

### Criterio de aceptación

- [ ] 7 días sin incidentes en `/stats` ni en el listing.
- [ ] `pnpm -C apps/web exec tsc --noEmit` verde tras el borrado.
- [ ] Suite completa verde, **mirando la cola del log** — vitest sale non-zero
      por `Unhandled Errors` con 100 % verde.
- [ ] `chesscito-landing` aparece en `pnpm ops:health`.

### Commits

```
feat(stats): promote the stats redirects to permanent
chore(stats): remove the duplicated dashboards from web
feat(ops): monitor chesscito-landing
```

---

## Resumen

| Fase | Producción | Tests | SQL | Rollback | Gate |
|---|---|---|---|---|---|
| A · RPC | 0 | ~120 | ~260 | `drop function`, costo cero | — |
| B · cliente | ~60 | ~80 | 0 | borrar 2 envs | A |
| C · agregador | ~420 | ~380 | 0 | revert | A, B |
| D · UI | ~620 | ~300 | 0 | revert | C |
| E · caché | ~90 | ~120 | 0 | `revalidateTag` + revert | D |
| F · validación | 0 | 0 | 0 | — | E |
| G · redirects | ~50 | ~90 | 0 | revert (307 no se cachea) | **F verde** |
| H · retirada | **−1.100** | **−2.400** | 0 | revert | **G + 7 días** |
| **NETO** | **≈ −210** | **≈ −1.310** | **~260** | | |

**Puntos donde hay que detenerse y confirmar:**

1. **Antes de A** — es la primera migración de esta línea de trabajo.
2. **Antes de B** — añade la primera credencial de servicio a un proyecto que
   nunca tuvo secretos.
3. **Antes de G** — a partir de ahí el tráfico público cambia de destino.
4. **Antes de H** — punto de no retorno.

---

## Referencias

| Documento | Para qué |
|---|---|
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | causa raíz, contratos §13, consolidación §21 |
| §9 de la auditoría | la prueba del techo de 1.000 |
| §21.6 | las seis reglas de redirect, en detalle |
| `docs/runbooks/launch-health-monitor.md` | operar el monitor; §3bis, la topología |
