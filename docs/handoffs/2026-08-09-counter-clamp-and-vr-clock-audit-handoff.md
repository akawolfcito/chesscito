# Handoff — el contador que se pasaba de su meta, y la auditoría de relojes del VR

**Fecha:** 2026-08-09
**Rama:** `main` local (⚠️ medir con `git log origin/main..main`, no heredar de acá)
**Commits de esta sesión:** `831053b` (el tope) · `1a84cf3` (el `+`) · este doc
**Handoff anterior:** `docs/handoffs/2026-08-09-hub-tile-progress-counter-handoff.md`

---

## Estado

| Verificación | Resultado | Cómo se midió |
| --- | --- | --- |
| Suite web | **7580 passing / 617 files, EXIT=0** | `pnpm test` con la máquina libre (sin `pnpm dev` arriba), salida a archivo y `echo $?` |
| `Unhandled Errors` | **0** | `grep -c "Unhandled Error"` sobre el log completo, no sobre el resumen |
| `tsc` | limpio | `pnpm exec tsc --noEmit` |
| VR | **no se recorrió esta sesión** | ver "Lo que NO se verificó" |

El conteo de archivos **subió** de 616 a 617 (el test nuevo) y el de tests de
7573 a 7580. Esa es la dirección correcta: si el de archivos hubiera **bajado**,
la corrida no valía (workers que no arrancan, resumen verde con `exit 1`).

---

## Lo que cerró

### 1. El contador se pasaba de su propia meta (`9/8`, `10/8`)

**Cómo apareció:** el founder jugando en device, captura del alfil con el chip
en `9/8`.

**Causa:** el denominador del chip es el **gate** de la insignia
(`badgeRequiredCount` = 80% del pool redondeado arriba = **8 para las seis
piezas**), pero el numerador venía de `completedExerciseCount`, que cuenta el
**pool entero**. Los pools son 9 (alfil) y 10 (las otras cinco). Cruzado el gate,
la fracción se pasaba de largo:

| Pieza | Pool | Gate | Peor caso que se veía |
| --- | --- | --- | --- |
| bishop | 9 | 8 | `9/8` |
| rook, knight, pawn, queen, king | 10 | 8 | `10/8` |

**Por qué el hub nunca lo mostró — y no fue suerte:** su contador sólo se pinta
en estado `progress`, y en `derive-reward-tiles.ts` ese estado exige
`!meetsThreshold`. Al cruzar el gate la baldosa pasa a `claimable` y el chip
desaparece. `/exercises` no tiene ese corte, así que el defecto era visible ahí
y **sólo** ahí.

**El arreglo:** topear el numerador, no esconder el chip.
`apps/web/src/hooks/use-exercise-progress.ts` — `badgeProgress` ahora devuelve
`{ completed: Math.min(completedCount, required), required, extra }` — ver §1b
para `extra`.

Se eligió topear sobre esconder porque `8/8` acompaña al punto rojo del CLAIM
que **ya está** en el dock, y deja el chip donde el jugador aprendió a buscarlo.
Esconderlo le quitaría la referencia justo en la pieza que está jugando.

⚠️ **Sólo el DISPLAY se topea.** `completedCount` y `badgeEarned` siguen leyendo
el pool real — el gate no se movió. Hay un test que afirma exactamente eso, para
que el tope no se convierta en el gate por un refactor futuro.

**Decisiones de copy del founder en el camino:**

- ❌ `8 of 8` en vez de `8/8` — descartado. El chip mide `height: 16px` y
  `font-size: 0.58rem`; es un badge flotante, no una etiqueta. La forma larga
  duplica el ancho justo en la fila donde el ancho es lo escaso (el label de la
  pieza es lo que se comprime a 390px) y rompe el reconocimiento con la baldosa,
  que era el punto del Paso 2. La forma larga **ya existe donde importa**: el
  `aria-label` dice *"8 of 8 toward your badge"*.
- ✅ **Marcar al que se pasó del gate — resuelto con un `+`** (ver §1b).
  Primero se leyó "START" y se descartó por duplicar el momento del Claim; era
  **STAR**, el ícono. La intención detrás era correcta y se implementó.

### 1b. …pero topear borró una distinción, y el `+` la devuelve

Commit `1a84cf3`. Topear en `8/8` arregla la fracción rota, pero deja al que
resolvió **8** y al que resolvió **10** viendo exactamente el mismo número. Eso
era justo lo que el founder quería marcar.

El hook expone ahora un tercer campo, `extra` = lo que queda más allá del gate
(**1** para el alfil, **2** para las otras cinco), y el chip lo dice con un `+`:

| Resolvió | Chip |
| --- | --- |
| 3 | `3/8` |
| 8 (justo en el gate) | `8/8` |
| 9 o 10 | `8/8+` |

**⛔ Un `+` y NO el ícono de estrella** (propuesta original del founder,
conversada y acordada). La estrella ya significa otra cosa en el producto: el
`★ 27` del HUD es `totalStars`, la métrica de **recompensa**, y este gate se
sacó a propósito de las estrellas para ponerlo en **completación**
(`BADGE_THRESHOLD` se eliminó por eso; el drawer lo dice explícito: *"Badge
progress bar tracks COMPLETION, not stars"*). Una estrella sobre este chip
vuelve a mezclar las dos cosas que se separaron.

⚠️ **El `+` no es un número, así que un lector de pantalla no puede leerlo.** La
cuenta llega por `aria-label` con una clave nueva, `ariaLabelExceeded`, en los
dos bundles (`en.ts` con `plural`, `es.ts` con `plural`). La clave sale marcada
por `content:audit` igual que la `ariaLabel` que ya existía — mismo shape,
warn-only, exit 0: no es una regresión.

⚠️ La baldosa del hub **no** pasa `extra` y no le hace falta: su contador sólo
existe por debajo del gate. Por eso `extra` es opcional en el tipo del chip.

### 2. La aserción del VR daba verde con `9/8`

`hub-clean` afirmaba el chip con `toHaveText(/^\d+\/\d+$/)`. Esa regex es lo
único que un regex puede ver de una fracción: **la forma**. `9/8` la satisface.

Ahora el caso parsea los dos lados y afirma `done <= gate` (descartando el `+`
antes de parsear, o `Number("8+")` daría `NaN` y el guard se rompería solo). La
foto no podía verlo (el chip son ~450 px sobre una tolerancia de ~1.646) y la
aserción de forma tampoco: entre las dos, el defecto viajó hasta el device.

### 3. Auditoría de fixtures atados al reloj — **cerrada, no queda ninguno suelto**

El pendiente que dejó el handoff anterior: `vr17-play-hub-*` era el candidato
obvio. Resultado:

- **Cinco casos tocan el reloj y los cinco lo pinean.** `hub-clean`,
  `hub-daily-tactic-open`, `hub-shop-sheet-open` y `frame-tablet-600` vía
  `freezeDate(FROZEN_DATE)`; `vr8-coach-history-mixed` vía
  `page.clock.install(FROZEN_NOW_MS)` — sus *"2h ago / 1d ago / 3d ago"* son
  relativos a esa fecha congelada, no a hoy.
- **`vr17-play-hub-*` está limpio.** `PlayHubFixture` pasa todo por props
  (`daysRemaining: 12` incluido) y `PlayHubScaffold` no monta ningún consumidor
  de reloj: su único import de PRO es `import type`.
- **`vr18-learn-hub-*`** sigue pineado por el `today={PINNED_TODAY}` de la sesión
  anterior.
- **El resto de los `/dev/*`** son fixtures de props. Los tres archivos de `/dev`
  que sí leen el reloj (`duel-link-probe`, `permit-probe`, `tx-error-probe`)
  **no tienen caso VR**.

⚠️ **Hueco latente, NO cerrado:** nada impide que el próximo fixture monte un
lector de reloj y se pudra en silencio cada medianoche. Un source guard que
prohíba `todayUtc()` / `new Date()` en el árbol de un fixture VR-cubierto sería
el cierre real. No se construyó — es scope aparte.

---

## Lo que NO se verificó

- **El VR no se corrió esta sesión.** El cambio de esta sesión es un número de
  un dígito dentro de un chip de ~450 px, muy por debajo de la tolerancia
  (~1.646 px sobre 390×844): una corrida verde **no probaría nada** sobre él, y
  por eso el ancla es la aserción de DOM. La última corrida completa válida
  sigue siendo la del handoff anterior: **67 passed** con
  `--project=minipay --update-snapshots=none` y el 3002 libre.
  ⚠️ Si igual se corre, bajar el `pnpm dev` propio primero.
- **El `bottom: 168px`** del banner flotante de guardado sigue siendo una
  estimación sin foto que la cubra — pero el founder lo vio en device esta
  sesión y lo dio por bueno ("se lo ve bastante bien").

---

## Hallazgo lateral — NO tocado

**El gate del hub y el de `/exercises` no cuentan lo mismo.**

- `use-hub-data.ts` → `loadCompletedPerPiece()` es el conteo **ANCHO**: suma toda
  entrada positiva del storage, ids retirados incluidos, porque la maestría no se
  revoca cuando cambian los ids internos.
- `use-exercise-progress.ts` → `completedExerciseCount()` es el **ANGOSTO**:
  intersecta con el catálogo vivo.

Angosto ≤ ancho siempre, así que el contador del hub no puede pasarse (y por eso
el `9/8` no llegó ahí). Pero el **gate** sí diverge: un jugador con ids retirados
podría ver la baldosa `claimable` sin tener `badgeEarned` en `/exercises`.

No se investigó a fondo. Es territorio de
`[[project_retired_lane_preserves_mastery]]` y no era lo que se estaba probando.
**No convertirlo en tarea sin antes confirmar que es alcanzable** — puede que
ningún jugador real tenga ids retirados hoy.

---

## Decisión de producto tomada

⛔ **Paso 3 (promover el mapa) queda DESCARTADO por ahora.** Founder, tras jugarlo
en device: *"no veo la necesidad de promover el mapa; con lo que tenemos basta"*.

Queda como idea sin prioridad para si alguna vez se cambia el flujo. **No es
trabajo pendiente** y no debería reaparecer como tal en el próximo backlog.

Con eso, el brief de visibilidad del progreso (Pasos 1 → 2 → 3) **cierra en el
Paso 2**.

---

## Qué sigue

1. **PUSH a `origin/main`** — 56 commits sin publicar. Es del founder, no mío.
2. **Cluster Closure Protocol** — sin correr para este cluster: issues de GitHub,
   milestone, sync del README si cambió "What's live", branch hygiene.
3. ⛔ **La "validación del Paso 2" queda CERRADA sin ejecutarse — el test estaba
   mal planteado.** Ver la sección siguiente.
4. **Opcional, hueco latente:** el source guard que impida que un fixture VR
   nuevo monte un lector de reloj.

---

## La validación del Paso 2 se cierra sin ejecutarse

Arrastramos varias sesiones un ítem que decía: *"preguntarle a alguien que jugó
hace ~3 días, antes de que toque nada: ¿qué hiciste la última vez?"*. Nunca se
corrió, y no por falta de agenda. **El test es inejecutable, por dos razones
distintas:**

1. **No hay quién lo responda de forma válida.** Pide una persona **ingenua** —
   que no sepa dónde está el contador ni qué significa. Los únicos que juegan
   somos los dos que lo construimos. Podemos jugarlo; no podemos *no saber*
   dónde mirar, que es exactamente lo que el test mide.
2. **La población que necesita casi no existe.** De 443 jugadores, **434 jugaron
   un solo día** → [[project_content_capacity_and_ranking_ceiling]]. "Alguien que
   jugó hace tres días y volvió" es justo el jugador que el producto todavía no
   tiene. El Paso 2 es una apuesta a que esa retención **aparezca**; no se puede
   validar antes de que exista.

**Decisión (founder, 2026-08-09):** el Paso 2 se da por bueno con el juicio del
device — *"lo estoy probando y veo que está muy bien"*. No queda tarea de
validación pendiente.

⚠️ **Lo que queda no es una tarea, es algo a notar:** si alguna vez hay retención
real, la señal a mirar es si un jugador que vuelve sabe dónde estaba sin abrir
nada. Hasta entonces, ponerlo en una lista de pendientes sólo hace que la lista
mienta.

⛔ **Y la regla que deja para la próxima:** un ítem de validación que exige un
sujeto que no tenemos no es un pendiente — es un deseo. Detectarlo cuando se
escribe, no tres handoffs después.

---

## Open questions

1. **El `8/8+` no se vio en device todavía.** Sólo existe para un jugador que se
   pasó del gate, y el `+` suma ~4 px al chip en la fila más apretada de la
   pantalla. Vale una mirada con una pieza terminada.
2. **¿La divergencia ancho/angosto del gate es alcanzable por un jugador real?**
   Antes de tratarla como bug hay que confirmar que existe alguien con ids
   retirados en storage.
