# Spec — Focus Days: 21 en 30 (Spec B)

**Date**: 2026-07-27
**Status**: draft
**Predecesor**: `docs/specs/2026-07-27-focus-days-ledger.md` (APPROVED, Stage 2 en prod)

## Problem

Hoy un solo número hace tres trabajos incompatibles. `SEASON_PASSES.lite_season_pass_21.durationDays = 21`
(`lib/payments/rail-config.ts:149`) es a la vez:

1. **Cuánto acceso se compra** — `expiresAt = now + durationDays` (`api/verify-payment/route.ts:240`).
2. **La meta del desafío** — `goal: configuredPass.durationDays` (`api/season-pass/status/route.ts:195` y `:213`,
   `api/focus-day/route.ts:194`).
3. **Dónde empieza la ventana** — `windowStart = expiresAt − durationDays` (`focus-days.ts:97`,
   vía `passWindowStartUtc` en `focus-ledger-init.ts:110`), que gobierna la elegibilidad de fechas
   y el backfill.

Como (1) y (2) son el mismo número, la meta exige **acertar todos los días**. Un solo salteo la vuelve
matemáticamente incompletable: quedan 20 días de acceso para 21 días de foco. Stage 2 hizo ese estado
**visible** (`unreachable`, `focus-days.ts:75`), que era su objetivo; no lo hizo **recuperable**.

## Goal

Comprar 30 días de acceso y completar 21 Focus Days adentro: la misma meta, con margen para tropezar
hasta 9 veces, y sin dejar de ser perdible.

## Non-goals

- **No** se convierte en un "30-day challenge". La propuesta comercial sigue siendo el desafío de 21 días.
- **No** cambia el precio ($0.99), el SKU, el `seasonId`, ni el bonus de +3 escudos.
- **No** se toca la economía de escudos, ni se les da poder de perdonar días
  (sigue vigente: el escudo salva un ejercicio, no un día).
- **No** se construye compatibilidad permanente con pases de 21 días (decisión del founder,
  2026-07-27: las únicas filas afectadas son de prueba).
- **No** se cambia el comportamiento de PRO: sin ventana comprada, `unbounded`, nada que agotar.

## Contracts (SDD)

El cambio central: **un campo se parte en dos**, y cada consumidor declara cuál de los dos significa.

```ts
// lib/payments/rail-config.ts
export type SeasonPass = {
  sku: SeasonPassSku;
  priceUsd6: bigint;
  /** Cuánto acceso pagado otorga la compra. Gobierna `expires_at` y, por lo
   *  tanto, la reconstrucción del inicio de ventana. NO es la meta. */
  accessDurationDays: number;
  /** Cuántos Focus Days hay que completar DENTRO de la ventana de acceso.
   *  NO es la duración del pase. Invariante: <= accessDurationDays. */
  challengeGoalDays: number;
  shieldsOnPurchase: number;
  seasonId: string;
  supporterStatus: string;
  source: typeof SEASON_PASS_SOURCE;
};

export const SEASON_PASSES: Record<SeasonPassSku, SeasonPass> = {
  // El sku y el seasonId NO cambian: viajan en filas de settlement ya
  // escritas, y renombrarlos rompe historia por cosmética.
  lite_season_pass_21: {
    sku: "lite_season_pass_21",
    priceUsd6: 990_000n,
    accessDurationDays: 30,
    challengeGoalDays: 21,
    shieldsOnPurchase: 3,
    seasonId: "21day-mind-challenge-2026-q3",
    supporterStatus: "challenger",
    source: SEASON_PASS_SOURCE,
  },
};
```

`durationDays` **desaparece** del tipo `SeasonPass`. El borrado hace exactamente una cosa: obliga al
typecheck a **enumerar** los 7 call sites, de modo que ninguno quede sin revisar.

**Lo que el typecheck NO puede hacer, y este spec no debe fingir que hace**: distinguir cuál de los dos
números corresponde a cada sitio. `challengeGoalDays` y `accessDurationDays` son ambos `number`, así que
intercambiarlos compila limpio, pasa lint y sale a producción diciendo "30 Focus Days" o vendiendo 21
días de acceso. Es el modo de falla ya registrado en el repo: dos métricas `number` de sentido opuesto
se reusan sin error y nadie lo reporta.

**La red de seguridad real son los tests de discriminación** (AC2–AC6): cada consumidor se prueba con
21 ≠ 30, de forma que **intercambiar los dos valores ponga rojo al menos un test por consumidor**. Los
números se eligieron distintos a propósito; si algún día coincidieran, esos tests dejarían de discriminar
y habría que fijarlos con constantes de test propias.

`ProPack.durationDays` **no se toca**: PRO no tiene meta, así que ahí el nombre no es ambiguo.

```ts
// components/hub/use-hub-data.ts — SeasonChallengeMeta
export type SeasonChallengeMeta = {
  /** La meta que la tarjeta nombra ("21 Focus Days"). */
  challengeGoalDays: number;
  /** La ventana dentro de la cual hay que lograrla. Nuevo: la oferta debe
   *  poder decir las dos cosas sin que una se disfrace de la otra. */
  accessDurationDays: number;
  shieldBonus: number;
  priceLabel: string;
};
```

Los tipos de `focus-days.ts` (`FocusWindow`, `FocusDaysProgress`, `ChallengeProgressView`) **no cambian**.
`isUnreachable` tampoco: sigue siendo `owed > daysRemaining`, y con la ventana más larga simplemente
deja de dispararse por un solo salteo. Ese es el punto — la mecánica ya estaba bien, el número estaba mal.

Las firmas que hoy toman `durationDays` pasan a nombrar lo que reciben:

```ts
// focus-days.ts
export function elapsedEligibleDays(
  expiresAt: string | null | undefined,
  accessDurationDays: number,   // ← reconstruye windowStart; NUNCA la meta
  now?: number,
): number;

export function passWindowStartUtc(
  expiresAt: string | null,
  accessDurationDays: number,   // ← idem
): string | null;
```

## Behavior

1. Dado un jugador sin pase, cuando compra, entonces `expires_at = now + 30 días`
   (`accessDurationDays`), y el bonus de 3 escudos se acredita igual que hoy.
2. Dado un pase activo, cuando el status responde, entonces `goal = challengeGoalDays = 21`,
   independientemente de la duración del acceso.
3. Dado un pase activo, cuando se reconstruye el inicio de ventana, entonces se usa
   `expires_at − accessDurationDays`, y la elegibilidad de fechas cubre los 30 días.
4. Dado 12 de 21 completados y 18 días restantes, cuando se evalúa `unreachable`, entonces es
   `false` (9 debidos ≤ 18 restantes) y la tarjeta sigue en `active`.
5. Dado 12 de 21 y 5 días restantes, cuando se evalúa, entonces es `true` (9 > 5): el desafío
   **sigue siendo perdible**, sólo que hace falta salteo sostenido, no un tropiezo.
5b. **El borde es alcanzable.** Con `owed === daysRemaining` el desafío NO es unreachable: quedan
   exactamente tantos días como días se deben, así que aún se completa acertando todos. La
   condición es `owed > daysRemaining` (`focus-days.ts:79`), estricta, y se fija con dos casos
   pegados al borde: 12/21 con **9** días → `false`; 12/21 con **8** días → `true`.
6. Dado 21 de 21 con días restantes, cuando se evalúa, entonces `completed` — y llegar a la meta
   sigue sin acreditar nada (AC18 de Stage 2 se mantiene y su test debe seguir verde).
6b. **`completed` es terminal, y el POST se cierra con él.** Alcanzado `challengeGoalDays`, el
   endpoint de Focus Day **deja de crear filas nuevas** para ese `seasonId`, aunque queden días de
   acceso pagado. Los días 22–30 son **margen para completar, no días registrables después de
   completar**. Un POST posterior responde éxito idempotente sin escribir (misma forma que el no-op
   del mismo día que ya existe), de modo que el cliente no vea un error por algo que no es un error.
   Decisión explícita del founder (2026-07-27), no un efecto colateral: sin esto el ledger seguiría
   acumulando filas que la tarjeta clampa y nadie ve — progreso invisible, que es justo lo que
   Stage 2 vino a eliminar.
7. Dado PRO, cuando se evalúa, entonces `unbounded`: sin countdown y nunca `unreachable`.
8. Dada la oferta (sin pase), cuando se renderiza, entonces nombra **las dos** cifras: la meta (21)
   y la ventana (30). Nunca "30-day challenge".
9. Dado el backfill inicial del ledger, cuando corre, entonces el rango de fechas **elegibles** se
   ensancha a 30 días (`elapsedEligibleDays(expiresAt, accessDurationDays)`), pero la **cantidad**
   de filas que siembra sigue capada por la meta: `Math.min(streak, elapsed, goal)`
   (`focus-days.ts:188`). Ensanchar la ventana cambia *qué días* pueden sembrarse, no *cuántos*.
10. **`sku` y `seasonId` son identificadores internos, nunca copy.** Verificado 2026-07-27:
   `lite_season_pass_21` aparece en un único componente (`season-pass-sheet.tsx:30`) y sólo como
   clave de lookup (`getSeasonPass(SKU)`) y parámetro del rail; `seasonId` no llega a ningún
   componente ni a los bundles de mensajes. Ambos siguen diciendo "21" y eso está bien **mientras
   nadie los muestre** — el spec lo fija con un test para que siga siendo cierto.
11. **El status emite un log estructurado** con la forma de la temporada y el estado resuelto, para
   que un call site mal decidido sea detectable sin que alguien lo note a ojo (ver §Observabilidad).

## Edge cases

- **`completed > goal` NO es alcanzable por el flujo normal.** El POST se cierra al llegar a
  `challengeGoalDays` (Behavior 6b), así que el máximo que ese flujo puede escribir es **21 filas
  por wallet y season**. La ventana de 30 días es margen para *completar* 21, no permiso para
  registrar 30.

  **Los dos escritores del ledger quedan capados en 21**, verificado: el POST por Behavior 6b, y
  el backfill inicial por `backfillDates`, que ya calcula
  `count = Math.min(streak, elapsed, goal)` (`focus-days.ts:188`) — `elapsed` sube a 30 con la
  ventana nueva, pero `goal` sigue mandando. No hace falta tocar ese archivo para sostener el tope.

  El clamp de `focusDaysProgress` a `goal` (`focus-days.ts:70`) se conserva igual, pero su rol es
  **defensa, no comportamiento esperado**: cubre filas históricas anteriores a este cambio,
  fixtures de test, escrituras concurrentes que crucen el umbral antes de que el cierre las vea,
  y filas anómalas de cualquier otro origen. La regla de presentación es incondicional: **la
  interfaz clampa a 21 aunque la persistencia contenga más filas** — nunca "24 of 21", venga de
  donde venga ese 24. Confirmar además que ningún consumidor derive porcentajes de `completed`
  sin clampar.
- **Pase que vence entre el render y el POST.** Ya cubierto por `isEligibleFocusDate`; la ventana más
  larga no lo cambia.
- **`expires_at` ausente o inválido.** `elapsedEligibleDays` devuelve 0 y no se infiere nada. Igual que hoy.
- **El `windowStart` NO se mueve** una vez que deploy y backfill están ambos aplicados:
  `(expires_at + 9) − 30 = expires_at − 21`. Verificado fila por fila contra producción
  (read-only, 2026-07-27): las tres activas dan el mismo inicio de ventana antes y después.
  Sumar 9 días y alargar la ventana a 30 se cancelan exactamente — que es la razón por la que
  sumar 9 es preferible a recalcular desde la compra.
  **El transitorio sí existe**, y su signo depende del orden (ver §Migración).
- **El ledger de las 3 filas está vacío** (`focus_day_ledger`: 0 filas para las tres). No hay
  progreso registrado que un corrimiento de ventana pueda reinterpretar. Esto no es una suposición:
  se contó.
- **Una de las tres ya latcheó su init** (`focus_ledger_init` presente, la que vence 2026-08-01)
  **con 0 filas escritas**. El latch es de una sola vez por wallet, así que esa wallet no volverá a
  inicializar aunque la ventana cambie. Si en la implementación hiciera falta re-inicializarla,
  se revierte borrando su fila de `focus_ledger_init` — no con un redeploy.
- **Un pase de 21 días que expira antes del backfill.** No hay ninguno: la más próxima vence
  2026-08-01, con margen de sobra.

## Acceptance criteria

### Estructura

- [ ] **AC1** — `SeasonPass` ya no tiene `durationDays`; tiene `accessDurationDays: 30` y
      `challengeGoalDays: 21`. El typecheck pasa sin `any` ni casts en ningún call site.
      *(Enumera los sitios; NO garantiza que cada uno eligió bien — eso es AC2–AC6.)*

### Discriminación semántica — un test por consumidor

> **La prueba de que estos ACs sirven**: intercambiar los valores de `accessDurationDays` y
> `challengeGoalDays` en `rail-config.ts` debe poner **rojo al menos un test de cada uno** de
> AC2–AC6. Si al intercambiarlos la suite sigue verde, el AC no está discriminando y hay que
> arreglarlo antes de seguir. Esta verificación por mutación es parte del criterio, no una
> sugerencia.

- [ ] **AC2 — `verify-payment` expira con 30.** Compra a `T` ⇒ `expires_at == T + 30 días`.
      El test fija **30**, no `pass.accessDurationDays`: leer la constante que se quiere probar
      pasaría igual con el valor intercambiado.
- [ ] **AC3 — `season-pass/status` mete la meta en 21.** Con pase activo, la respuesta trae
      `goal === 21`. Además `goal !== 30` explícito, para que el intercambio se vea.
- [ ] **AC4 — `focus-day` usa los DOS, cada uno en su lugar.** Dos tests separados:
      (a) **elegibilidad con 30** — una fecha a 25 días del inicio de ventana es elegible
      (sería rechazada con 21);
      (b) **progreso con 21** — `focusDaysProgress` recibe `goal = 21` y la respuesta reporta
      `goal: 21`. Si el caso se monta con más de 21 filas, esas filas son un **fixture defensivo**
      (simulan datos históricos o anómalos) y el test debe decirlo en su nombre o su comentario:
      el POST no puede producirlas, y leerlas como "el flujo permite 30" contradice AC8.
- [ ] **AC5 — `SeasonChallengeMeta` / tarjeta: meta 21, ventana 30.** La meta que la tarjeta nombra
      es 21 y la ventana que expone es 30, en campos distintos, con un test que falla si se cruzan.
- [ ] **AC6 — la oferta nombra 21 DENTRO de 30.** La copy de compra menciona ambas cifras con su
      rol correcto; ninguna superficie dice "30-day challenge" ni vende "30 días de desafío"
      (`pnpm content:audit` + test de copy en EN y ES).

### Comportamiento

- [ ] **AC7 — el borde de `unreachable` es alcanzable.** 12/21 con **9** días ⇒ `false`;
      12/21 con **8** ⇒ `true`. Los dos casos pegados al borde, de modo que cambiar `>` por `>=`
      ponga rojo.
- [ ] **AC8 — `completed` cierra la escritura.** Alcanzado `challengeGoalDays`, un POST de Focus Day
      con días de acceso restantes **no crea fila nueva** y responde éxito idempotente. Verificado
      contando filas antes y después, no sólo por el status code.
- [ ] **AC9 — `focusDaysProgress(30, 21)`** devuelve `{completed: 21, goal: 21}`. Es una prueba de
      la **defensa**, no de un estado que el flujo pueda producir: ningún escritor llega a 30 filas
      (ver Edge cases). Se elige 30 por ser el extremo que la ventana haría concebible si el tope
      fallara — que es precisamente lo que este clamp tiene que sobrevivir.
- [ ] **AC10 — AC18 de Stage 2 sigue verde**: llegar a 21 no acredita escudos, Peones, Coach ni pase.

### Identificadores y observabilidad

- [ ] **AC11 — `sku` y `seasonId` no son copy.** Test que falla si `lite_season_pass_21` o
      `21day-mind-challenge-2026-q3` aparecen en un bundle de mensajes o en texto renderizado.
      Siguen siendo idénticos en la base (regresión contra la constante).
- [ ] **AC12 — log estructurado del status** con `challengeGoalDays`, `accessDurationDays`,
      `completed`, `daysRemaining` y `state`. Sin wallet completa (hash, como el resto de las rutas)
      ni datos sensibles.
- [ ] **AC13 — test de contrato de la temporada**: falla si `challengeGoalDays !== 21` o
      `accessDurationDays !== 30` para `21day-mind-challenge-2026-q3`. Es el que convierte un cambio
      silencioso de constante en un CI rojo.

### Visual

- [ ] **AC14 — VR con umbral explícito `0.002`** en los casos afectados (`vr18-learn-hub-*` ya lo
      usan; los nuevos que se agreguen también). Re-baselinear **borrando el PNG y regenerando**,
      nunca confiando en `--update-snapshots` con el umbral global de `0.01`: un re-layout completo
      de una fila entra por debajo de ese umbral y deja el baseline viejo en su lugar en verde
      (ocurrido el 2026-07-27). El caso `unreachable` de `/dev/challenge-card` debe seguir siendo
      alcanzable con los números nuevos.

## Migración — acotada a 3 filas

**Naturaleza**: normalización de datos de prueba activos. No hay compradores reales
(verificado read-only 2026-07-27: 6 filas totales, 3 activas, 3 expiradas; las 3 activas son del founder).

**Alcance**: exactamente las 3 filas activas de `21day-mind-challenge-2026-q3`. Las 3 expiradas
**no se tocan** — y no pueden afectar nada: `readSeasonPassRow` filtra `expires_at > now`
(`read-season-pass-row.ts:34`), así que ninguna fila vencida alimenta la reconstrucción de ventana.

**Orden**: aplicados los dos, el `windowStart` queda idéntico al de hoy (ver Edge cases). Lo único
en juego es el transitorio entre uno y otro, y su signo depende del orden:

| Orden | Durante el intervalo | Efecto |
|---|---|---|
| Deploy → backfill | `windowStart = expires − 30` | 9 días **antes** de la compra: `elapsedEligibleDays` sobreestima, el techo del backfill del ledger se **amplía** |
| Backfill → deploy | `windowStart = (expires+9) − 21` | 9 días **después**: `elapsedEligibleDays` subestima, el techo se **achica** |

Ninguno es neutro. **Se elige deploy → backfill**: sobreestimar un techo no escribe nada de más
(el ledger sólo cuenta filas que existen, y hoy son **cero** en las tres), mientras que subestimarlo
podría rechazar una fecha legítima. Y el intervalo debe ser de minutos, no de días.

El `SELECT` previo, el `UPDATE`, el `SELECT` posterior y el rollback están en
`docs/specs/2026-07-27-focus-days-window-21-in-30-backfill.sql`. **No se ejecuta sin aprobación
explícita del founder, con la salida del `SELECT` previo a la vista.**

La salvaguarda cuenta las filas que el `UPDATE` **realmente modificó** (`RETURNING`), no las que
un `SELECT` previo había visto: entre un `SELECT` y un `UPDATE` que reevalúa `now()` hay una
ventana, y una salvaguarda que mide la lectura no está midiendo la escritura.

### Rollback coordinado — código y datos son UNA unidad

El backfill y el deploy se revierten **juntos o no se revierten**. Los dos estados mixtos son
peores que cualquiera de los dos consistentes:

| Estado | Consecuencia |
|---|---|
| Código revertido (21) + backfill aplicado (30 días de acceso) | El pase da 30 días pero el código reconstruye la ventana con 21 ⇒ `windowStart` 9 días tarde, fechas legítimas rechazadas |
| Código desplegado (30) + backfill revertido (21 días de acceso) | Vuelve el bug original: meta 21 con 21 días de acceso, incompletable tras un salteo |

**Regla**: revertir el código obliga a revertir el backfill en la misma intervención, y viceversa.
El `.sql` conserva los valores originales para que la mitad de datos sea siempre reversible.

## Observabilidad

El cambio mueve una constante que nadie mira. Si un call site elige el número equivocado, hoy no
hay nada que lo diga: el mismo silencio que dejó "Day N of 21" yendo hacia atrás durante semanas.

**Dos mecanismos, uno en runtime y otro en CI:**

1. **Log estructurado en `season-pass/status`** (AC12), una línea por respuesta con pase activo:

   ```ts
   log.info("focus_days_status", {
     wallet: hashWallet(wallet),   // hash, como el resto de las rutas
     season_id: seasonId,
     challenge_goal_days: pass.challengeGoalDays,
     access_duration_days: pass.accessDurationDays,
     completed,
     days_remaining: daysRemaining,
     state,                        // active | completed | degraded | disabled
   });
   ```

   Sin wallet completa, sin `expires_at` exacto (deriva de `days_remaining`), sin nada sensible.
   Con esto, "¿la meta salió 30 en prod?" se responde mirando, no adivinando.

2. **Test de contrato de la temporada** (AC13): falla si `challengeGoalDays !== 21` o
   `accessDurationDays !== 30` para `21day-mind-challenge-2026-q3`. Es deliberadamente rígido —
   una temporada futura con otros números **debe** tocar este test, y ese toque es la revisión.

## Out of scope / future

- Que el jugador **vea** cuántos salteos le quedan ("18 días para 9 Focus Days"). La tarjeta hoy
  muestra progreso, ventana y racha; una cuarta cifra necesita diseño.
- Perdón explícito de días (escudos, gracia, compra de días). Descartado en esta ronda.
- Renombrar `lite_season_pass_21` / `21day-mind-challenge-2026-q3` a algo que no diga 21.

## Open questions

- La copy exacta de la oferta. El mensaje conceptual aprobado es
  *"Complete 21 Focus Days within a 30-day window"*; la redacción final en EN y ES queda para
  la implementación, sujeta al brief de lenguaje (nada de "on-chain", ver `project_language_brief_web3_wording`).
- ¿La tarjeta en estado `active` debería nombrar la ventana de 30 en algún lado, o alcanza con
  el countdown que ya muestra? Hoy dice "10 days left" sin explicar de cuántos.
