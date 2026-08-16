# ¿Qué señal recibe Chesscito cuando MiniPay lo abre desde su catálogo?

**Fecha:** 2026-08-16 · **Tipo:** inventario de sólo lectura, sin código nuevo
**Motivo:** el Lote 3 del plan de instrumentación (`docs/plans/2026-08-16-evidence-instrumentation-execution-plan.md`)
partía de una premisa que el founder corrigió: **no existe una URL de listado a la que
podamos colgarle `?utm_source=`**. El journey real es abrir MiniPay, buscar Chesscito y
abrirlo desde el catálogo. Los deep links externos ya se intentaron y MiniPay no los permite
para este caso.

---

## Veredicto

⛔ **NO ATRIBUIBLE HOY.** No existe ninguna señal — ni de URL, ni de referrer, ni de SDK, ni
de cabecera — que distinga **listado / búsqueda / push** dentro de MiniPay.

✅ Lo que **sí** está resuelto y no hay que construir: distinguir el **runtime** MiniPay del
navegador. Eso ya viaja en cada evento.

⛔ **No se inventa `minipay_listing`.** Un valor canónico que nadie puede poblar es
vocabulario muerto que después se lee como si significara algo.

---

## Lo que se inspeccionó, y qué dio

| Señal candidata | Dónde vive | Qué dice |
|---|---|---|
| **Query params** | `lib/analytics/attribution.ts:33-39` | La URL enviada al intake es `https://www.chesscito.com` **pelada** (`docs/audits/2026-06-03-minipay-intake-form-packet.md:16`). Sin parámetro, `getAttribution()` resuelve a `direct` y lo **persiste first-touch** |
| **`document.referrer`** | nadie lo lee | Cero lectores en el código (los hits de grep son todos `rel="noopener noreferrer"`). Y hay evidencia previa en contra: el WebView de MiniPay **omite `Origin` y `Referer`**, documentado en tres módulos servidor a raíz de incidentes reales (`lib/server/early-access-origin.ts:7`, `lib/server/score-save-origin.ts:5`, `lib/server/demo-signing.ts:147`) |
| **SDK / launch context de MiniPay** | — | **No hay SDK.** `apps/web/package.json` no tiene ninguna dependencia `@celo` / `minipay` / `@opera`. El único contrato con MiniPay es el proveedor EIP-1193 inyectado |
| **Provider inyectado** | `lib/minipay.ts` | `window.ethereum.isMiniPay` es un **booleano**. Dice *en qué* estás, no *cómo llegaste* |
| **User-Agent** | `lib/server/wallet-detection.ts:17` | La UA contiene `MiniPay` verbatim → identifica el WebView. Mismo techo: runtime, no ruta de entrada |
| **Cookie / storage previo** | `attribution.ts:25` | Sólo devuelve lo que ya guardamos. No puede crear información que nunca entró |

## El argumento que cierra el tema, incluso si la URL se pudiera cambiar

⛔ **Una sola URL no puede separar tres caminos de entrada.** El listado, la búsqueda del
catálogo y un push abren **la misma** App URL registrada. Aunque re-enviáramos el intake con
`?utm_source=minipay_listing`, los tres entrarían marcados igual — el parámetro nombraría *la
integración*, no *la superficie*, y produciría una distinción falsa que después nadie podría
desarmar. La única forma real sería que MiniPay pasara un parámetro propio por camino, que es
exactamente lo que no ofrece.

## Lo que sí sabemos hoy de cada wallet de MiniPay

```
source    = "direct"            (first-touch, por ausencia de parámetro)
container = "minipay"           (isMiniPay en cliente, UA en servidor)
```

⚠️ **`minipay_discovery` existe en `SOURCES` y nunca se puebla.** Está en el allow-list desde
el diseño del vocabulario junto a sus alias `minipay` y `discovery`
(`lib/analytics/dimensions.ts:30,49-52`), pero nada escribe ese token porque nada lo pone en la
URL. Quien lea la tabla hoy verá `minipay_discovery = 0` y puede concluir que **nadie llega por
MiniPay**, que es lo contrario de la verdad: llegan **todos**, contados como `direct`.
Ese es el riesgo de lectura que este documento previene.

## Consecuencia para el reporte de evidencia

El §9 del research trata la adquisición como una brecha de instrumentación *que se puede
cerrar*. Con este inventario, la parte de "qué superficie de MiniPay" pasa a ser
**`[UNKNOWN]` estructural, no una tarea pendiente**: depende de que la plataforma emita algo
que hoy no emite. La pregunta "¿el 95% one-and-done es basura de adquisición o fallo de
producto?" **no se contesta con atribución** en MiniPay. Si se quiere contestar, hay que
atacarla por comportamiento (lo que el research ya hace en §8), no por origen.

## Lo que queda abierto, sin costo

1. **Medir `document.referrer` en el WebView.** Es una línea en una página `/dev`, no
   atribución nueva. Contestaría si el `Referer` ausente de los fetch también falta en la
   navegación de nivel superior. ⚠️ Predicción explícita, para poder equivocarme: **vacío**.
   Si saliera poblado con algo de MiniPay, este veredicto se reabre.
2. **Preguntarle a MiniPay** si el catálogo puede pasar un parámetro por superficie. Es la
   única vía que convertiría esto en medible, y está enteramente fuera del repo.
3. **`web_early_access` sí funciona** como precedente: ahí controlamos el link, y por eso el
   canal se distingue. Es la prueba de que el mecanismo está bien y lo que falta es la
   emisión, no el receptor.
