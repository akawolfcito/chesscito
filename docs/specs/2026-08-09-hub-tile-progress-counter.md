# Spec — hub-tile-progress-counter (Paso 2)

**Date**: 2026-08-09
**Status**: draft · **rev 2** (cierra las tres P0 del red-team)
**Brief**: `docs/product/2026-08-08-progress-visibility-design-brief.md` (§ Paso 2, aprobado)
**Predecesor**: Paso 1 — `docs/specs/2026-08-08-consequence-in-completion-overlay.md`
**Red-team**: `docs/specs/2026-08-09-hub-tile-progress-counter-redteam.md`

---

## Problem

434 de 443 jugadores jugaron un solo día. El brief lo diagnostica como un **problema de
aviso**: nadie vio nunca que estaba avanzando.

El Paso 1 puso la consecuencia en el overlay de completado. Pero el overlay **sólo dispara si
jugás**. Al que vuelve tres días después no lo cubre nada: abre el hub y el rail de baldosas
le dice *qué* pieza está activa, no *cuánto* lleva.

`reward-column.tsx:10` ya distingue cuatro estados y ninguno dice cuánto.

## Goal

Que la baldosa de la pieza activa diga **"3/4"** — cuántos ejercicios lleva de los que
necesita para la insignia — sin agregar un tap ni una pantalla, y **coincidiendo con lo que el
drawer le deja contar con el dedo**.

## Non-goals

- ⛔ **No agregar taps.** La baldosa sigue ruteando a `/exercises?piece=`.
- ⛔ **No reclamar desde la baldosa** (decisión founder 2026-08-09). Arrastra wallet, firma y el
  caso sin-wallet. Si la visibilidad sola mueve la aguja, el claim nunca hizo falta.
- ⛔ **No wayfinding al Claim.** El drawer abre en la lista, como hoy.
- ⛔ **No tocar el Path / mapa** (Paso 3, condicional).
- ⛔ **No mostrar el contador fuera de `progress`.**
- ⛔ **No tocar PLAY.** `play-hub-path-grid` reusa `.reward-tile` con su propio CSS
  (`globals.css:10010`); el chip no debe filtrarse.

---

## La decisión que ordena el spec

> **La baldosa dice lo mismo que el drawer.** (founder, 2026-08-09)

Suena obvio y no lo era: hoy el hub y el drawer cuentan **con reglas distintas**, en los dos
lados de la fracción.

| | Numerador ("hiciste") | Denominador ("hacen falta") |
|---|---|---|
| **Drawer** | `completedExerciseCount` (`exercises.ts:58-64`) — filtra sobre `catalog[piece]`: sólo cuenta lo que **existe hoy** | catálogo **mergeado** (baseline ⊕ overlay), vía `useExerciseCatalog()` dentro del provider |
| **Hub (hoy)** | `loadCompletedPerPiece` (`use-hub-data.ts:134-155`) — cuenta **toda entrada positiva** del storage, incluidos ids retirados | `EXERCISES` **baseline**: el hub no está dentro de `ContentCatalogProvider`, que se monta sólo en `/exercises/page.tsx:133` |

Como *estado* ese desacuerdo era inofensivo. Como *número en pantalla* produce
"4/5 en la baldosa, 3 hechos en el drawer" — el fallo de *un número que el jugador no puede
reconciliar*. **Ambos lados se alinean al drawer.**

### El numerador

El hub deja de usar el conteo pre-cocido y pasa a usar la misma función que el drawer. Para eso
necesita el mapa de estrellas **keyed by id**, no un total:

```ts
// use-hub-data.ts — reemplaza a loadCompletedPerPiece
/** Mapa id→estrellas por pieza, sin agregar. El conteo lo hace
 *  `completedExerciseCount`, que intersecta con el catálogo vigente —
 *  así el hub cuenta lo mismo que el drawer. */
function loadStarsByIdPerPiece(): Partial<Record<PieceId, Record<string, number>>>;
```

⚠️ **El gate de la insignia NO cambia.** Sigue leyendo el conteo amplio, porque *la maestría no
se revoca* cuando cambian ids internos. Es un desfase deliberado y **nunca visible**: cuando el
conteo amplio cruza el gate, la baldosa ya pasó a `claimable` y el chip desapareció.

### El denominador

El hub necesita el mismo catálogo que el drawer, **sin pagar su peso** — MiniPay es el único
criterio de performance y el hub es el camino crítico al primer juego.

No hace falta el catálogo: hacen falta **los ids**. Numerador y denominador salen de la misma
lista, así que la baldosa coincide con el drawer *por construcción*.

```ts
// nuevo — server boundary del hub
/** Ids de ejercicio por pieza del catálogo VIGENTE. Todo lo que el contador
 *  necesita, en el payload más chico que lo garantiza. */
export type ExerciseIdsPerPiece = Record<PieceId, readonly string[]>;
```

Gateado por el mismo kill-switch que ya existe (`envStageFloor()`, `page.tsx:102`):

- **`CONTENT_STAGE` sin setear** (default hoy) → los ids salen de `EXERCISES`, ya compilado en
  el bundle. **Cero DB, cero payload nuevo.** Byte-idéntico al camino actual.
- **`CONTENT_STAGE` seteado** → el boundary sirve los ids del catálogo mergeado (`~78` strings
  cortos), y el hub concuerda con el drawer.

---

## Contracts (SDD)

```ts
// apps/web/src/components/kingdom/reward-column.tsx

/** Cuánto lleva el jugador hacia la insignia de esta pieza.
 *
 *  ⚠️ `required` es el GATE (`badgeRequiredCount(poolSize)` = 80% redondeado
 *  hacia arriba), NO el tamaño del pool. Un pool de 10 tiene gate 8: mostrar
 *  "8/10" con la insignia ya ganada sería irreconciliable. */
export type RewardTileProgress = {
  /** Ejercicios del catálogo VIGENTE completados (≥1★) — vía
   *  `completedExerciseCount`, la misma función que usa el drawer. */
  completed: number;
  /** Ejercicios necesarios para la insignia. Siempre > 0: un pool vacío cae
   *  en `locked` y nunca llega acá. */
  required: number;
};

export type RewardTile = {
  id: RewardTileId;
  state: RewardTileState;
  /** ⚠️ Se llama `progress` como el ESTADO homónimo y como el `ariaState` que
   *  `claimed` produce (`reward-column.tsx:89-90`). Coexisten a propósito:
   *  el prop existe SÓLO cuando `state === "progress"` y los datos están
   *  hidratados. `undefined` = no hay nada honesto que decir. */
  progress?: RewardTileProgress;
  onTap?: () => void;
};
```

```ts
// apps/web/src/lib/hub/derive-reward-tiles.ts

export type RewardDerivationInput = {
  badgesClaimed: Partial<Record<PieceId, boolean>>;
  /** Alimenta el GATE (conteo amplio) — sin cambios, no se revoca maestría. */
  completedPerPiece: Partial<Record<PieceId, number>>;
  /** Alimenta el CHIP (conteo intersectado con el catálogo). */
  starsByIdPerPiece: Partial<Record<PieceId, Record<string, number>>>;
  onTileTap?: (piece: PieceId) => void;
  catalog?: ExerciseCatalog;
  /** ⛔ REQUERIDO, sin default. `completedPerPiece` arranca `{}` y se llena en
   *  un efecto de montaje (`use-hub-data.ts:283-291`): en el primer paint todo
   *  vale 0. Un estado no afirma nada numérico; un contador SÍ, y "0/4" en una
   *  pieza con 3 hechos es una mentira visible. Sin default para que `tsc`
   *  señale cada call site. */
  isHydrated: boolean;
};
```

```ts
// apps/web/src/components/hub/use-hub-data.ts — shared
/** `true` una vez que el efecto de montaje leyó localStorage. Todo consumidor
 *  que afirme un NÚMERO debe esperarla. */
isProgressHydrated: boolean;
```

### i18n — clave separada, no un argumento nuevo

⛔ **No tocar `REWARD_COPY.<id>.ariaLabel`.** Lo consumen las 6 piezas en los 4 estados
(`reward-column.tsx:106`) y **`tsc` no ve los argumentos ICU**: agregarle `{completed}` compila
en verde y falla en runtime.

```
REWARD_COPY.<id>.ariaLabelWithProgress  // "{piece}, {completed} of {required} toward the badge"
```

Se usa **sólo** cuando hay `progress`; el resto sigue con `ariaLabel`. Va en **EN y ES**, y el
guard de bundle ES lo cubre.

---

## Behavior

1. **Dado** 3 de 4 requeridos hechos en torre, **cuando** abre el hub hidratado, **entonces**
   la baldosa de torre muestra el chip `3/4`.
2. **Dado** el primer paint sin hidratar, **entonces** ninguna baldosa muestra chip — ni
   `0/N`. Al hidratar aparece. El hueco **no cambia de alto** (el chip se posiciona absoluto,
   no empuja layout).
3. **Dado** un estado distinto de `progress`, **entonces** nunca hay chip: `claimed` ya tiene
   su `✓` (`:120-127`), `claimable` su punto pulsante (`:128-137`), `locked` no tiene nada que
   contar y seis `0/4` leen como deuda.
4. **Dado** un pool de 10 con gate 8 y 5 hechos, **entonces** el chip dice `5/8` — el gate.
5. **Dado** que el jugador cruza el gate, **entonces** la baldosa pasa a `claimable` y el chip
   **desaparece**; no existe `4/4`. Intencional: en ese instante el jugador está en el overlay
   del Paso 1, no en el hub, y cuando vuelva la baldosa ya es reclamable.
6. **Dado** un lector de pantalla, **entonces** el conteo llega por `ariaLabelWithProgress`. El
   chip es `aria-hidden`; no hay nodo suelto que se lea dos veces.
7. **Dado** el variante `compact` (48px), **entonces** el chip escala y no desborda.
8. **Dado** un id en el storage que ya no existe en el catálogo, **entonces** el chip **no lo
   cuenta** (coincide con el drawer) aunque el gate sí lo siga contando.
9. ⛔ **Sin animación de entrada.** El anti-objetivo del brief es no celebrar dos veces lo
   mismo; el Paso 1 ya celebró esa consecuencia. Decisión cerrada, no una omisión.

---

## Edge cases

| Caso | Comportamiento |
|---|---|
| Pool vacío (rey "soon") | `hasExercises` → `locked` (`derive-reward-tiles.ts:76,79`). Nunca llega a `progress`. **Nunca se divide por cero.** |
| `completed > required` en `progress` | Imposible por construcción (`meetsThreshold` sería true). Se **clampea** igual: una regresión futura no debe pintar `9/8`. |
| Storage con ids retirados | El chip los ignora; el gate los cuenta. Ver Behavior 8 — desfase deliberado e invisible. |
| El catálogo CRECE desde el builder | `required` sube: `3/4` puede volverse `3/5`. No es mentira (el gate es ratio, `exercises.ts:38-42`), pero el número puede retroceder relativo sin que el jugador haya perdido nada. |
| `CONTENT_STAGE` seteado con overlay activo | Los ids del boundary mandan; hub y drawer concuerdan. |
| Sin wallet | `badgesClaimed` vacío → la primera pieza queda `progress`. El chip funciona: el conteo es local, no on-chain. |

---

## Acceptance criteria

- [ ] **AC-1** `RewardTile` acepta `progress?: RewardTileProgress`; `tsc --noEmit` limpio.
- [ ] **AC-2** `deriveRewardTiles` exige `isHydrated` y `tsc` marca los call sites sin él.
      Blast radius conocido: `reward-column.test.tsx`, `hub-scaffold.test.tsx`,
      `hub-lite-scaffold.test.tsx`, `mastery-dashboard.test.tsx`, `app/dev/learn-hub/fixture.tsx`.
- [ ] **AC-3** Con `isHydrated: false`, ninguna tile trae `progress`.
- [ ] **AC-4** Con `isHydrated: true`, sólo la tile en `progress` lo trae.
- [ ] **AC-5** El denominador es `badgeRequiredCount(poolSize)`: pool de 10 → `required === 8`.
- [ ] **AC-6** 🔴 **El chip ignora ids retirados.** Storage con 4 ids de los cuales 1 no está en
      el catálogo → chip `3/N`, **y** el gate sigue viendo 4. Un solo test que ancla las dos
      mitades de la decisión del founder.
- [ ] **AC-7** El chip coincide con el conteo del drawer para el mismo storage y catálogo
      (mismo `completedExerciseCount`, no una reimplementación).
- [ ] **AC-8** `RewardColumn` pinta el chip sólo con `progress` presente, y nunca en
      `claimed` / `claimable` / `locked`.
- [ ] **AC-9** El chip es `aria-hidden`; el conteo viaja por `ariaLabelWithProgress`, clave
      **nueva**, presente en EN y ES.
- [ ] **AC-10** `use-hub-data` expone `isProgressHydrated`, `false` antes del montaje.
- [ ] **AC-11** Con `CONTENT_STAGE` sin setear, el camino es byte-idéntico al actual: cero DB
      hits, ids desde `EXERCISES` compilado.
- [ ] **AC-12** El fixture `/dev/learn-hub` gana un variant con una tile en `progress`, **y ese
      variant está en la allowlist de su `page.tsx`**. Sin la allowlist, el VR graba una
      baseline verde de otra pantalla.
- [ ] **AC-13** VR en dos pasos, en orden:
      1. bajar el `pnpm dev` propio (si Playwright adopta el server de 3002 pierde el pin de
         `NEXT_PUBLIC_CHAIN_ID` y aparecen rojas que parecen regresión de código);
      2. grabar **sólo** las baselines esperadas, contarlas, y **abrir cada PNG** para
         confirmar que el chip está en la foto;
      3. correr `--project=minipay --update-snapshots=none` y exigir verde. **Ese verde es el
         único que cuenta** — una corrida que graba lo faltante reporta PASSED sin comparar.
- [ ] **AC-14** Vitest: **medir el conteo de archivos en `main` limpio ANTES de tocar nada y
      anotarlo**; la corrida final debe dar ese mismo número. ⛔ No se pinea una constante:
      CLAUDE.md declara 598 y 610 en dos lugares y en disco hay 647 archivos de test — ninguno
      es verificable estáticamente. La regla (un conteo que BAJA = corrida inválida, no un
      pase) sigue siendo la que vale.

---

## Out of scope / future

- Claim desde la baldosa y su caso sin-wallet silencioso.
- Wayfinding del drawer al botón Claim.
- Paso 3 (promover el mapa) — sólo si 1 y 2 no alcanzan.
- Progreso del carril 2 en la baldosa: no consume cuota y sigue abierto cuando pega el muro
  diario (`exercise-drawer.tsx:155-156`), pero mezcla dos denominadores en 60px.

## Open questions

Ninguna bloqueante. Las dos del rev 1 quedaron cerradas: sin animación (Behavior 9) y la
desaparición del chip al cruzar el gate es intencional (Behavior 5).

---

## Resultado de la implementación (2026-08-09, `46f31f9` + `e569d5f`)

**Entregado y verde**: 614 archivos / 7565 tests, `exit 0`, mismo conteo de archivos que el
baseline medido en `main` limpio antes de empezar (614/7557). `tsc --noEmit` limpio. VR
**66 passed** con `--project=minipay --update-snapshots=none`.

### Lo que el spec dijo mal

- **AC-2, el blast radius estaba equivocado.** Predije `hub-scaffold.test.tsx`,
  `mastery-dashboard.test.tsx` y `hub-lite-scaffold.test.tsx`. No rompió ninguno: reciben
  `RewardTile[]` ya armado y no pasan por la derivación. Los 13 reales fueron
  `learn-hub-client.tsx:416`, `catalog-injection.test.ts:79` y 11 en el test de la derivación.
- **AC-12 pedía trabajo que no hacía falta.** No hubo variant nuevo ni cambio de allowlist: el
  fixture ya tenía una baldosa en `progress` (knight) y `REWARD_TILES` es el mismo const para
  los cuatro variants, así que el chip entró en las cuatro baselines de una.
- **AC-14 no podía pinear un número, y con razón.** El real es **614**; CLAUDE.md declaraba 598
  y 610, y en disco hay 647 archivos de test. Ninguno de los tres era el correcto.

### Desvíos deliberados

- **⛔ No se implementó el clamp** que pedía Edge cases. Es inalcanzable: para que el conteo
  estrecho supere el gate, el amplio tendría que superarlo también (amplio ≥ estrecho), y ahí
  el estado ya es `claimable` y no hay chip. Sería código muerto que ningún test puede tocar.
  Queda documentado en el tipo en vez de escrito.
- **La clave i18n NO pudo ir dentro de `REWARD_COPY`.** `RewardTileId = keyof typeof
  REWARD_COPY`: cualquier clave agregada ahí se vuelve un id de baldosa válido. Vive en
  `REWARD_PROGRESS_COPY`, y es **una** clave compartida con `{piece}` en vez de siete — las
  siete `ariaLabel` existentes son per-pieza porque su frase difiere de verdad; ésta no.

### Un caso que el spec no contempló

`loadStarsByIdPerPiece` **ignora la forma array** del storage. `loadCompletedPerPiece` acepta
array u objeto, pero un array no trae ids con los que intersectar: contarlo daría exactamente
el número irreconciliable que la decisión del founder vino a evitar. Esa pieza se queda sin
contador en vez de mostrar uno inventado.

### Hallazgo aparte, ya arreglado (`e569d5f`)

Las cuatro baselines `vr18-learn-hub-*` **seguían el reloj real** y se pudrían cada medianoche
UTC — defecto preexistente, no del Paso 2. Ver el commit; el fix pinea la fecha en el fixture y
`HubLiteScaffold` ahora reenvía el `today` que `ChallengeCard` ya exponía para eso.

---

## Cómo se valida (del brief, no negociable)

⛔ **No con métricas** — 443 jugadores no dan poder estadístico; sería ruido con forma de
conclusión.

✅ **Playtest, una pregunta**, a alguien que jugó hace tres días, **antes de que toque nada**:
*"¿qué hiciste la última vez?"*. Si no puede contestar, no está resuelto.
