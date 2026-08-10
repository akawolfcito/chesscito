# Handoff — el contador que se pasaba de su meta, y la auditoría de relojes del VR

**Fecha:** 2026-08-09
**Rama:** `main` local (56 commits sin pushear a `origin/main`)
**Commit de cierre:** `831053b`
**Handoff anterior:** `docs/handoffs/2026-08-09-hub-tile-progress-counter-handoff.md`

---

## Estado

| Verificación | Resultado | Cómo se midió |
| --- | --- | --- |
| Suite web | **7577 passing / 617 files, EXIT=0** | `pnpm test` con la máquina libre (sin `pnpm dev` arriba), salida a archivo y `echo $?` |
| `Unhandled Errors` | **0** | `grep -c "Unhandled Error"` sobre el log completo, no sobre el resumen |
| `tsc` | limpio | `pnpm exec tsc --noEmit` |
| VR | **no se recorrió esta sesión** | ver "Lo que NO se verificó" |

El conteo de archivos **subió** de 616 a 617 (el test nuevo). Esa es la dirección
correcta: si hubiera bajado, la corrida no valía.

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
`{ completed: Math.min(completedCount, required), required }`.

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
- ❌ `8/8 + START` — descartado. Ese momento ya se anuncia dos veces (el modal de
  milestone con su botón Claim, y el punto rojo del CLAIM en el dock). Un tercer
  aviso repite el problema ya cerrado en
  `[[project_the_badge_gate_moment_belongs_to_the_milestone_modal]]`.
  ⚠️ Queda **abierto** si con START se pensaba en otra cosa (arrancar el
  ejercicio que falta, no reclamar) — ver Open questions.

### 2. La aserción del VR daba verde con `9/8`

`hub-clean` afirmaba el chip con `toHaveText(/^\d+\/\d+$/)`. Esa regex es lo
único que un regex puede ver de una fracción: **la forma**. `9/8` la satisface.

Ahora el caso parsea los dos lados y afirma `done <= gate`. La foto no podía
verlo (el chip son ~450 px sobre una tolerancia de ~1.646) y la aserción de forma
tampoco: entre las dos, el defecto viajó hasta el device.

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
3. **La validación del Paso 2 sigue siendo un playtest, una pregunta**: a alguien
   que jugó hace ~3 días, antes de que toque nada, *"¿qué hiciste la última
   vez?"*. ⛔ No con métricas — 443 jugadores no dan poder estadístico.
4. **Opcional, hueco latente:** el source guard que impida que un fixture VR
   nuevo monte un lector de reloj.

---

## Open questions

1. **¿El `START` del founder era otra cosa?** Se descartó entendido como "otro
   botón de Claim". Si la idea era *arrancar el ejercicio que falta* desde el
   chip, es una propuesta distinta y no evaluada.
2. **¿La divergencia ancho/angosto del gate es alcanzable por un jugador real?**
   Antes de tratarla como bug hay que confirmar que existe alguien con ids
   retirados en storage.
