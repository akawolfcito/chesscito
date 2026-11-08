# Play: validación P0 de caché de assets públicos

Fecha: 2026-10-29, consultas aproximadamente 05:02–05:11 UTC.
Rama: `fix/play-vercel-usage`; HEAD/base: `b7f5457b`.
Sin deploy, push, commits, cambios de main ni integración Cloudflare.

## Resultado

La hipótesis queda respaldada para la navegación medida: los assets públicos
de producción requieren revalidación y generan solicitudes al CDN aunque
este responda HIT. El parche implementado añade caché de navegador de 24 h
para tres grupos de medios públicos. No demuestra todavía ahorro facturado
en producción.

## Cabeceras reales de producción

Consultas HEAD a `https://play.chesscito.com`; además navegación GET real en Chromium.

| Ruta | HTTP | Cache-Control | x-vercel-cache inicial |
| --- | --- | --- | --- |
| `/art/chesscito-board.png` | 200 | `public, max-age=0, must-revalidate` | HIT |
| `/art/bg-splash-chesscito.webp` | 200 | igual | MISS |
| `/art/avatar-fun.avif` | 200 | igual | MISS |
| `/art/new-assets-chesscito/hub/chesscito-normal-portal.webp` | 200 | igual | MISS |
| `/fonts/Cinzel-Bold.ttf` | 200 | igual | HIT |
| `/animations/sparkles.json` | 200 | igual | MISS |
| `/animations/interactive-mage-animation.lottie` | 200 | igual | MISS |
| `/icon-512.png` | 200 | igual | HIT |
| `/_next/static/media/043945717efb3a31-s.p.woff2` | 200 | `public,max-age=31536000,immutable` | HIT |

En el tablero, HEAD condicional con el ETag devuelto produjo **304**, manteniendo
`max-age=0, must-revalidate` y HIT. Un HIT del CDN no evita la solicitud del navegador.
La fuente pública tuvo Age 1.033.016 s y el tablero 822.719 s: la caché del CDN
ya funciona, pero el navegador tiene obligación de revalidar.

La ruta histórica `/art/bg-game.webp` devolvió 404, `private, no-cache,
no-store, max-age=0, must-revalidate`; no se contabiliza como asset válido.
Inventario local: 901 archivos en public; 884 imágenes en art
(294 AVIF, 280 PNG, 309 WebP y un JPG). No todos se solicitan en una visita.

## Cuántos 304 son de art

Recorrido productivo: `/` → `/arena` → `/minigames`, seguido por el mismo
recorrido con el mismo contexto de navegador. Persona MiniPay de prueba sin
cuenta conectada; viewport 390×844. No se inició ninguna partida ni pago.

| Pasada | 304 totales del mismo origen | 304 de art |
| --- | ---: | ---: |
| Inicial | 5 | 3 |
| Caliente | 41 | 36 |
| Ambas | 46 | 39 |

En caliente, 36/41 = 87,8% de los 304 observados corresponden a art.
Esto se refiere exclusivamente a esta captura. No se recibió el HAR ni los
logs originales de Claude y no se atribuyen sus 304 históricos a art.

## Parche y precedencia

Único archivo de implementación modificado: `apps/web/next.config.js`, 13 líneas.

- Imágenes bajo `/art/`: png, jpg, jpeg, webp, avif, svg, gif, ico.
- Fuentes bajo `/fonts/`: ttf, otf, woff, woff2.
- Animaciones bajo `/animations/`: json, lottie.
- Cabecera: `Cache-Control: public, max-age=86400`, sin immutable ni SWR.
- Las reglas solo se incluyen con `NODE_ENV=production`; next dev mantiene su
  comportamiento anterior. Se verificó la lista de reglas con ambos valores.
- No hay coincidencia con API, páginas, iconos raíz, archivos de texto,
  `/_next/static/` ni información personalizada. El config compartido también
  aplicaría a Learn si en el futuro se desplegara allí; no se desplegó nada.

La regla global anterior solo añade seis cabeceras de seguridad, ninguna de
caché. Las reglas nuevas van después y añaden otra clave. Las seis cabeceras
siguen presentes en respuestas locales de los assets.

Next 14.2.35 procesa headers antes del filesystem; si dos reglas escriben la
misma clave, gana la última. Se comprobó también el código instalado en
`next/dist/server/lib/router-server.js`: el año immutable corresponde a
`nextStaticFolder`, y el servidor público respeta la cabecera personalizada.
La prueba HTTP con next start confirma el resultado efectivo.

En Vercel, la prioridad de caché de CDN es Vercel-CDN-Cache-Control >
CDN-Cache-Control > Cache-Control; las cabeceras de Functions prevalecen sobre
las de configuración para esa misma clave. No se añadieron cabeceras dirigidas
al CDN ni reglas de Functions. El navegador recibe Cache-Control. La respuesta
efectiva del parche en Vercel queda pendiente, ya que no hubo despliegue.

Fuentes primarias consultadas:
[Next headers](https://nextjs.org/docs/14/app/api-reference/next-config-js/headers),
[Vercel Cache-Control](https://vercel.com/docs/caching/cache-control-headers).

## Theme Builder y riesgo de imágenes obsoletas

`catalog.ts` expone mtime; `dev/theme-builder/page.tsx:previewSrc` utiliza
`?v=<mtime>` para imágenes web y el streaming de preview para imágenes landing.
Upload/undo refrescan el catálogo con router.refresh. El GET del streaming
conserva `no-store`; se verificó por HTTP. Las escrituras son locales, se
bloquean en Vercel, y la superficie se bloquea en Vercel production.
No se ejecutaron uploads ni se reemplazó arte existente. La comprobación
adicional de reemplazo al final usa exclusivamente fixtures temporales.

Los componentes de runtime construyen URLs estables del registry, incluyendo
tripletes y tamaños responsivos, sin mtime/hash. Una imagen reemplazada con la
misma URL puede verse antigua durante hasta 24 h de frescura; un deploy o purge
del CDN no vacía la caché del navegador. Para publicación urgente, cambiar el
basename y sus referencias/familia completa, o introducir una versión de URL
en todos sus consumidores. No se implementa ese mecanismo adicional en este P0.
No se recomienda TTL anual immutable para estas URLs.

Límite comprobado: `/art/p0-missing.png` devuelve 404 HTML con el mismo TTL
de 24 h localmente, porque headers() coincide por ruta, no por existencia o
status. Al corregir un archivo ausente, una URL nueva evita una respuesta 404
guardada. La regla no amplía la caché de HTML fuera de los patrones de medios.

## Pruebas y medición local

Dos builds `pnpm --filter web build`, antes y después, completados con lint y
tipos. Persisten tres warnings previos de dependencias de hooks en duel-arena
y exercises-screen, sin errores. 47 tests existentes pasaron en estos archivos:

- `src/lib/themes/__tests__/catalog.test.ts`
- `src/app/api/dev/theme-asset/__tests__/route.test.ts`
- `src/app/dev/theme-builder/__tests__/derived-slot-ui.test.tsx`

Navegación contra next start en localhost:3002, mismo entorno local en ambos
builds, Chromium instalado 1248 mediante Playwright, viewport 390×844,
deviceScaleFactor 1, isMobile true. Provider MiniPay de prueba con request que
devuelve cuentas vacías. Un contexto nuevo por experimento; página nueva por
ruta, compartiendo caché entre páginas; espera de load más 4,5 s por ruta.
Sin routing/interception, cacheDisabled ni hard reload.

Se contó la red con `Network.responseReceivedExtraInfo.statusCode`: incluye
los 304 reales, aunque el DOM/Playwright muestre 200 por reutilización del body.
Los eventos lógicos de recursos no equivalen a solicitudes de red. Se excluyen
los eventos sin respuesta de red verificable de la columna siguiente.

| Pasada y ruta | Red assets antes | Red assets después | 304 art antes → después |
| --- | ---: | ---: | ---: |
| Inicial `/` | 19 | 19 | 0 → 0 |
| Inicial `/arena` | 17 | 13 | 4 → 0 |
| Inicial `/minigames` | 3 | 3 | 0 → 0 |
| Caliente `/` | 19 | 0 | 19 → 0 |
| Caliente `/arena` | 17 | 0 | 17 → 0 |
| Caliente `/minigames` | 3 | 0 | 3 → 0 |

Resultado caliente: **39 → 0 solicitudes verificadas de assets, -100% en ese
subconjunto**. Los 42 eventos lógicos de assets después se marcaron como caché
de navegador, sin respuestas de red. El primer acceso realmente frío a `/`
no reduce sus 19 solicitudes. La primera vuelta completa baja 39 → 35 por
reutilización de cuatro recursos compartidos entre rutas.

Las tres rutas retornaron 200 en ambas pasadas y builds. En ambos se verificaron
24 imágenes visibles en Hub, 17 en Arena y 3 en minigames, todas decodificadas;
se inspeccionaron capturas móviles del resultado. No se pulsó PLAY ni se ejerció
la lógica de partidas. El Hub local tiene más elementos que el productivo:
los entornos no son idénticos y estos totales no se extrapolan a producción.

Prueba adicional aislada de cinco URLs (TTF, JSON Lottie, contenedor .lottie y
dos versiones query de la imagen del tablero): 5 respuestas de red 200 en la
primera pasada y ninguna adicional en la segunda. La fuente se decodificó con
FontFace, el JSON incluyó layers, y el .lottie tuvo firma ZIP válida. Las dos
versiones de URL se descargaron separadamente. No se afirma haber validado
visualmente la reproducción de todas las animaciones.

HTTP local: PNG, AVIF anidado de Theme Builder, TTF, JSON y .lottie retornaron
200 y `public, max-age=86400`, con las cabeceras de seguridad. El icono raíz
retuvo `public, max-age=0`; la fuente next/font retuvo su año immutable.
La API de preview mantuvo no-store; las rutas API no coinciden con la regla.

## Qué falta para ahorro productivo

Después de una publicación autorizada separada, verificar headers reales en
Play/Vercel, repetir este recorrido sin desactivar caché y observar cohortes de
retorno con caché ya poblada. Comparar ventanas equivalentes por tráfico,
ruta, status y tipo de cliente, incluyendo solicitudes art, 304 y solicitudes
totales del CDN. La reducción global depende de visitantes recurrentes,
intervalo entre visitas, evicción del WebView y fracción de tráfico de assets.
No se promete -100% de CDN Requests globales ni un porcentaje de ahorro facturado.

## Complemento P0: confirmación y reemplazo real

Se retomó el trabajo sobre el mismo HEAD `b7f5457b` y rama
`fix/play-vercel-usage`. El working tree inicial de esta continuación no estaba
limpio: contenía exclusivamente el parche de 13 líneas y este informe de la
validación anterior. Se conservaron sin commit. No se cambió nuevamente el
parche; los dos builds y 47 tests anteriores corresponden a su contenido actual.

Se repitió una muestra HEAD de producción a las 05:26:34 UTC:

| Ruta | Cache-Control | ETag | Age | Vary | x-vercel-cache |
| --- | --- | --- | ---: | --- | --- |
| `/art/chesscito-board.png` | `public, max-age=0, must-revalidate` | `"77af0702ae463030ff266ebc17a9fe74"` | 824179 | ausente | HIT |
| `/art/redesign/bg/bg-new-hub.avif` | igual | `"784930c3849d2c9dc474582b86fc9129"` | 1149324 | ausente | HIT |
| `/art/bg-splash-chesscito.webp` | igual | `"5cbf9a48f92751dd28391dd35153d8cc"` | 1395 | ausente | HIT |

Las tres devolvieron 200 y las seis cabeceras de seguridad. Fueron tres
consultas individuales, sin prueba de carga.

### Reemplazo PNG, WebP y AVIF

Se crearon tres imágenes temporales de 8×8 en
`public/art/p0-cache-validation/replacement.{png,webp,avif}` antes de arrancar
next start. Chromium cargó cada imagen roja, se sobrescribió exclusivamente el
fixture con una imagen verde y se volvió a consultar con caché habilitada.
Se decodificaron los bytes con createImageBitmap y se leyó el píxel central con
canvas, comprobando el contenido real y no solo un status o nombre de archivo.

| Formato | Carga inicial | Misma URL después de reemplazar | URL con `?v=replaced` |
| --- | --- | --- | --- |
| PNG | rojo `[220,38,38]` | rojo `[220,38,38]` | verde `[22,163,74]` |
| WebP | rojo `[220,38,38]` | rojo `[220,38,38]` | verde `[21,163,74]` |
| AVIF | rojo `[219,36,38]` | rojo `[219,36,38]` | verde `[22,163,74]` |

Todos devolvieron `public, max-age=86400`. La misma URL conservó el ETag
anterior; la URL versionada obtuvo el ETag nuevo. Confirma experimentalmente
tanto el riesgo de obsolescencia como el mecanismo que ya usa el preview del
Theme Builder. El runtime sigue sin versionado automático: se elige el TTL
conservador de 24 h permitido para este P0, no caché immutable para arte editable.
Se detuvo el servidor y se eliminaron los tres fixtures y su directorio;
ningún archivo de arte existente se modificó.

### Solicitudes CDN y funciones, por separado

- Assets: la comparación de red local conservada es inicial 39 → 35 y caliente
  39 → 0. Son solicitudes HTTP que en producción llegarían al CDN; el después
  productivo todavía no existe porque no se desplegó el parche.
- APIs: la captura local posterior incluye cero respuestas de red `/api/` en
  ambos recorridos. La captura previa no guardó todos los eventos API; no se
  calcula una reducción antes/después de llamadas API.
- Funciones reales de Vercel: no se deducen del número de requests, de un HIT
  ni del conteo de URLs API. Se consultaron por separado
  `vercel.request.count` y `vercel.function_invocation.count`, usando el ID
  canónico de Play y scope `play-chess`, ventana production de 1 h.
  El esquema de CLI 65.2.0 confirmó aggregation `count` y dimensión
  `requestPath`. Las consultas corregidas devolvieron `payment_required`:
  **Observability Plus is required for this query**. No se contrató ningún plan.
  Los conteos productivos de CDN e invocaciones permanecen sin cuantificar.

### Recomendación

**GO para un despliegue controlado de Play, pendiente de autorización**, con
el límite explícito de frescura de 24 h y versionado de URL para actualizaciones
urgentes. No implica GO de ahorro financiero demostrado. Para comprobarlo,
harán falta cabeceras reales posteriores y métricas/exportaciones disponibles
del CDN y de funciones por separado, en ventanas comparables.

El único cambio de implementación continúa en `apps/web/next.config.js`.
Es configuración compartida con Learn: este P0 no cambia su despliegue; el
operador debe seleccionar únicamente el proyecto Play al publicar. El otro
archivo modificado es este informe. Sin cambios de APIs, usuarios, negocio,
dependencias, servicios, infraestructura, main ni ramas anteriores.
