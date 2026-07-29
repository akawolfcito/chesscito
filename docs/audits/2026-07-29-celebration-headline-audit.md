# Auditoría — ¿qué overlays adoptan `ArchedHeadline`?

> ## ⛔ CONCLUSIÓN REVISADA (founder, 2026-07-29): NINGUNO DE LOS DE ACÁ.
>
> Esta auditoría rankeó por **momento** ("¿es una celebración?"). El criterio real
> es **estructural**: un *overlay* es scrim oscuro con el contenido flotando; todo
> lo que listo abajo vive dentro de un **panel crema** (`VictoryPopupShell`), o
> sea que son **modales**, y el titular se les queda plano.
>
> La taxonomía vigente está en
> **`docs/design-patterns/full-screen-surface-taxonomy.md`**. Lo que sigue se
> conserva por dos cosas que siguen siendo válidas: el censo de call sites de
> `.arena-result-title` (Hallazgo 1) y el techo de largo del arco (Hallazgo 2).

**Fecha:** 2026-07-29
**Alcance:** todo titular de overlay/modal de la app, no sólo los "de celebración".
**Método:** censo de las tres clases de titular (`.arena-result-title`,
`.season-pass-celebration-title`, `.language-modal-title`) sobre `components/**`,
y mapeo de cada superficie a su probe `/dev` para poder verla.

---

## Hallazgo 1 — `.arena-result-title` NO es "el titular de celebración"

Son **14 call sites en 10 archivos**, y sólo ~6 son momentos de celebración. La
misma clase pinta hoy:

- una victoria (`Victory!`),
- una derrota (`arena-end-state`, que cubre resign / stalemate / draw),
- un estado de progreso (`Claiming…`),
- un error de transacción,
- y **precios** en la hoja de Peones (`get-peones-sheet.tsx:149`).

**Consecuencia:** "migrar la clase" no es un plan válido — arquearía el error de
transacción y el precio de un pack. La migración es **call site por call site**.

## Hallazgo 2 — el arco tiene techo de largo, y es corto

El arco abre ±19° y el radio se deriva del largo, así que la *forma* aguanta
cualquier string; lo que crece es el **ancho de la caja**. A `font-size: 13vw`
(50px en 390px de viewport) el ancho de tinta es ≈ `0.70em × (n−1)`:

| String | n | Ancho a 13vw | ¿Entra en 390px? |
|---|---|---|---|
| `Well Done!` | 10 | ~320px | sí |
| `¡Bien Hecho!` | 12 | ~390px | al límite (es lo que ya ves) |
| `Training Complete!` | 18 | ~600px | **no** — pediría bajar a ~7.7vw |

**Criterio:** el arco es para **exclamaciones cortas (≤ 12 caracteres)**. Un
titular más largo o se acorta en editorial, o se queda plano — arquearlo lo
achica tanto que deja de leerse como cartel.

---

## Tabla de veredictos

Probes: `pnpm -C apps/web dev` → `http://localhost:3000/…`. Están gateados por
`isDevSurfaceEnabled()` (`VERCEL_ENV !== "production"`), así que **también viven
en preview** — podés abrirlos desde el celular con la URL del deploy de preview.

### ✅ Ya migrados

| Superficie | Archivo | URL |
|---|---|---|
| Flash de ejercicios | `exercises/mission-panel-candy.tsx:317` | jugar `/exercises` y resolver |
| Flash del Daily | `daily/daily-tactic-sheet.tsx:333` | `/` → Daily Tactic |

### 🎯 Candidatos claros (string corto, momento de logro)

| Superficie | Archivo:línea | Título hoy | URL |
|---|---|---|---|
| Victoria de Arena | `arena/victory-celebration.tsx:179` | `Victory!` / `Checkmate!` | `/dev/arena-end-state?variant=win-celebration` |
| Claim de victoria OK | `arena/victory-claim-success.tsx:159` | (headline de claim) | `/dev/arena-end-state?variant=win-success` |
| Season Pass | `payments/season-pass-celebration.tsx:39` | `You are in!` | `/dev/season-pass-celebration` |
| Badge ganado | `exercises/result-overlay.tsx:650` | (título de badge) | `/dev/exercises-popups?variant=result-badge` |
| Victory landing | `victory/victory-landing-card.tsx:55` | (título de victoria) | `/dev/victory-landing?variant=easy` |

### ⚠️ Candidatos que exigen decisión de copy primero

| Superficie | Archivo:línea | Título hoy | Problema | URL |
|---|---|---|---|---|
| Laberinto completo | `exercises/labyrinth-complete-overlay.tsx:100` | `Training Complete!` (18) | muy largo para el arco | `/dev/exercises-popups?variant=labyrinth-king-solved` |
| Pieza completa | `exercises/result-overlay.tsx:809` | (título de pieza completa) | verificar largo | `/dev/exercises-popups?variant=piece-complete-final` |

### 🚫 No migrar (no son celebraciones)

| Superficie | Archivo:línea | Por qué | URL |
|---|---|---|---|
| Fin de partida Arena | `arena/arena-end-state.tsx:462` | mismo nodo pinta derrota / tablas | `/dev/arena-end-state?variant=resigned` |
| Claim en curso | `arena/victory-claiming.tsx:71` | estado de progreso | `/dev/arena-end-state?variant=win-claiming` |
| Error de claim | `arena/victory-claim-error.tsx:100,105` | error | `/dev/arena-end-state?variant=win-error` |
| Score guardado | `exercises/result-overlay.tsx:324` | confirmación, no logro | `/dev/exercises-popups?variant=score-saved` |
| Compra de tienda | `exercises/result-overlay.tsx:425` | transaccional | `/dev/exercises-popups?variant=result-shop` |
| Error de resultado | `exercises/result-overlay.tsx` (variant error) | error | `/dev/exercises-popups?variant=result-error` |
| Hoja de Season Pass | `payments/season-pass-sheet.tsx:173,177,188` | estado informativo | (sheet en `/`) |
| Precios de Peones | `payments/get-peones-sheet.tsx:149,202` | son **precios** | (sheet en `/`) |
| Modales de idioma | `hub/language-chip.tsx:88`, `exercises/exercises-screen.tsx:4344` | diálogo de settings | (chip de idioma) |
| Nudge de racha | `daily/streak-nudge-screen.tsx:57` | pantalla didáctica | (flag `NEXT_PUBLIC_STREAK_NUDGE_ENABLED`) |

### ❓ Sin probe — hay que llegar jugando

| Superficie | Archivo:línea | Cómo verla |
|---|---|---|
| Ceremonia Mini-Arena | `mini-arena/mini-arena-result-ceremony.tsx:54` | `mini-arena-sheet.tsx:566` — abrir la hoja y terminar una partida |
| Welcome package | `welcome-package/welcome-package-modal.tsx:55` | flujo de bienvenida |
| Primer Focus Day | `welcome-package/first-focus-day-overlay.tsx:30` | primer día con Focus Days |
| Unlock overlay | `progression/unlock-overlay.tsx:69` | desbloqueo de progresión |

**Nota:** estos cuatro usan `.language-modal-title` (Welcome/Focus/Unlock) o
viven dentro de una hoja. Si se migran, conviene **crearles probe primero** —
sin probe no hay forma barata de verificar el cambio ni de fotografiarlo en VR.

---

## Recomendación de orden

1. **Arena victoria + claim OK** — mismo archivo-vecindario, strings cortos, con
   probe. Es el par que más se parece a lo ya hecho.
2. **Season Pass** (`You are in!`) — string corto, probe propio, alto impacto.
3. **Badge ganado + victory landing** — verificar largo del string antes.
4. **Los que piden copy nuevo** (laberinto) — decisión de editorial, no de CSS.
5. **Los cuatro sin probe** — sólo después de darles probe.

## Preguntas abiertas

- ¿La derrota de Arena merece su propio tratamiento (arco en otra paleta) o se
  queda plana? Hoy comparte nodo con tablas y resign, así que arquear "Defeat"
  arquearía también "Draw".
- `Training Complete!` — ¿se acorta el copy o se queda plano?
- ¿Se crean probes para Mini-Arena / Welcome / Focus Day / Unlock, o quedan
  fuera del patrón?
