# MiniPay — carga percibida y Web Vitals bajo la persona real

**Fecha:** 2026-08-07 · **Commit:** `85c6868` · **Build:** producción (`next build` + `next start`)
**Instrumento:** `pnpm -C apps/web measure:first-load` (mismo que arbitró el frente anterior)

> ⛔ **Este informe NO es Lighthouse web.** Lighthouse entra como visitante web y monta Privy;
> esa persona ya no es la puerta del producto. Todo lo de acá es Chromium con
> `window.ethereum.isMiniPay` inyectado, caché off, Pixel 5 @ 390×844, cortes de producto.

---

## 0. El instrumento casi miente, y cómo se supo

La primera corrida con Web Vitals reportó:

```
FCP n/a   LCP n/a   CLS 0.0000   TBT~ 0 ms   long tasks 0
```

Cuatro valores que se leen como datos y eran **cuatro ausencias**. La página había pintado a
los 576 ms.

Causa: `addInitScript(fn)` serializa `fn.toString()`, y tsx/esbuild compila las funciones
internas con nombre agregando una llamada a `__name(...)` que **sólo existe dentro del
bundle**. En la página eso es `__name is not defined`: el script moría después de crear el
store y antes de registrar un solo observer.

Lo que lo destapó fue un `page.on("pageerror")` y un **cross-check**: el script ahora compara
lo que reportó el observer contra `performance.getEntriesByType("paint")` y **aborta** si la
página pintó y el observer no lo vio. Los dos quedaron en el instrumento.

📌 Corregido pasando el init como **string**, inmune a cualquier helper de transpilador.

---

## 1. Resultados

### Sin throttling (referencia, comparable con la medición de bytes)

| | Valor |
|---|---|
| T1 / T2 / Tbranch | 990 / 1.003 / 1.006 ms |
| T3 | 3.007 ms |
| JS encoded | 420,1 kB · 42 requests · **0 de Privy** |
| FCP / LCP | 572 / 572 ms |
| CLS | 0,0000 |
| Long tasks | 0 |

### Slow 4G + CPU 4× (perfil móvil de Lighthouse, reproducido a mano)

| | Valor |
|---|---|
| T1 / T2 / Tbranch | ~4.150 / ~4.180 / ~4.186 ms |
| T3 | ~6.190 ms |
| JS encoded hasta T2 | **409,3 kB · 39 requests · 0 de Privy** |
| JS encoded a T3 | 420,1 kB · 42 requests |
| **FCP** | **~3.950–4.070 ms** |
| **LCP** | **~4.320–4.570 ms** |
| **CLS** | **0,000 ó 0,179 — bimodal** (ver §3) |
| Long tasks | 3–5, máx 65–127 ms, **todas antes de FCP** |
| TBT aprox | 0 ms |

⚠️ **TBT ≈ 0 no significa "no hay trabajo de CPU".** Significa que todas las tareas largas
ocurren **antes** de FCP, y la aproximación —por definición— sólo cuenta desde FCP. El costo
de CPU existe; está en el tramo en blanco.

---

## 2. La ventana en blanco es real y dura ~4 segundos

Filmstrip bajo Slow 4G (`e2e-results/filmstrip/minipay-slow4g-filmstrip/`):

| Frame | Qué se ve |
|---|---|
| 178 ms | Azul plano `#0b1220` (el `themeColor`) |
| 2.016 ms | **Azul plano. Nada más.** |
| 4.018 ms | Azul plano |
| 4.664 ms | **Hub completo**: fondo, panel, training path, CTAs |

No es negro ni blanco: es el color de tema, sin un solo elemento. **No hay esqueleto, no hay
logo, no hay nada.** El jugador mira una pantalla vacía durante ~4 s y después aparece todo de
golpe.

### Qué responde esto de las preguntas de AC8

1. **¿Cuánto dura el shell?** Hasta ~4,15 s bajo Slow 4G; ~1,0 s sin throttling.
2. **¿Bajo red MiniPay?** ~4 s de pantalla vacía. Es material.
3. **¿Blanco/negro o contenido útil?** Ni contenido ni esqueleto: color plano.
4. **¿Afecta FCP/LCP?** **Sí, es exactamente lo que los define.** FCP ~4,0 s es el momento en
   que la rama termina de montar. Mientras el shell está en pantalla no hay nada "contentful".
5. **¿Se puede mejorar sin descarga crítica nueva?** Plausible: el color ya está, y un
   esqueleto en CSS puro dentro del `WalletShell` no agrega ningún request. **No verificado
   todavía** — va al spec.
6. **¿CLS sigue en 0?** **No exactamente.** Ver abajo.

---

## 3. CLS: bimodal 0,000 / 0,179 — y NO es el WalletShell

Cinco corridas dieron 0,179 en tres y 0,000 en dos. Capturando los nodos que se mueven, las
tres corridas con shift señalan **exactamente lo mismo**:

```
shift 0.1790 @ ~4.150 ms → section.hub-scaffold-body, div.kingdom-anchor-tagline
```

⛔ **Esto no es el swap del shell.** Ocurre **después** de que el hub montó (T2 ≈ 4.140 ms), y
mueve contenido **dentro** del hub: el cuerpo del scaffold y la tagline del kingdom anchor.

📌 Consecuencia para la priorización: **el WalletShell cuesta FCP/LCP, no CLS.** Son dos
frentes distintos con dos arreglos distintos, y mezclarlos haría que ninguna mejora sea
atribuible. 0,179 está en zona "needs improvement" (>0,1) de Core Web Vitals.

---

## 4. Los dos hallazgos "chicos" de Lighthouse, auditados

### Viewport (`maximum-scale=1, user-scalable=no`)

**Existe la dependencia comprobada, y está documentada.** `src/app/[locale]/layout.tsx:99-123`
la declara con su razón (Sprint 4 commit O, 2026-06-08):

- el gesto de arrastrar para mover compite con el pinch-zoom a dos dedos;
- el doble-tap-zoom de iOS Safari se dispara con el flujo tap-pieza → tap-destino;
- nota de accesibilidad explícita: el zoom **del sistema operativo** sigue disponible y aplica
  por encima del browser.

⛔ **Recomendación: no tocarlo.** La condición que pediste —"si no existe una dependencia real
y comprobada"— no se cumple: existe, es de gesto, y está escrita con su mitigación. Cambiarlo
para subir un score sería romper el modelo de interacción del tablero a cambio de nada
medible para el jugador.

### Landmark `<main>`

**El hallazgo de Lighthouse no se reproduce bajo MiniPay — y el defecto real es otro.**

Medido en el DOM final:

| Persona | `<main>` | `<main main>` anidados |
|---|---|---|
| MiniPay | **2** | **1** |
| Web (local) | **2** | **1** |

O sea: no falta el landmark, **sobra**. Hay un `<main>` en el layout
(`[locale]/layout.tsx:159`) y otro en páginas como `trophies/page.tsx:26` y `coach/*` → uno
anidado dentro del otro, que es su propio defecto de accesibilidad (un documento debe tener
un solo `main`).

⚠️ Por qué Lighthouse ve "falta": corre como visitante **web con Privy encendido**, donde
`<main>` vive dentro de `WebAccessGate` y **no se renderiza hasta autenticar**. Localmente
Privy está apagado, así que las dos personas montan `injected` y el `<main>` existe. Es un
artefacto de la persona web → **fuera del criterio**.

📌 Lo que sí queda como candidato real y barato: **eliminar el `<main>` anidado**. Es
semántico, no cambia layout ni estilos, y aplica a las dos personas.

---

## 5. Qué NO se hizo, a propósito

Nada de `preconnect` a `auth.privy.io` ni a `explorer-api.walletconnect.com`. Para MiniPay
sería **contraproducente**: abriría conexiones tempranas a servicios que este frente acaba de
sacar del camino. Tampoco SEO de preview, ni source maps, ni legacy JS, ni limpieza de unused
JS por marcarlo Lighthouse.

---

## 6. Prioridad que sugiere la medición

1. **AC8 / `WalletShell`** — ~4 s de pantalla vacía bajo Slow 4G, y es lo que define FCP/LCP.
   Candidato #1. Necesita spec propio.
2. **CLS 0,179 en `hub-scaffold-body` / `kingdom-anchor-tagline`** — frente separado, ya con
   el nodo identificado. No mezclar con (1).
3. **`<main>` anidado** — commit chico, semántico, verificable.
4. **CSS render-blocking** — todavía sin medir bajo MiniPay. Es el siguiente en medirse, no en
   implementarse.
5. ⛔ **Viewport** — no tocar, con razón escrita.
