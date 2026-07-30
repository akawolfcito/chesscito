# Spec — `/stats`: descarga pagada con x402

**Fecha:** 2026-07-30
**Estado:** 🅿️ **APARCADO SIN FECHA** (founder, 2026-07-30) — escrito, **sin red team**, sin
implementar. Buen feature, no necesario ahora. Al retomarlo se arranca desde acá, no de cero:
primero el spike de §9.1 (facilitator), después el red team, después la etapa 2.
**Reemplaza a:** `2026-07-30-stats-noindex-and-internal-gate{,-redteam}.md` (borrados)
**Backlog:** `docs/backlog/2026-07-10-backlog-index.md` §Export de `/stats` con x402

---

## 0. Corrección de alcance

El spec anterior partió de "hay que gatear `/stats`" y terminó clasificando funnels como
internos. **Esa premisa era falsa y la corrigió el founder**: el dashboard no cambia —
ni lo que muestra, ni quién entra. Lo único nuevo es que **bajar los datos en formato
procesable cuesta**.

Queda **eliminado** del alcance: partir `PublicStats` / `InternalStats`, la cookie
`STATS_INTERNAL_TOKEN`, la vista pública recortada, el chip *Internal view*, el gate de
funnels, tocar `grant-shots`, y duplicar caches por `includeInternal`.

### Lo que ya está hecho (etapa 1, commit `5595722`)

`noindex, nofollow` en `apps/web` y `apps/landing`, `/stats` fuera de `STATIC_PATHS`, y
el primer test sobre `sitemap.ts`. **Se conserva tal cual.**

⚠️ El backlog justificaba "no poner 402 delante del HTML" en parte por *"mata el
indexado"*. Ese argumento ya no aplica — la página es `noindex` por decisión propia. El
que sí sigue en pie, y es el que manda, es el otro: **MiniPay §8 exige una página de
stats abierta y sin wallet**, y ponerle 402 adelante rompería el listing.

---

## 1. Por qué el HTML sigue gratis

De los requisitos de listing de MiniPay (`minipay-requirements.md` §8, snapshot del PDF
oficial, 2026-05-13):

> *"Where to publish: a `/stats` page inside the Mini App (**read-only, no wallet
> required**)."*

`/stats` es un entregable del listing. **El 402 va sólo delante del archivo, nunca
delante de la página.**

⚠️ Confirmar §8 en la próxima llamada con MiniPay (pendiente D3 de la sesión anterior).

---

## 2. El cobro es por conveniencia, y hay que decirlo

Tomado del backlog (`2026-07-10-backlog-index.md` §Export con x402), sigue vigente:

> **No tiene valor de enforcement, y no hay que pretender que lo tenga.** El HTML ya trae
> los datos; el "download" es reformatear algo que el cliente ya tiene.

Consecuencias que este spec adopta como reglas:

- **No se construye anti-scraping.** Ni detección de bots, ni ofuscación del payload.
- El precio es honesto: **0.01 USDC por el formato**, no por el acceso.
- Si algún día el export incluye algo que el HTML no muestra, **eso es otro producto** y
  necesita su propia decisión de privacidad.

---

## 3. Contrato (SDD)

### 3.1 Endpoint

```
GET /api/stats/export?surface=<all|learn|play>&container=<all|minipay|browser>&format=<csv|json>
```

- `surface` / `container`: **exactamente** los de `lib/stats/filters.ts`. Se reusa
  `parseStatsFilters`; no se inventa un segundo parser.
- `format`: conjunto cerrado `csv | json`. Cualquier otro valor → **400**.
- **No hay parámetro de fechas.** El payload son los agregados que la página ya muestra,
  cuyas ventanas son fijas (7d / 30d / lifetime). Sin rango no hay rango máximo que
  imponer, y no hay forma de pedir una consulta arbitrariamente cara. Es la
  simplificación que hace innecesarias tres de las salvaguardas del brief.

### 3.2 Payload

**Los mismos agregados que ya se ven.** Cero campos nuevos. La fuente es el mismo
`getPublicStats(filters)` que renderiza el dashboard — **no una segunda ruta de
agregación**, que derivaría del dashboard sin que nada lo delate.

```ts
// lib/stats/export.ts
export type StatsExport = {
  generatedAt: string;
  filters: StatsFilters;
  /** Serialización plana de PublicStats, sin campos añadidos. */
  rows: ExportRow[];
};
```

⛔ **Ninguna wallet sale del servidor.** Ya hay un test que lo fija sobre el endpoint
existente (`JSON.stringify(body)` no contiene `"0x"`); el export **hereda esa aserción**.
`topMinters` y `leaderboardTop10` ya viajan como `rowId` opaco + `variant`
(`aggregateTopMinters` descarta la address antes de devolver).

### 3.3 Precio y destino, por entorno

| Env | Default | Si falta |
|---|---|---|
| `STATS_EXPORT_PRICE_USDC` | `"0.01"` | usa el default |
| `STATS_EXPORT_PAY_TO` | — | **503 y el botón no se renderiza** |

Server-only las dos. **Nunca `NEXT_PUBLIC_`** — un precio en el cliente es una sugerencia.
El precio que se cobra es el que el servidor pone en el desafío 402; el cliente lo lee de
ahí, no de su propia copia.

USDC en Celo tiene **6 decimales**: `0.01` = `10000` unidades. Escribirlo mal es cobrar
mil veces de más o de menos, y el test lo pinea.

---

## 4. El flujo, y el orden es la especificación

```
1. validar format + filtros        (cero I/O)      → 400 si no
2. leer cabecera de pago           (cero I/O)      → 402 + desafío si falta
3. verificar / settlear con el facilitator          → 402 si falla
4. leer el snapshot cacheado       (I/O, barato)
5. serializar CSV/JSON
6. 200 con el archivo en el body
```

⛔ **Los pasos 4–5 no ocurren antes del 3.** Es el requisito explícito del founder y la
única forma de que un atacante sin fondos no pueda hacer trabajar al servidor.

⛔ **La validación (1) va ANTES del pago (2), no después.** Cobrarle a alguien por un
request que igual va a terminar en 400 es peor que no cobrarle: le sacás plata por un
archivo que no existe.

### 4.1 El desafío 402 no toca la base

Precio, moneda, red y descriptor del recurso son **estáticos**. El 402 se construye sin
una sola query. Si construir el desafío costara una agregación, el paso 2 sería el mismo
DoS gratis que el paso 4 evita.

### 4.2 Por qué x402 y no una transferencia directa

MiniPay **sí soporta `eth_signTypedData_v4`** — medido en device
([[project_minipay_platform]]; la regla "no message signing" de Celopedia está STALE).
Entonces el esquema `exact` de x402 (EIP-3009 `transferWithAuthorization`) funciona
dentro del mini app.

Y es estrictamente mejor que una transferencia directa: **el usuario no manda una
transacción**, la settlea el facilitator. Las wallets de MiniPay **no tienen CELO**
([[project_minipay_platform]]), así que cualquier write propio arrastraría
`getMiniPayFeeCurrency` y su retry. Con x402 ese problema no existe.

### 4.3 Replay

El nonce de la autorización EIP-3009 lo consume el contrato: una autorización no se
reusa. **Encima de eso, el archivo se devuelve en el cuerpo del 200** — no se emite
ningún enlace de descarga. Sin enlace no hay enlace que expire ni que compartir, lo que
elimina por construcción la salvaguarda de "expiración corta del recibo".

---

## 5. Cache: dos capas, y la segunda regala el archivo

**(a) Reuso del snapshot.** El export lee el mismo `unstable_cache` horario que el
dashboard, keyeado por `(surface, container)`. Diez descargas = **cero** agregaciones
extra. Es lo que pedía el brief y sale gratis por reusar `getPublicStats`.

**(b) ⛔ La respuesta pagada NO puede ser cacheable.** Si el edge cachea el 200 con el
archivo, **el segundo visitante lo baja sin pagar** y el cobro entero es decorativo. La
respuesta lleva `Cache-Control: private, no-store` explícito, y hay un test sobre los
headers. No alcanza con suponer que leer una cabecera vuelve la ruta dinámica.

Son dos capas en serie con requisitos opuestos: la de datos **debe** cachear, la de
respuesta **no debe**. Confundirlas en cualquier dirección rompe algo.

### 5.1 El cache no se puede testear ingenuamente

`unstable_cache` lanza `incrementalCache missing` fuera de un request de Next — está
documentado en este repo (`app/api/scores/save/__tests__/route.test.ts:17`). En vitest
**el cache no existe**, así que un test de reuso escrito de frente pasaría en verde
contra un memoizador que nunca memoiza.

Se usa el seam que ya existe (`lib/content/merged-catalog.ts:350`): un memoizador falso
real, keyeado por el array, que permite afirmar que dos exports con los mismos filtros
comparten una sola agregación.

---

## 6. Rate limit: no en v1, y por qué

El brief pedía rate limit por wallet. **Recomiendo no construirlo todavía:**

- El pago **es** el rate limit. Cada request cuesta 0.01 USDC.
- El trabajo por request es leer un snapshot cacheado y serializarlo — el costo marginal
  de la descarga número 100 es casi cero (§5a).
- Un límite por wallet necesita identidad estable, y x402 gatea por **pago, no por
  identidad** (backlog). Sería una defensa cara contra un ataque que paga por ejecutarse.

Queda escrito para que la ausencia se lea como decisión y no como olvido. Si aparece
abuso real, el lugar es Redis (ya cableado) keyeado por el `payTo` del recibo.

---

## 7. UI

Un botón **Download data** en `/stats`, junto a los controles de filtro, que hereda los
filtros activos.

| Estado | Qué se ve |
|---|---|
| Normal | `Download data` + el precio en claro: **$0.01** |
| Sin `STATS_EXPORT_PAY_TO` | El botón **no se renderiza**. Fail closed: hoy la env no existe en ningún entorno, así que el deploy no muestra un botón roto. |
| Pago pendiente | Estado de espera; sin spinner infinito — timeout con reintento. |
| Pago rechazado / cancelado | Vuelve al estado normal. Cancelar **es** el usuario, no un error. |
| Descarga lista | El navegador baja el archivo; el botón vuelve a normal. |

**Copy (regla dura de MiniPay §3):** ni *gas*, ni *crypto*, ni *onramp/offramp*. Si hay
que nombrar el costo de red es **Network fee** — aunque acá no hay, porque el usuario no
manda tx (§4.2). Nada de direcciones `0x…` en pantalla.

---

## 8. Plan de trabajo (TDD, commits atómicos)

| # | Etapa | Test primero |
|---|---|---|
| 1 | ~~`noindex` + sitemap~~ | ✅ hecho (`5595722`) |
| 2 | `lib/stats/export.ts` — serializar `PublicStats` a CSV/JSON | Round-trip de campos; **ninguna wallet en la salida**; CSV con comas/comillas escapadas. |
| 3 | Ruta + validación, **sin pago** | `format` inválido → 400 **sin** tocar la base (spy en el aggregator). Filtros desconocidos colapsan a `all`. |
| 4 | Desafío 402 | Sin cabecera de pago → 402, cuerpo con precio y `payTo`, **cero queries**. Precio en unidades de 6 decimales. |
| 5 | Verificación + orden | ⛔ El aggregator **no se llama** si la verificación falla. Es el test central del spec. |
| 6 | `Cache-Control: private, no-store` | Sobre los headers del 200. |
| 7 | Reuso de snapshot | Con el seam de §5.1: dos exports, una agregación. |
| 8 | Botón + estados | Incluye el caso "env ausente → no se renderiza". |

**Verificación final** (una sola corrida): suite de `web`, `pnpm exec tsc --noEmit`,
`content:audit`.

---

## 9. Riesgos y preguntas abiertas

1. ⛔ **¿Hay facilitator de x402 en Celo?** Es la incógnita que puede mover el plan
   entero. Si no hay uno público, hay que auto-hospedarlo, y eso es un frente propio, no
   una etapa. **Recomiendo un spike de medio día antes de la etapa 4** — el resto
   (etapas 2, 3, 6, 7) no depende de la respuesta y puede avanzar igual.
2. ⚠️ **MiniPay no manda `Origin`/`Referer`** ([[project_minipay_platform]]). El bypass de
   `enforceOrigin` es deliberado; si el endpoint nuevo endurece origen a ciegas, **muere
   dentro del mini app**, que es la distribución principal.
3. ⚠️ **El `format` viaja en la URL y la URL entra en logs.** No es secreto, pero el
   endpoint no debe aceptar nada más por querystring que lo enumerado en §3.1.
4. ⚠️ **`/stats` es `noindex` pero el endpoint es una API** — no lo indexa nadie. No hace
   falta tocar `robots`.
5. 🟢 Sin migración, sin schema, sin contratos nuevos. Reversible con un revert.
6. **¿El botón va en learn y play, o sólo en uno?** El endpoint es el mismo código en los
   dos deployments. Asumo **los dos** salvo que digas otra cosa.
