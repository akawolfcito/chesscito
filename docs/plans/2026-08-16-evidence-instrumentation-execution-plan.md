# Plan de ejecución — pasada de instrumentación por evidencia

**Fecha:** 2026-08-16 · **Estado:** pre-vuelo cerrado · Lote 1 aprobado (**sólo PRO**) · **Lote 3 anulado por evidencia**
**Fuente:** `docs/research/2026-08-15-chesscito-product-economics-evidence-pass.md` §9, §11
**Handoff previo:** `docs/handoffs/2026-08-16-session-handoff.md` (P2P DUEL V0 congelado, Phase 0.5 completa)

---

## 0. Lo que cambió al leer el código (antes de planear)

Tres correcciones al reporte. No invalidan sus conclusiones; **sí cambian el trabajo.**

| # | El reporte dice | El código dice | Consecuencia |
|---|---|---|---|
| 1 | "el mensaje crudo del mint no se registra" | `apps/web/src/lib/coach/claim-telemetry.ts` ya existe y el Arena **ya reenvía** `props.error` con `describeClaimError()` (`app/[locale]/arena/page.tsx:426`) desde 2026-07-21 | El corpus para clasificar **ya está en la base**. El lote 2 arranca con una consulta, no con código |
| 2 | "`source` y `campaign` existen y están sin usar" | La cadena completa ya está viva: `attribution.ts` (first-touch, localStorage) → `client-dimensions.ts:52` → `telemetry.ts` → columna | No hay que construir atribución. Falta **el parámetro en la URL del listado** y un valor canónico que lo nombre |
| 3 | "la lectura falla y se puntúa como 0" | Confirmado en `use-get-peones-token-selection.ts:88-90`: `r.status === "success"` o `0n`. `data` también es `undefined` mientras carga | Se puede distinguir `success` / `failure` / `absent` **sin tocar la lógica de selección**. La instrumentación es puramente aditiva |

⛔ **Nada de esto se verificó contra la base todavía.** El punto 1 predice que `props->>'error'` está poblado para los eventos posteriores al 2026-07-21; si no lo está, el lote 2 vuelve a su forma original. **Esa consulta es el primer paso del lote 2, no un supuesto.**

---

## Pre-vuelo — CERRADO el 2026-08-16

1. ⚠️ **Commits sin pushear en `main`.** Eran 4 al escribir esto; hoy son más. **El push a
   `origin/main` lo hace el founder**, no yo. Sigue pendiente de su mano.
2. ✅ **`docs/research/` commiteado** (`fe4946a`), con revisión de privacidad previa porque el
   repo es público: cero wallets, emails, UUIDs, tokens o connection strings. Sale del limbo.
3. ✅ **Suite de partida medida en `main` limpio, sin dev server arriba: 689 archivos / 8.453
   tests, `EXIT=0`, cero errores de worker.** Coincide con el handoff. Es la línea base.

---

## Lote 1 — Instrumentación de lectura de balance `[P0]`

**Pregunta que contesta:** ¿los wallets de MiniPay realmente no tienen $1.99, o la lectura de `balanceOf` está fallando?

**Por qué primero:** es la única pregunta cuya respuesta bloquea decisiones de precio, packaging y del rail entero (§10 clasifica PRO/Shop/Season Pass como `FREEZE` hasta resolverla).

### 1.1 Contrato (SDD)

Archivo: `apps/web/src/lib/payments/use-get-peones-token-selection.ts`

```ts
export type TokenReadStatus = "success" | "failure" | "absent";

export type TokenReadOutcome = {
  symbol: string;              // USDC | USDT | cUSD
  status: TokenReadStatus;
  bucket: BalanceBucket | null; // null si status !== "success"
};

export type BalanceBucket = "zero" | "dust" | "under_price" | "payable";
```

- `absent` = `data` aún `undefined` o índice ausente. **Es un tercer estado real**, no un sinónimo de `failure`; hoy los tres colapsan a `0n`.
- Buckets sobre el `expectedAmount` ya calculado por token: `zero` (=0), `dust` (<1% del precio), `under_price` (<precio), `payable` (≥precio). Cardinalidad acotada por construcción, como el resto de `dimensions.ts`.
- ⛔ **`selectPayableToken` no se toca.** Es la función pura que sostiene el bug-fix del smoke de 2026-06-09. La instrumentación se agrega al lado, nunca en su camino.

### 1.2 Tests primero (TDD)

Rojo antes de verde, en `lib/payments/__tests__/`:

1. `describeTokenReads` con los tres estados de `useReadContracts` → los tres `TokenReadStatus`.
2. Cada frontera de bucket, por token, con las tres decimales distintas (6/6/18). **cUSD a 18 decimales es donde esto se rompe si se rompe.**
3. Invariante: para cualquier entrada, el `selected` de la instrumentación es idéntico al `selected` de hoy. Property-based si el harness lo permite.
4. Emisión: el evento sale **una vez por tap bloqueado**, no una por render. `useReadContracts` re-renderiza.

### 1.3 Emisión

Punto de emisión: `apps/web/src/lib/pro/use-pro-sheet-state.ts:267`, la rama que ya emite `pro_purchase_failed { kind: "no-token" }`.

```ts
track("pro_purchase_failed", {
  kind: "no-token",
  reads: /* [{symbol, status, bucket}] × 3 */,
});
```

⚠️ **Presupuesto de props:** `/api/telemetry` descarta el objeto entero por encima de 4KB (`sanitizeProps` → `MAX_PROPS_BYTES`). Tres objetos de tres campos cortos caben con holgura, pero la forma se decide midiendo el payload serializado en un test, no a ojo — es exactamente la lección de `claim-telemetry.ts`.

**Alcance:** ¿solo PRO, o todas las superficies del rail (Shop, Season Pass, Peones)? Recomiendo **solo PRO en el primer envío**: es donde está el 98.4% medido y el n llega rápido. Ampliar después con la forma ya validada.

### 1.4 Criterio de lectura

Esperar **~200 eventos `no-token`** (§11.1). Luego:

- Mayoría `status: "failure"` → la hipótesis RPC se sostiene; **entonces** se aplica el `fallback()` que `web-transports.ts` ya tiene escrito y probado para la rama web.
- Mayoría `status: "success"` con `bucket` bajo → el gate es honesto; la conclusión revierte a asequibilidad real y el precio vuelve a estar sobre la mesa.

⛔ **No se arregla el transporte en este lote.** Arreglar y medir a la vez destruye la línea base: si la conversión se mueve, no sabremos si arreglamos un RPC o movimos un precio.

### 1.5 ✅ VERIFICADO end-to-end en un build real — 2026-08-16

Smoke del founder en preview (PLAY), wallet sin fondos: abrir PRO → intentar activar →
"Insufficient stablecoin balance." Consulta de sólo lectura contra `analytics_events`
(`scripts/ops/read-only-query.ts`). Wallets mostrados como `md5` truncado, nunca completos.

| criterio | resultado |
|---|---|
| `event` | `pro_purchase_failed` ✅ |
| `kind` | `no-token` ✅ |
| `read_usdc` | **`absent`** |
| `read_usdt` | **`absent`** |
| `read_cusd` | **`absent`** |
| ¿sobrevivieron a `sanitizeProps`? | ✅ las tres claves están en la fila |
| ¿props inesperadas? | ✅ ninguna — el conjunto es exactamente `{kind, read_usdc, read_usdt, read_cusd}` |
| ¿una vez por tap? | ✅ **una** fila para ese tap |

**La prueba de que las claves son nuevas y no se descartan:** en los 10 días previos hay
**640 filas** `no-token` y **cero** con `read_*`; el 2026-08-16 aparece **1** con las tres.
Un `sanitizeProps` que las tirara habría dado 0 en todos los días por igual.

⚠️ **`absent`, no `success:zero` — y eso ya es un hallazgo, no un defecto.** `absent` significa
que la lectura de `balanceOf` **no había llegado** cuando se procesó el tap. Antes de este lote
ese caso era `0n`, idéntico a un wallet vacío: **la distinción que el lote existía para hacer,
la hizo en su primer evento.**

⛔ **Lo que esto NO dice todavía.** Con n=1 no se decide nada: no responde si el 98,4% son
lecturas fallidas o wallets realmente sin saldo. El criterio de lectura sigue siendo el de
§1.4 — **~200 eventos**. Y ojo con la interpretación: si `absent` domina, la pregunta se
desplaza de "¿falla el RPC?" a "¿estamos bloqueando el tap antes de que la lectura llegue?",
que es una respuesta distinta y más barata.

⚠️ **Abierto, NO introducido por este lote:** hay ráfagas históricas en el mismo call site
—hasta 10 eventos de un wallet en un segundo el 2026-08-15— con el código viejo. El punto de
emisión no cambió, así que el "una vez por tap" queda verificado **para este smoke**, no como
propiedad global. Merece mirarse cuando se calcule cualquier tasa con este evento.

---

## Lote 2 — Clasificación del error del mint de victoria `[P0]`

**Pregunta:** ¿por qué falla el 41% de los mints, el único producto que convierte?

### 2.1 Paso 0 — leer el corpus que ya existe (sin código)

Consulta de **solo lectura**, con la misma disciplina de la pasada de evidencia (`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`):

```sql
SELECT props->>'error' AS provider_message, count(DISTINCT account_ref) AS wallets
FROM analytics_events
WHERE event = 'victory_claim_tx'
  AND props->>'stage' = 'error'
  AND props->>'error_kind' = 'unknown'
GROUP BY 1 ORDER BY 2 DESC;
```

Tres resultados posibles, tres caminos distintos:

| Resultado | Lectura | Camino |
|---|---|---|
| `error` poblado y agrupable | El corpus está ahí | Extender `classifyTxErrorKind` **contra mensajes reales**, con un test por familia |
| `error` mayormente NULL | El fix de 2026-07-21 llegó después del volumen, o hay otra ruta de emisión | Auditar rutas de emisión; recién ahí, código |
| `error` poblado pero irreducible | Los proveedores no dicen nada útil | `[UNKNOWN]` declarado y cerrado. **Un resultado válido** |

⛔ **Sin este paso no hay lote 2.** Escribir clasificadores contra errores imaginados es cómo se llegó a `unknown` la primera vez.

### 2.2 Implementación (condicionada al paso 0)

Archivo: `apps/web/src/lib/errors.ts` — `classifyTxErrorKind`, que ya tiene la estructura correcta (tipo `TxErrorKind` cerrado, `CUSTOM_ERROR_KINDS`, degradación a `null`).

- Cada familia nueva del corpus → **un valor nuevo en `TxErrorKind`**, con su test, con el mensaje real como fixture.
- ⚠️ La regla existente del módulo se respeta: un `error_kind` nuevo se justifica solo si **cambia lo que el jugador haría después**. Si no, se queda en `revert`/`unknown`. La cardinalidad es un presupuesto.
- Verificar de paso si `insufficientFunds` (7 wallets) está subcontando por caer en `unknown`. Es el número que el lote 1 va a querer cruzar.

### 2.3 Anexo barato — `tx_progress_done`

§9 registra que ese evento sólo tiene `outcome='success'` en 4.932 de 4.932 filas: el instrumento no puede representar el fracaso. Es **un call site** en la rama de error. No es del lote nombrado; se incluye aquí sólo si el paso 0 sale corto, para no abrir un lote por una línea.

---

## Lote 3 — Instrumentación de fuente de adquisición `[ANULADO 2026-08-16]`

⛔ **Este lote no se ejecuta. Su premisa era falsa.**

El founder corrigió el supuesto y la inspección lo confirmó: **no controlamos una URL de
listado** a la que colgarle `?utm_source=`. El journey real es abrir MiniPay, buscar Chesscito
y abrirlo desde el catálogo; los deep links externos ya se intentaron y MiniPay no los permite
para este caso. La App URL registrada es `https://www.chesscito.com`, pelada.

**Inventario completo de señales:** `docs/audits/2026-08-16-minipay-entry-signal-inventory.md`.
Resultado: **ninguna** señal — URL, referrer, SDK, provider, UA, cookie — distingue
listado / búsqueda / push. Y aunque pudiéramos cambiar la App URL, **una sola URL no puede
separar tres caminos de entrada**: marcaría a los tres igual y fabricaría una distinción falsa.

⛔ **No se agrega `minipay_listing` a `SOURCES`.** Un valor canónico que nadie puede poblar es
vocabulario muerto, y después se lee como si significara algo.

La adquisición dentro de MiniPay queda declarada **`[UNKNOWN]` estructural** — no una tarea
pendiente. La pregunta del §9 se ataca por comportamiento (§8 del research), no por origen.

⚠️ Lo que sí quedó anotado, sin costo: `minipay_discovery` está en el allow-list y **nunca se
puebla**, así que quien lea la tabla verá `0` y puede concluir que nadie llega por MiniPay —
lo contrario de la verdad. Está en el inventario para que nadie lo lea mal.

---

<details>
<summary>Contenido original del lote, conservado para trazabilidad</summary>

**Pregunta:** ¿el 95% one-and-done es basura de adquisición o fallo de producto? ¿Y qué es NL al 17.4%?

### 3.1 Lo que NO hay que construir

La cadena ya está viva y con tests: `attribution.ts` (first-touch persistido) → `client-dimensions.ts:52` → `telemetry.ts` → `analytics_events.source`. `SOURCES` ya incluye `minipay_discovery`, y `SOURCE_ALIASES` ya mapea `minipay` y `discovery`.

### 3.2 Paso 0 — verificar qué está llegando hoy

```sql
SELECT source, campaign, count(DISTINCT session_id)
FROM analytics_events
WHERE created_at >= DATE '2026-08-03'
GROUP BY 1,2 ORDER BY 3 DESC;
```

**Predicción explícita, para poder equivocarme:** casi todo cae en `direct`, porque el link del listado no lleva parámetro y `getAttribution()` resuelve a `direct` ante su ausencia. Si aparece otra distribución, este lote se reescribe.

### 3.3 El cambio

**No es principalmente código. Es la URL del listado de MiniPay.**

1. Agregar `?utm_source=minipay_listing&utm_campaign=<canal>` al link del directorio de MiniPay. ⚠️ Fuera del repo — es configuración en el dashboard de MiniPay, con su propio ciclo de aprobación y latencia. **Ese es el camino crítico del lote.**
2. Agregar `minipay_listing` a `SOURCES` y a `SOURCE_ALIASES` en `dimensions.ts`, **aditivo**, con el mismo comentario de intención que tiene `web_early_access`. Hoy `minipay` alias→ `minipay_discovery`, que significa otra cosa: distinguir el listado del descubrimiento in-app es el punto entero.
3. Test: token nuevo → canónico; token ausente → `direct`; token desconocido → `unknown`. Idempotencia, como el resto del módulo.

⚠️ **Es first-touch y persistido.** Los 6.035 wallets ya instalados **nunca** se reetiquetan. Este lote sólo produce evidencia sobre adquisición **futura**, y por eso va tercero — pero por eso mismo conviene mandar el parámetro pronto: cada día sin él es un día de cohorte sin atribuir.

</details>

---

## Orden, y por qué — revisado el 2026-08-16

```
Pre-vuelo  ✅ CERRADO (docs/research commiteado, baseline 689/8.453 medida)
   │
   ├── Lote 3  ⛔ ANULADO — no hay señal que atribuir (inventario cerrado)
   │
   ├── Lote 1 — instrumentación de balance, SÓLO PRO
   │             [bloquea precio, packaging y el rail entero]
   │
   ├── Lote 2, paso 0 — la consulta          [puede cerrar el lote sin código]
   │
   └── Lote 2 — clasificador                 [condicionado al paso 0]
          │
          └── OBSERVAR (~200 eventos no-token) → recién ahí, arreglar el rail
```

⚠️ **El Lote 3 era el que tenía latencia externa, y desapareció.** Eso deja el camino crítico
enteramente adentro del repo: nada de lo que queda depende de un tercero, salvo el deploy.

## Verificación por lote

Ninguno se declara hecho sin: suite completa verde con conteo reportado en el commit, `tsc` limpio, y **el evento visto llegando a `analytics_events` en un build real**.

⛔ **La lección de esta semana aplica directo:** 688 archivos verdes, VR 67/67 y `tsc` limpio convivieron con un feature inusable. `next dev` no ejecuta lo que se rompía. **Un evento de telemetría que sólo se probó en tests unitarios no está probado.**

## Preguntas abiertas

1. ✅ **Lote 1 — sólo PRO.** Decidido por el founder el 2026-08-16. El resto del rail se amplía después, con la forma de payload ya validada.
2. ✅ **Lote 3 — cerrado, no por respuesta sino por inexistencia del sujeto.** No hay URL de listado que cambiar. Ver el inventario de señales.
3. **¿Se despliega esto a producción, y cómo?** Producción se despliega **buildeando la rama `production`**, nunca promoviendo un preview. Sin deploy, no hay evidencia: estos lotes no valen nada en preview.
4. **Las 11 filas de prueba en `duels`** siguen abiertas del handoff anterior. No bloquea nada de acá.
