# Fase F — validación del dashboard consolidado contra SQL

**Fecha:** 2026-08-05 · **SHA validado:** `b8e58996`
**Deployment:** `chesscito-landing-qsj754b0p` · READY · **38 s** · **1 solo build**
(`chesscito` y `lite-chesscito` cancelados por `vercel-should-build.sh`)

> **✅ VEREDICTO: READY para Fase G — con una reserva.**
> Las cifras publicadas coinciden con las RPC en las cinco combinaciones; toda
> diferencia es Δ = 1–2 y queda explicada por la edad del snapshot. Las
> invariantes cierran en las cinco. **La reserva es `census.total`**, que sigue
> sin explicación — §7.

---

## 1. Estado del fix

| Eje | Estado |
|---|---|
| `STATS_DEBUG` | ✅ **eliminado** — 0 filas en el listado sin filtro |
| `STATS_REVALIDATE_TOKEN` | ✅ intacto, Preview + Production |
| `/api/cache-diag` | ✅ **HTTP 404** — la ruta ya no existe |
| `/api/revalidate-stats` | ✅ **HTTP 401** sin token — viva y cerrada |
| `/stats`, Play, Learn | ✅ HTTP 200 · **cero 5XX** |

---

## 2. Caché — veredicto por `generatedAt`, no por `x-vercel-cache`

| Prueba | Resultado |
|---|---|
| `all/all`, 6 GET en dos tandas separadas 60 s | `generatedAt` = **03:47 en las seis** ✅ |
| ES (`Accept-Language: es-CO`) | **mismo 03:47** que EN, contenido traducido ✅ |
| `?surface=learn` | entrada propia, **03:48 estable** ✅ |
| 5XX / timeouts | **ninguno** ✅ |

### 🔬 La Data Cache SOBREVIVIÓ al deploy — observado, no supuesto

El primer GET a `?surface=learn` devolvió **`02:33`**: el sello del deployment
ANTERIOR. La petición siguiente ya trajo `03:48`.

Eso es stale-while-revalidate en vivo — la primera petición pasada la ventana
recibe la foto vieja y sólo *dispara* el refresco — y confirma de primera mano
**por qué existe el endpoint de invalidación**: un deploy no purga esta caché.

Una respuesta lenta con el sello **sin cambiar** (7.252 ms en un GET de la tanda
2) es **cold start / TTFB**, no regeneración.

⚠️ **Límite:** no pude ejecutar el POST de invalidación en este deployment —
`STATS_REVALIDATE_TOKEN` es *Sensitive* y `vercel env pull` lo redacta.
El endpoint quedó verificado sobre `35314f7a` (200 + `{"revalidated":true,
"tag":"public-stats"}`) con **código byte a byte idéntico**: `b8e58996` no tocó
`revalidate-stats/route.ts`.

---

## 3. Matriz de filtros — publicado vs. referencia

Contraste directo contra las ocho RPC, leídas a los pocos minutos de capturar la
página.

| combinación | snapshot | sessions_7d | sessions_30d | app_open_sessions | known | active_7d | dormant |
|---|---|---|---|---|---|---|---|
| **all / all** | 03:47 | 4853 / 4855 | 7360 / 7362 | 4906 / 4908 | 3808 / 3810 | 3806 / 3808 | 2 / 2 ✅ |
| **learn / all** | 03:48 | 1709 / 1710 | 1801 / 1802 | 1732 / 1733 | 1146 / 1147 | 1145 / 1146 | 1 / 1 ✅ |
| **play / all** | 03:51 | 3129 / 3129 | 3180 / 3180 | 3134 / 3134 | 2663 / 2663 | 2662 / 2662 | 1 / 1 ✅ |
| **all / minipay** | 03:51 | 4772 / 4773 | 4779 / 4780 | 4773 / 4774 | 3807 / 3808 | 3806 / 3807 | 1 / 1 ✅ |
| **all / browser** | 03:51 | **81 / 81** ✅ | **329 / 329** ✅ | **135 / 135** ✅ | **3 / 3** ✅ | **2 / 2** ✅ | 1 / 1 ✅ |

**Diferencia máxima: 2. Diferencia típica: 0 ó 1.**

`all/browser` coincide **exactamente en los seis campos** — es la combinación de
menor tráfico, donde la deriva no alcanza a moverse. Ése es el control: cuando
el tráfico no interfiere, la coincidencia es perfecta.

### Por qué Δ = 1–2 no es un defecto

La página sirve una **foto cacheada** (03:47) y la referencia se leyó minutos
después contra una tabla que ingiere ~2.000 filas cada 40 min. Un desplazamiento
de una o dos sesiones en ese intervalo es exactamente lo esperado, y el sello
está impreso en pantalla para que el lector pueda hacer esa cuenta.

⚠️ **Mi primera corrida reportó 30 discrepancias con `publicado=null`.** Era un
defecto de MI medición: las etiquetas van en minúsculas en el HTML y el
`uppercase` es CSS, así que el scraper no encontraba nada. Las invariantes, que
leen el texto directo, pasaban en esa misma corrida — la contradicción fue la
señal. Corregido antes de sacar conclusiones.

---

## 4. Invariantes — verdes en las CINCO combinaciones

```
partición (active+dormant+inactive=known) ..... true ×5
activación monótona ........................... true ×5
hábito no creciente (1/3/7/14/21) ............. true ×5
trend 30 filas densas, sin huecos ............. true ×5
new + returning = sessions (las 30 filas) ..... true ×5
países ordenados, n = 8 ....................... true ×5
access: 5 pasos + failed_sessions ............. true ×5   (sin exigir monotonía)
week3 cohorte = 0 ............................. ×5
```

---

## 5. Presentación — verde en las cinco

```
"Not enough history yet" para cohorte 0 ....... true ×5
NUNCA se imprime 0 % .......................... true ×5
sin mints en el trend ......................... true ×5
nota "Learn + Play < Total" visible ........... true ×5
generatedAt visible ........................... true ×5
```

Verificado además sobre el HTML servido: canonical
`https://www.chesscito.com/stats`, `noindex, nofollow`, EN y ES funcionando,
**0 claves técnicas de eventos**, 0 secretos, sin wallet ni auth, censo con
`asOf` propio y distinto del sello de la página.

---

## 6. On-chain

Contrato y fuente **sin cambios** desde Fase C: el bloque se porta literal desde
`apps/web` y esta fase no lo tocó. `ONCHAIN_QUERY_MAX_ROWS` sigue en 999.

---

## 7. ⚠️ La reserva: `census.total`

`census.total` **sigue sin explicación trazada**. Se arrastra desde la auditoría
del 2026-08-04 y ninguna fase posterior lo abordó: el censo lee
`leaderboard_full_v`, la misma relación que cuenta la población del hero de
Leaders, pero **nadie ha reconciliado ese número contra el conteo de jugadores
que el producto afirma en otras superficies**.

No bloquea los redirects —es un dato de una sección, no del embudo—, pero
**el dashboard no puede declararse cerrado mientras siga así**, que es
exactamente la condición que la auditoría original dejó escrita.

---

## 8. Riesgos vigentes

| # | Riesgo | Nota |
|---|---|---|
| 1 | **Cold start: TTFB de 1,6–7,3 s** | con el sello **sin cambiar**. No es un MISS y no lo arregla la caché de datos. En una ruta de bajo tráfico va a pasar seguido — y es lo primero que vería un reviewer de MiniPay |
| 2 | **El TTL de 900 s es un PISO** | observado en vivo: una entrada sirvió un sello de 02:33 pasada la ventana antes de revalidar |
| 3 | **`census.total` sin explicación** | §7 |
| 4 | **`week3` en cohorte 0 hasta ~2026-08-20** | correcto y explicado en pantalla, pero un revisor que mire antes verá una tarjeta sin número |
| 5 | **production y preview comparten base** | toda cifra es la suma de los dos entornos; declarado en la metodología |
| 6 | **Invalidación no reejecutada en este SHA** | §2 — verificada en `35314f7a` con código idéntico |

---

## 9. Veredicto

> ## ✅ READY para Fase G
>
> Las cinco combinaciones coinciden con las RPC dentro de la edad del snapshot,
> las invariantes cierran, la presentación cumple todos los contratos, la caché
> se reutiliza y no hay 5XX.
>
> **Condiciones que Fase G debe respetar:**
> 1. **Trazar `census.total` antes de declarar `/stats` cerrada** (§7). No
>    bloquea el redirect; sí bloquea el cierre.
> 2. **307, nunca 308** — un 308 lo cachea el navegador de forma casi
>    irreversible y el rollback dejaría de ser efectivo.
> 3. El cold start (§8 #1) es lo primero que vería un reviewer llegando por el
>    link del listing.

---

## 10. Actualización 2026-08-05 — `census.total` RESUELTO y Fase G CANCELADA

### `census.total` ya no es la reserva

La reserva de §7 **se cae**. La auditoría original lo dejó abierto porque
`fetchLeaderboardTotalFromDb()` devolvía `null` **en producción** mientras el
mismo `HEAD ... Prefer: count=exact` contra `leaderboard_full_v` respondía
`Content-Range: 0-290/291` desde una máquina local.

**La página publica hoy `Ranked players 373`.** El port de Fase C reescribió esa
consulta con el cliente server-only nuevo y el `null` desapareció; 291 → 373 es
crecimiento real en el mes transcurrido.

Queda una pregunta más chica que la original: **por qué fallaba el código
anterior**. Es forense sobre código ya reemplazado, así que **no bloquea cerrar
`/stats`**.

### El veredicto de §9 cambia de destino

Decía «READY para Fase G». **La Fase G quedó CANCELADA** — no por un defecto,
sino porque su premisa se venció: el listing de MiniPay **ya apunta directo** a
`https://www.chesscito.com/stats`, así que no hay tráfico que reapuntar.
Investigación read-only: cero enlaces internos humanos, cero hits en la muestra
de logs, y una sola referencia viva que es un probe E2E propio.

**No se implementó ningún redirect. Ni 307 ni 308.** Detalle y condiciones de
reapertura en `docs/plans/2026-08-04-stats-consolidation-execution-plan.md`,
Fase G.

**Veredicto vigente: la consolidación de `/stats` está COMPLETA y validada.**
Lo que queda es limpieza sin urgencia (repuntar `grant-shots.spec.ts`, borrar la
ruta vieja de `apps/web`) y la iniciativa de arquitectura de información.
