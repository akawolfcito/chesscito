# Red Team Review v3 — private-duel

> ## ⚠️ ARTEFACTO HISTÓRICO — NO es la próxima implementación
>
> Este red-team audita la variante **wallet-first** del duelo. **NO representa D1**, la próxima capa a
> construir, donde **se juega SIN wallet** y el enlace debe abrir en **cualquier navegador móvil o
> PWA**.
>
> **Directriz vigente:** `docs/product/2026-07-13-direction-where-we-are.md` (§10, Frente 5).
>
> **Los HALLAZGOS siguen siendo válidos y reutilizables** — árbitro, expiración, concurrencia,
> persistencia, seguridad y estados. Varios se aplican a D1 **tal cual**: la deuda de
> `api/games/route.ts:21` (una wallet declarada por el cliente **no es una credencial**), los ids no
> enumerables, el CAS contra las carreras, y la persistencia server-side.
>
> **Lo SUPERSEDED es el modelo de identidad y el orden de implementación.** En particular, el **P0 de
> plataforma** de este documento (*"el webview de WhatsApp no tiene wallet, B no puede aceptar
> nunca"*) **fue lo que forzó el rediseño**: D1 lo resuelve **eliminando la wallet del camino de
> entrada**, no buscándole un puente.
>
> **La trazabilidad v1→v2→v3 se conserva íntegra** — es el registro de por qué D1 se ve como se ve.

**Date**: 2026-07-13
**Reviewer mindset**: hostile QA + senior engineer
**Target**: `docs/specs/2026-07-13-async-link-duel-spec.md` (**v3** — sesión firmada)
**Supersedes**: red-team v1 y v2 (mismo archivo). Abajo, la trazabilidad completa.

---

## Resumen

**El P0 de auth de la v2 está cerrado, y bien cerrado.** La wallet ya no es un `string` que el
cliente declara: se prueba con firma, el nonce es de un solo uso, la sesión es server-side y los
endpoints **ignoran** el body. Los siete acceptance criteria que pediste están escritos y son
testeables.

Las tres verificaciones se **hicieron** y dos **encontraron problemas reales** (no se asumieron):

| Verificación | Resultado |
| --- | --- |
| **chess.js** | ✅ **1.4.0 tiene los cuatro predicados** (`isStalemate`, `isInsufficientMaterial`, `isThreefoldRepetition`, `isDrawByFiftyMoves`). `DuelDrawReason` es real. **Cerrado.** |
| **Coach** | ❌ **No puede analizar partidas humanas.** `prompt-template.ts:114,139` hardcodea `(${difficulty} difficulty AI opponent)`. Ensanchar `difficulty` habría producido *"(duel difficulty AI opponent)"* — incoherente **y mentira**. El spec ahora agrega `GameOpponent` como discriminante. **Cerrado por diseño; falta construirlo.** |
| **Matriz Arena** | ❌ Reveló una interacción que nadie había visto: **`ArenaSelectScaffold` recibe `playerColor` como una ELECCIÓN del jugador**, y en un duelo el color **lo fija el asiento**. El selector tiene que bloquearse. Está en la matriz (B15). **Cerrado.** |

**Queda 1 P0** — y no es de diseño, es de **plataforma**. Puede dejar la feature **sin ningún camino
de aceptación real**.

---

## Findings

### P0 — Must address before implementation

- **[Plataforma] El enlace viaja por WhatsApp, y el navegador in-app de WhatsApp NO TIENE WALLET.
  Tal como está, B no puede aceptar nunca.**

  El flujo canónico del producto es: A manda el link **por WhatsApp**. B lo toca. B aterriza en el
  **webview de WhatsApp**, donde **no existe MiniPay, no existe wallet, no hay nada que conectar**.
  El spec lo resuelve mostrando `connect-wallet-to-accept`… **y ahí se termina el flujo**: no hay
  wallet que conectar en ese contexto.

  Es la consecuencia directa (y no buscada) de la decisión de producto correcta: **wallet =
  identidad**. La v1 no tenía este problema porque B jugaba anónimo — pero la v1 se cayó por otras
  razones. Ahora el asiento es sólido y **el camino hasta el asiento no existe**.

  *Why blocking:* **la mitad del producto es el jugador B**, y B no tiene un camino comprobado para
  aceptar. Todos los acceptance criteria de aceptación son verdes en test y **muertos en device**.

  *Lo que hay que medir, en device, ANTES de escribir código:*
  1. ¿Existe un **deep link a MiniPay** que abra Chesscito en una ruta dada (`?challenge=<id>`)? Si
     existe, el link que comparte A **tiene que ser ese**, no una URL `https://` pelada.
  2. Si no existe: ¿qué ve realmente B al tocar un link `https://` de Chesscito desde WhatsApp?
     ¿Ofrece "abrir en…"? ¿Se puede instruir *"abrí esto desde MiniPay"* sin que el flujo muera?
  3. ¿MiniPay preserva el `?challenge=` al abrir la app desde un link externo?

  Es **una tarde de medición** y decide la forma del enlace, que es *la feature*. → aplica
  [[feedback_suspect_your_derivation_first]] y [[project_minipay_platform]].

### P1 — Should address

- **[Auth] "Una firma por sesión" es una promesa sobre una cookie, y la cookie vive en un webview.**
  La sesión es una cookie `httpOnly`. Si el webview de MiniPay la descarta entre navegaciones (**no
  está medido**), el jugador tendría que **volver a firmar**, y el acceptance criterion *"una partida
  de N movidas produce exactamente una llamada a `personal_sign`"* **falla en device y pasa en
  test**. La consecuencia es mucho más benigna que en la v1 (se re-firma y se sigue — **el asiento no
  se pierde**), pero el contrato de producto que aceptaste dice *"una vez por sesión"*, y hay que
  saber cuánto dura una sesión **de verdad**. Medir junto con el P0.

- **[Persistencia] "Dentro del mismo CAS" es una promesa que Redis no puede cumplir tal cual.** B25
  dice que el servidor escribe los dos `GameRecord` **dentro del CAS** que marca `archivedAt`. Pero
  esos records viven en **otras claves** (`coach:game:${wallet}:${gameId}`) y su lista
  (`coach:games:${wallet}`) se actualiza con `LPUSH` + cap. Un `SET` a una clave determinista **sí**
  es idempotente (misma clave, mismo contenido) — **pero el `LPUSH` a la lista NO**: dos
  materializaciones concurrentes pueden **duplicar el `gameId` en la lista**, y el historial muestra
  la partida dos veces. Hay que ordenarlo explícitamente: **primero** los `SET` idempotentes,
  **después** el `LPUSH` guardado por el CAS de `archivedAt`, y que el `LPUSH` sea condicional (o
  deduplicar al leer).

- **[Auth] `POST /api/auth/nonce` no tiene rate limit.** El spec limita **crear** (3 abiertos) y
  **aceptar** (10/h wallet, 30/h IP) — pero **no** la emisión de nonces, que es una **escritura a
  Redis sin autenticar** y para cualquier `wallet` arbitraria. Es un amplificador de escritura
  gratuito contra Upstash (que cobra por request). Necesita límite por IP.

- **[Seguridad] `/api/games` sigue aceptando la wallet del body, y eso ahora CORROE la garantía del
  duelo.** El spec lo registra como "deuda conocida" (Open question 3), pero subestima el efecto: el
  duelo escribe el `GameRecord` server-side en `coach:game:${wallet}:${duelId}` — y **`/api/games`
  deja que cualquiera escriba esa misma clave sin firma**. O sea: un atacante puede **sobrescribir el
  resultado de tu duelo en tu archivo** (tu derrota se vuelve victoria, o basura). No afecta la
  partida ni la economía, pero **vuelve falsificable justamente la persistencia que el duelo acaba de
  hacer confiable**. Mínimo: que `/api/games` **rechace escrituras sobre un `gameId` que ya existe
  con `opponent.kind === "human"`**.

- **[CSRF] Una lectura que muta + cookie de sesión.** El `GET` materializa el vencimiento
  (**escribe**), y `SameSite=Lax` **permite** GETs cross-site de navegación de primer nivel. Un tercero
  puede forzar la materialización de un abandono en tu duelo con sólo hacerte abrir un link. El daño
  es bajo (materializa algo que igual iba a ocurrir), pero **una lectura no debería mutar bajo cookie
  de sesión**: o el `POST` es el único que materializa, o la materialización no depende de la sesión.

- **[Nonce] El spec no dice que `verify` compare el nonce CONTRA la wallet que lo pidió.** El
  `AuthChallenge` lleva `wallet`, pero el paso 3 sólo dice "recupera la dirección y verifica que
  coincide con `wallet`" — **¿con la del body o con la que el nonce tenía guardada?** Si es la del
  body, un atacante toma un nonce ajeno y lo usa con **su propia** wallet y **su propia** firma
  (válida). No gana nada hoy (la sesión sería suya), pero el chequeo correcto es contra **la wallet
  guardada con el nonce**, y hay que escribirlo.

### P2 — Nice to clarify

- **[Feature flag]** Sigue sin definirse (Open question 2). Sin flag, "reversible" es una promesa
  vacía. Es la propiedad que hace barato a este cluster; no la regalen.
- **[VR / probe]** El slot de reto **recibe su verdad por props** — el spec lo dice y está bien. El
  probe `/dev` para `/arena?challenge=` tiene que existir **antes** de los baselines, o Playwright
  fotografía un `WagmiProviderNotFoundError` y **pasa en verde**. →
  [[feedback_vr_green_can_photograph_an_error]], [[feedback_dev_probe_mirrors_real_screen]].
- **[i18n]** El copy citado ("Tu rival no volvió", "Pipo challenged you", "Challenge them back")
  entra por `lib/content/editorial.ts`, **nunca hardcodeado**. La UI es inglés.
- **[Coach]** `elapsedMs` en un duelo significa **duración de la partida**, no tiempo del jugador. El
  spec lo documenta — asegurarse de que el visor no lo muestre como "tu tiempo".
- **[`gameId` compartido]** Dos wallets con el mismo `gameId` es nuevo. Las claves no colisionan, pero
  **verificar el visor y el share** (Open question 5). Es un `grep`, no una discusión.

---

## Trazabilidad — v1 → v2 → v3

| Hallazgo | Origen | Estado |
| --- | --- | --- |
| Expiración por TTL se contradecía | P0 v1 | **CERRADO** (computada al leer, con CAS). |
| Cookie de asiento en webview | P0 v1 | **ELIMINADO** (no hay asiento por cookie). |
| Nadie escribe el `GameRecord` con el cliente cerrado | P0 v1 | **CERRADO** (B25, server-side). |
| `id` enumerable | P0 v1 | **CERRADO** (128 bits). |
| Poll de 2 s = factura de Upstash | P1 v1 | **CERRADO** (backoff + `visibilitychange`). |
| `GameResult` no seat-relative | P1 v1 | **CERRADO** (el que se rinde ve `resigned`; el rival, `win`). |
| No había forma de abandonar | P1 v1 | **CERRADO** (B24 + `/resign`). |
| Modo espectador era superficie nueva | P1 v1 | **CERRADO** (`full` = pantalla de texto). |
| **Wallet no autenticada** | **P0 v2** | **CERRADO** (sesión firmada, nonce de un solo uso, body ignorado). |
| Abandono sólo se materializa si alguien lee | P1 v2 | **CERRADO** (aceptado y **escrito** en el spec; sin cron en el MVP). |
| `GET` que muta necesita CAS | P1 v2 | **CERRADO** en el CAS… **pero abre el P1 del `LPUSH`** (arriba). |
| El servidor inventa campos del `GameRecord` | P1 v2 | **CERRADO** (`GameOpponent`; `elapsedMs` y `gameId` documentados). |
| El Coach no sabe analizar humanos | P1 v2 | **MEDIDO Y CERRADO por diseño** (`resultSuffix` ramifica sobre `opponent`). |
| Matriz `viewerAction` × Arena sin enumerar | P1 v2 | **CERRADO** (tabla completa; reveló el bloqueo del selector de color). |
| chess.js sin verificar | P1 v1+v2 | **CERRADO** (1.4.0, verificado en el paquete). |
| **B no tiene wallet donde abre el link** | **P0 v3 (nuevo)** | **ABIERTO. Bloquea el envío.** |

---

## Categories audited

**Contract gaps** — `AuthSession` / `AuthChallenge` completos. `DuelPublic.viewerAction` sigue siendo
un acierto: la UI **recibe** las reglas de acceso, no las re-deriva. `GameOpponent` es opcional por
back-compat y con fallback explícito. Sin `any`. El hueco es el chequeo nonce↔wallet (P1).

**Behavioral ambiguity** — Los 29 behaviors tienen trigger. La ambigüedad que queda es **operativa**,
no lógica: qué pasa exactamente dentro del CAS de la persistencia (P1 del `LPUSH`).

**Hidden assumptions** — Ya no hay supuestos sobre la identidad (se prueba con firma). Quedan **dos
supuestos de plataforma, ambos sin medir**: que B puede llegar a una wallet desde el link (**P0**), y
que la cookie de sesión sobrevive en el webview de MiniPay (**P1**). Los dos se miden con el mismo
teléfono, en la misma tarde.

**Backward compatibility** — Namespace `duel:` y `auth:` separados de `coach:`. `validateGameRecord()`
intacta. `/arena` sin `?challenge=` idéntica y fijada por VR. `GameRecord.opponent` opcional con
fallback. **Muy limpio.**

**Security & data** — Firma + nonce de un solo uso + sesión server-side + body ignorado ✅. `id` no
enumerable ✅. Wallets truncadas ✅. Rate limits en crear y aceptar ✅, **falta en `nonce`** (P1).
**`/api/games` sigue abierto y ahora corroe la persistencia del duelo** (P1). GET que muta bajo cookie
(P2/CSRF).

**Test coverage gaps** — Los siete criterios de auth que pediste están y son ejecutables. Falta un
criterio para el **`LPUSH` duplicado** bajo materialización concurrente, y otro para el **rate limit
de `nonce`**.

**Operational readiness** — Sin logging especificado. **Sin feature flag** (P2) — y es la propiedad
que hace barato y reversible a todo el cluster.

---

## Verdict

**READY para `/tdd` — CON UNA CONDICIÓN BLOQUEANTE.**

El spec ya **no tiene un defecto de diseño**: el P0 de auth está cerrado, las tres verificaciones se
hicieron contra el código real (y dos encontraron problemas que se corrigieron), y los P1 que quedan
son **de escritura**, no de rediseño.

**Pero no empieces por el código.** El P0 de plataforma decide **la forma del enlace**, y el enlace
**es la feature**. Si B no puede llegar a una wallet desde donde abre el link, todos los tests de
aceptación pasan en verde y **nadie puede aceptar un duelo en el mundo real**. Es la misma trampa que
este repo ya pagó dos veces: **un VR verde puede ser la foto de un error**.

**Orden recomendado:**

1. **Medir en device** (una tarde, con el teléfono): ¿hay deep link a MiniPay con `?challenge=`? ¿Qué
   ve B al tocar el link desde WhatsApp? ¿Cuánto vive la cookie de sesión en el webview de MiniPay?
   → cierra el P0 y el P1 de la cookie.
2. Cerrar los P1 **de papel** en el spec (orden del `LPUSH`, rate limit del nonce, `/api/games`,
   chequeo nonce↔wallet, `GET` que muta, feature flag).
3. **Recién entonces** `/tdd`, empezando por **la sesión firmada** — es el cimiento de todo lo demás,
   y sin ella los otros doce criterios no se pueden ni escribir.
