# Auditoría de portabilidad — Sesión B sobre `origin/production` (2026-08-05)

**Base:** `origin/production` = `b3281c5c` · **Origen:** `origin/main` = `374ee7ea`
**Worktree de auditoría:** rama `audit/session-b-on-production`. **Nada pusheado.**

---

## Corrección al inventario

La orden habla de "los cuatro commits funcionales de Sesión B". Son **tres**; los otros
dos son documentales y no hacen falta para compilar:

| Commit | Tipo | ¿Se porta? |
|---|---|---|
| `20016cbd` `fix(analytics): separate daily and training activation funnels` | funcional | ✅ |
| `3157900c` `fix(analytics): dedupe accepted pro purchase attempts` | funcional | ✅ |
| `990b527c` `feat(onboarding): start first activity after tour, instrumented` | funcional | ✅ |
| `2666a499` `docs(handoff): close onboarding experiment session` | docs | excluido |
| `374ee7ea` `docs(handoff): record the production execution of session B` | docs | excluido |

---

## Resultado del cherry-pick

| # | Commit portado | Conflictos |
|---|---|---|
| 1 | `1d2ac2d1` ← `20016cbd` | **2**, ambos modify/delete |
| 2 | `b2491561` ← `3157900c` | **0** |
| 3 | `2ed244ac` ← `990b527c` | **0** |

### Conflictos — ninguno es de contenido

Los siete archivos fuente de `20016cbd` aplicaron **limpios**. Los dos conflictos son
`modify/delete`: archivos que **no existen** en `production`.

| Archivo en conflicto | Lo aporta | ¿Compila sin él? |
|---|---|---|
| `apps/web/supabase/migrations/__tests__/stats-rpc-privileges.test.ts` | `b0e3190b feat(stats): add server-side aggregation RPCs` | Sí |
| `docs/audits/2026-08-05-daily-focus-activation-d1.sql` | `1c892eb2 docs(analytics): add reproducible daily focus activation query` | Sí (es un `.sql` de documentación) |

Resueltos tomando la versión entrante; los dos entraron enteros.

**Nada sorprendente en el #3**, y vale decir por qué: `990b527c` es **puramente aditivo**
(1.219 inserciones, 0 borrados). Toca `learn-hub-client.tsx` y `use-hub-tour.ts`, que en
`production` están 29 commits atrás, pero como no borra ni reescribe nada, los hunks no
se solapan.

### Imports o APIs inexistentes

**Ninguno.** `tsc --noEmit` exit 0.

### Cambios de env

**Ninguno obligatorio.** La única variable nueva es
`NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT`, y **su ausencia es el estado deseado**
(→ 0 % → control). No hay que tocar Vercel para desplegar esto.

### Migraciones requeridas

Ninguna que aplicar: `20260805020000` **ya está aplicada** en producción (Etapa 2).

⚠️ Pero deja una inconsistencia: la rama portada llevaría `20260805020000` **sin** sus dos
predecesoras (`20260805000000`, `20260805010000`), que sí están aplicadas en la base. La
rama `production` ya arrastra esa desincronización hoy; esto la profundiza.
**Nadie debe correr `supabase db push` desde `production`** — las migraciones se aplican
desde `main`.

---

## ⛔ La dependencia material: `b0e3190b`

Todo compila y todo pasa sin ella. **Igual la considero bloqueante**, y el motivo no es
de compilación.

`b0e3190b feat(stats): add server-side aggregation RPCs` aporta dos cosas:

1. `20260805000000_stats_aggregation_rpcs.sql` — la migración de las 8 RPC. **Ya aplicada
   en la base de producción**, pero ausente del árbol de `production`.
2. **La línea del `vitest.config.ts` que hace que los guards de migración se ejecuten.**

Ese segundo punto es el problema. El `vitest.config.ts` de `production` incluye:

```
src/**/__tests__/**/*.test.{ts,tsx}
scripts/**/__tests__/**/*.test.{ts,tsx}
../../scripts/ops/**/__tests__/**/*.test.ts
```

**No incluye `supabase/migrations/__tests__/**`.** Verificado empíricamente: correr
`vitest run supabase/migrations` en la rama portada devuelve `No test files found`.

O sea: yo porté 554 líneas de guard (`stats-rpc-privileges.test.ts`) y en `production`
**no las colecta nadie**. El comentario que `main` tiene junto a esa línea lo dice con
todas las letras:

> *"Without this line the files are silently never collected — a guard that does not run
> is the failure mode these guards exist to prevent."*

Y hay un segundo guard ausente: `apps/web/src/lib/supabase/__tests__/privileged-views-schema.test.ts`
(el que detecta **prefijos de migración duplicados**, y que existe justamente porque esa
colisión ya rompió un despliegue de seguridad el 2026-08-05). Lo aporta `083094b2`, que
tampoco está en `production`.

**Portar el código sin `b0e3190b` deja a `production` con dos guards que parecen estar y
no corren.** Es exactamente el modo de falla que estas dos sesiones vinieron arreglando.

### Inventario mínimo de dependencias

| Commit | Por qué | ¿Material? |
|---|---|---|
| `b0e3190b feat(stats): add server-side aggregation RPCs` | el glob de vitest + la migración ya aplicada | **Sí** |
| `083094b2 fix(db): close public access to privileged views` | guard de prefijos duplicados + migración ya aplicada | **Sí** |
| `5c03d581 fix(db): give the privileged-views migration a unique version` | renombra la migración de `083094b2` | Sí, si entra `083094b2` |
| `1c892eb2 docs(analytics): …activation query` | sólo el `.sql` de docs | No |

Y esos cuatro arrastran sus propios ancestros. **Por eso no fuerzo el cherry-pick.**

---

## Verificación de la rama portada

| Qué | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** |
| Analytics + stats focal | **241/241** |
| Onboarding + hub + daily | **778/778** |
| PRO + payments + verify-payment | **507/507** |
| **Suite completa** | **7.263/7.263 · 592/592 archivos** |
| `pnpm build` | **exit 0** |
| `vitest run supabase/migrations` | ⛔ **`No test files found`** — ver arriba |

> Referencia: en `main` la suite da 7.384/595. La diferencia (121 tests, 3 archivos) es
> la brecha de 29 commits más los guards que no se coleccionan.

## Comportamiento con el flag ausente o en 0

| Requisito | Evidencia |
|---|---|
| Todo usuario en control | `onboardingFirstActivityRolloutPct()` → 0 sin la variable; `assignOnboardingVariant(id, 0)` → `"control"` para todos. Tests corridos **sin stub de env**: pasan |
| Learn preserva comportamiento | El único camino nuevo sale de `onFinished` del tour, y con `variant === "control"` `decideFirstActivity` devuelve `start: false` |
| **Play preserva comportamiento** | `git diff` sobre `play-hub-client.tsx`, `hub-daily-tile.tsx` y `components/daily/` → **vacío**. Bit a bit idéntico |
| `/stats` con la RPC ya aplicada | **Cero call sites** a `stats_activation_funnel` / `stats_daily_focus_funnel` en `src/`; sólo un comentario en `funnels.ts`. `/stats` calcula en TypeScript, así que la RPC aplicada no lo afecta |
| Daily manual funciona | `hub-daily-tile.tsx` sin cambios; el sheet controlado ya existía para el Focus Passport |
| Sin dependencia de BalanceReadHealth | `grep` de `BalanceReadHealth` / `balance-unreadable` → **0 hits** en código de producto. Los `refetchBalances` que aparecen son POCs preexistentes en `/dev`, no tocados |

---

## Diff final contra `origin/production`

21 archivos. Idéntico a lo que los tres commits tocan en `main`, más los dos archivos que
entraron enteros por no existir (`stats-rpc-privileges.test.ts` 554 líneas,
`daily-focus-activation-d1.sql` 321).

```
 140 +    apps/web/src/components/hub/learn-hub-client.tsx
  30 +    apps/web/src/components/hub/use-hub-tour.ts
  50 -4   apps/web/src/components/stats/stats-page.tsx
  73 -6   apps/web/src/lib/analytics/canonical-events.ts
 145 +    apps/web/src/lib/onboarding/first-activity-experiment.ts
 126 +    apps/web/src/lib/onboarding/telemetry.ts
  19 -1   apps/web/src/lib/pro/use-pro-rail.ts
  16 -6   apps/web/src/lib/pro/use-pro-sheet-state.ts
  53 -4   apps/web/src/lib/stats/funnels.ts
  19 -2   apps/web/src/lib/stats/public-aggregator.ts
 284 +    apps/web/supabase/migrations/20260805020000_…sql
 + 9 archivos de test y 1 de docs
```

---

# Recomendación: **NO portar por cherry-pick. Reconciliar las ramas.**

El código porta limpio y queda verde, así que la opción de cherry-pick existe. **No la
recomiendo**, por una razón: dejaría dos guards de migración instalados y silenciosamente
no ejecutados, y agravaría la divergencia rama/base. El inventario mínimo para hacerlo
bien son cuatro commits más, con sus ancestros — a esa altura conviene reconciliar.

## La reconciliación es más barata de lo que parece — y está probada

**`main` es superconjunto estricto de `production`.** No es una impresión, está medido:

```
$ git cherry origin/main origin/production
- 5a5e3e09b506572f6742332a6af002f6a13f7ef6
- b3281c5c11d2daade4cb7f60331ccd9def03ab94
```

Los dos `-` significan que **los parches de ambos commits de `production` ya están en
`main`** (por patch-id): son cherry-picks de `fbbe33ff` y `4d2d4eaf`, que viven en `main`.
Y ningún archivo existe en `production` y falta en `main`.

**No hay nada que rescatar del lado de `production`. El hotfix no se pierde.**

### Procedimiento propuesto, ya ensayado

1. `git merge origin/production` sobre `main`.
   Conflictúa en **dos** archivos: `use-pro-rail.ts` y `use-pro-rail.test.ts` — porque
   `main` los modificó después (el dedupe `onAccepted`) sobre el mismo mutex.
2. Resolver **con la versión de `main`** en los dos (`git checkout --ours`). Es correcto:
   `main` tiene mutex **y** dedupe; `production` sólo el mutex.
3. Commitear el merge.

**Ensayado en un worktree descartable:** tras la resolución, el árbol queda
**byte-idéntico a `origin/main`** (`git diff origin/main` → vacío). El merge es un no-op
de contenido; sólo registra en la historia que los cherry-picks quedaron incorporados.

4. `git push origin main:production` — ya como fast-forward real, sin `--force`.
5. Deploy: los dos proyectos construyen desde `production`.

### Qué desplegaría eso

Los 29 commits de la brecha: Sesión B completa, los P0 de Sesión A por su ruta original,
el rework de IA de `/stats`, el script de revenue on-chain, y los guards que hoy no
corren. **Es un deploy grande** — pero es el que la rama viene debiendo desde el
2026-08-04, y hoy sabemos que `production` sólo se descubre rota cuando alguien la toca.

---

# Plan de deploy con 0 %, si igual preferís portar

Aplica sólo si decidís cherry-pick en vez de reconciliación.

1. Traer también `b0e3190b` y `083094b2` + `5c03d581` (inventario mínimo de arriba), o
   asumir explícitamente que los dos guards no corren en `production`.
2. **No tocar ninguna variable de entorno.** La ausencia de
   `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` es el 0 %.
3. Push a `production`.
4. Esperar los dos deploys y confirmar en el log que
   `[should-build] BUILD — turbo-ignore reports this workspace is affected`.
5. Smoke: learn / lite / play / `/stats` en ambos / `/exercises` / `/api/peones/balance`.
6. Confirmar que ningún evento `onboarding_variant_assigned` con
   `variant: "first-activity"` aparece en las primeras horas. Si aparece, el flag se
   coló en algún entorno: **poner 0 y redeployar**.
7. **Parar.** El 10 % es una decisión aparte.

## Rollback

- Experimento: la variable ausente ya es 0 %. Nada que apagar.
- Código: `git revert` de los tres commits portados, o `git push origin
  b3281c5c:production --force-with-lease` para volver al estado actual desplegado.

---

## Estado al cerrar la auditoría

| | |
|---|---|
| `origin/main` | `374ee7ea` |
| `origin/production` | `b3281c5c` (sin tocar) |
| Rama de auditoría | `audit/session-b-on-production`, local, **sin pushear** |
| Flag de la variante | ausente → 0 % → control |
| Etapa 3 | **no arrancó** |
