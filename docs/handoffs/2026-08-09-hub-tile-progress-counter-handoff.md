# Handoff — Paso 2: el contador en la baldosa del hub

**Fecha:** 2026-08-09 · **Rama:** `main` (local, sin pushear)
**Spec:** `docs/specs/2026-08-09-hub-tile-progress-counter.md`
**Red-team:** `docs/specs/2026-08-09-hub-tile-progress-counter-redteam.md`
**Brief que lo ordena:** `docs/product/2026-08-08-progress-visibility-design-brief.md` § Paso 2

---

## Estado: entregado y verde

| Verificación | Resultado |
|---|---|
| Vitest | **614 archivos / 7565 tests**, `exit 0` |
| Baseline medido en `main` limpio ANTES de tocar nada | 614 / 7557 — mismo conteo de archivos ✅ |
| `tsc --noEmit` | limpio |
| VR | **66 passed**, `--project=minipay --update-snapshots=none` |

### Commits

| Hash | Qué |
|---|---|
| `bb0ce237` | `chore(gitignore)` — output regenerable de `rook-rails-shots` |
| `5c9f7473` | `docs(spec)` — spec + red-team |
| `46f31f94` | `feat(hub)` — **el contador** |
| `e569d5fb` | `fix(vr)` — **el reloj congelado** + 4 baselines |
| `38b9d6c6` | `docs(spec)` — desvíos de la implementación |

⛔ **Sin pushear.** El merge a `main` local es mío; el push a origin es del founder.

---

## Qué se construyó

La baldosa de la pieza activa muestra **`3/8`**: cuántos ejercicios lleva de los que necesita
para la insignia. Cero taps, cero pantallas nuevas.

Cubre al que **vuelve a los tres días**, que es a quien el Paso 1 no alcanza — el overlay de
completado sólo dispara si jugás.

**Sólo el estado `progress` lleva contador.** `claimed` ya tiene su ✓, `claimable` su punto, y
seis `0/8` en `locked` se leen como deuda, no como invitación.

---

## El hallazgo que ordenó todo

El Paso 2 parecía "mostrar un número que ya está calculado". Lo que había abajo:

> **El hub y el drawer contaban con reglas distintas en los DOS lados de la fracción.**

| | Numerador | Denominador |
|---|---|---|
| **Drawer** | `completedExerciseCount` — intersecta con el catálogo vigente | catálogo mergeado |
| **Hub (antes)** | toda entrada positiva del storage, **ids retirados incluidos** | `EXERCISES` baseline (el hub no está dentro de `ContentCatalogProvider`, que se monta sólo en `/exercises/page.tsx`) |

Como *estado* era inofensivo. Como *número en pantalla* habría dicho **`4/5` en la baldosa con
3 hechos en el drawer** — un número que el jugador no puede reconciliar, que es la peor clase
de error de confianza.

**Decisión del founder:** la baldosa dice lo mismo que el drawer.

⚠️ **El gate de la insignia NO cambió.** Sigue contando amplio, porque la maestría no se revoca
cuando cambian ids internos. El desfase es deliberado y **nunca visible**: cuando el conteo
amplio cruza el gate, la baldosa ya es `claimable` y el chip desapareció. Lo ancla un test.

---

## Hallazgo aparte, ya arreglado: el VR se pudría solo

Las cuatro baselines `vr18-learn-hub-*` **seguían el reloj real**. La tira semanal de
`ChallengeCard` ancla en `todayUtc()` y el fixture no lo pineaba: el marcador de "hoy" caminaba
una columna por día y las baselines se ponían rojas **sin cambio de código detrás**.

Medido, no deducido: se grabaron el **2026-08-07 20:43 -0500** (= Aug 8 UTC, sábado) y hoy
Aug 9 UTC es domingo. El diff marcaba exactamente las columnas S y S.

> ⚠️ **Se pudrieron ~1 hora después de haber sido verificadas 66/66** (`fec09bb8`). Ese verde
> era real cuando se midió y ya no lo era a la mañana siguiente.

`ChallengeCard` ya exponía `today` para pinear ("*Injected so tests can pin it*"). Lo que
faltaba era que `HubLiteScaffold` lo reenviara. El fixture ahora fija `2026-08-05`.

**Es preexistente, no del Paso 2** — por eso va en commit aparte.

---

## Próximos pasos

1. **La validación del brief — es un playtest, no un test.** A alguien que jugó hace tres días,
   **antes de que toque nada**: *"¿qué hiciste la última vez?"*. Si no puede contestar, el
   Paso 2 no resolvió nada. ⛔ **No validar con métricas**: 443 jugadores no dan poder
   estadístico, cualquier lectura sería ruido con forma de conclusión.
2. **Corregir el baseline de Vitest en CLAUDE.md.** Declara **598** en un lugar y **610** en
   otro; el real de hoy es **614 / 7565**. En disco hay 647 archivos de test, así que ninguno
   de los tres números se puede derivar estáticamente — la regla vale más que la constante:
   *si el conteo de archivos baja, la corrida no vale.*
3. **Paso 3 (promover el mapa) sigue condicional.** Sólo si 1 y 2 no alcanzan. Si alcanzan, el
   mapa resulta innecesario — y eso es la mejor noticia, no un fracaso.

---

## Deuda que este paso NO tomó (a propósito)

- **Reclamar desde la baldosa.** Hoy `claimable` sólo rutea al drawer, donde vive el botón
  Claim. Entrarle arrastra wallet, estados de firma y el caso sin-wallet (donde el botón no
  hace nada, en silencio). Se dejó fuera para que el Paso 2 sea **falsable**: si la visibilidad
  sola mueve la aguja, el claim nunca hizo falta.
- **Wayfinding del drawer al botón Claim.**
- **Progreso del carril 2 en la baldosa.** Mezcla dos denominadores en 60px.

---

## Gotchas de método que dejó la sesión

- ⛔ **Un `| tail` se come el exit code de Playwright.** La corrida con 4 rojas fue reportada
  como `exit code 0` porque el código que llega es el de `tail`. No usar ese número como
  prueba de nada cuando hay pipe.
- ⛔ **La corrida que graba baselines NO verifica.** El `4 passed` de la grabación no comparó
  nada: escribió archivos. El verde que cuenta es el segundo, con `--update-snapshots=none`.
- ✅ **Correr el VR sin grabar PRIMERO enseña el radio real.** Mostró 4 rojas y 62 verdes, y
  dentro del diff mostró que **sólo la mitad del cambio era mía** — la otra mitad era el reloj.
  Si hubiera grabado de una, habría horneado la podredumbre en la baseline nueva.
- ⚠️ **El VR levanta su propio dev server, y eso invalida una suite de Vitest en vuelo.** No se
  pueden solapar: con un server arriba algunos workers de Vitest no arrancan y esos archivos no
  corren, con el resumen diciendo "todo verde".
- ⚠️ **Se puede atribuir un diff sin tocar el árbol de trabajo**: leer la baseline commiteada y
  compararla contra el `-actual.png`. Evitó un `git stash` con 13 archivos modificados.

---

## Open questions

- **¿El chip debería llamar la atención cuando cambia?** Hoy no anima, a propósito: el Paso 1
  ya celebró esa consecuencia y el brief prohíbe celebrar dos veces lo mismo. Si el playtest
  muestra que nadie lo ve, ésa es la primera perilla.
- **¿Qué pasa cuando el catálogo crece desde el builder?** `required` sube, así que un `3/4`
  puede volverse `3/5`. No es mentira (el gate es ratio, decisión vieja), pero el número
  retrocede en términos relativos sin que el jugador haya perdido nada.
- **¿Hay otros fixtures de VR atados al reloj?** Se arregló el de `learn-hub`. No se auditaron
  los demás; `vr17-play-hub-*` es el candidato obvio a mirar.
