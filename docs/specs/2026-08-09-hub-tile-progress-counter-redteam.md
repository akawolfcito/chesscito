# Red Team Review — hub-tile-progress-counter (Paso 2)

**Date**: 2026-08-09
**Reviewer mindset**: hostile QA + senior engineer
**Spec bajo revisión**: `docs/specs/2026-08-09-hub-tile-progress-counter.md`

> El spec convierte un dato interno en una **afirmación numérica en pantalla**. Ese cambio de
> categoría es todo el riesgo: los estados podían estar mal y nadie lo notaba; un número mal
> no se lee como un bug, se lee como una mentira.

---

## Findings

### P0 — Must address before implementation

- **[Numerador y denominador vienen de generaciones distintas del catálogo]**
  `loadCompletedPerPiece` (`use-hub-data.ts:134-155`) cuenta **toda entrada positiva** del mapa
  `stars` guardado en `chesscito:progress:<piece>` — **no la intersecta con `catalog[piece]`**.
  El denominador, en cambio, sale de `badgeRequiredCount(catalog[piece].length)`: el catálogo
  **de hoy**. Y esto no es un descuido: la maestría **no se revoca** cuando cambian ids
  internos (decisión vigente). Consecuencia: un jugador con ejercicios retirados en su storage
  ve `4/5` en la baldosa mientras el drawer le muestra 3 hechos sobre el pool actual.
  **Por qué bloquea:** es exactamente el fallo "un número que el jugador no puede reconciliar
  se lee como mentira". El spec lo tapa a medias con un clamp (Edge cases) que sólo evita
  `9/8` — no evita el desacuerdo con el drawer, que es el daño real.
  **Exige decisión antes de codear:** o el numerador mostrado se intersecta con el pool actual
  (y entonces **difiere del que abre la insignia** — dos números distintos en dos superficies,
  peor), o la baldosa muestra el mismo conteo que el drawer y se acepta que el gate use otro.
  No hay tercera opción silenciosa. ⛔ No implementar hasta elegir.

- **[El `aria-label` compartido no aguanta un argumento nuevo, y `tsc` no lo va a decir]**
  AC-7 mete el conteo en `REWARD_COPY.<id>.ariaLabel`, que hoy ya toma `{state}`
  (`reward-column.tsx:106`) y lo consumen **las seis piezas en los cuatro estados**. Agregar
  `{completed}`/`{required}` a ese mensaje lo vuelve obligatorio para llamadas que no tienen
  esos valores. **`tsc` NO ve los argumentos ICU** — los call sites siguen compilando y el
  fallo aparece en runtime o, peor, como texto degradado.
  **Por qué bloquea:** el spec pide tocar un mensaje compartido sin decir que necesita una
  **clave separada** (p. ej. `ariaLabelWithProgress`) y su gemela en el bundle ES.

- **[El VR puede dar verde sin haber fotografiado el chip jamás]**
  AC-10 pide que el fixture `/dev/learn-hub` traiga una tile con `progress`, pero no dice que
  el fixture se sirve por una **allowlist de variantes en su `page.tsx`**. Un variant fuera de
  la allowlist **graba una baseline verde de otra pantalla**. Sumado a que `hub-clean`
  fotografía `/exercises` (no el hub), la cobertura real del rail queda colgando de los
  `vr18-learn-hub-*`.
  **Por qué bloquea:** el modo de falla es un verde, no un rojo. Sin allowlist explícita en el
  plan, el criterio AC-11 se puede cumplir sin cubrir nada.
  **Exige:** nombrar el variant, agregarlo a la allowlist, y **abrir el PNG** para confirmar
  que el chip está en la foto.

### P1 — Should address

- **[El chip hace visible un flash de estado que ya existía]**
  `completedPerPiece` arranca `{}` (`use-hub-data.ts:283-291`), así que en el primer paint la
  derivación ya produce estados equivocados: la primera pieza en `progress`, el resto `locked`.
  Eso hoy pasa desapercibido. El spec (Behavior 2) hace que el chip **aparezca tarde**, lo que
  llama la atención sobre el flash en vez de taparlo.
  **Riesgo si se ignora:** se arregla la mentira numérica y se empeora la percepción de que el
  hub "carga en dos etapas". Decidir si `isProgressHydrated` gatea sólo el chip o el rail.

- **[`.reward-tile` lo reusan tres superficies de PLAY]**
  `globals.css:9647` (`play-hub-secondary-actions`), `:10010` (`play-hub-path-grid`) y `:11700`
  (`hub-action-rail`) montan `.reward-tile` con su propio layout. El spec declara el no-goal
  pero no dice **cómo** se garantiza.
  **Riesgo:** una regla nueva sin scope se filtra a PLAY. Mitigación real: el chip es un nodo
  que **sólo se renderiza si llega el prop**, y esas superficies construyen sus tiles por otro
  camino — verificar que ninguna hace spread de props arbitrarios.

- **[AC-11 pide "re-grabar deliberadamente" — esa frase es la trampa]**
  Un `--update-snapshots` no verifica nada, y una corrida que graba baselines faltantes reporta
  PASSED sin comparar. AC-11 debe partirse en dos pasos ordenados: (1) grabar **sólo** los
  archivos esperados y contarlos; (2) correr de nuevo con `--project=minipay
  --update-snapshots=none` y exigir verde ahí. El verde del paso 2 es el único que cuenta.
  **Además:** bajar el `pnpm dev` propio antes de correr, o Playwright adopta el server de 3002
  sin el pin de `NEXT_PUBLIC_CHAIN_ID` y aparecen rojas que parecen regresión de código.

- **[`isHydrated` requerido va a romper call sites de test — eso es lo que se busca, pero hay que contarlo]**
  El spec lo justifica bien (EDD), pero no dimensiona el blast radius:
  `reward-column.test.tsx`, `hub-scaffold.test.tsx`, `hub-lite-scaffold.test.tsx`,
  `mastery-dashboard.test.tsx` y el fixture de `/dev`. Si el plan de TDD no los lista, la
  primera corrida roja se va a leer como sorpresa.

### P2 — Nice to clarify

- **[La palabra "progress" ya está sobrecargada]** `reward-column.tsx:89-90` mapea
  `state: "claimed"` a `ariaState: "progress"`. Ahora habrá además un prop `progress` que
  **nunca** acompaña a `claimed`. Un lector del código va a tropezar. Renombrar el prop
  (`counter`, `towardBadge`) o comentar la colisión.

- **[La open question de la animación no es opcional]** El spec propone "sin animación" y lo
  deja abierto. Es la decisión correcta (el anti-objetivo del brief es no celebrar dos veces),
  pero dejarla abierta invita a que alguien agregue un `transition` en review. Cerrarla.

- **[Behavior 5 describe una desaparición que nadie va a ver]** El chip se va justo cuando el
  jugador cruza el gate — pero en ese momento está en el overlay del Paso 1, no en el hub.
  Cuando vuelva, la baldosa ya es `claimable`. No es un bug; conviene decir que es intencional
  para que no se reporte como "el contador se perdió".

---

## Categories audited

### Contract gaps
`RewardTileProgress` es explícito y sin `any`. ✅ El `?` en `progress` codifica bien "no hay
nada honesto que decir". ⚠️ Falta el tipo de la clave i18n nueva (P0-2).

### Behavioral ambiguity
Los 7 behaviors tienen trigger claro. ⚠️ Behavior 2 no dice **qué se pinta** en el hueco
mientras no hay chip (¿nada, o un placeholder de alto fijo para que no salte el layout?).

### Hidden assumptions
- Asume que `completedPerPiece` sólo cuenta carril 1. Verificado: el carril 2 usa
  `labyrinthBests`, storage aparte. ✅
- Asume que `progress` implica `completed < required`. Cierto **por construcción hoy**
  (`derive-reward-tiles.ts:81-84`). Frágil ante un refactor: el clamp es el seguro correcto.
- Asume pool > 0 en `progress`. Garantizado por `hasExercises` (`:76,79`). ✅

### Backward compatibility
`progress` es opcional → ningún consumidor existente rompe. `isHydrated` requerido rompe a
propósito. No hay datos persistidos con formato nuevo. ✅ Sin migración.

### Security & data
Sin PII, sin red, sin wallet: el conteo es localStorage y ya se leía. Sin superficie nueva de
ataque. ✅

### Test coverage gaps
AC-1..AC-9 son testeables en unit. ⚠️ **Falta un AC** para el caso del P0-1 (numerador con ids
retirados): sin él, la decisión que se tome no queda anclada por ningún test.
⚠️ AC-12 pide 610 archivos, pero el baseline citado en CLAUDE.md es **598 files / 7404** en un
lugar y **610 / 7504** en otro. Fijar el número correcto antes de usarlo como criterio, o el
AC es infalsificable.

### Operational readiness
Sin logging nuevo — correcto, es UI pura. `track("hub_reward_tile_tap")` ya existe
(`learn-hub-client.tsx:420`) y no cambia. Rollback = revertir el commit; no hay estado
persistido que quede huérfano. ✅

---

## Resolución (rev 2 del spec — 2026-08-09)

| Hallazgo | Cómo quedó |
|---|---|
| **P0-1** numerador/denominador | **Cerrado.** Decisión founder: *la baldosa dice lo mismo que el drawer*. El numerador pasa a `completedExerciseCount` (intersecta con el catálogo); el denominador se alinea sirviendo los **ids** del catálogo vigente al hub, bajo el kill-switch `envStageFloor()` — cero DB y cero payload cuando `CONTENT_STAGE` está sin setear. El gate **no** cambia: la maestría no se revoca, y el desfase nunca se ve porque al cruzarlo la baldosa ya es `claimable`. Anclado en **AC-6**. |
| **P0-2** aria-label ICU | **Cerrado.** Clave nueva `ariaLabelWithProgress` (EN + ES); el mensaje compartido no se toca. **AC-9**. |
| **P0-3** VR verde sin cobertura | **Cerrado.** **AC-12** exige el variant del fixture *y* su allowlist; **AC-13** parte la verificación en tres pasos y obliga a abrir cada PNG. |
| **P1** flash de hidratación | Mitigado: Behavior 2 fija que el chip no altera el alto (posición absoluta), así que la aparición tardía no salta el layout. El flash de *estado* preexistente queda fuera de alcance, declarado. |
| **P1** `.reward-tile` en PLAY | Behavior/no-goal + el chip sólo se renderiza si llega el prop; PLAY construye sus tiles por otro camino. |
| **P1** `--update-snapshots` | **AC-13**. |
| **P1** blast radius de `isHydrated` | Enumerado en **AC-2**. |
| **P2** "progress" sobrecargado | Documentado en el propio tipo en vez de renombrar. |
| **P2** animación | Cerrada: **sin** animación (Behavior 9). |
| **P2** desaparición del chip | Declarada intencional (Behavior 5). |
| *Test coverage gap* (AC faltante) | **AC-6** y **AC-7**. |
| *AC-12 infalsificable* | **AC-14**: se mide el baseline en `main` limpio antes de tocar nada. En disco hay **647** archivos de test; CLAUDE.md dice 598 y 610. Ninguno es verificable estáticamente, así que no se pinea constante. |

**Verdict actualizado: READY para `/tdd`.**

---

## Verdict (rev 1 — histórico)

**NEEDS REVISION** — tres P0 antes de `/tdd`.

1. **Decidir el numerador** (P0-1): qué se muestra cuando el storage tiene ids retirados, y
   cómo se garantiza que la baldosa y el drawer digan lo mismo. Es una decisión de producto,
   no técnica.
2. **Clave i18n separada** (P0-2) para el aria-label con conteo, EN + ES, sin tocar el mensaje
   compartido.
3. **Nombrar el variant del fixture y su allowlist** (P0-3), y agregar a AC-11 la verificación
   de que el PNG contiene el chip.

Con eso resuelto, más el AC faltante señalado en *Test coverage gaps* y el número de archivos
de AC-12 corregido, el spec queda listo.
