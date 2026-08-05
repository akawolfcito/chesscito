# Fase D — dashboard público consolidado en el landing · revisión

**Fecha:** 2026-08-04 · **Rama local:** `feat/stats-landing-aggregator`
**SHA local de Fase C:** `ebbd303` — `feat(landing): aggregate public stats from server-side RPCs`
**Estado:** implementado y validado **enteramente en local**.
**Sin commit de Fase D, sin push, sin deploy, sin preview remoto, sin túnel, sin merge.**

> **✅ El selector de dos botones ya no existe: `/stats` renderiza el dashboard
> completo alimentado por las ocho RPC.** Una sola URL canónica, `noindex,
> nofollow`, fuera del sitemap, sin wallet y sin auth. **Cero em-dashes como
> valor de métrica** con datos vivos, y **cero ceros falsos** con los datos
> caídos. Landing 165 / 19 · web 7.283 / 592 · verificador 1.084 / 1.084.
>
> ⛔ **NO se puede publicar todavía** — el agregador sigue sin caché. Ver §11.

---

## 1. Archivos de Fase D

| Archivo | Líneas | Qué |
|---|---|---|
| `src/app/stats/page.tsx` | **reescrito** (102) | el selector desaparece; lee filtros + locale y compone |
| `src/components/stats/stats-dashboard.tsx` | 434 | **nuevo** — la página, una sola columna, mobile-first |
| `src/components/stats/primitives.tsx` | 243 | **nuevo** — `StatCard`, `Bar`, `RetentionRow`, `Callout`, `ScrollBox` |
| `src/components/stats/filter-chips.tsx` | 116 | **nuevo** — chips + `buildStatsHref` |
| `src/lib/stats/copy.ts` | 309 | **nuevo** — EN/ES completo |
| `src/lib/stats/locale.ts` | 49 | **nuevo** — `Accept-Language` + `?locale=` |
| `src/lib/stats/aggregator.ts` | +47 | `getSurfaceBreakdown()` para la fila Learn/Play/Total |
| `src/lib/stats/step-labels.ts` | 106 | **nuevo** — mapeo editorial EN/ES + fallback |
| `src/lib/stats/__tests__/presentation.test.ts` | 176 | **nuevo** — **28 tests** |
| `src/lib/stats/__tests__/step-labels.test.ts` | 118 | **nuevo** — **11 tests** |
| `src/lib/stats/__tests__/steps-match-migration.test.ts` | 78 | **nuevo** — guard contra la migración · **5 tests** |
| `src/app/stats/__tests__/stats-page-metadata.test.ts` | reescrito (50) | canonical, sitemap, sin alternates de idioma |

### Corrección obligatoria aplicada — etiquetas editoriales

Los nombres técnicos de eventos **ya no llegan a pantalla**. Las claves de las
RPC viajan intactas (`dataIntegrity`, tests y cualquier export futuro siguen
hablando el idioma del esquema); la traducción vive en presentación.

```
EN  App opened · Hub viewed · Exercise started · Exercise completed ·
    Daily focus completed · Access screen viewed · Sign-in started ·
    Sign-in completed · Wallet ready · First exercise completed
ES  App abierta · Centro visto · Ejercicio iniciado · Ejercicio completado ·
    Enfoque diario completado · Pantalla de acceso vista ·
    Inicio de sesión comenzado · Inicio de sesión completado ·
    Wallet lista · Primer ejercicio completado
```

Una clave desconocida **nunca se imprime literalmente**: cae a `Unknown step` /
`Paso desconocido`.

### 🔬 La corrección destapó un defecto real: `gate_viewed` ≠ `web_access_gate_viewed`

El encargo listaba `web_access_gate_viewed` para el primer checkpoint. **La RPC
no emite eso.** La migración dice, en la línea 295:

```sql
select 1 as ord, 'gate_viewed'::text as step,
```

`web_access_gate_viewed` es el **evento de analytics** del que el SQL selecciona
la cohorte; `gate_viewed` es la **etiqueta del paso** que devuelve la función.
Mapear sólo el nombre del evento imprimió **«Unknown step» en el primer
checkpoint de una página pública** — y todos los tests unitarios pasaban en
verde, porque afirmaban contra la misma lista equivocada que yo había escrito.

Lo detectó la comprobación contra el HTML servido, no la suite. Por eso añadí
**`steps-match-migration.test.ts`**: lee el `.sql`, extrae los literales de los
dos bloques `steps as (...)`, y falla si alguno no tiene etiqueta en alguna de
las dos lenguas. También falla si el mapa acumula una clave muerta — con
`web_access_gate_viewed` declarado explícitamente como el único alias
permitido.

**Verificado sobre el HTML servido, tras reconstruir:**

```
EN | claves técnicas visibles: 0 | etiquetas presentes: 10/10 | fallback: no
ES | claves técnicas visibles: 0 | etiquetas presentes: 10/10 | fallback: no
```

Ningún `snake_case` aparece en el texto visible de ninguna de las dos lenguas.

**No tocado:** `apps/web`, redirects, las ocho RPC, migraciones,
`/api/profile/stats`, el monitor, la telemetría, el cron, la retención, los
índices y `SESSION.md`.

---

## 2. Contrato de URL — verificado sobre el HTML servido

```
title              Stats — Chesscito
robots             noindex, nofollow          ✅ en las tres variantes
canonical          https://www.chesscito.com/stats
alternates.languages   ausente                ✅ un hreflang re-anunciaría las dos URLs que el canonical niega
sitemap            /stats ausente             ✅
wallet / auth      ninguna referencia         ✅ público
```

`/stats` sigue **fuera del matcher del middleware** de next-intl, así que no
existe `/en/stats` ni `/es/stats`. La ruta pasó de `○ (Static)` a
`ƒ (Dynamic)` — correcto: `force-dynamic`, sin caché en esta fase.

---

## 3. Locale — por cabecera, con override

| Petición | Resultado |
|---|---|
| sin `Accept-Language` | **EN** (título «Chesscito Stats», «Summary») |
| `Accept-Language: es-CO,es;q=0.9` | **ES** — «Estadísticas de Chesscito», **7 de 7 secciones traducidas** |
| `?locale=en` con cabecera `es-CO` | **EN** — el override gana |

Cubierto además por tests: orden de calidad respetado, match por tag base
(`es-CO` → `es`), idiomas que no servimos se saltean en vez de cortar la
búsqueda, y **un `?locale=` inválido cae a la cabecera en vez de romper** — un
query param malo nunca debe poder blanquear una página pública.

⚠️ **`locale` NO entra en la clave de datos.** `parseStatsFilters` lo ignora por
completo (hay un test que verifica que las claves del filtro son exactamente
`surface` y `container`), y `buildStatsHref` sólo lo propaga cuando fue
**elegido explícitamente** — si no, cada link compartido se convertiría en un
candado de idioma. Fase E hereda esa separación en su clave de caché.

---

## 4. Filtros — medidos sobre los `href` renderizados

| URL | Chips activos | Los chips del otro eje |
|---|---|---|
| `?surface=learn` | Learn · All | `…?surface=learn&container=minipay` ✅ preserva surface |
| `?surface=play&container=minipay` | Play · MiniPay | `…?surface=learn&container=minipay` y `…?surface=play&container=browser` ✅ preservan el otro |

`all` se omite de la URL (canónica limpia) y el chip «All» de surface con
MiniPay activo apunta a `/stats?container=minipay` — **suelta su eje y conserva
el otro**, que es lo correcto. Valores inválidos colapsan a `all`
(`?surface='; drop table` → `all`).

---

## 5. Presentación de cada bloque

### Activation — funnel estricto ✅
`4.755 ≥ 4.660 ≥ … ` con barras a escala común. La nota lo dice: *«cada paso
cuenta solo las sesiones que completaron todos los anteriores»*.

### Access — **checkpoints, no funnel** ✅
Cajas **independientes**, sin línea de continuidad, sin descenso forzado.
Medido en pantalla: `login succeeded 15` y debajo `wallet ready 17` **con la
barra más larga**, y no se lee como error porque la nota está arriba:

> *«These are checkpoints, not a strict funnel. A session can reach a later
> checkpoint without recording an earlier one, so a number here may be higher
> than the one above it. That is expected, not an error.»*

`Sessions with a sign-in error: 6` va **al lado**, nunca restado de un paso.

### Retention — `cohort = 0` ✅
`Days 15–21 → «Not enough history yet»`. **Nunca 0 %.** Verificado en pantalla
y con test. Las bandas con cohorte real sí muestran porcentaje + `66 of 4,490`.

### Learn / Play / Total ✅
Tabla de tres filas, y **la explicación pegada debajo**, en la misma superficie
donde se afirma el número:

> *«Learn and Play exclude activity without a recorded surface, so their sum may
> be lower than Total.»*

Medido: Learn 1.752 + Play 3.077 = 4.829 contra Total 7.211. **No se creó
categoría «Unknown».**

### Activity trend ✅
Sólo `sessions`, `new installs`, `returning`. **Sin mints y sin ninguna consulta
adicional para recuperarlos** — viven en el bloque de Celo.

### App opens rows ✅
Etiquetado **en la tarjeta**: `App open events (30d) (approx.)`, con el motivo
debajo — cuenta eventos y el flujo tiene duplicados exactos.

### Saved on Celo ✅
Cero «on-chain», cero «NFT», cero «mint» en toda la copy (test que barre las dos
lenguas y lo prohíbe por regex).

---

## 6. Fallos parciales — los dos caminos, medidos

### A · sin envs (cliente `null`)

```
HTTP 200 · 55.938 bytes
em-dashes en el body     : 26
aviso de integridad      : NO      ⬅ correcto: nada FALLÓ, no había cliente
players unavailable      : sí
algún 0 como valor       : NO
secciones presentes      : 7 de 7
```

### B · las ocho RPC caídas (host inalcanzable)

```
HTTP 200 · 57.498 bytes · sin 500
aviso de integridad      : SÍ
RPC nombradas            : las OCHO, por nombre
em-dashes en el body     : 27
algún 0 como valor       : NO
secciones presentes      : 7 de 7
```

La distinción importa y está construida a propósito: **«no había con qué medir»
no es lo mismo que «lo intentamos y falló»**, y sólo el segundo caso levanta el
aviso. Ninguno de los dos imprime un `0`.

### Con datos vivos

**4 em-dashes en toda la página, y los cuatro son PROSA** (el guion del título y
tres guiones tipográficos dentro de frases explicativas). **Ninguna métrica
renderizó em-dash.**

`generatedAt` se imprime al pie; el censo lleva **su propio sello** (`Players
list as of …`) porque envejece en otro reloj, y cuando el read de filas falla
muestra su mensaje en vez de un total inventado. `census.total` conserva `null`
si no resuelve.

---

## 7. Diseño — desktop y móvil

| Viewport | `body.scrollWidth` | overflow horizontal | alto | secciones | cajas con scroll propio |
|---|---|---|---|---|---|
| **390 px** (MiniPay) | 390 | **NO** | 6.794 px | 12 | 3 |
| **1280 px** | 1280 | **NO** | 6.124 px | 12 | 3 |

**El body nunca hace scroll horizontal**; las tres tablas largas (desglose,
trend de 30 filas, censo) scrollean **dentro de su propia caja**. Capturas en el
scratchpad: `stats-mobile.png`, `stats-mobile-access.png`, `stats-desktop.png`.

Orden: **resumen arriba → secciones → metodología al final**. Sin tabs — una
tab sería una ruta, y `/stats` tiene que seguir siendo una sola URL canónica.
Identidad visual **sin rediseñar**: se reusan los tokens `--landing-*` /
`--paper-*` y `fantasy-title` que ya usaba la página.

⚠️ **6.794 px de alto en móvil es largo.** Es la consecuencia de meter 12
secciones en una página sin tabs; la tabla de 30 días es la mitad. Anotado como
riesgo, no resuelto (ver §10 #4).

---

## 8. Bundle y caché

```
scanned 121 files under .next (32 under static/)

SUPABASE_URL (real value)                static/: 0   elsewhere: 0
SUPABASE_SERVICE_ROLE_KEY (real value)   static/: 0   elsewhere: 0
literal name SUPABASE_SERVICE_ROLE_KEY   static/: 0   elsewhere: 2
literal name SUPABASE_URL                static/: 0   elsewhere: 2
any NEXT_PUBLIC_SUPABASE                 static/: 0   elsewhere: 0

RESULT: no credential reaches the browser bundle
```

**`.next/cache/fetch-cache` sigue sin existir** tras renderizar la página
completa varias veces en dos idiomas y cinco combinaciones de filtro. El
`no-store` de Fase C aguanta con el consumidor real conectado.

Todos los componentes son **server components** — la página no tiene ni un
`"use client"`, así que no hay superficie por la que un env pueda viajar.

---

## 9. Validación

| Verificación | Resultado |
|---|---|
| Tests dirigidos (`src/lib/stats`) | **77 passed** |
| Suite del landing | **183 passed / 21 files · 0 skipped** (Fase C dejó 140 / 18) |
| ⚠️ Los guards de `.next/static` | **corridos**, no salteados: la suite se ejecutó **después** del build |
| `pnpm -C apps/landing exec tsc --noEmit` | **exit 0** |
| `pnpm -C apps/landing build` | **verde** · `/stats` ahora `ƒ` |
| `next start` local + navegación | **HTTP 200** en las 3 variantes de locale y las 5 de filtro |
| **Suite completa (`apps/web`)** | **7.283 passed / 592 files · exit 0** |
| `Unhandled Errors` | **0** |
| `verify-stats-rpcs.ts` | **1.084 / 1.084** |
| `git diff --check` | **exit 0** |
| Scan de secretos | **0 hits** |

---

## 10. Riesgos

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **Sin caché: cada visita ejecuta 11 RPC + ~15 consultas on-chain + el censo** | **alta — bloqueante para publicar** | son las 8 del dashboard **más 3** de `getSurfaceBreakdown`. Primera carga medida: **2,38 s**. Fase E es prerrequisito |
| 2 | **`getSurfaceBreakdown` añadió 3 llamadas** | media | son a UNA sola RPC (`stats_install_counts`), no tres agregaciones completas, pero es +37 % de llamadas por render. Con caché es irrelevante; sin caché no |
| 3 | ~~**Los pasos se muestran con su nombre técnico**~~ | — | **CERRADO** con el mapeo editorial EN/ES. Verificado sobre el HTML: 0 claves técnicas, 10/10 etiquetas, sin fallback |
| 4 | **6.794 px de alto en móvil** | media — **optimización posterior, no bloqueo** | 12 secciones sin tabs. La tabla de 30 filas es la mitad. **Decisión del founder: no rediseñar el trend como gráfico en esta fase**; conserva su scroll interno, sin componente cliente, sin tabs, sin rutas nuevas |
| 5 | **El censo renderiza hasta 50 filas de 500** | baja | corte arbitrario mío para contener el alto. `census.total` sigue diciendo la población real, así que el número no miente — pero la tabla no es el censo completo que su nombre promete |
| 6 | **`census.total` sigue sin explicación** | media | intacto desde la auditoría. **No declarar `/stats` cerrada sin trazarlo** |
| 7 | **`week3` seguirá en «Not enough history yet» hasta ~2026-08-20** | media | correcto y explicado en pantalla, pero un revisor de MiniPay que mire antes verá una tarjeta sin número |
| 8 | **production y preview comparten base** | media | declarado en la metodología, al pie |
| 9 | **`identity.ts` sigue siendo una copia de la derivación de `apps/web`** | media | sin test cruzado entre apps. Si una cambia, el mismo wallet muestra otro avatar en cada superficie |

---

## 11. NEXT ACTION

> **Implementar Fase E localmente antes de cualquier push o deploy. Después
> validar C+D+E juntos y realizar un único deployment.**

⛔ **Aunque Fase D esté verde, NO se publica.** El agregador sigue sin caché y
la página ejecuta once RPC por visita.

Commit sugerido cuando se apruebe Fase D:

```
feat(landing): render the public stats dashboard
```

---

## 12. `git status --short` al cierre

```
 M SESSION.md
 M apps/landing/src/app/stats/__tests__/stats-page-metadata.test.ts
 M apps/landing/src/app/stats/page.tsx
 M apps/landing/src/lib/stats/aggregator.ts
?? apps/landing/src/components/stats/
?? apps/landing/src/lib/stats/__tests__/presentation.test.ts
?? apps/landing/src/lib/stats/copy.ts
?? apps/landing/src/lib/stats/locale.ts
```

Rama `feat/stats-landing-aggregator`, **local**. Nada stageado. El `.next`, los
scripts temporales y los archivos de credenciales ya no existen.

---

## 13. Referencias

| Documento | Para qué |
|---|---|
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **Fase E empieza acá** |
| `docs/handoffs/2026-08-05-stats-phase-c-aggregator-review.md` | el agregador y sus invariantes |
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | contratos §13, SQL de referencia §22 |
