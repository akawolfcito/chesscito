# Handoff — A9: el bloqueador es una pieza, no un muro (2026-07-14)

Branch: `fix/exercise-obstacles-a0` · Suite: **5093 passing / 429 files** · `tsc --noEmit` limpio.
**Sin commitear todavía** (esperando tu revisión de las capturas).

---

## 1. Qué se cerró

| Superficie | Obstáculo | Clase |
| --- | --- | --- |
| `practice` | **Caballo blanco propio** — arte canónico, atenuado, más chico, sin animación | `.playhub-board-piece-float.is-friendly-blocker` |
| `labyrinth` | **Muro ambiental, intacto** | `.playhub-board-cell.is-wall` |

- Arte **reutilizado** (`PIECE_IMG.knight`), no se creó ninguno nuevo.
- Bloqueador **no interactivo**: `pointer-events: none` + `aria-hidden`. El tap lo recibe la casilla y
  la **regla** rechaza el movimiento — que es lo que enseña.
- **No se tocó** tablero, orden, BFS ni dificultad. Los 60 puzzles quedan idénticos.

### Archivos

| Archivo | Qué |
| --- | --- |
| `src/components/board.tsx` | Capa de bloqueadores friendly; `isWall` ahora exige `mode === "labyrinth"` |
| `src/app/globals.css` | `.is-friendly-blocker` (z-index 9, scale .88, desaturado) |
| `src/components/__tests__/board.test.tsx` | **4 tests**: practice→pieza/nunca muro, labyrinth→muro/nunca pieza, 1 bloqueador por obstáculo, no se come el tap |
| `src/lib/content/catalog.ts` | **Gate nuevo** (ver §2) |
| `src/lib/content/__tests__/lint.test.ts` | 3 tests del gate |
| `scripts/__tests__/import-puzzles.test.ts` | Fixture "boxed mover" ahora usa caballos (ver §2) |

El spec de capturas **se borró** — no pasó la barra de determinismo. Ver §4.5, que es el hallazgo más
importante de la sesión.

---

## 2. El agujero que encontré y tapé

`obstacles` es `BoardPosition[]`: lleva **casillas, no tipos de pieza**. El tablero **no puede
verificar lo que dibuja**. Hoy los 60 puzzles usan caballos blancos (auditado: 0 excepciones) y sólo
por eso el sprite dice la verdad — pero **un alfil blanco autorado mañana se renderizaría como
caballo**, y el tablero mentiría sobre la posición.

En vez de ensanchar `obstacles` (eso es cirugía de BFS, ver §3), el **linter de contenido** sostiene
la invariante: un bloqueador de ejercicio que no sea caballo **no compila**. Laberintos exentos: su
obstáculo es muro, la pieza detrás nunca se dibuja.

> **Un test rojo por esto.** El fixture `"rejects an unsolvable puzzle (boxed mover)"` encerraba la
> torre con **torres blancas**; el gate nuevo dispara antes y le robaba el error. Cambié el fixture a
> caballos: sigue probando lo suyo (b2 tapiado, a8 inalcanzable). La precedencia es la correcta y es
> la que ya declara `catalog.ts` — nombrar la casilla culpable **&gt;** decir "no hay camino".

---

## 3. Registrado, NO implementado

`obstacles → {pos, piece}` es la **misma cirugía** que ya está registrada en el plan §15.6.3:

> **Captura** (Fase B) y **objetivos múltiples** piden la **MISMA generalización del BFS**: el estado
> pasa de `posición` a `(posición, pendientes)`. Si se hace una, la otra sale casi gratis; si se hacen
> por separado, se paga dos veces.

**Ninguna de las dos se construyó.** A9 se apoya en el gate de contenido justamente para **no** abrir
esa cirugía antes de tiempo. Documentado en `docs/plans/2026-07-13-rook-curriculum-implementation-plan.md` §15.7.1.

---

## 4. Capturas 6–10 — la lectura

Contact sheet: artifact publicado (privado). Capturas en el scratchpad de la sesión.

| Slot | Título | Bloqueadores | Opciones iniciales |
| --- | --- | --- | --- |
| 6 | Your own piece blocks the way | 2 | **2** |
| 7 | The file is closed | 4 | **7** |
| 8 | The boxed star | 2 | 6 |
| 9 | Find the shortest route | 7 | 8 |
| 10 | Plan the whole route | 11 | 14 |

### Sobre el salto de 2 → 7 (lo que te preocupaba)

**El número sube; la decisión no.** En el ejercicio 7 las **7 opciones están todas sobre la fila 1**:
la columna está cerrada a **cero** (caballo en d2, justo delante de la torre en d1). Las siete son
**la misma idea repetida siete veces** — *andá de costado y volvé*. El ejercicio 6, con sólo 2
opciones, ofrece **dos ideas distintas** (subir, o cruzar).

Contadas como **ideas** en vez de casillas, la curva va 2 → 1 → 2… El salto es nominal.

**Riesgo real, si querés mirarlo:** el 7 puede sentirse *más fácil* que el 6, no más difícil — porque
7 dots en una fila recta se leen como "obvio", mientras que 6 dots que exigen elegir dirección se
leen como decisión. No lo toqué (dijiste no cambiar orden ni dificultad). Queda a tu juicio.

---

## 4.5 🔴 HALLAZGO — el estado sembrado NO aterriza en el ejercicio pedido

**Esto es lo que tiene que atacar el smoke funcional de los 10 de torre.**

Al intentar dejar el spec de capturas como test repetible (tu condición: determinístico), **falló la
barra**. Con `--repeat-each=3`:

- **Ejercicio 10: falla 3/3.**
- **Ejercicio 8: falla 1/3.**
- El tablero renderiza el **ejercicio 1** (torre b1 → h1, sin bloqueadores) aunque el contador de
  estrellas muestra el progreso correcto.

**No es el test.** Sembré el progreso de dos formas distintas y las dos derivan:

1. Forma legacy (`exerciseIndex` + array de estrellas) — la que usa `capture-exercise.spec.ts` hoy.
2. **Forma actual, con `currentId` explícito** (`{ piece, currentId, stars: Record<id, number> }`,
   estrellas en 3 para superar `MEDIUM_UNLOCK_STARS = 5`). **Sigue fallando.**

O sea: **incluso nombrando el ejercicio por id, la pantalla a veces cae al primero del pool.**
`exercises-screen.tsx:711-718` documenta ese fallback («A null/stale id falls back to the first pool
exercise»), así que algo está resolviendo `currentId` como null/stale de forma intermitente. Sospechas
en orden: carrera de hidratación (la pantalla monta con default y escribe antes de leer), o
`useRotationSteering` (aunque `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` parece apagado).

**No lo diagnostiqué a fondo** — pediste no avanzar. Pero es un bug de producto, no de test: si un
jugador vuelve a la app y el estado se resuelve mal, **lo tiran al ejercicio 1**.

> **Las capturas SÍ son válidas.** Cada una verificó su chip de misión, su conteo de bloqueadores y su
> conteo de opciones **antes** de disparar. Lo que es inestable es *llegar* al ejercicio, no lo que se
> ve cuando se llega.

---

## 5. 🔴 Disco — por qué se muere codex

**Medido hoy, no supuesto.** Disco: **425 G usados de 460 G. Contenedor APFS: 7.4 GB libres.**
El sistema vive crónicamente al 98%: **cualquier** corrida de Playwright es la gota que rebalsa.

### Dónde está el espacio

| Qué | Peso | ¿Seguro de borrar? |
| --- | --- | --- |
| **Chrome** (`Caches/Google` 23 G + `App Support/Google` 23 G) | **~46 G** | Caché sí; el resto es tu perfil |
| **`node_modules`** — 76 carpetas en `~/development` | **21.5 G** | Sí, en repos dormidos |
| JetBrains + VS Code + Cursor + Claude (App Support) | ~20 G | Parcial |
| **Playwright — navegadores viejos** (chromium 1148, 1169 + headless shells) | **~900 M** | **Sí — basura pura** |
| `e2e-results` de una corrida fallida | 31 M / 3 fallos | Sí |

**Tu hipótesis era correcta, pero parcial.** Playwright **sí** acumula silenciosamente:
- **3 versiones de Chromium** conviven (`chromium-1148/1169/1208`); descarga la nueva en cada bump y
  **nunca borra la vieja**. Sólo 1208 se usa.
- `video: "retain-on-failure"` + `trace: "on-first-retry"` → **31 MB por 3 tests fallidos**. Una VR
  suite (51 snapshots) que falle feo escribe **GB**, y quedan ahí hasta la próxima corrida.

Pero Playwright es **el gatillo, no el hog**: el hog es Chrome (46 G) + node_modules (21.5 G).

### Alternativas — de más barata a más estructural

1. **Recupero inmediato (~25 G, 5 min):** vaciar caché de Chrome (23 G, se regenera solo) y borrar
   los chromium viejos de `~/Library/Caches/ms-playwright/` (~900 M).
2. **`node_modules` de repos dormidos (~15 G):** 76 carpetas para los proyectos que no tocás. Un
   `pnpm store prune` + borrar `node_modules` de repos inactivos (se reinstalan con un comando).
3. **Adelgazar los artefactos de Playwright:** `video: "off"` en `playwright.config.ts`. El video es
   lo pesado; screenshot + trace ya te dan el diagnóstico. **Cambio de una línea.**
4. **Guard de preflight (lo que evita el crash):** un hook/script que **se niegue a correr Playwright
   si hay menos de N GB libres**, en vez de morir a mitad de camino y dejar basura. Esto es lo que
   convierte "se murió codex" en "me avisó antes de empezar".
5. **Estructural: sacar la VR de la máquina.** Correr la suite visual en CI y no localmente. Es la
   única opción que deja de pelear por los 7 GB.

**No ejecuté ninguna** — todas tocan cosas fuera del repo y varias son destructivas. Decime cuáles y
las hago (1, 3 y 4 son las de mejor relación beneficio/riesgo).

---

## 6. Estado y próximos pasos

**Cerrado:**
- [x] A9 aprobado visualmente. **Orden 6 → 7 se mantiene** (concepto antes que aplicación — plan §15.7.0).
- [x] Gate de caballos = **invariante temporal**, con su condición de borrado escrita en el código y en el plan.
- [x] A9 commiteado en 3 commits atómicos.
- [x] Spec de capturas **borrado** (no determinístico — §4.5).

**Sigue:**
- [ ] **Guard de disco** — bloque y commit separados. Preventivo: verifica espacio, aborta con mensaje
      claro, **no borra nada**.
- [ ] **Smoke funcional de los 10 ejercicios de torre.** Primer trabajo: §4.5. El smoke no puede
      asumir que sembrar progreso te deja en el ejercicio que pediste — **hoy no lo hace**.
- [ ] **NO** avanzar con A10/A11 hasta que el smoke esté.

## Preguntas abiertas

1. §4.5: ¿el fallback al ejercicio 1 es una carrera de hidratación o steering de rotación? Hay que
   decidir si el smoke lo **documenta** o lo **arregla**.
2. `capture-exercise.spec.ts` siembra con la forma legacy (`exerciseIndex`). Si esa forma ya no es
   confiable, ese spec está verde por suerte.
