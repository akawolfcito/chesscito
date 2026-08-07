# Discovery — critical CSS / render-blocking bajo MiniPay

**Fecha:** 2026-08-07 · **Commit:** `9afe372` · **Perfil:** Slow 4G + CPU 4×, persona MiniPay,
build de producción. **⛔ No se tocó una línea de CSS.**

> **Resumen:** una sola hoja de **305,2 kB (55,5 kB encoded)** bloquea el render. El
> `WalletShell` necesita **4,7%** de ella; el hub usable, **10,8%**. Nada más se usa después.
> El FCP ocurre **46 ms después** de que esa hoja termina de bajar.
> ⚠️ **El split por ruta ya se hizo en este repo y se revirtió con números** — no se repite.

---

## 1. Qué bloquea, exactamente

| | |
|---|---|
| **Ruta** | `/_next/static/css/d92c167beb638040.css` |
| **Origen** | `src/app/globals.css` — importado en `[locale]/layout.tsx` |
| **Tamaño** | **305,2 kB decoded · 55,5 kB encoded** (16.932 líneas, ~1.768 reglas) |
| **Descarga** | empieza **203 ms** · termina **1.690 ms** (1.487 ms en vuelo) |
| **first-paint = FCP** | **1.736 ms** — 46 ms después |

Segunda hoja, irrelevante: `5dfc27a55db4b374.css`, 6,5 kB decoded / **924 B encoded**,
203 → 816 ms, con **3,7%** de uso.

⚠️ Los 1.487 ms de descarga **no son sólo ancho de banda** (55,5 kB a 1,6 Mbps ≈ 270 ms):
la hoja compite con 409 kB de JS que arrancan a la vez. Parte del piso es contención, no peso.

### ¿Monolítica por diseño?

**Sí, y es deliberado.** `globals.css` es la única hoja del app (CLAUDE.md lo declara), se
importa en exactamente dos lugares (`[locale]/layout.tsx` y `dev/layout.tsx`), y no hay CSS
modules. Next emite un chunk de CSS por layout, así que **toda** ruta hereda la hoja entera.

## 2. Qué reglas hacen falta, por etapa del viaje real

Medido con `CSS.startRuleUsageTracking` + `takeCoverageDelta` de CDP — uso por **regla**, no
el "unused CSS" agregado de Lighthouse.

| Etapa | Reglas nuevas | Bytes usados | % de la hoja |
|---|---|---|---|
| **Shell pintado** (define el FCP) | 33 | **14,2 kB** | **4,7 %** |
| **+ Hub usable** (T2) | +135 | **33,0 kB** | **10,8 %** |
| **+ 2 s de settle** | **+0** | 33,0 kB | 10,8 % |
| **Nunca usado en este viaje** | — | **272,2 kB** | **89,2 %** |

📌 Tres lecturas que importan:

1. **El shell necesita 4,7% de la hoja y espera por el 100%.**
2. **Después de T2 no se usa una sola regla más** — el viaje del hub está completo a los ~4 s.
3. ⛔ Ese 89,2% **no es CSS muerto**: es de otras superficies (`/arena`, `/exercises`,
   `/coach`, `/trophies`). Confundir "no usado en este viaje" con "borrable" es el error que
   este informe no comete.

## 3. Lo que este repo YA probó — y por qué no se repite

`docs/audits/2026-06-12-css-split-analysis.md` + `docs/handoffs/2026-06-12-p4-css-split-handoff.md`:

- El split por superficie **se implementó y se promovió a prod** (`d535d212`): 445 bloques,
  ~103 kB raw a `src/styles/{arena,hub,coach,exercises}.css`, con VR 49/49 y suite verde.
- **Se revirtió el mismo día** (`babcd019`) con la razón escrita:

  > «el split optimizó BYTES cuando el cuello es RENDER-BLOCKING. Los stylesheets ya bajan en
  > paralelo (HTTP/2); dividir no quita el bloqueo (el navegador espera TODOS los `<link>`
  > antes del primer paint) y suma un request de descubrimiento. Net: −14-18% bytes pero +1
  > request render-blocking → score plano-a-peor.»

- **Fase 2b rechazada con números**: sólo ~22,5 kB raw extraíbles ≈ ~1 kB gz por ruta, contra
  el riesgo de mover reglas de antes a después de las utilidades de Tailwind y voltear
  conflictos de igual especificidad.
- Las familias grandes (`arena-`, `hub-`, `coach-`) **no son exclusivas de ruta**: cruzan
  superficies vía popups y chips del HUD. Un split puro duplica reglas o rompe UI.

⛔ **Conclusión heredada, hoy confirmada por mi medición: dividir la hoja no ataca el piso.**
El piso lo pone *que algo bloquee*, no *cuánto pesa lo que bloquea*.

📌 Y un dato que cierra el círculo: la palanca #3 de ese mismo informe era «lazy-load del
wagmi provider hasta el primer wallet intent (spec propia)». **Eso es exactamente el frente
que cerramos esta semana** — con −628 kB medidos. El plan de junio predijo estos dos frentes.

## 4. Opciones, ordenadas por riesgo

| # | Opción | Qué haría | Riesgo | FCP estimado |
|---|---|---|---|---|
| **1** | **Critical inline + resto diferido** (`experimental.optimizeCss`/critters, o el swap `media="print"`+`onload`) | El crítico viaja **en el HTML, sin request**; la hoja grande deja de bloquear | **Medio.** Critters a veces difiere de más y rompe estilos → **VR completo obligatorio**. Es dependencia experimental sobre una cascada de 17k líneas | **~400–600 ms** (acotado por el HTML, que termina a ~335 ms) |
| **2** | **Critical a mano, sólo el shell** (14,2 kB raw ≈ 3–4 kB inline) | Bloque crítico escrito y mantenido a mano | **Medio-alto.** Es una COPIA de reglas que viven en `globals.css`, y este repo ya tiene escrito que una copia no la delata nada observable. Necesitaría guard de fuente | ~400–600 ms |
| **3** | Purga de CSS no usado | Bajar los 305 kB | **Alto retorno bajo.** No quita el bloqueo (opción 1 lo hace igual sin borrar nada) y las clases dinámicas hacen insegura la detección por grep (lección `badge-treat-${state}`) | Casi nulo sobre FCP |
| **4** | **Split por ruta** | Repetir P4 | ⛔ **Refutado con datos en este repo.** −14-18% bytes, +1 request bloqueante, resultado plano-a-peor | ~0 |
| **5** | No hacer nada | — | Nulo | 1.736 ms (hoy) |

### Estimación del techo (y su base)

El HTML termina a **335 ms**. Si el crítico viaja inline y la hoja grande deja de bloquear, el
primer paint queda acotado por HTML + parse ≈ **400–600 ms**, o sea **−1,1 a −1,3 s** sobre el
FCP actual de 1.736 ms.

⚠️ **Es una estimación, no una medición.** El mismo error ya se cometió en este frente: EXP1
"debía" adelantar el FCP con un gradiente y no movió nada. **Antes de implementar hay que
correr un EXP** con la opción 1 en una rama y medir con el mismo instrumento.

## 5. Veredicto del discovery

**No exige una refactorización grande** — la opción 1 es configuración + verificación, no
reescritura, y **no duplica estilos** (a diferencia de la 2). Pero **sí exige un experimento
antes del spec**, porque su beneficio depende de que critters recorte bien una cascada de
17.000 líneas, y su riesgo (romper estilos por diferir de más) sólo se ve en el VR.

**Siguiente paso propuesto, sin implementar nada todavía:**

- **EXP-CSS1** — activar la opción 1 en una rama, build de producción, medir FCP/LCP/T2/CLS con
  el instrumento MiniPay (3 corridas, mediana) **y correr el VR completo**.
  - PASS → spec + red team.
  - FAIL (o VR roto) → se reporta y el frente se cierra en la opción 5, con el piso explicado.

⛔ Fuera de este frente, como pediste: CLS 0,179, `<main>` anidado, Privy/web, imágenes y JS.
