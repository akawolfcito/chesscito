# Fase C — agregador del landing alimentado por las ocho RPC · revisión

**Fecha:** 2026-08-04 · **Rama local:** `feat/stats-landing-aggregator`
**Base:** `978f47cb8eba9cb255b23c74ad8f28ea6c3f90b9` (= `origin/main`)
**Estado:** implementado y validado **enteramente en local**.
**Sin commit, sin push, sin deploy, sin preview remoto, sin cambios en Vercel.**

> **✅ Las ocho RPC responden correctas a través del runtime real, con cero
> fallos y todas las invariantes cerradas.** Agregador completo en **644–1.935 ms**.
> **Cero entradas en la Data Cache de Next** — el `no-store` está medido, no
> supuesto. Suite completa 7.283 / 592 · landing 140 / 18 · verificador 1.084 / 1.084.

---

## 1. Regla local-first — cumplida

| Restricción | Estado |
|---|---|
| Rama local `feat/stats-landing-aggregator` | ✅ creada, **nunca pusheada** |
| `vercel deploy` | ❌ no ejecutado |
| Preview remoto | ❌ no creado |
| Túneles | ❌ no usados |
| Probes publicados | ❌ ninguno — el probe fue local, gateado y **borrado** |
| Merge a main / promoción | ❌ no |
| Cambios en Vercel | ❌ ninguno |

**No hay ninguna comprobación pendiente que requiera un deploy remoto.** Todo lo
que el encargo pedía verificar se reprodujo con `next build` + `next start` +
llamadas reales a Supabase + escaneo de `.next`.

---

## 2. Archivos

Todos nuevos bajo `apps/landing/src/lib/stats/`, salvo el último.

| Archivo | Líneas | Qué |
|---|---|---|
| `aggregator.ts` | 262 | **nuevo** — las ocho RPC, mapeo y aislamiento de fallos |
| `types.ts` | 152 | **nuevo** — el contrato, port de `PublicStats` |
| `filters.ts` | 62 | **port literal** + `toRpcArg` (`"all"` → `null`) |
| `onchain.ts` | 285 | **port** — lógica intacta, tabla de tokens inlineada |
| `players-census.ts` | 151 | **port** + las dos queries que importaba de `lib/supabase/queries` |
| `identity.ts` | 109 | **port** de la mitad pura de `identity-lite` |
| `__tests__/aggregator.test.ts` | 287 | **nuevo** — comportamiento · **17 tests** |
| `__tests__/aggregator-source-guard.test.ts` | 186 | **nuevo** — guard de fuente · **20 tests** |
| `apps/landing/src/lib/supabase/server.ts` | +14 | **modificado** — `fetch` con `cache: "no-store"` |

**No tocado:** `apps/landing/src/app/stats/page.tsx`, las ocho RPC, migraciones,
redirects, consumidores de `apps/web`, `/api/profile/stats`, el monitor, la
telemetría, el cron, la retención, los índices y `SESSION.md`.

---

## 3. Resultado de las ocho RPC — runtime real, base de producción

Probe server-only local (`/api/phase-c-probe`, gateado por token aleatorio,
**borrado**), sobre el build de producción. `failedRpcs: []` en las cinco
combinaciones medidas.

```
installs      sessions_7d 4670 · sessions_30d 7175
              app_opens_rows_30d 5570 · app_open_sessions_30d 4719

activation    app_opened 4719 ≥ hub_viewed 4625 ≥ exercise_started 1446
              ≥ exercise_completed 629 ≥ daily_focus_completed 327     ✅ MONÓTONO

access        gate_viewed 96 · login_started 32 · login_succeeded 15
              wallet_ready 17 · first_exercise_completed 7 · failed 6

countries     NG 1737 · NL 812 · KE 320 · ZA 294 · ID 259 · BR 245 · UG 141 · CO 115
                                                        ⬅ KE TERCERA, su lugar real

retention     d1 66/4490 · d7 7/144 · week3 0/0

lifecycle     known 3655 · new_today 94 · new_7d 3649
              active_7d 3653 · dormant 2 · inactive 0 · resurrected_7d 0
              3653 + 2 + 0 = 3655 = known                            ✅ PARTICIÓN CIERRA

habit         1d:7175 · 3d:26 · 7d:15 · 14d:4 · 21d:0
              cohorte 7175 · mediana 1                               ✅ NO CRECIENTE

trend         30 filas · 30 fechas distintas · densa
              new + returning = sessions en LAS 30                   ✅
              2026-07-07 → 2026-08-05

onchain       usuarios únicos 187 · victorias 278 / 201 / 177        (sin cambios)
```

**Contraste con lo que la página publica hoy:** `App opened 37 < Hub viewed 41`,
`Inactive 962` contra un **0** real, y Kenia impresa octava con 1 sesión.

---

## 4. Tiempo total del agregador

Ocho RPC en paralelo (`Promise.all`) + el bloque on-chain (~15 consultas, su
propio `allSettled`) después.

| Filtros | ms |
|---|---|
| sin filtros — **primera llamada, caché frío** | **1.935** |
| sin filtros — en caliente | **1.331** |
| `surface=learn` | 930 |
| `surface=play` | 962 |
| `container=minipay` | 1.280 |
| `surface=play&container=browser` | 644 |

⚠️ **Esto es sin caché ninguna**, por política de esta fase. Cada request
ejecuta las ocho RPC más el bloque on-chain. Es aceptable para validar y **no lo
es para una página pública con tráfico** — ver riesgo #5.

---

## 5. Comportamiento con fallos parciales

Cada RPC está aislada: un fallo anula **su propio** campo, se nombra en
`dataIntegrity.failedRpcs`, y el resto de la página sobrevive.

| Caso | Resultado |
|---|---|
| Una RPC devuelve `error` | ese bloque `null`, las otras siete intactas, la RPC nombrada |
| Una RPC **rechaza la promesa** | idéntico — un `catch` cubre los dos caminos |
| Varias fallan a la vez | todas nombradas, el resto vive |
| A `stats_retention` le falta un bucket | bloque entero `null` — es un **contrato roto**, no una cohorte vacía |
| El bloque on-chain lanza | `EMPTY_ONCHAIN_STATS`, la página sigue |
| Una RPC devuelve **cero filas** | **NO es un fallo** — un ranking vacío es una respuesta real |

⛔ **En ningún camino se devuelve `0` en lugar de una medición fallida.** Un cero
afirma «nadie hizo esto»; `null` dice «no pudimos medirlo». Hay un test que lo
fija explícitamente.

### Sin envs

`getSupabaseServer()` devuelve `null` → `EMPTY_PUBLIC_STATS`: los ocho bloques en
`null`/`[]`, on-chain vacío, y aun así `generatedAt` real y los filtros
ecoados. **No lanza.** Borrar las dos variables sigue siendo un rollback
completo y sin deploy.

---

## 6. Caché — política cumplida y **medida**

`lib/supabase/server.ts` instala un `fetch` que fuerza `cache: "no-store"` en el
cliente que comparten todas las lecturas. Es la contramedida directa al hallazgo
de Fase B: `supabase-js` va por `fetch`, y Next 14 lo cachea por defecto dentro
de un Server Component — con una caché que **no se purga al desplegar**.

**No se introdujo** `unstable_cache`, `revalidate`, `revalidateTag` ni Route
Handler de invalidación. Hay cuatro tests que lo fijan.

> ⚠️ Consecuencia deliberada: **el port de `players-census.ts` dejó atrás su
> `unstable_cache`.** El fichero original lo trae; conservarlo habría violado la
> política de esta fase. El memoizer es trabajo de Fase E.

### La prueba

| Momento | `.next/cache/fetch-cache` |
|---|---|
| **Fase B**, un probe, sin `no-store` | **1 entrada** (contenía la URL de Supabase) |
| **Fase C**, 6 corridas del agregador ≈ **100+ fetches**, con `no-store` | **el directorio NO EXISTE** |

No queda ninguna entrada reutilizable de las RPC. Y el valor real de
`SUPABASE_URL`, que en Fase B aparecía una vez en esa caché, ahora aparece
**cero veces en todo `.next`**.

---

## 7. Escaneo de bundle — con el agregador en el grafo

Build de producción con el probe registrado (`ƒ /api/phase-c-probe`), es decir
con el módulo **realmente ejecutándose**, buscando los **valores reales**:

```
scanned 127 files under .next (32 under static/)

SUPABASE_URL (real value)                static/: 0   elsewhere: 0
SUPABASE_SERVICE_ROLE_KEY (real value)   static/: 0   elsewhere: 0
literal name SUPABASE_SERVICE_ROLE_KEY   static/: 0   elsewhere: 2
literal name SUPABASE_URL                static/: 0   elsewhere: 2
phase-b sentinel                         static/: 0   elsewhere: 0
any NEXT_PUBLIC_SUPABASE                 static/: 0   elsewhere: 0

RESULT: no credential reaches the browser bundle
```

**Cero valores en `.next/static`. La service role no aparece en ninguna parte de
`.next`. Ningún `NEXT_PUBLIC_SUPABASE_*`.** `/stats` sigue pesando 8,87 kB — no
se tocó.

---

## 8. Tests

| Verificación | Resultado |
|---|---|
| Tests dirigidos (`src/lib/stats`) | **37 passed** |
| Suite del landing | **140 passed / 18 files** (Fase B dejó 103 / 16 → **+37, +2**) |
| **Suite completa (`apps/web`)** | **7.283 passed / 592 files · exit 0** |
| `Unhandled Errors` | **0** (grep sobre el log entero) |
| `pnpm -C apps/landing exec tsc --noEmit` | **exit 0** |
| `pnpm -C apps/landing build` | **verde** |
| `verify-stats-rpcs.ts` | **1.084 / 1.084** |
| `git diff --check` | **exit 0** |

### El guard de fuente — 20 tests

Portado desde `public-aggregator-truncation.test.ts`, no reescrito. Falla si:

- alguna fuente de `lib/stats/**` consulta `analytics_events`,
  `account_first_seen` o `session_first_seen`;
- el agregador contiene un `.range(` o un `new Set(`;
- reaparece el `9999` en un archivo que consulta;
- reaparece la **prosa falsa** («explicit range bypasses», «dodge PostgREST»);
- alguien introduce caché en esta fase;
- el agregador nombra una función `stats_*` que no sea una de las ocho;
- `"all"` deja de traducirse a `null`.

⚠️ **Dos vistas del mismo archivo, a propósito.** Lo que el CÓDIGO no debe hacer
se comprueba sobre una copia **sin comentarios**, porque la prosa nombra
deliberadamente lo prohibido para explicar por qué está ausente. Lo que la PROSA
no debe afirmar se comprueba sobre el texto crudo, porque el comentario falso
**es** el artefacto: viajó entre dos archivos junto con la constante sobre la
que mentía. Hay un test que verifica que el stripper no se comió el cuerpo.

---

## 9. Riesgos

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **El embudo de acceso NO es monótono** | media | medido: `wallet_ready 17 > login_succeeded 15`. Es **correcto**: `stats_access_funnel` conserva a propósito los pasos independientes del `computeAccessFunnel` original, a diferencia de la activación que sí es monótona por álgebra. **Fase D no debe dibujarlo como embudo estricto** ni el lector concluirá que hay un bug |
| 2 | **`learn` + `play` ≠ sin filtros** | media | 1.741 + 3.052 = 4.793 contra 7.175. Son el **15,5 % de filas con `surface` NULL**, que un filtro no-null excluye. **Declararlo en la MISMA superficie donde se afirma el número** |
| 3 | **`week3` devuelve cohorte 0 y lo hará hasta ~2026-08-20** | media | `session_first_seen` nació el 2026-07-23. La RPC devuelve la fila con `cohort: 0` justamente para que la UI distinga «cohorte vacía» de «nadie volvió». Hay un test que impide que el mapeo la descarte |
| 4 | **`mints` desapareció del contrato del trend** | media | la RPC no lo devuelve, y recuperarlo exigiría un `.range()` sobre `victories` — justo lo que esta fase elimina. El total de mints ya vive en su propia tarjeta. **Fase D tiene que rediseñar ese panel, no portarlo** |
| 5 | **Cero caché: cada request son 8 RPC + ~15 consultas on-chain** | **alta si se publica así** | 644–1.935 ms por request. Es la política correcta para validar y **inaceptable para tráfico público**. Fase E es un prerrequisito para exponer esto, no una mejora opcional |
| 6 | **`players-census.ts` viajó SIN su `unstable_cache`** | media | consecuencia buscada de la política de caché. Quien lea el original y el port lado a lado verá la diferencia; está documentada en la cabecera del archivo. **Restaurarlo es tarea de Fase E** |
| 7 | **`appOpensRows30d` cuenta FILAS, no sesiones** | media | hereda el 8,6 % de duplicados exactos de `analytics_events`. La migración lo declara aproximado; la superficie que lo imprima debe decirlo también |
| 8 | **El bloque on-chain se `await`ea DESPUÉS de las ocho** | baja | secuencial, suma ~300–600 ms. Se puede paralelizar; no lo hice porque cambia el perfil de concurrencia contra la Micro y esta fase no tenía presupuesto medido para eso |
| 9 | **`identity.ts` es una COPIA de la derivación de `apps/web`** | media | si una de las dos cambia, el mismo wallet produce avatares distintos en Play y en la tabla pública. Las constantes FNV y el encoder UTF-8 se copiaron verbatim por eso, pero **no hay test cruzado entre apps** que lo detecte |
| 10 | **production y preview comparten la MISMA base** | media | toda cifra es la suma de los dos entornos |
| 11 | **`census.total` sigue sin explicación** | media | intacto. **No cerrar `/stats` sin trazarlo** |

---

## 10. `git status --short` al cierre

```
 M SESSION.md
 M apps/landing/src/lib/supabase/server.ts
?? apps/landing/src/lib/stats/
```

Rama `feat/stats-landing-aggregator`, **local**. Nada stageado, nada commiteado.
El probe, el `.next` y los archivos temporales de credenciales ya no existen.

---

## 11. NEXT ACTION

> Revisar Fase C. Si se aprueba, crear un commit local. Evaluar continuar con
> Fase D en la misma rama y desplegar C+D juntos, para evitar un build remoto
> intermedio. No pushear hasta decisión explícita del founder.

Commit sugerido cuando se apruebe:

```
feat(landing): aggregate public stats from server-side RPCs
```

---

## 12. Referencias

| Documento | Para qué |
|---|---|
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **Fase D empieza acá** |
| `docs/handoffs/2026-08-05-stats-phase-b-post-env.md` | cliente server-only, variables, el hallazgo de la Data Cache |
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | contratos §13, SQL de referencia §22 |
| `scripts/ops/verify-stats-rpcs.ts` | la única red de las RPC hasta que algo en producción las llame |
