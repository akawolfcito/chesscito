# Fase E — una sola capa deliberada de caché · revisión

**Fecha:** 2026-08-04 · **Rama local:** `feat/stats-landing-aggregator`
**SHA local de Fase C:** `ebbd3035` — `feat(landing): aggregate public stats from server-side RPCs`
**SHA local de Fase D:** `f4c71e0` — `feat(landing): render the public stats dashboard`
**Estado:** implementado y validado **enteramente en local**.
**Sin commit de Fase E, sin push, sin deploy, sin preview remoto, sin túnel, sin merge, sin cambios en Vercel.**

> **✅ Un hit de caché cuesta 27 ms contra 1.985 ms de regeneración — 74×.**
> Cero RPC, cero consultas on-chain, cero lecturas de censo en un hit. `en` y
> `es` comparten entrada. La invalidación por token funciona y el endpoint
> **falla cerrado**. Landing 216 / 23 · web 7.283 / 592 · verificador 1.084 / 1.084.

---

## 1. Archivos de Fase E

| Archivo | Líneas | Qué |
|---|---|---|
| `src/lib/stats/snapshot.ts` | 152 | **nuevo** — la ÚNICA capa de caché: TTL, clave, tag, dos loaders |
| `src/app/api/revalidate-stats/route.ts` | 74 | **nuevo** — invalidación con token server-only |
| `src/app/api/revalidate-stats/__tests__/route.test.ts` | 148 | **nuevo** — **15 tests** |
| `src/lib/stats/__tests__/snapshot-cache.test.ts` | 268 | **nuevo** — **18 tests** |
| `src/lib/stats/__tests__/aggregator-source-guard.test.ts` | modificado | el guard de Fase C se **acota**, no se borra |
| `src/app/stats/page.tsx` | modificado | consume los loaders cacheados |
| `apps/landing/.env.template` | +20 | `STATS_REVALIDATE_TOKEN`, **sólo el nombre** |
| `src/lib/stats/copy.ts` · `stats-dashboard.tsx` | +7 / 1 | ⬅ **bug de copy corregido**, ver §8 |

---

## 2. Arquitectura

```
   Supabase fetch (cache: "no-store")
        ↓
   agregador  (8 RPC + 3 de desglose + on-chain)
        ↓
   ⭑ unstable_cache — UNA capa, 900 s, tag "public-stats"
        ↓
   UI (render por request, para poder leer Accept-Language)
```

⛔ **Nunca la otra forma.** Dejar encendida la Data Cache implícita de `fetch`
*y además* envolver el agregador apila dos TTL, sólo uno de ellos visible en el
código y **ninguno purgado por un deploy**. El `no-store` de Fase C es lo que
mantiene inerte la capa de abajo, y hay un test que verifica que sigue ahí.

**La página queda `force-dynamic` y la caché vive una capa más abajo.** Es
deliberado: el render depende de `Accept-Language`, y un `revalidate` a nivel de
ruta tendría que entrar por la cabecera — lo que guardaría los mismos números
una vez por idioma. Cachear el DATO y re-renderizar el HTML cuesta ~25 ms y deja
**una sola foto detrás de los dos idiomas**.

| Eje | Valor |
|---|---|
| `revalidate` | **900 s** — es un **piso**, no un techo: con SWR la primera petición pasada la ventana todavía recibe la foto vieja y sólo *dispara* el refresco. Medido bajo `revalidate: 3600`, una foto sobrevivió 5 h 22 min |
| Tag | **`"public-stats"`**, único. ⛔ nunca `"content"` (ése es el catálogo de puzzles y ya produjo un falso verde) |
| Clave del snapshot | `["public-stats", surface, container]` — **y nada más** |
| Clave del censo | `["public-stats", "census"]` — **sin filtros**: es global |
| `locale` | **fuera de las dos claves** |

---

## 3. Desglose Learn / Play / Total — opción A, y por qué

| Opción | Llamadas | Coherencia |
|---|---|---|
| **A · las 3 extra dentro de la MISMA regeneración cacheada** | 11 por regeneración | **una entrada, un `generatedAt`, una invalidación** |
| B · Total/Learn/Play como snapshots coordinados reutilizables | menos en teoría | ⛔ las tres filas de la tabla vendrían de **tres regeneraciones distintas** |

**Elegida: A.** La opción B ahorra llamadas y compra a cambio una tabla cuyas
propias filas pueden no reconciliar entre sí — deriva *dentro de una sola
vista*, que es peor que deriva contra el dato vivo. Menor complejidad, una sola
fuente de verdad, invalidación coherente, y cero resultados inconsistentes
duplicados.

### Llamadas por regeneración — el número final

| Concepto | Llamadas |
|---|---|
| Dashboard (las ocho RPC) | **8** |
| Desglose (`stats_install_counts` × learn/play/all) | **3** |
| **Total RPC** | **11** |
| Bloque on-chain | ~15 consultas (no RPC) |
| Censo (entrada aparte) | 2 consultas |

**En un HIT: 0 · 0 · 0.**

---

## 4. Medición local — build de producción, datos reales

| # | Escenario | Tiempo |
|---|---|---|
| 1 | **primera regeneración** (sin filtros) | **1.986 s** |
| 2 | cache HIT, mismos filtros | **0.037 s** |
| 3 | cache HIT (2.º) | **0.030 s** |
| 4 | **HIT con `Accept-Language: es-CO`, mismos filtros** | **0.023 s** ⬅ misma entrada |
| 5 | filtro distinto (`?surface=learn`) → regeneración | 1.163 s |
| 6 | HIT de ese filtro | 0.028 s |
| 11 | **tras invalidar** → regeneración | 1.505 s |
| 12 | HIT de nuevo | 0.027 s |

**Un hit es 54–74× más rápido que una regeneración.** El punto 4 es la prueba de
que `locale` no entra en la clave: una petición en español sobre los mismos
filtros **no regeneró nada**. El punto 11 es la prueba de que la invalidación
realmente vació la entrada.

---

## 5. Invalidación — `POST /api/revalidate-stats`

| # | Caso | Resultado |
|---|---|---|
| 7 | sin token | **HTTP 401** |
| 8 | token incorrecto | **HTTP 401** |
| 9 | `GET` | **HTTP 405** — un prefetch o un crawler no puede vaciar la caché siguiendo un link |
| 10 | token correcto | **HTTP 200** · `{"revalidated":true,"tag":"public-stats"}` |

Cubierto además por tests: token de la **longitud correcta pero bytes
distintos** → 401; comparación en **tiempo constante**; y **falla cerrado** —
con la variable ausente, vacía o en blanco el endpoint responde 401 **incluso al
valor correcto**. Un secreto sin configurar no puede convertirse en una puerta
abierta.

**No filtra nada:** los tres rechazos (sin token / token malo / sin configurar)
devuelven un **401 con cuerpo vacío**, indistinguibles entre sí. Ningún cuerpo
contiene el token ni el nombre de la variable. El handler **no loguea** (hay un
test sobre el fuente) — la sugerencia automática de añadir observabilidad se
descartó a propósito: recibe el secreto en la petición.

⚠️ **Existe porque un DEPLOY NO PURGA la Data Cache de Next.** Un censo roto
sobrevivió 18 h 34 min *y un deploy entero*. «Redesplegá» no es una estrategia
de invalidación.

**`STATS_REVALIDATE_TOKEN` está documentado sólo por nombre** en
`apps/landing/.env.template` (verificado: 3 variables declaradas, **0 líneas con
valor**). **No se cargó en Vercel** — hasta que se cargue, `/stats` sólo se
refresca esperando los 900 s.

---

## 6. Censo — entrada y reloj propios

- **Entrada separada**: `public-stats::census`, verificada distinta de
  `public-stats::all::all` en el mismo store.
- **`asOf` propio**, estampado *dentro* de `readPlayersCensus` para que se
  congele junto con las filas y el total. En pantalla: `Players list as of …` /
  `Lista de jugadores al …`, aparte del `Snapshot taken: 2026-08-05 01:55 UTC`
  del pie.
- **`total` null se conserva**; nunca se sustituye por `rows.length` — el defecto
  que una vez anunció «10 jugadores» a alguien rankeado 13.º.
- **Fallo visible**: con el read de filas caído, muestra su mensaje y el total
  que sobreviva.
- **Nunca sobrevive sin mostrar su edad**: el `asOf` se renderiza siempre.

⚠️ Un resultado degradado cachea como cualquier otro, así que un fallo
transitorio esconde la tabla hasta el TTL. Es deliberado: saltarse la caché en
el fallo la cambia por una tormenta de reintentos contra una base que ya está
mal. Como la edad se ve, una foto trabada es visible y no silenciosa.

---

## 7. Bundle y caché — con el consumidor real conectado

```
scanned 129 files under .next (32 under static/)

SUPABASE_URL (real value)                static/: 0   elsewhere: 0
SUPABASE_SERVICE_ROLE_KEY (real value)   static/: 0   elsewhere: 0
literal name SUPABASE_SERVICE_ROLE_KEY   static/: 0   elsewhere: 2
literal name SUPABASE_URL                static/: 0   elsewhere: 2
any NEXT_PUBLIC_SUPABASE                 static/: 0   elsewhere: 0

RESULT: no credential reaches the browser bundle
```

### 🔬 Cómo sabemos que NO reapareció la caché implícita de `fetch`

`.next/cache/fetch-cache/` **existe ahora, con 2 entradas** — y eso es
correcto: en Next 14 `unstable_cache` guarda en **ese mismo directorio**, cuyo
nombre es engañoso. La prueba de qué son esas entradas es el escaneo:

| | Fase B (1 fetch, sin `no-store`) | **Fase E (~100 fetches, con `no-store`)** |
|---|---|---|
| entradas | 1 | 2 |
| **contienen la URL real de Supabase** | **SÍ** | **NO — 0 apariciones en todo `.next`** |

Una entrada de la Data Cache de `fetch` **contiene la URL de la petición**. Estas
dos no. Son el snapshot y el censo — exactamente los dos loaders que declaramos,
ni uno más.

---

## 8. 🔬 Un bug de copy que sólo apareció mirando el HTML servido

Reusé `c.snapshotAt` («Snapshot taken» / «Foto tomada») como **cabecera de la
columna de fecha del trend**. Las 30 filas quedaron bajo un encabezado que dice
«Foto tomada», que es lo que rotula *cuándo se tomó la foto entera*, no el día
de cada fila.

**Ningún test lo detectó** — la clave existía, estaba traducida y no estaba
vacía. Sólo se ve leyendo la página. Corregido con una clave propia (`trendDay`
= «Day» / «Día»), con el comentario que explica por qué no debe volver a
compartirse.

⚠️ **Y al corregirlo, `perl -pi` volvió a producir mojibake** (`DÃ­a`) pese al
`-CSD`: el literal acentuado se pasó como bytes en la línea de comando.
Detectado con un grep de mojibake sobre los dos archivos (**0 restantes**) y
corregido con la herramienta de edición. Es la segunda vez que este comando
muerde en este repo.

---

## 9. Validación conjunta C+D+E

| Verificación | Resultado |
|---|---|
| `pnpm -C apps/landing build` | **verde** · `ƒ /stats` · `ƒ /api/revalidate-stats` |
| `next start` local + datos vivos | **HTTP 200** |
| EN / ES | ambos, **0 claves técnicas visibles** |
| Cinco combinaciones de filtros | todas responden, cada una su entrada |
| Cache hit | **27 ms**, 0 RPC |
| Invalidación | 401 / 401 / 405 / 200 + regeneración forzada |
| Fallo parcial | aviso nombrando las RPC, em-dashes, **cero ceros falsos** |
| Sin envs | HTTP 200, todo em-dash, sin aviso (nada falló) |
| **Suite del landing** | **216 passed / 23 files · 0 skipped** |
| ⚠️ Tests de bundle | **ejecutados**, no salteados: la suite corrió **después** del build |
| **Suite completa (`apps/web`)** | **7.283 passed / 592 files · exit 0** |
| `Unhandled Errors` | **0** |
| `pnpm -C apps/landing exec tsc --noEmit` | **exit 0** |
| `verify-stats-rpcs.ts` | **1.084 / 1.084** |
| `git diff --check` | **exit 0** |
| Scan de secretos | **0 hits** |

---

## 10. Riesgos

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **`STATS_REVALIDATE_TOKEN` no está en Vercel** | media | **deliberado**. Hasta cargarlo, la única forma de refrescar `/stats` es esperar 900 s — y un deploy **no** sirve. Cargarlo en los dos scopes antes de publicar |
| 2 | **El TTL es un PISO, no un techo** | media | con SWR una foto puede vivir bastante más de 15 min en una ruta de bajo tráfico. Ya se midieron 5 h 22 min bajo `revalidate: 3600`. El sello en pantalla es lo que impide que eso engañe |
| 3 | **La primera visita tras una ventana paga la regeneración** | media | ~1,5–2 s, y quien la dispara es un visitante real. Con `/stats` de bajo tráfico eso puede ser *casi todas* las visitas. Un cron de calentamiento contra el endpoint de invalidación lo resolvería — no lo hice porque añade una variable remota más |
| 4 | **11 RPC por regeneración** | baja | es la opción A y su costo está acotado a una regeneración por combinación cada 900 s. En un hit son 0 |
| 5 | **Un resultado degradado cachea hasta 900 s** | media | deliberado (§6). La edad siempre se ve |
| 6 | **`.next/cache/fetch-cache` tiene un nombre engañoso** | baja | `unstable_cache` guarda ahí. Quien audite este directorio en el futuro y vea entradas puede concluir mal; la prueba es el CONTENIDO, no el nombre del directorio (§7) |
| 7 | **`census.total` sigue sin explicación** | media | intacto desde la auditoría. **No declarar `/stats` cerrada sin trazarlo** |
| 8 | **6.794 px de alto en móvil** | media — optimización posterior | decisión del founder: no rediseñar el trend en esta fase |
| 9 | **`identity.ts` es copia de la de `apps/web`** | media | sin test cruzado entre apps |
| 10 | **production y preview comparten base** | media | declarado en la metodología |

---

## 11. `git status --short` al cierre

```
 M SESSION.md
 M apps/landing/.env.template
 M apps/landing/src/app/stats/page.tsx
 M apps/landing/src/components/stats/stats-dashboard.tsx
 M apps/landing/src/lib/stats/__tests__/aggregator-source-guard.test.ts
 M apps/landing/src/lib/stats/copy.ts
?? apps/landing/src/app/api/revalidate-stats/
?? apps/landing/src/lib/stats/__tests__/snapshot-cache.test.ts
?? apps/landing/src/lib/stats/snapshot.ts
```

Rama `feat/stats-landing-aggregator`, **local**, con C y D commiteados y E sin
commitear. El `.next`, los scripts temporales, el token de prueba y los archivos
de credenciales ya no existen.

---

## 12. NEXT ACTION

> Revisar Fase E. Si se aprueba: commit local
> `feat(landing): cache the stats snapshot under a single tag`, y **entonces**
> el push único de C+D+E con un solo deployment.
>
> Antes de ese deploy hay que decidir dos cosas remotas que esta fase dejó
> pendientes a propósito:
> 1. cargar `STATS_REVALIDATE_TOKEN` en `chesscito-landing` (los dos scopes);
> 2. si se calienta la caché con un cron, o se acepta que el primer visitante
>    de cada ventana pague ~1,5 s.
>
> ⛔ **Fase F (validación contra SQL) y Fase G (redirects) siguen sin empezar.**
> El link del listing de MiniPay apunta al destino: no redirigir hasta que F
> esté verde.

---

## 13. Referencias

| Documento | Para qué |
|---|---|
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **Fase F empieza acá** |
| `docs/handoffs/2026-08-05-stats-phase-d-ui-review.md` | la UI y sus contratos |
| `docs/handoffs/2026-08-05-stats-phase-c-aggregator-review.md` | el agregador |
| `docs/audits/2026-08-04-public-stats-accuracy-audit.md` | SQL de referencia §22, para Fase F |
