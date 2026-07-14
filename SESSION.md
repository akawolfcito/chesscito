# Session Handoff — 2026-07-13 (e)

> Quinta sesión del día. **No se escribió código de producto: se corrigió el RUMBO.**
> Empezó como "arranquemos el spec del duelo" y terminó reemplazando la directriz entera.

## Completed

- `57a49e57` **Directriz consolidada** — `docs/product/2026-07-13-direction-where-we-are.md`.
  Modelo de **frentes → capas → gates**. Reemplaza la directriz binaria del mismo día.
- `987a6488` **Investigación del duelo preservada** — spec v3 + red-team v3 (marcados
  **ARTEFACTO HISTÓRICO**, no son el plan de D1) + la probe de device `/dev/duel-link-probe`.
- Ambos **pusheados a `origin/main`**.

## Current State

- **Branch**: `main`, sincronizado con `origin/main`. **PRs abiertos**: ninguno.
- **Build**: `tsc --noEmit` limpio · eslint sin hallazgos. **La suite NO se corrió** — no se tocó
  código de producto (la probe vive bajo `/dev` y no se enlaza desde ningún lado).
- **Uncommitted work**: sólo este `SESSION.md`.

## Next Tasks

### ▶️ Arrancar por el **Frente 1 — pulir el aprendizaje actual** (frente principal)

Es lo que decidió el founder al cerrar la sesión. **No es construir contenido nuevo: es pulir lo que
ya se ve.** Detalle en la directriz, §6.

1. **Definir qué aborda el usuario primero en cada sesión** y simplificar el primer recorrido.
2. **Revisar ejercicios**: instrucciones y dificultad.
3. **Ocultar contenido que no esté a la altura** — incluye **mejorar o esconder temporalmente el
   laberinto de peones** si daña la percepción.
4. Aprovechar que muchos usuarios **tardan** en desbloquear contenido avanzado: es tiempo regalado
   para pulirlo antes de que lleguen.

**Gate:** comprensión y finalización aceptables. ⚠️ **Las señales y umbrales concretos se definen
ANTES del experimento** — la directriz (§14) prohíbe inventarlos por adelantado.

### Paralelo barato (si sobra sesión, NO desplaza al Frente 1)

- **Frente 2 — Peones**: **inventariar fuentes y sinks.** No existe hoy y es la primera tarea. Lo
  único leído del código: `PEONES_DAILY_CAP = 6`, `SHIELD_RESCUE_PEONES_COST = 2`,
  `PEONES_WELCOME_PACK_AMOUNT = 1`, `peonesReward: 50` (compra).
  **NO tocar precios antes de medir.**
- **Frente 3 / T1 — Themes**: el **catálogo de arte** (página `/dev` que lista cada slot con sus
  dimensiones). Es lo que destraba el cuello de botella real, que es el **arte**, no el código.

## Blockers

- **Ninguno para el Frente 1.**
- **MiniPay**: la app está **EN REVISIÓN**. **No hay pedidos oficiales abiertos.** Es un canal en
  observación, **no un bloqueo del roadmap**. Cuando aprueben → correr `/dev/duel-link-probe` desde
  WhatsApp, navegador y MiniPay, con captura de cada uno.
- **Belt System**: sigue bloqueado por la decisión de *server-verified progress* (sin cambios).
- **Smoke del Hub Tour en device**: arrastrado desde 2026-07-12.

## Notes

### ⚠️ Lo más importante que dejó esta sesión: cómo NO trabajar

**El founder dijo "me siento perdido y no siento que tengamos una directriz".** La causa fue mía:
especifiqué el duelo **tres veces** (v1 cookie → v2 wallet sin autenticar → v3 sesión firmada) antes
de preguntar lo único que importaba: **"¿dónde aterriza el jugador invitado?"**. La respuesta —el
webview de WhatsApp no tiene wallet— invalidaba el modelo de identidad de las tres versiones.

**La regla:** en una feature cuyo corazón es un enlace, **el camino del enlace se mide ANTES de
diseñar el asiento**. Y más general: **cuando una iniciativa parezca menor, preguntar por su TECHO
antes de descartarla** — despaché el theme builder como "tooling interno" (era: marketplace de
creadores) y el duelo como "growth puro" (era: economía de espectadores). **Las dos veces me
corrigió el founder.**

### El principio que ahora gobierna el roadmap

> **Construir la capa mínima que demuestre valor, medirla, y dejar que el resultado desbloquee la
> siguiente.**

**Antes de rankear CUALQUIER idea nueva, leer la tabla de §2 de la directriz** y ubicarla: ¿qué
frente? ¿qué capa? ¿cuál es la próxima capa mínima? ¿nos estamos adelantando?

### Correcciones que NO hay que re-litigar

- **El duelo NO está congelado.** Se construye por capas. **D1 = abrir un enlace y jugar, SIN
  wallet**, en cualquier navegador móvil o PWA. **No depende de MiniPay.**
- **El spec v3 del duelo NO es el plan de D1** (es wallet-first). Se conserva por su árbitro, su
  expiración, su concurrencia, su persistencia, su seguridad y su matriz de estados.
- **El listado de MiniPay NO es "lo único con reloj"** — eso fue una inferencia mía, no un hecho.
- **Las cifras de Peones del founder son HIPÓTESIS**, no diagnóstico. Nada de precios sin medir.

### Deuda de seguridad descubierta (no bloquea, pero está viva en producción)

**`/api/games` acepta la wallet del body sin firma** (`api/games/route.ts:21`; el único chequeo es
`isAddress()` — valida el **formato, no la propiedad**). Hoy sólo permite vandalizar el archivo de
otro. **Cualquier feature que use la wallet como AUTORIZACIÓN (no como etiqueta) tiene que resolver
esto primero.** Es exactamente el defecto que mató a la v2 del spec del duelo.

### Arrastrado (sigue vigente)

- **Dónde vive cada hub**: el LEARN hub sólo renderiza en `/` con `NEXT_PUBLIC_CHESSCITO_MODE=learn`
  **y** `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`.
- **NO mover el timer de la transición fuera de su `useEffect`** (Strict Mode lo cuelga en
  "Preparing AI…").
- Lo que un probe `/dev` fotografía **recibe su verdad por props**, nunca de un hook de wallet — si
  no, Playwright fotografía un `WagmiProviderNotFoundError` y **pasa en verde**.
