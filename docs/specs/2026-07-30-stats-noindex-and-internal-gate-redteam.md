# Red team — `/stats`: noindex + recorte de internals

**Spec revisado:** `2026-07-30-stats-noindex-and-internal-gate.md`
**Fecha:** 2026-07-30
**Veredicto:** **NEEDS REVISION** — el spec es correcto en la clasificación, pero tiene
**dos huecos de filtración** que no cubre (F1, F2), **un bug de protocolo** que las
decisiones del founder acaban de introducir (F3), y **un test que no puede fallar**
(F4). Ninguno bloquea la etapa 1, que es independiente y sale como está.

Las 6 decisiones del founder están incorporadas abajo y **tres de ellas cierran
hallazgos que este red team habría abierto igual** (D1 saca el token de la URL, D5
hace visible la diferencia entre las dos vistas, D6 endurece el test de cache).

---

## Hallazgos bloqueantes

### F1 ⛔ El spec protege una capa de cache y deja la otra abierta

§3.3 cubre `unstable_cache`. **No dice nada del cache HTTP.** Son dos caches en serie
y el segundo es el que sirve al público:

`/stats` declara `export const revalidate = 3600`. Hoy la ruta es dinámica por
`searchParams`, así que en la práctica no se cachea en el CDN — pero eso es un
accidente de la implementación actual, no una garantía declarada. En cuanto la
respuesta lleve `s-maxage`, **una respuesta renderizada con la cookie de unlock puede
quedar cacheada en el edge y servirse a visitantes anónimos**. Es exactamente el mismo
fallo que §3.3, un piso más arriba, y el spec lo pasa por alto porque razonó sobre la
capa que estaba mirando.

Leer `cookies()` marca la ruta como dinámica en Next 14 y eso *debería* bastar. "Debería"
no es una invariante.

**Corrección:** la respuesta desbloqueada emite `Cache-Control: private, no-store`
explícito. Y el test lo verifica sobre los headers, no sobre la suposición de que
`cookies()` alcanza. Un `revalidate` de una hora que convive con una cookie de
privilegio necesita que la exclusión esté **escrita**, no inferida.

### F2 ⛔ `dataIntegrity.truncated` nombra las lecturas internas

El aviso de truncamiento imprime los nombres de las lecturas que tocaron el techo de
filas (`stats-page.tsx:759`), y es **público por diseño** — el spec lo clasifica bien
en §2.1, porque ocultarlo empeora la lectura de los números.

Pero si una lectura interna se trunca, su nombre entra en esa lista. Un anónimo lee
entonces algo como *"…, access funnel, account lifecycle"* debajo de una página donde
esos bloques no existen. Filtra la existencia y el nombre de lo que se recortó, en la
única prosa que la página promete no maquillar.

**Corrección:** con `internal === null`, `truncated` se filtra a las lecturas públicas.
⚠️ Y si al filtrar la lista queda vacía, el aviso **desaparece entero** — correcto, pero
significa que la vista pública puede no advertir un truncamiento que sí ocurrió en un
bloque que ella no muestra. Eso es consistente: no se le debe una advertencia sobre
datos que no ve.

### F3 ⛔ D4 (POST) introduce un bug de redirect y deja el unlock sin puerta de entrada

Dos problemas distintos, los dos nuevos:

**(a) 302 sobre POST re-envía el POST.** El spec dice "redirige 302". Sobre un GET daba
igual; **sobre un POST, un 302 permite al cliente repetir el método en el destino**, y
`/stats` recibiría un POST. El código de estado correcto para POST→GET es **303 See
Other**. Es el bug clásico del patrón POST/Redirect/GET y lo acaba de habilitar D4.

**(b) No hay desde dónde hacer el POST.** Con GET `?key=`, el founder pegaba una URL.
Con POST, un `curl -X POST` deja la cookie **en el jar de curl, no en el navegador** —
el unlock se vuelve inalcanzable desde la superficie donde se lo necesita. El spec no
define ningún origen para ese POST.

**Corrección:** un `<form method="POST" action="/api/stats/unlock">` con un input
`type="password"`, detrás de un enlace discreto **"Internal access"** al pie de `/stats`.
Sin JS, el token viaja en el body — que es justamente lo que D4 pide: fuera de la URL,
fuera del `Referer`, fuera de los logs de acceso.

**No lleva token CSRF.** Un POST cross-site sólo tendría efecto si el atacante ya
conoce el secreto, y en ese caso no necesita CSRF. Dejarlo escrito para que nadie lo
"arregle" después.

### F4 ⛔ El test de cache que pedía el spec no puede fallar

D6 ya identificó que inspeccionar la key textual es insuficiente. El motivo es peor de
lo que sugiere: **`unstable_cache` lanza `incrementalCache missing` fuera de un request
de Next** — está documentado en este repo, en
`app/api/scores/save/__tests__/route.test.ts:17`. O sea que en vitest el cache real
**no existe**. Un test de aislamiento escrito ingenuamente pasaría en verde contra un
cache que nunca memoiza nada, y seguiría pasando el día que la key esté mal.

Ese es el peor resultado posible: la única defensa contra F1/§3.3 sería un test que
**no puede detectar el fallo que dice cubrir**.

**Corrección:** seguir el precedente de `merged-catalog.ts:350` — un **seam de test**
que sustituye `unstable_cache` por un memoizador falso, real, keyed por el array. El
test entonces demuestra lo que D6 pide: cargar con `includeInternal: true`, cargar
después con `false` y **los mismos filtros**, y verificar que la segunda **no** recibe
el payload de la primera. El aserto es sobre el payload devuelto, no sobre la key.

---

## Hallazgos no bloqueantes

### F5 ⚠️ Las dos capturas de D5 pueden salir idénticas y en verde

`grant-shots` corre **local, nunca en CI** ([[project_vr_suite_facts]]). Si
`STATS_INTERNAL_TOKEN` falta en el `.env` local, la cookie que Playwright inyecta (D1)
no valida, y `stats-internal.png` sale **idéntica a `stats-public.png`** — dos archivos
distintos, misma foto, test verde. Es el patrón ya conocido
([[feedback_vr_green_can_photograph_an_error]]).

Y el riesgo simétrico es peor: si el contexto se comparte y el orden cambia,
**`stats-public.png` podría salir CON los internals** y terminar adjunta a una
aplicación a grant. La foto pública es la que se distribuye.

**Corrección:** cada captura **afirma antes de disparar**. La interna exige que los 4
encabezados estén presentes; la pública exige que estén ausentes. Contextos separados,
sin depender del orden.

### F6 ⚠️ `tokenMatches` está copiado en cuatro rutas

`api/admin/{content,content/stage,content/revalidate,lite-stats}/route.ts` tienen la
misma función, carácter por carácter. El spec manda "mismo patrón que
`lite-stats:69`", que en la práctica significa **una quinta copia**.

Una comparación de secretos duplicada cinco veces es una que se arregla en cuatro
lugares cuando se arregla. Y es justo la clase de duplicación que renderiza bien y pasa
todos los tests de comportamiento ([[feedback_duplicated_geometry_passes_every_behavioural_test]]).

**Corrección:** extraer a `lib/server/timing-safe-token.ts` y que la ruta nueva lo
importe. Migrar las otras cuatro **no** es parte de este cluster — anotarlo, no hacerlo.

### F7 ⚠️ `Secure` en la cookie rompe el unlock local

Si la cookie sale siempre con `Secure`, Playwright y el navegador local sobre
`http://localhost:3002` quedan en un borde que depende del navegador. `Secure` sólo
cuando `NODE_ENV === "production"`.

### F8 ⚠️ Son dos deployments, entonces son dos unlocks

learn y play son orígenes distintos: la cookie no cruza. Con un solo
`STATS_INTERNAL_TOKEN` compartido (§4.1, correcto), **igual hay que desbloquear cada
dominio por separado**. No es un defecto; es una expectativa que el spec no dejó escrita
y que va a parecer un bug la primera vez.

### F9 🟢 `?lock=1` por GET es aceptable

Un GET que muta estado se dispara con un `<img src>`. Acá el único efecto es cerrar tu
propia vista interna. Sin escalada. D4 lo conserva a propósito y está bien.

---

## Lo que el spec acertó y no hay que tocar

- **La clasificación de §2.** El criterio (MiniPay §8 manda) es verificable y deja la
  decisión fuera del gusto. `retention` y `topCountries` públicos **no** son un
  descuido.
- **Recortar en el aggregator, no en el render** (§3.2). Sin eso, todo lo demás es
  decorado: el payload RSC viaja igual.
- **`internal: null` ≠ campos en `null`** (§3.1). Distinguir "no autorizado" de "roto"
  es lo que hace legible la vista interna.
- **Fail closed sin env.** El deploy oculta antes de que nadie configure nada.

---

## Cambios al plan de trabajo

Etapas revisadas (las nuevas van marcadas):

| # | Etapa | Cambio |
|---|---|---|
| 1 | `noindex` + fuera del sitemap | **sin cambios — arranca ya** |
| 2 | Extraer `timing-safe-token.ts` | 🆕 F6, antes de la ruta |
| 3 | Partir el tipo + `includeInternal` | sin cambios |
| 4 | Cache key **+ seam de test** | 🆕 F4, D6 |
| 5 | `Cache-Control: private, no-store` | 🆕 F1 |
| 6 | `POST /api/stats/unlock` + **303** + form | F3, D4 |
| 7 | Render + chip visible + filtrar `truncated` | F2, D2 |
| 8 | Copy + renumeración | sin cambios |
| 9 | `grant-shots`: 2 capturas con asertos | F5, D1, D5 |

**Pendiente antes del deploy final (D3):** confirmar §8 con MiniPay. No bloquea nada
de lo anterior.
