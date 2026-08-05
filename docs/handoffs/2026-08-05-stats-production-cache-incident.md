# Incidente — el snapshot de `/stats` no se reutiliza en producción

**Fecha:** 2026-08-05 · **Deployment:** `chesscito-landing-z81lhauxk` · **SHA:** `b2c0873d`
**Estado:** **CAUSA IDENTIFICADA 2026-08-05** — ver
`docs/handoffs/2026-08-05-stats-production-cache-runtime-diagnosis.md`.
Fase F sigue bloqueada hasta retirar la instrumentación.

> **Resuelto por diferencia controlada en `35314f7a`:** el wrapper de
> `unstable_cache` se construía **por request**, y en Vercel eso mintea una
> entrada nueva en cada invocación. Memoizarlo a nivel de módulo dejó
> `generatedAt` estable en diez peticiones y una pausa de 60 s.
> **`force-dynamic` era inocente**, como decía la hipótesis 1 refutada abajo.
> ⚠️ Yo mismo descarté la memoización apoyándome en un contrafactual local que
> **no podía** detectar el defecto: `next start` es un proceso de larga vida.
**Severidad:** alta para el costo y la latencia; **cero** para la corrección de los números.

> **La página es funcionalmente correcta y sus cifras son buenas.** Lo que falla
> es la reutilización: cada visita parece regenerar el snapshot completo.

---

## 1. Qué se observó

Seis GET consecutivos a `https://www.chesscito.com/stats`, sin filtros, desde el
mismo cliente y en serie:

| # | Estado | Tiempo |
|---|---|---|
| 1 | 200 | 1,93 s |
| 2 | 200 | 2,28 s |
| 3 | 200 | 2,83 s |
| 4 | **000** | **38,79 s** ⬅ **la conexión colgó y falló** |
| 5 | 200 | 3,61 s |
| 6 | 200 | 1,87 s |

Y con filtro repetido: `?surface=learn` → 3,25 s y luego 2,32 s.

**En local, sobre un build de producción, un hit medía 27 ms.** Ninguna de estas
respuestas se parece a un hit.

### El timeout no es ruido

El GET 4 no devolvió código: la conexión murió tras 38,8 s. Si cada request
ejecuta 11 RPC + ~15 consultas on-chain + el censo contra una instancia Micro,
un pico de concurrencia puede agotar el presupuesto de la función. **Es el
síntoma más caro del incidente**, no una anécdota.

---

## 2. Lo que SÍ funciona

| Eje | Estado |
|---|---|
| `/stats` EN y ES | **HTTP 200**, dashboard completo, 6/6 secciones |
| canonical | `https://www.chesscito.com/stats` |
| `noindex, nofollow` | presente |
| Claves técnicas de eventos visibles | **0** |
| Secretos en el HTML | **0** |
| Wallet / auth | ninguno — pública |
| `Not enough history yet` | presente (cohorte 0) |
| Invalidación | sin token **401** · token malo **401** · GET **405** · token correcto **200** `{"revalidated":true,"tag":"public-stats"}` |
| Play y Learn | intactos |
| Deployment | READY en 47 s; `chesscito` y `lite-chesscito` **cancelados** por el script de skip — un solo build |

**Los números que publica la página son correctos.** El incidente es de
reutilización y costo, no de exactitud.

---

## 3. Cabeceras observadas

```
x-vercel-cache: MISS
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
age: 0
```

### ⚠️ ADVERTENCIA — `x-vercel-cache` NO es la prueba

**`x-vercel-cache` describe la caché de la RESPUESTA de la ruta, no el estado de
`unstable_cache`.** La página es deliberadamente dinámica (lee
`Accept-Language`), así que un `MISS` permanente en esa cabecera es el
comportamiento **esperado** aunque el snapshot se estuviera reutilizando
perfectamente por debajo.

**Usar esa cabecera como gate del snapshot sería medir la cosa equivocada.** La
evidencia real del incidente son los TIEMPOS: 1,9–3,6 s de forma consistente,
donde un hit local mide 27 ms. Esa es la única señal que hoy sostiene el
diagnóstico, y es indirecta.

La prueba determinante tiene que ser otra: **dos GET consecutivos deben devolver
el MISMO `generatedAt`**, y el segundo no debe ejecutar ni una RPC. Eso se
construye en el fix, no acá.

---

## 4. Corrección de lo que reporté

En el handoff de Fase E afirmé **«cache hit 27 ms, 74× más rápido»**. Esa
medición es real **y sólo vale para `next start` local**, donde un único proceso
mantiene un memo en memoria que puede enmascarar el comportamiento del runtime
de Vercel. **Extrapolarla a producción fue un error mío.**

Es el modo de fallo que ya tengo anotado: cuando una medición local contradice
lo que hace el device, el equivocado suelo ser yo.

---

## 5. Hipótesis abiertas — ninguna confirmada

| # | Hipótesis | Por qué es plausible | Por qué NO está probada |
|---|---|---|---|
| 1 | **`export const dynamic = "force-dynamic"`** (`page.tsx:51`) fuerza `fetchCache: "force-no-store"` en el scope de la ruta, y ése es el mismo incremental cache que usa `unstable_cache` | es la diferencia más visible entre la página y una cacheada | la documentación dice que `unstable_cache` funciona en rutas dinámicas; no lo medí aislado |
| 2 | **El wrapper de `unstable_cache` se construye POR REQUEST** — `loadStatsSnapshot()` llama a `createSnapshotLoader(...)()` en cada render | Next deriva parte de la clave del callback; un closure nuevo por request puede producir una entrada nueva cada vez | localmente daba hits, así que no explica por sí solo la diferencia |
| 3 | **Cold start por invocación** en Fluid, sin memo en memoria compartida | explicaría tiempos altos aun con caché sana | no distingue "caché fría" de "caché ausente" sin instrumentación |
| 4 | **Contención**: 11 RPC + ~15 on-chain + censo por request saturan la Micro | explica el timeout de 38,8 s | es consecuencia del fallo, no necesariamente su causa |

⛔ **`force-dynamic` es la hipótesis 1, no la causa.** Tratarla como confirmada
sin aislarla es exactamente cómo se arregla el síntoma equivocado.

---

## 6. Impacto

- **Costo**: cada visita ejecuta 11 RPC + ~15 consultas + el censo contra la
  base compartida de producción/preview.
- **Latencia**: 1,9–3,6 s, con al menos un fallo total observado.
- **Riesgo**: si el listing de MiniPay dirige tráfico acá antes del fix, el
  reviewer puede encontrarse el timeout.

---

## 7. Estado de Fase F

**BLOQUEADA.** Los números son correctos, pero firmar una validación de
consolidación sobre una página que incumple el gate de caché que el propio plan
puso enterraría el hallazgo dentro de un documento que dice «verde».

---

## 8. NEXT ACTION

> Diagnóstico local con instrumentación que distinga render / MISS / RPC /
> on-chain / censo, y que trate `force-dynamic` como **variable aislada**.
> Rama `fix/stats-cache`, basada en `b2c0873d`. Sin push y sin deploy
> exploratorio.
>
> Entregable: `docs/handoffs/2026-08-05-stats-cache-fix-review.md`.

---

## 9. Referencias

| Documento | Para qué |
|---|---|
| `docs/handoffs/2026-08-05-stats-phase-e-cache-review.md` | el contrato de caché y la medición local que no se sostuvo |
| `docs/plans/2026-08-04-stats-consolidation-execution-plan.md` | Fase F, bloqueada |
