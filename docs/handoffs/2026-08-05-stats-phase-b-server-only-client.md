# Fase B — cliente Supabase server-only en `chesscito-landing`

**Fecha:** 2026-08-04 · **HEAD:** `8919d1687fde81294b040003ea508fae41e4c10f` (= `origin/main`)
**Estado:** implementado y validado. **Detenido antes de commitear.**
**Ningún commit, ningún push, ningún deploy, ninguna variable remota tocada.**

> **✅ El landing puede leer Supabase y ni una clave toca el bundle del cliente.**
> Suite completa 7.283 / 592 · landing 103 / 16 · verificador RPC 1.084 / 1.084.
> **Nada consume todavía las RPC** — eso es Fase C.

---

## 0. Verificación inicial — antes de tocar nada

| Eje | Resultado |
|---|---|
| HEAD vs `origin/main` | `8919d1687fde81294b040003ea508fae41e4c10f` — **idénticos** |
| `SESSION.md` | modificado, **fuera del stage** (`git diff --cached` vacío) |
| `pnpm ops:health` (production) | 🟢 **GREEN (partial)** · `2026-08-04T23:39:23Z` |
| `pnpm ops:health:preview` | 🟢 **GREEN (partial)** · `2026-08-04T23:39:36Z` |
| 5XX | **ninguno** — los cuatro dominios HTTP 200 |
| `/api/telemetry` | 0 errores en ambos proyectos |
| `verify-stats-rpcs.ts` | **1.084 / 1.084 · exit 0** — las ocho RPC intactas |
| Incidente activo | **ninguno** |

---

## 1. Archivos

| Archivo | Líneas | Qué |
|---|---|---|
| `apps/landing/src/lib/supabase/server.ts` | **50** | **nuevo** — el cliente |
| `apps/landing/src/lib/supabase/__tests__/server-only.test.ts` | **201** | **nuevo** — comportamiento + contrato de fuente · **20 tests** |
| `apps/landing/src/lib/supabase/__tests__/secret-isolation.test.ts` | **180** | **nuevo** — aislamiento estructural + bundle · **17 tests** |
| `apps/landing/.env.template` | **35** | **nuevo** — nombres, cero valores |
| `apps/landing/package.json` | **+2** | dos dependencias, pin exacto |
| `pnpm-lock.yaml` | **+11** | lockfile |

**No tocado:** las ocho RPC, migraciones, consumidores de `apps/web`,
`apps/landing/src/app/stats/page.tsx`, redirects, `/api/profile/stats`, el
monitor, la telemetría, el cron, la retención, los índices y `SESSION.md`.

---

## 2. Dependencias — pin exacto, y una desviación declarada

```json
"@supabase/supabase-js": "2.100.1",
"server-only": "0.0.1",
```

`2.100.1` es **exactamente** la versión de `apps/web` (verificada en su
`package.json`, no supuesta). pnpm la reusó del store: `downloaded 0, added 0`.

### ⚠️ `server-only` es una segunda dependencia — por qué no se pudo evitar

El encargo pide no añadir dependencias adicionales **sin necesidad**. La
necesidad está medida, no supuesta:

```
Error: Failed to resolve import "server-only" from "src/lib/supabase/server.ts"
  Plugin: vite:import-analysis
```

`server-only` **no existe en el repo**: no está en `pnpm-lock.yaml`, no está en
`node_modules/.pnpm`, y `next@14.2.35` no lo trae como dependencia. `apps/web`
usa `import "server-only"` en tres módulos y funciona porque **Next.js resuelve
el especificador con su propia copia compilada durante el build** — pero eso es
webpack, no Vite.

**No existe convención previa que copiar.** Busqué la que el encargo pedía
respetar: los tests de `apps/web` que declaran `vi.mock("server-only", …)`
**nunca ejercitan la ruta** — `route.test.ts` mockea los módulos intermedios
(`registry-editor`, `variant-undo`), así que el archivo con el
`import "server-only"` jamás llega al transform de Vite. Ese `vi.mock` es código
muerto defensivo. **Ningún test del repo importa estáticamente un módulo que
importe `server-only`.**

Las dos salidas eran un `resolve.alias` en `vitest.config.ts` apuntando a un
stub, o el paquete real. Elegí el paquete:

- resuelve en **las tres** herramientas a la vez — `tsc`, Vite/vitest y
  `next build` — en vez de parchear sólo el runner de tests;
- es lo que documenta Next.js;
- su `exports` con condición `react-server` **lanza en tiempo de build** si un
  componente cliente lo importa. Eso es **más fuerte** que el alias interno de
  Next, que sólo lo hace por convención del bundler;
- pesa ~1 kB y no tiene dependencias.

Un alias de vitest habría dejado el guard verde en tests y ciego en el build.

---

## 3. El cliente

`apps/landing/src/lib/supabase/server.ts`

```ts
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

| Requisito | Cómo |
|---|---|
| importa `server-only` | primera línea, antes de todo |
| lee **sólo** las dos variables | test que extrae el conjunto de `process.env.X` y lo compara contra un `Set` exacto |
| sin prefijo `NEXT_PUBLIC_` | fijado en tres guards independientes |
| no exporta valores de env | test que enumera los `export` y exige **exactamente** `["getSupabaseServer"]` |
| no imprime secretos | test que prohíbe `console.*`, `process.stdout`, `process.stderr` — **logs cero**, no «logs sin secreto» |
| `null` si faltan variables | 4 casos: ninguna, sólo url, sólo key, **cadena vacía** |
| no lanza al importar | el módulo no tiene efectos de import; test que exige `not.toThrow()` y prohíbe `throw` en el cuerpo |
| sin persistencia de sesión | las **tres** banderas en `false`, cada una con su test |
| reutilizable por Fase C | devuelve `SupabaseClient \| null` tipado; test de dos llamadas independientes |

**Las tres banderas están explícitas a propósito**, aunque `persistSession:
false` ya implique casi todo: un cambio de default en supabase-js no puede
volver a encender ninguna en silencio.

**Ningún cliente de browser.** El único `createClient` del landing está en este
archivo, y hay un guard que lo verifica sobre `src/components/**`.

### Comportamiento sin envs

`getSupabaseServer()` devuelve `null` y **no lanza**, ni al importar ni al
llamar. Borrar las dos variables en Vercel es un rollback completo y sin deploy:
el agregador de Fase C cae a `EMPTY_PUBLIC_STATS` y la página renderiza
em-dashes. **Sin 500.**

---

## 4. Guardias — 37 tests, y **probados contra su propia violación**

### `server-only.test.ts` — 20 tests

Comportamiento con `createClient` mockeado (se asertan los **argumentos**, no un
objeto cliente que los escondería) + contrato del texto del módulo.

⚠️ **La prosa del módulo NOMBRA a propósito lo que el código no debe hacer**
(`NEXT_PUBLIC_`, lanzar, loguear) para que un lector futuro sepa por qué existen
las restricciones. Aseverar sobre el texto crudo fallaría contra la
documentación en vez de contra el código, así que los checks corren sobre una
copia sin comentarios — con un test que verifica que el stripper **no se comió
el cuerpo**, porque si lo hiciera todas las demás aserciones pasarían contra una
cadena vacía.

### `secret-isolation.test.ts` — 17 tests

Escaneo estructural, en la línea de `privy-isolation.test.ts` (mismo patrón de
recorrido y exclusión por basename):

- ninguna fuente del landing menciona `NEXT_PUBLIC_SUPABASE*`;
- **`next.config.js` no reenvía ninguna variable con `SUPABASE`** — su bloque
  `env:` inlinea al bundle lo que liste, con prefijo o sin él, y eso derrotaría
  a todos los demás guards;
- nada bajo `src/components/**` menciona `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `createClient` ni `@supabase/supabase-js`, ni
  importa `lib/supabase`;
- ningún componente cliente importa `lib/supabase/server`;
- **ningún componente cliente lee `process.env` en absoluto** — más estricto que
  «no lee secretos»: cero es una línea verificable, «sólo los seguros» no lo es.
  Hoy se cumple: los tres archivos `"use client"` del landing no lo tocan;
- cuatro tests de **cobertura del propio escaneo** (cuenta de archivos, cuenta de
  componentes cliente > 0, el módulo bajo guardia no está exento) — sin ellos,
  un cambio en la detección de `"use client"` reduciría los checks a cero
  archivos y seguiría en verde.

### 🔬 Los guards **disparan** — medido, no revisado

**Contrafactual 1 — fuga plantada en el bundle.** Escribí un archivo con el
centinela y el nombre de la variable en `.next/static/` y corrí la suite:

```
× contains no occurrence of SUPABASE_SERVICE_ROLE_KE…
× contains no occurrence of phase-b-sentinel-service…
AssertionError: expected [ '.next/static/__counterfactual.js' ] to deeply equal []
```

Falla, y **nombra el archivo**. Probe eliminado inmediatamente.

**Contrafactual 2 — el prefijo público.** Cambié una sola línea a
`process.env.NEXT_PUBLIC_SUPABASE_URL`:

```
Tests  9 failed | 28 passed (37)
```

**Nueve fallos en tres guards independientes** (contrato de fuente, escaneo de
variables públicas, y los cinco de comportamiento). Revertido.

> Un checker que sólo vio entrada sana no está demostrado que rechace nada — es
> lo que le pasó a `hitCeiling` comparando contra un 10.000 inalcanzable.

---

## 5. Build degradado — los dos escenarios

### A · sin envs

```
✓ Compiled successfully
✓ Generating static pages (10/10)
/stats   8.87 kB   96.1 kB
```

Build verde, el import no rompe, `getSupabaseServer()` devuelve `null`. La
página `/stats` **no cambió de tamaño**: no se tocó.

### B · con envs centinela

```
SUPABASE_URL="https://phase-b-sentinel.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="phase-b-sentinel-service-role-key-not-a-real-credential"
```

Build verde, mismo output. Escaneo de los **32 archivos** de `.next/static/`
buscando `phase-b-sentinel`, `SUPABASE_SERVICE_ROLE_KEY`, `supabase.co` y `eyJ`:

```
0 coincidencias
```

Y en **todo** `.next/` (servidor incluido): 0 coincidencias.

**Ninguna credencial real se usó en ninguna parte de esta fase. No se hizo ni
una llamada a Supabase desde el landing.**

### ⚠️ Qué prueba y qué NO prueba ese escaneo

**Todavía nada importa `server.ts`** — Fase B monta el cliente, no lo consume.
El módulo no está en el grafo del build, así que el centinela **no podía
aparecer aunque el guard estuviera roto**. Lo que el escaneo sí prueba hoy es
que ni el bloque `env:` de `next.config.js` ni un prefijo accidental inlinean
esos nombres en ningún chunk. Que el escáner **funciona** está probado aparte,
por el contrafactual 1. **La cobertura real llega en Fase C**, cuando el
agregador importe el módulo.

---

## 6. Documentación de envs — desviación declarada

Creé **`apps/landing/.env.template`** en vez de editar una plantilla existente.

El repo tiene dos plantillas trackeadas: `.env.example` en la raíz y
`apps/web/.env.template`. **Las dos me están denegadas por las reglas de
seguridad de la sesión** (`File is in a directory that is denied`) — no puedo
leerlas. Editar a ciegas un archivo que no puedo leer arriesga pisar contenido.

Además, la plantilla per-app es la convención que `apps/web/.env.template` ya
establece, y estas variables son del proyecto `chesscito-landing`, no de
`apps/web` — lo que además hace consistente la nota «no copiar a apps/web si ya
existe allí» que pedía el encargo.

Contiene **sólo nombres** (verificado: `0` líneas con valor después del `=`), y
documenta: server-only, sin `NEXT_PUBLIC_`, requerido en production **y**
preview de `chesscito-landing`, no copiar a `apps/web`, y que la ausencia
degrada a em-dashes en vez de romper.

⚠️ **Si preferís que las dos variables se documenten en la plantilla raíz o en
la de `apps/web`, hace falta que me habilites la lectura de esos paths** — o
hacelo vos con este archivo como fuente.

---

## 7. Validación

| Verificación | Resultado |
|---|---|
| Tests dirigidos del landing | **37 passed** (`src/lib/supabase`) |
| Suite del landing | **103 passed / 16 files** (baseline 66 / 14 → **+37, +2 archivos**) |
| `pnpm -C apps/landing exec tsc --noEmit` | **exit 0** |
| `pnpm -C apps/landing build` | **verde en los dos escenarios** |
| **Suite completa (`apps/web`)** | **7.283 passed / 592 files · exit 0** |
| `Unhandled Errors` en el log | **0** (grep sobre el log entero, no sólo el contador) |
| `git diff --check` | **exit 0** |
| Scan de secretos | **0 hits** en el diff trackeado y en el módulo nuevo |
| `.next/static` | **0 hits** sobre 32 archivos |
| `pnpm ops:health` | 🟢 **GREEN (partial)** · 5XX ninguno · telemetría 0 err |
| `pnpm ops:health:preview` | 🟢 **GREEN (partial)** · los dos dominios HTTP 200 |
| `verify-stats-rpcs.ts` | **1.084 / 1.084 · exit 0** — sin cambios |
| `git diff --cached` | **vacío** |

---

## 8. Riesgos

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| 1 | **El escaneo del bundle es confirmatorio, no probatorio, hasta Fase C** | media | nada importa `server.ts` todavía. El escáner está probado (contrafactual 1), pero su objeto de estudio aún no existe. **Repetir el escaneo al cerrar Fase C, con el agregador ya importando el módulo** |
| 2 | **Los casos de `.next/static` se SALTAN si no hubo build** | baja | usan `it.skipIf`, así que aparecen como *skipped* y no como verdes vacíos. Aun así, un `pnpm -C apps/landing test` en limpio no los ejercita |
| 3 | **`server-only` es una dependencia nueva en el deploy del landing** | baja | 1 kB, cero dependencias, y su condición `react-server` lanza en build si un cliente lo importa. Es la razón por la que se eligió, pero es superficie nueva |
| 4 | **Las variables NO están en Vercel** | — | **deliberado**: el encargo lo excluye. Sin ellas el código nuevo simplemente devuelve `null`. Hay que ponerlas en `chesscito-landing`, **production y preview**, antes de Fase C |
| 5 | **`vercel env ls production` OCULTA filas scopeadas a Preview** | media | al auditar la presencia de las dos variables, hacerlo **sin filtro de entorno**. Ya produjo un reporte falso una vez |
| 6 | **production y preview comparten la MISMA base** | media | toda cifra que devuelvan las RPC es la suma de los dos entornos. Sin cambios respecto de Fase A |
| 7 | **`chesscito-landing` sigue fuera de `ops:health`** | media | pasa a alojar la única página de estadísticas del producto y el monitor no lo mira. El plan lo agenda en Fase H; con secretos ya montados, vale adelantarlo |
| 8 | **`census.total` sigue sin explicación** | media | intacto. **No cerrar `/stats` sin trazarlo** |

---

## 9. `git status --short` al cierre

```
 M SESSION.md
 M apps/landing/package.json
 M pnpm-lock.yaml
?? apps/landing/.env.template
?? apps/landing/src/lib/supabase/
```

`git diff --cached` **vacío**. `SESSION.md` fuera del stage.

---

## 10. NEXT ACTION

> **Decisión del founder antes de seguir**, en este orden:
>
> 1. ¿Se acepta `server-only@0.0.1` como segunda dependencia? (§2)
> 2. ¿La plantilla de envs queda en `apps/landing/.env.template`, o se mueve a
>    una de las dos que no puedo leer? (§6)
> 3. Commit sugerido: `feat(landing): add server-only Supabase client`
> 4. Cargar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el proyecto
>    `chesscito-landing`, **production y preview**, sin prefijo `NEXT_PUBLIC_`.
>
> Después: **Fase C** — el agregador.
> Referencia: `docs/plans/2026-08-04-stats-consolidation-execution-plan.md`.

---

## 11. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-05-stats-rpc-phase-a-post-apply.md` | estado de las ocho RPC en producción |
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | **empezar acá para Fase C** |
| `apps/landing/src/lib/__tests__/privy-isolation.test.ts` | el precedente del escaneo estructural |
| `scripts/ops/verify-stats-rpcs.ts` | correrlo antes y después de cualquier cambio de esquema |
