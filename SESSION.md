# Session Handoff — 2026-07-27 (refactor del daily slot + Focus Days S2.1)

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

### 3. `feat/focus-days-ui` S2.1 (`6619294`) — branch VIVA, sin mergear

`useLearnFocusDays` + 11 tests. **Todavía no lo consume ninguna superficie.**

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

- **Branch**: `feat/focus-days-ui` (S2.1 adentro). `main` local tiene el refactor.
- **`main` está 4 commits adelante de `origin/main`** (2 de docs previos + refactor +
  merge). ⏳ **El founder pushea.**
- **Build**: suite **6094 passing / 533 files, EXIT=0, 0 `Unhandled Errors`**, `tsc`
  limpio, eslint limpio.
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

Sigue el orden de commits de Stage 2 (S2.1 hecho):

- **S2.2** — `ChallengeCard`: los 5 estados de `challengeProgressView` (`offer`,
  `disabled`, `degraded`, `active` con `unreachable`, `completed`). El CTA
  **sobrevive** a `unreachable` (spec, sección "convive con el CTA").
  ⚠️ Acá se cablea `useLearnFocusDays` a `use-hub-data`/`LearnHubClient`: hoy el hook
  existe y **no lo llama nadie**.
- **S2.3** — i18n en `editorial.ts` + `messages/es.ts` (tabla del spec), cero
  em-dashes (AC23, `anti-ai-prose.test.ts`), `pnpm content:audit` (AC24).
- **S2.4** — cliente del POST al completar el Daily + reintento `daily_retry`.
- **S2.5** — borrar `challenge-day.ts`, su test, `dayOfChallenge` y sus referencias
  (AC1). **Último**, para que el camino viejo viva hasta que el nuevo esté cableado.
  📌 Medido: `dayOfChallenge` está en el **tipo** (`challenge-card.tsx:59`), se produce
  en `use-hub-data.ts:418`, y la tarjeta **nunca lo lee**. De sus 11 referencias, **9
  son fixtures de tests**.
- **S2.6** — AC20 (camino real `/status` → hub → `ChallengeCard`) y AC18 (los cuatro
  caminos de acreditación espiados y en cero).

Fuera de Stage 2, cuando el founder quiera:
- **`/dev/learn-hub` + `vr18-learn-hub-*`** — desbloqueado por el refactor. Conviene
  **después** de S2.2: fotografiar la tarjeta vieja no sirve.
- **`hub-clean` → `exercises-clean`** (~39 fotos revisadas una por una). No tiene
  relación con Stage 2; se sacó del camino crítico a propósito.

## Blockers

Ninguno.

## Notes

- **Higiene de branches**: siguen ~25 branches locales sin auditar. No se tocó.
- **Spec B (21-en-30) sigue sin escribir.** Sin él, "12 of 21" sigue siendo
  incompletable tras un salteo — pero **visible**, que era el punto de Spec A.
- **CI NO corre Playwright.** VR local necesita `BASE_URL=http://localhost:3002
  PORT=3002`.
- El ledger **sigue prendido en prod (LEARN)**. Mientras Stage 2 no mande el reporte,
  cada llamada cae en `report = null` → no siembra y no latchea. Es correcto y a
  propósito (AC13).
