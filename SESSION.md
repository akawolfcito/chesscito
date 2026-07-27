# Session Handoff — 2026-07-27 (refactor del daily slot + Focus Days S2.1 y S2.2a)

> 📌 **Stage 2 cerró.** El handoff de esa sesión, con lo construido, los gotchas y
> las preguntas abiertas: `docs/handoffs/2026-07-27-focus-days-stage2-handoff.md`.
> Este archivo queda como el registro de cómo se llegó hasta acá.

## Completed

### 1. Branch `feat/focus-days-ledger` borrada
Mergeada y ausente de `origin` (verificado con `ls-remote` antes de borrar, y con
`-d`, no `-D`).

### 2. `refactor/hub-lite-daily-slot` — MERGEADO a `main` local (`5444353`)

`HubLiteScaffold` montaba `HubDailyTile` y era dueño de `dailyOpen`. El tile llama
`useAccount()`, así que el presenter entero necesitaba un provider de wagmi para
renderizar: su propia suite tenía que stubbear el módulo, y un probe `/dev` del hub
de LEARN moría con `WagmiProviderNotFoundError` (lo reproduje: es el rojo literal
que quedó en el log antes de implementar).

Ahora el daily llega como `dailySlot: ReactNode`, **espejando `PlayHubScaffold`**
(`play-hub-scaffold.tsx:27` — no inventé el patrón, ya existía del lado PLAY). El
scaffold conserva lo suyo: el anchor, su `data-tour-target="daily"` y el pulso
`is-pending`. `LearnHubClient` es dueño de la instancia y del estado.

⚠️ **`HubDailyTile` era el ÚLTIMO hook de wagmi del subtree.** Verifiqué
`ChallengeCard`, `LanguageChip`, `AppModeSwitch`, `RewardColumn` y `CandyIcon`:
limpios. **El item 3 (`/dev/learn-hub` + VR) ya no tiene blocker.**

La invariante "el regalo y el Focus Passport abren UNA sola instancia" era una
aserción sobre el scaffold. Se movió a `learn-hub-client-daily-slot.test.tsx`, en un
contenedor que **no tenía ningún test**. Verificada por mutación (rompí el cableado
a propósito y confirmé el rojo), no sólo por verde. De paso el pulso `is-pending`
ganó cobertura, que no tenía.

### 3. `feat/focus-days-ui` — branch VIVA, sin mergear

- **S2.1** (`6619294`): `useLearnFocusDays` + 11 tests.
- **S2.2a** (`6534808`): `buildChallengeProgressView` + `focusWindow` + 14 tests.
- **S2.2b + S2.3** (`afb28a9`): la tarjeta consume la vista, los 5 estados, copy en
  los dos locales, CSS, y el cableado completo. **`Day N of 21` ELIMINADO.**

Dos cosas que apareció el cambio y valen más que el feature:
- **Un bug que iba a introducir yo**: el `·` separador de la racha es un `::before`
  y dependía de que el ordinal fuera siempre primero. Sin ordinal, en `offer` y
  `disabled` colgaba al principio de la fila. Ahora va con `:not(:first-child)`.
- **Dos tests de integración fijaban el defecto** (`Day 0 of 21` a `Day 1 of 21`
  movido sólo por localStorage). Reescritos, no borrados: ahora fijan que la racha
  avanza reactivamente y que la tarjeta se NIEGA a convertirla en progreso.

`disabled` no dice nada de sí mismo (decisión nuestra); `degraded` dice que falta
la métrica (falla nuestra). Se distinguen en copy **y** en `data-progress-state`.

Dos lecturas que el builder mantiene separadas a propósito:
- **ledger sin responder = `loading`, NO `degraded`.** `degraded` nos acusa de una
  falla; no haber preguntado no lo es, y tampoco es un cero.
- **pase vencido = `0 days left`, NO ventana ausente.** Caer en `unbounded` le diría
  a un jugador vencido que no tiene fecha límite.

## Hallazgo que cambió el plan (y decisión del founder)

**El plan decía "`use-hub-data` manda `streak` + `lastCompletedDate`". No se puede.**
Ese fetch no es suyo: lo hace `EffectiveTrainingPassProvider`
(`product-context-providers.tsx:31`), instancia única montada en los dos wallet
providers y **fijada por `product-context-parity.test.tsx:111,118`**.
`use-hub-data.ts:394` sólo lee ese snapshot compartido, que además sirve a PLAY.

**El filo:** el reporte sale de `getDailyProgress()`, leído **diferido** en
`use-hub-data.ts:292-296` (`dailyProgress` arranca `null`). El server latchea con un
`streak=0` literal e ignora el ausente (`focus-ledger-init.ts:40,50`). Disparar antes
de que resuelva el localStorage congela a un jugador real en cero **por toda la
temporada**, y sólo se deshace borrándole la fila de `focus_ledger_init`.

**Decisión firmada (founder, 2026-07-27): opción 1 — llamada aparte, sólo LEARN.**
El provider global queda intacto como autoridad única de acceso pago. LEARN espera
hidratación explícita y llama al mismo `/status` con el reporte, consumiendo
**únicamente** la slice `focusDays`. Nunca re-decide `active`/`source`/expiración.
Un fallo ahí → `degraded` en la tarjeta, **acceso intacto**.

Por eso `DailyProgressState` es una unión discriminada y no un nullable: las dos
lecturas de `null` no son igual de inocuas.

## Current State

- **Branch**: `feat/focus-days-ui` (S2.1, S2.2a y S2.2b+S2.3 adentro).
- ✅ **`main` y `origin/main` están sincronizados en `cfe9ec41`** — el founder pusheó
  el refactor. `main` NO tiene nada de Stage 2.
- ⚠️ **Este `SESSION.md` vive en `feat/focus-days-ui`.** El de `main` sigue siendo el
  de Stage 1 hasta que esta branch mergee.
- **Build (tras S2.4)**: suite **6139 passing / 537 files, EXIT=0, 0
  `Unhandled Errors`**, `tsc` limpio, eslint limpio, `content:audit` sin hallazgos en las claves nuevas (los 162
  que reporta son preexistentes y es warn-only).
- **Uncommitted work**: ninguno.
- 📌 **Baseline corregido: `main` limpio da 531 archivos, no 529.** Lo medí con stash
  para confirmar que el delta era sólo mío. El 529 del handoff anterior estaba viejo.

## Honestidad de proceso

- El refactor y S2.1 se corrieron **en rojo verificado sobre lógica** antes de
  implementar. Para S2.1 el primer rojo fue `no tests` (fallo de import, que **no**
  cuenta): creé el módulo con el contrato y un cuerpo inerte para obtener un rojo
  real de 8 tests, y recién ahí implementé.
- ⚠️ **3 de los 11 tests de S2.1 pasaban ya contra el cuerpo inerte** (los tres
  guardas de "no hace request": loading, PLAY, sin entitlement). Un stub que nunca
  llama a `fetch` los satisface. No están verificados por mutación — si alguien toca
  las guardas, conviene confirmar que se ponen rojos.

## Next Tasks

Sigue el orden de commits de Stage 2 (S2.1, S2.2a y S2.2b+S2.3 hechos):

- ✅ **S2.4 — HECHO** (2026-07-27, 3 commits en `main` local). Lo construido:
  1. `lib/daily/events.ts`: `dispatchDailyCompleted(date)` +
     `subscribeToDailyCompleted`, canal DEDICADO; `progress.ts` lo emite **solo**
     en la rama de cambio real (nunca en el no-op del mismo día).
  2. `lib/season-pass/use-focus-day-recorder.ts`: completación → POST **sin**
     `date`; retry en mount con `lastCompletedDate` acotado a [ayer, hoy]; un ref
     `(wallet, date)` reclamado **antes** del await; un POST fallido **libera** su
     clave para que el próximo mount lo vuelva a deber. 16 tests.
  3. `useLearnFocusDays` toma `refreshToken`; `LearnHubClient` monta el recorder y
     lo bumpea `onRecorded` → **el número se mueve en la misma sesión**. Sin eso
     la escritura existía pero la tarjeta seguía congelada hasta el próximo mount.

  ⚠️ De los 16 tests del recorder, **4 guardas verificadas por mutación**
  (entitlement, PLAY, fecha vieja, fecha futura). Las otras 3 del bloque "no
  escribe" (sin wallet, loading, sin historial) pasan estructuralmente: sin
  wallet o sin fecha no hay nada que postear.

  <details><summary>Diseño original (previo a implementar)</summary>

  ⚠️ **NO colgar el POST de `chesscito:daily-progress-changed`.** Ese evento se
  despacha desde **dos** lugares (`progress.ts:94` y, redundante,
  `challenge-daily-client.tsx:67`) y los tests lo emiten a mano. Colgarse de él es
  exactamente la observación pasiva que el founder descartó: cualquiera que lo
  emita provocaría una escritura.

  📌 `recordDailyCompletion` (`lib/daily/progress.ts:83`) es el **único** punto de
  escritura y devuelve **la misma referencia** en el no-op
  (`if (next === prev) return prev`). Sus 3 llamadores: `hub-daily-tile.tsx:171`,
  `daily-tactic-slot.tsx:116`, `challenge-daily-client.tsx:66`.

  Plan:
  1. `lib/daily/events.ts`: `dispatchDailyCompleted(date)` +
     `subscribeToDailyCompleted`, evento DEDICADO con la fecha en el `detail`.
  2. `progress.ts`: emitirlo SOLO en la rama de cambio real, nunca en el no-op.
  3. `lib/season-pass/use-focus-day-recorder.ts`: completación → POST sin `date`;
     en mount, **una vez por `(wallet, date)` con un ref** → retry con
     `lastCompletedDate` si cae en [ayer, hoy].

  📌 El retry puede dispararse sin saber si la fecha ya está en el ledger: la
  idempotencia la da el UNIQUE. Y el cliente **no puede** saberlo de todos modos:
  `/status` devuelve un conteo, no fechas.

  Invariantes firmadas (founder) que los tests deben fijar: el Daily se completa
  localmente aunque el POST falle · sin wallet no se intenta escribir · la
  escritura normal NO manda `date` · el retry SÍ manda `lastCompletedDate` ·
  nunca se reintenta una fecha fuera de [ayer, hoy] · **ni un POST de más por
  rerender o rehidratación**. — **las seis quedaron con aserción.**
  </details>
- ✅ **S2.5 — HECHO** (`e3a94a5`). `challenge-day.ts`, su test, el campo del tipo y
  las 11 referencias, borrados juntos. El typecheck es la red que prueba que no
  quedó ninguna.
- ✅ **S2.6 — HECHO** (`207d878`). `focus-days-real-path.test.tsx`: AC20 monta
  `LearnHubClient` con `use-hub-data` **real** (sólo red y cadena mockeadas) y
  cubre pase expirable · PRO unbounded · `degraded`; AC18 espía los cuatro
  caminos de acreditación y los deja en cero — verificado que la aserción
  discrimina (metí una ruta que sí se llama y se puso roja).
  ⚠️ **Contrato que mi fixture tenía mal**: `proExpiresAt` viaja como **epoch en
  número**, no ISO. Con ISO el validador (`use-season-pass-status.ts:105`)
  descarta el body ENTERO y la tarjeta cae al `offer` **en silencio**.

▶️ **Stage 2 está COMPLETO (S2.1 → S2.6).** Lo único pendiente es la validación
visual del founder, abajo.

- 🆕 **`/dev/challenge-card`** (`6e50e32`) — los 9 estados apilados a 390px con
  toggle EN/ES. Existe para que esa validación no dependa de tener un pase vivo.
  Hallazgo para el ojo del founder: en PRO la tarjeta dice lo mismo dos veces
  ("PRO Benefit included" en el chip, "Included with PRO" donde va el countdown).

Fuera de Stage 2, cuando el founder quiera:
- **`/dev/learn-hub` + `vr18-learn-hub-*`** — desbloqueado por el refactor. Ahora
  SÍ conviene: los 5 estados ya existen y `data-progress-state` los hace
  fotografiables sin wallet ni pase vivo.
- **`hub-clean` → `exercises-clean`** (~39 fotos revisadas una por una). No tiene
  relación con Stage 2; se sacó del camino crítico a propósito.

## Blockers

✅ **LEVANTADO el bloqueo funcional de push: S2.4 está construido** (2026-07-27,
commits `7977536` · `a528f19` · `1caf6c1`). La cadena en producción ya cierra:
completar el Daily → POST `/api/focus-day` → el hub **relee** el conteo → el
número se mueve en la misma sesión. El defecto "el número se congela" ya no
existe.

🚦 **Sigue en pie la validación visual** (abajo). Es lo único que queda antes del
merge/push de Stage 2 desde el lado del founder.

**Y además, para el merge final de Stage 2** (founder, 2026-07-27):

🚦 **Validación visual antes de mergear.** Nadie vio esto renderizado todavía; los
tests fijan estructura y copy, no que entre en 390px. Revisar: 390px · `active` con
las tres métricas · `unreachable` con su copy extra · `degraded` · **español**
(ocupa más ancho) · streak de dos dígitos · `0 days left` · `Included with PRO`.

El punto de ruptura más probable no es el texto sino la fila
**progreso + countdown + racha**. Si no entra con aire, la salida preferida es
**wrap controlado a dos líneas**, NO achicar tipografía ni convertir todo en chips.
(`.challenge-card-day-count` ya es `flex-wrap: wrap`, así que el wrap existe; falta
medir si respira.)

## Notes

- **Higiene de branches**: siguen ~25 branches locales sin auditar. No se tocó.
- **Spec B (21-en-30) sigue sin escribir.** Sin él, "12 of 21" sigue siendo
  incompletable tras un salteo — pero **visible**, que era el punto de Spec A.
- **CI NO corre Playwright.** VR local necesita `BASE_URL=http://localhost:3002
  PORT=3002`.
- El ledger **sigue prendido en prod (LEARN)**. Mientras Stage 2 no mande el reporte,
  cada llamada cae en `report = null` → no siembra y no latchea. Es correcto y a
  propósito (AC13).
