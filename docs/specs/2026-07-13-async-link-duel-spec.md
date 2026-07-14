# Spec — Duelo privado por enlace (private-duel)

> ## ⚠️ ARTEFACTO HISTÓRICO — NO es la próxima implementación
>
> Este spec describe la variante **wallet-first** del duelo. **NO representa D1**, la próxima capa a
> construir, donde **se juega SIN wallet** y el enlace debe abrir en **cualquier navegador móvil o
> PWA**.
>
> **Directriz vigente:** `docs/product/2026-07-13-direction-where-we-are.md` (§10, Frente 5).
>
> **Qué de acá SIGUE SIENDO REUTILIZABLE** (son hallazgos, no decisiones de producto):
> el **árbitro** seat-relative, el modelo de **expiración** computada al leer, la **concurrencia**
> (CAS sobre `version`), la **persistencia** server-side e idempotente, los hallazgos de **seguridad**
> (ids no enumerables, la deuda de `api/games/route.ts:21`), y la **matriz de estados** de la Arena.
>
> **Qué está SUPERSEDED:** el **modelo de identidad** (wallet = asiento, sesión firmada obligatoria
> para jugar) y el **orden de implementación**. En D1 la autorización del asiento la da una
> **credencial no adivinable emitida por el servidor**, y **la wallet aparece recién en D2**, para
> reclamar o vincular la partida.

**Date**: 2026-07-13
**Status**: superseded como plan de implementación — se conserva como investigación (**v3** — agrega
sesión firmada; reemplaza la v2)
**Feasibility**: `docs/product/2026-07-13-async-link-duel-feasibility.md`
**Red-team**: `docs/specs/2026-07-13-async-link-duel-redteam.md`

**Historia**: v1 (asientos anónimos con cookie) → v2 (Arena única, wallet = asiento) → **v3 (la
wallet se AUTENTICA)**. La v2 apoyó la autorización en un `walletAddress` que el cliente declara —
verificado en `api/games/route.ts:21`, donde el único chequeo es `isAddress()`, que valida el
**formato, no la propiedad**. Esta versión lo cierra.

---

## Problem

`/victory/[id]` se comparte, renderiza una OG card, y ofrece **"Accept challenge"** que hace
`router.push("/arena?fresh=1")`: te manda a jugar **solo contra la IA**. El enlace promete un duelo
y entrega un solitario. La superficie del reto ya está en producción y **está hueca**.

No hay forma de jugar contra otra persona. El árbitro, el tablero, los rails, los end-states y el
store con TTL **ya existen y están testeados**.

## Goal

Un jugador crea un reto privado, manda el enlace, y su amigo — al abrirlo — aterriza en **la Arena
de siempre**, ve el reto como **un slot más** debajo de Easy/Medium/Hard, y lo acepta. Los dos
juegan la misma partida desde su dispositivo, **y el servidor puede probar quién es cada uno**.

## Non-goals

- **Lobby público / matchmaking.** Otro producto. `ArenaOpponentKind` deja lugar para `open-duel`,
  pero **este spec no lo cubre**.
- **Jugadores anónimos, seat tokens, cookies de asiento como identidad.** El asiento **es la wallet
  autenticada**.
- **Pantalla propia para `/duel/[id]`.** No existe: resuelve y redirige a la Arena.
- **Modo espectador.** Un tercero ve una pantalla de texto, no un tablero.
- **Push notifications.** MiniPay no las da. El enlace ES la notificación.
- **Progresión**: ni badges, ni estrellas, ni Peones, ni racha, ni leaderboard. **Reversible por
  flag.**
- **Reloj de ajedrez. Social login.**

---

## Decisiones de producto (CERRADAS — no re-litigar)

1. **Arena única.** El reto es **un slot contextual** debajo de Easy/Medium/Hard. Sin superficie
   nueva.
2. **La wallet autenticada es la identidad del asiento.** Permite retomar desde otro dispositivo —
   eso es lo que un seat token no daba.
3. **Firma una vez por sesión, NO por movimiento.** Crear, aceptar, mover y rendirse reusan la
   sesión mientras siga vigente.
4. **Contrato de producto, sin promesas no medidas:** *"crear o aceptar un duelo puede requerir una
   firma de autenticación, una vez por sesión."* **No prometemos que en MiniPay sea invisible hasta
   medirlo.**
5. **Privado, no público.** Sólo lo ven los participantes o quien tenga el enlace.
6. **La persistencia final es del servidor**, para **ambas wallets**, aunque un cliente esté cerrado.
7. **La expiración se computa al leer**, nunca por borrado de TTL.

---

## Contracts (SDD)

### 1. Sesión firmada (el P0 de la v2)

```ts
// lib/auth/types.ts

/** Emitido por POST /api/auth/nonce. Un solo uso, TTL corto. */
export type AuthChallenge = {
  wallet: string;      // lowercase, la que pidió el nonce
  nonce: string;       // 32 bytes hex, criptográficamente aleatorio
  issuedAt: string;    // ISO
  expiresAt: string;   // ISO — issuedAt + 5 min
  /** El texto EXACTO a firmar con personal_sign. El servidor lo reconstruye al
   *  verificar; el cliente NUNCA lo arma por su cuenta. */
  message: string;
};

/** Sesión server-side. La cookie sólo lleva un token opaco; esto vive en Redis. */
export type AuthSession = {
  wallet: string;      // lowercase. LA identidad. Única fuente de verdad.
  issuedAt: number;
  expiresAt: number;   // issuedAt + 24 h
};
```

**El mensaje firmado** (`personal_sign`) — plantilla fija, server-side:

```text
chesscito.xyz wants you to sign in with your wallet.

Wallet:     0x…
Nonce:      <32 bytes hex>
Issued At:  <ISO>
Expires At: <ISO>
Chain:      Celo (42220)

This signature authenticates you to Chesscito. It is NOT a transaction:
it cannot move funds, and it costs no gas.
```

**Flujo**:

1. `POST /api/auth/nonce { wallet }` → el servidor genera el nonce, lo guarda
   (`SETNX`, TTL 5 min), devuelve el `AuthChallenge` con el `message` ya armado.
2. El cliente firma `message` con **`personal_sign`** (MiniPay lo soporta — medido, ver
   `project_minipay_supports_personal_sign`).
3. `POST /api/auth/verify { wallet, signature }` → el servidor:
   - **recupera la dirección desde la firma** (`recoverMessageAddress` de viem) y verifica que
     **coincide con `wallet`**;
   - **consume el nonce atómicamente** (`GETDEL` / Lua) — un nonce usado **no se puede reusar**;
   - rechaza si el nonce venció;
   - emite la sesión (token opaco en cookie `httpOnly`, `Secure`, `SameSite=Lax`) y guarda
     `AuthSession` en Redis.
4. `GET /api/auth/me` → `{ wallet } | null`.

**Reglas duras**:

- **Los endpoints de duelo obtienen la wallet EXCLUSIVAMENTE de la sesión.** `accept`, `move` y
  `resign` **ignoran cualquier `walletAddress` del body**. Si viene, se descarta — no se compara,
  no se valida, **se ignora**.
- **Si cambia la wallet conectada, la sesión anterior no se reusa.** El cliente detecta el mismatch
  (`GET /api/auth/me` ≠ wallet conectada) y **vuelve a autenticar**. El servidor nunca sirve una
  sesión para una wallet distinta de la que firmó.
- **La cookie de sesión NO es el asiento.** Si se pierde (webview efímero, otro dispositivo, borrar
  datos), **no se pierde el asiento**: se vuelve a firmar con la misma wallet y se retoma la
  partida. *Esta es exactamente la propiedad que el seat token de la v1 no tenía.*

```ts
// se agrega a REDIS_KEYS
authNonce:   (nonce: string) => `auth:nonce:${nonce}`,
authSession: (tokenHash: string) => `auth:session:${tokenHash}`,
```

### 2. Modo de oponente

```ts
// lib/arena/opponent.ts

/** `open-duel` está RESERVADO y no se implementa acá. */
export type ArenaOpponentKind = "ai" | "private-duel";

export type ArenaOpponent =
  | { kind: "ai"; difficulty: "easy" | "medium" | "hard" }
  | { kind: "private-duel"; duelId: string };
```

### 3. Duelo

```ts
// lib/duel/types.ts

export type DuelColor = "w" | "b";

export type DuelStatus = "awaiting-opponent" | "active" | "finished" | "expired";

export type DuelOutcome =
  | { kind: "checkmate"; winner: DuelColor }
  | { kind: "draw"; reason: DuelDrawReason }
  | { kind: "resigned"; winner: DuelColor }
  | { kind: "abandoned"; winner: DuelColor };

/** ✅ VERIFICADO contra chess.js 1.4.0 (el instalado): `isStalemate()`,
 *  `isInsufficientMaterial()`, `isThreefoldRepetition()` e `isDrawByFiftyMoves()`
 *  existen por separado. La unión es real, no inventada. */
export type DuelDrawReason =
  | "stalemate" | "insufficient-material" | "threefold" | "fifty-move";

/** El asiento ES la wallet AUTENTICADA. Sin token, sin cookie, sin anónimos. */
export type DuelSeat = {
  wallet: string;      // lowercase, probada por firma
  name: string | null; // nickname (Identity Lite). Cosmético.
  joinedAt: number;
};

export type Duel = {
  /** 128 bits de aleatoriedad criptográfica, base62 (22 chars). NO enumerable,
   *  NO secuencial. Es la única barrera de acceso. */
  id: string;
  kind: "private-duel";
  moves: string[];          // SAN. Única fuente de verdad.
  white: DuelSeat;          // el creador. SIEMPRE existe.
  black: DuelSeat | null;   // null hasta que alguien acepte.
  status: DuelStatus;
  outcome: DuelOutcome | null;
  createdAt: number;
  lastMoveAt: number;
  /** Monótono. CAS: toda escritura (incluida la del abandono perezoso) va con
   *  el `version` esperado. Rechaza carreras y escrituras rancias. */
  version: number;
  /** Idempotencia de la persistencia al archivo (behavior B18/B20). Se marca
   *  DENTRO del mismo CAS que escribe el `outcome`. */
  archivedAt: number | null;
};

/** Lo que devuelve el GET. Wallets TRUNCADAS: el link se reenvía. */
export type DuelPublic = {
  id: string;
  status: DuelStatus;
  moves: string[];
  white: { walletShort: string; name: string | null };
  black: { walletShort: string; name: string | null } | null;
  outcome: DuelOutcome | null;
  version: number;
  /** Derivados de la SESIÓN del request, no del body. */
  yourSeat: DuelColor | null;
  yourTurn: boolean;
  /** Qué puede hacer ESTE visitante. La UI no re-deriva reglas de acceso. */
  viewerAction:
    | { kind: "accept" }                   // asiento libre + sesión válida
    | { kind: "connect-wallet-to-accept" } // asiento libre, sin sesión/wallet
    | { kind: "resume" }                   // ya sos jugador
    | { kind: "full" }                     // dos jugadores, no sos ninguno
    | { kind: "over" };                    // finished | expired
};
```

### 4. Árbitro (seat-relative)

`validateGameRecord()` **queda intacta** (la usa `/api/sign-victory`, tiene tests). Hermano nuevo:

```ts
// lib/duel/arbiter.ts  (server-only)
export type ApplyMoveResult =
  | { ok: true; moves: string[]; outcome: DuelOutcome | null }
  | { ok: false; error: "illegal-move" | "not-your-turn" | "game-over" };

/** Replica `moves` desde cero, verifica el turno, aplica `san`, detecta el final. */
export function applyMove(moves: string[], seat: DuelColor, san: string): ApplyMoveResult;

/** Outcome absoluto → `GameResult` desde la perspectiva de un asiento.
 *  Regla FIJADA: **el que se rinde ve `"resigned"`; su rival ve `"win"`.** */
export function resultForSeat(outcome: DuelOutcome, seat: DuelColor): GameResult;
```

### 5. El archivo del Coach — ⚠️ medido, y no alcanza con ensanchar `difficulty`

**Verificado**: `prompt-template.ts:114,139` hace
`resultSuffix: (difficulty) => \`(${difficulty} difficulty AI opponent)\`` (y su gemelo en
español). **Una partida humana en el archivo se analizaría como si fuera contra la IA.** Ensanchar
`GameRecord.difficulty` a `"duel"` produciría *"(duel difficulty AI opponent)"* — una frase
incoherente **y una mentira**.

Por lo tanto `GameRecord` necesita un **discriminante de oponente**, no un valor de relleno:

```ts
// lib/coach/types.ts — ampliación
export type GameOpponent =
  | { kind: "ai"; difficulty: "easy" | "medium" | "hard" }
  | { kind: "human"; name: string | null };

export type GameRecord = {
  // … campos existentes …
  /** Optional por back-compat: los registros previos al duelo no lo tienen y se
   *  leen como `{ kind: "ai", difficulty }`. `difficulty` SIGUE siendo requerido
   *  para no romper a los consumidores actuales; en un duelo se escribe "medium"
   *  y NADIE lo lee, porque `opponent.kind === "human"` gana. */
  opponent?: GameOpponent;
};
```

Y `resultSuffix` pasa a ramificar sobre `opponent`, no sobre `difficulty`:
`{ kind: "human" }` → *"(vs. Pipo)"* / *"(contra Pipo)"*.

**`elapsedMs`**: el servidor sólo conoce `createdAt` y `lastMoveAt` — es la duración de **la
partida**, no el tiempo de **ese jugador**. Se escribe `lastMoveAt - createdAt` para ambos, y **se
documenta que en un duelo significa duración de partida**.

**`gameId`**: es el `duelId`. Las **dos** wallets tienen un `GameRecord` con el **mismo `gameId`** —
cosa que hoy nunca pasa. Las claves son `coach:game:${wallet}:${gameId}`, así que **no colisionan**,
pero hay que verificar que el visor y el share no asuman unicidad global de `gameId`.

### 6. Expiración — computada al leer, con CAS

**El TTL de Redis NO expira duelos.** Un TTL borra la llave, y una llave borrada es indistinguible
de un `id` inexistente (sólo se puede devolver 404) — sería imposible mostrar *"Tu rival no volvió"*
y el `outcome` de abandono **nunca se escribiría**, porque **un TTL no ejecuta código**.

| Concepto | Valor | Rol |
| --- | --- | --- |
| TTL sobre `duel:${id}` | **90 días**, todos los estados | **Sólo recolección de basura.** |
| Ventana de aceptación | **2 h** desde `createdAt` | Se evalúa **al leer**. |
| Ventana de inactividad | **2 h** desde `lastMoveAt` | Se evalúa **al leer**. La renueva cada movida. |

En **cada** lectura (`GET`) y antes de cada escritura, el servidor materializa el vencimiento
**dentro de un CAS sobre `version`**:

- `awaiting-opponent` + `now - createdAt > 2 h` → `status: "expired"`. Visitante ve *"Tu rival no
  volvió"*.
- `active` + `now - lastMoveAt > 2 h` → `status: "finished"`,
  `outcome: { kind: "abandoned", winner: <el que NO tenía el turno> }`, **y dispara la persistencia
  al archivo** igual que un mate.
- **Dos lecturas concurrentes** (los dos jugadores abriendo a la vez — que es *exactamente* lo que
  pasa) **no pueden escribir dos veces**: el CAS deja pasar una, la otra reintenta y ve el estado ya
  materializado. La persistencia se marca con `archivedAt` **en el mismo CAS**, así que **no hay dos
  `GameRecord`**.
- **Consecuencia aceptada y explícita:** si **nadie** vuelve a abrir el duelo, el abandono **no se
  materializa** y el `GameRecord` no se escribe. En la práctica el ganador vuelve (quiere su
  victoria). **No se agrega un cron en el MVP.**

---

## Behavior

### Autenticación

- **B1** — Dado un jugador con wallet conectada y **sin sesión válida**, cuando intenta **crear** o
  **aceptar** un duelo, entonces se le pide **una firma** (`personal_sign`) del `message` del
  servidor. Una vez. La sesión dura **24 h**.
- **B2** — Dado un jugador **con sesión válida**, entonces **crear, aceptar, mover y rendirse NO
  piden firma.**
- **B3** — Dado un request a cualquier endpoint de duelo **sin sesión válida**, entonces se rechaza
  con `401`, **aunque el body traiga un `walletAddress` perfectamente formado**.
- **B4** — Dado un `POST /api/auth/verify` cuya firma recupera **otra** dirección, entonces se
  rechaza (`401`) y **el nonce igual se consume**.
- **B5** — Dado un nonce **ya usado** o **vencido** (>5 min), entonces `verify` lo rechaza.
- **B6** — Dado que el jugador **cambia de wallet** en su billetera, entonces el cliente detecta el
  mismatch contra `GET /api/auth/me` y **vuelve a autenticar**. La sesión anterior **no se reusa**
  para la wallet nueva.
- **B7** — Dado un jugador que **pierde la cookie** de sesión (otro dispositivo, webview efímero,
  borró datos), entonces **no pierde el asiento**: vuelve a firmar con **la misma wallet** y
  **retoma el duelo donde estaba**.

### Crear y compartir

- **B8** — Con sesión válida, **"Challenge a friend"** crea un `Duel` (`awaiting-opponent`,
  `kind: "private-duel"`), sienta al creador de **blancas** y devuelve el link `/duel/[id]`. **La
  wallet sale de la sesión.**
- **B9** — Se abre el **share sheet nativo**. El link se manda **una vez**.
- **B10** — Con **3 duelos** ya en `awaiting-opponent`, un cuarto devuelve `429`.
- **B11** — Al crear, la pantalla **dice la verdad**: *"Anyone with this link can accept."*

### El enlace resuelve a la Arena

- **B12** — `/duel/[id]` **no tiene UI**: resuelve y **redirige** a `/arena?challenge=<id>`.
- **B13** — `/arena?challenge=<id>` muestra, **debajo** de Easy/Medium/Hard, un **slot contextual**
  con: quién retó (*"Pipo challenged you"*), **de qué color jugás** (*"You will play as Black"*), y
  la acción que dicta `viewerAction` (los cinco casos, ver Matriz).
- **B14** — `/arena` **sin** `?challenge=` es **exactamente la de hoy**. Cero regresión. VR lo fija.
- **B15** — Con un reto cargado, **el selector de color se bloquea**: en un duelo el color lo fija el
  asiento, no lo elige el jugador. (`ArenaSelectScaffold` hoy recibe `playerColor` +
  `onSelectColor` como *elección* — ver Matriz.)

### Aceptar

- **B16** — Con sesión válida y `viewerAction: "accept"`, **Accept challenge** reclama el asiento
  **negro** de forma **atómica** (CAS de Lua sobre `version`) usando **la wallet de la sesión**. El
  duelo pasa a `active`.
- **B17** — **Dos aceptaciones concurrentes** → **exactamente una** gana. La que pierde ve `full`,
  **no un error**.
- **B18** — El **creador** que abre su propio link ve `resume`. **Nunca puede aceptar su propio
  duelo** (misma wallet en los dos asientos = imposible).
- **B19** — La aceptación se rate-limitea: **10/h por wallet y 30/h por IP**.

### Jugar

- **B20** — Un duelo `active` reusa **todo**: `ArenaBoard` (que ya voltea el tablero con
  `playerColor`), los rails, la navegación, **resign** y los end-states.
- **B21** — Cuando es tu turno el tablero es interactivo; cuando no, es de sólo lectura y la pantalla
  dice de quién es el turno.
- **B22** — La pantalla **consulta** (`GET /api/duels/[id]`, mandando su `version`) con **backoff**:
  2 s los primeros 30 s, luego 5 s, luego 15 s. **Se corta** con `visibilitychange` y se reanuda al
  volver. Si el `version` no cambió, no re-renderiza. **El link no se reenvía nunca.**
- **B23** — `POST /api/duels/[id]/move` toma la wallet **de la sesión**, **replica las movidas desde
  cero**, verifica que esa wallet es la del asiento con el turno, valida la legalidad, appendea y
  detecta la terminación. **El cliente no es autoridad de nada** — ni de la posición, ni de su
  identidad.
- **B24** — `POST /api/duels/[id]/resign` (wallet de la sesión) → `outcome: { kind: "resigned",
  winner: <el otro> }`.

### Terminar y persistir (server-side)

- **B25** — Cuando una movida, una rendición **o el vencimiento materializado al leer** terminan la
  partida, **el servidor**, en ese mismo request y **dentro del CAS**, escribe el `GameRecord` en el
  archivo de **ambas wallets**, cada uno con su `playerColor`, su `result` **relativo a su asiento**
  y `opponent: { kind: "human", name }`. **No lo hace el cliente.** Un jugador con la app cerrada
  igual recibe su partida.
- **B26** — La escritura es **idempotente**: `archivedAt` se marca en el mismo CAS. Re-entrar al
  duelo terminado **no duplica** el `GameRecord`.
- **B27** — Cada jugador ve el end-state existente con **su** resultado (uno ve win, el otro lose).

### Reparar `/victory/[id]`

- **B28** — El botón **"Accept challenge"** — que hoy hace `router.push("/arena?fresh=1")` y manda a
  jugar contra la IA — **deja de mentir**: pasa a **crear un duelo privado real** (el visitante de
  blancas) y abrir el share sheet, con copy que promete lo que entrega (**"Challenge them back"**).
- **B29** — Sin sesión, el CTA **pide la firma** antes de crear.

---

## Matriz `viewerAction` × estados de Arena

Regla de `CLAUDE.md`: *"el spec DEBE enumerar todos los estados de UI y sus transiciones"*.
El slot de reto **sólo existe en la fase de selección**. `ArenaSelectScaffold` es **presentacional**
(verificado): recibe `difficulty`, `playerColor`, `onSelectDifficulty`, `onSelectColor`, `onStart`.
El slot es **una prop más**, y **recibe su verdad por props** — nunca lee un hook de wallet por
dentro (si lo hiciera, un probe `/dev` fotografiaría un `WagmiProviderNotFoundError` y **pasaría en
verde**).

| Estado de Arena | Sin `?challenge=` | `accept` | `connect-wallet` | `resume` | `full` | `over` |
| --- | --- | --- | --- | --- | --- | --- |
| **Selección** | Hoy. Sin slot. | Slot + **Accept** | Slot + **Connect wallet** (deshabilitado el accept) | Slot + **Resume duel** | Slot de texto: *"This duel already has two players"* | Slot de texto: resultado o *"Tu rival no volvió"* |
| **Selector de dificultad** | Activo | Activo (podés ignorar el reto y jugar contra la IA) | Activo | Activo | Activo | Activo |
| **Selector de color** | Activo | **Bloqueado** (lo fija el asiento) | **Bloqueado** | **Bloqueado** | Activo | Activo |
| **Transición (matchup)** | *"Preparing AI…"* | **NO dice "AI"** — muestra al rival humano | n/a | idem | n/a | n/a |
| **Jugando** | vs IA | duelo | n/a | duelo | n/a | n/a |
| **End-state** | vs IA | duelo (seat-relative) | n/a | idem | n/a | n/a |
| **`?challenge=` inválido / inexistente** | — | Slot de texto: *"This challenge doesn't exist"*. **La Arena sigue usable contra la IA.** | | | | |

**Notas de la matriz** (cada una es un test):

- El reto **nunca secuestra la Arena**: en los seis estados, el jugador **puede seguir eligiendo
  jugar contra la IA**. El slot es una alternativa, no un modal.
- **`softGate` no se dispara** al iniciar un duelo (el duelo no toca la economía).
- ⚠️ **El timer de la transición NO se saca de su `useEffect`** — en Strict Mode queda colgado en
  *"Preparing AI…"* para siempre. Es una trampa ya pagada (arrastrada en `SESSION.md`).

---

## Edge cases

- **Request con `walletAddress` en el body y sin sesión** → `401`. El body **se ignora**, no se
  compara.
- **Firma de otra wallet** → `401`, y el nonce **se consume igual** (no se puede reintentar).
- **Nonce reusado / vencido** → rechazo.
- **Cambio de wallet a mitad de partida** → el cliente re-autentica. Si la wallet nueva **no tiene
  asiento** en ese duelo, ve `full` (es un espectador).
- **Cookie de sesión perdida** → se re-firma con la misma wallet y **se retoma el asiento**. El
  asiento **no depende del navegador**.
- **Dos aceptaciones simultáneas** → CAS; una gana, la otra ve `full`.
- **Doble tap / doble movida** → aplicada tu movida, el turno ya no es tuyo. Idempotente.
- **Escritura rancia** → el `version` no coincide → rechazo → el cliente re-sincroniza con el poll.
- **Dos lecturas concurrentes materializando un abandono** → CAS + `archivedAt` → **un solo**
  `GameRecord` por wallet.
- **El link se filtra / se reenvía** → cualquiera **con wallet y firma** puede aceptar. **Dicho en
  pantalla** (B11). El `id` de 128 bits hace que **no se pueda adivinar**: el único vector es el
  reenvío, no la enumeración.
- **B abre el link donde no hay wallet** (p.ej. el navegador in-app de WhatsApp) → ve el reto y
  `connect-wallet-to-accept`. **Ver Open questions #1 — este es el riesgo abierto más grande.**
- **Redis caído** → fail-closed. **Nunca** se juega un duelo con estado sólo en el cliente.

---

## Acceptance criteria

### Autenticación (el P0 de la v2)

- [ ] Un request a `accept` / `move` / `resign` **con `walletAddress` en el body pero sin sesión
      válida** → **`401`**. Test por endpoint.
- [ ] `accept`, `move` y `resign` **ignoran** cualquier wallet del body: un body con la wallet **del
      rival** y una sesión propia **actúa como la sesión**, nunca como el body.
- [ ] Una firma producida por **otra wallet** es rechazada.
- [ ] Un **nonce reutilizado** es rechazado.
- [ ] Un **nonce vencido** (>5 min) es rechazado.
- [ ] **Cambiar de wallet** invalida el uso de la sesión anterior: una sesión de la wallet A **nunca**
      autoriza como la wallet B.
- [ ] Una sesión válida **permite retomar el duelo desde otro dispositivo** tras volver a autenticar
      **con la misma wallet**.
- [ ] La firma se pide **una vez por sesión**, **no por movimiento**: una partida de N movidas
      produce **exactamente una** llamada a `personal_sign`.
- [ ] El `message` firmado contiene: dominio, wallet, nonce, issued-at, expiration, chain, y la frase
      de que **no es una transacción**.

### Duelo

- [ ] El `id` es **criptográficamente aleatorio, ≥128 bits, no secuencial**.
- [ ] Un cuarto duelo abierto de la misma wallet → `429`. La aceptación se rate-limitea por wallet e
      IP.
- [ ] `/duel/[id]` **no renderiza UI**: redirige a `/arena?challenge=<id>`.
- [ ] `/arena` **sin** `?challenge=` es idéntica a hoy (**VR**).
- [ ] Los **cinco** `viewerAction` renderizan su slot correcto, y en los cinco **la Arena sigue
      jugable contra la IA**.
- [ ] Con un reto cargado, **el selector de color está bloqueado**.
- [ ] Un `?challenge=` inexistente **no rompe la Arena**.
- [ ] `accept` es atómico: **dos concurrentes → exactamente un dueño**; la otra recibe `full`.
- [ ] El creador **nunca** puede aceptar su propio duelo.
- [ ] `move` rechaza: ilegal, fuera de turno, de una wallet sin asiento, y sobre `finished`/`expired`.
- [ ] El servidor **replica las movidas desde cero**: un cliente que mienta sobre la posición no
      escribe.
- [ ] `GET /api/duels/[id]` **nunca** devuelve la wallet completa.
- [ ] El poll **se detiene** con la pestaña oculta.
- [ ] Un mate da el resultado correcto **para cada asiento**. El que **se rinde** ve `"resigned"`; su
      rival ve `"win"`.

### Persistencia y expiración

- [ ] Al terminar, **el servidor** escribe el `GameRecord` de **las dos wallets** — **con el cliente
      del perdedor cerrado**. Test explícito.
- [ ] El `GameRecord` de un duelo lleva `opponent: { kind: "human" }`, y el prompt del Coach **no
      dice "AI opponent"**. Test sobre el texto del prompt.
- [ ] **Dos lecturas concurrentes** que materializan el mismo abandono producen **un solo**
      `GameRecord` por wallet (CAS + `archivedAt`).
- [ ] Un duelo `awaiting-opponent` de más de 2 h se lee como `expired` → *"Tu rival no volvió"*.
      **No 404, no error.**
- [ ] Un duelo `active` con 2 h de inactividad se resuelve por **abandono contra quien tenía el
      turno**, y **eso persiste**.
- [ ] Un duelo terminado sigue accesible a los 90 días.
- [ ] El CTA de `/victory/[id]` crea un **duelo real**, no `?fresh=1`.
- [ ] El duelo **no escribe** badges, estrellas, Peones, racha ni leaderboard. **Test negativo.**

---

## Out of scope / future

- **`open-duel`** (lobby público / matchmaking). `ArenaOpponentKind` ya deja el lugar.
- **Reto dirigido** (`reservedFor: wallet`): sólo la wallet retada puede aceptar. Cierra el hijacking
  por reenvío, pero exige que el retado vuelva. Natural para `/victory/[id]`.
- **Rematch**, **reloj de ajedrez**, **modo espectador real**, **color al azar**.
- **Migrar `/api/games` y el resto de las rutas a la sesión firmada.** Este spec la introduce **sólo
  para el duelo**. Ver Open questions #3.

---

## Open questions

1. **⚠️ ¿Dónde abre B el enlace?** Es el riesgo abierto más grande y **no es técnico**. El flujo
   canónico manda el link **por WhatsApp**, y el navegador in-app de WhatsApp **no tiene wallet**:
   B vería `connect-wallet-to-accept` y **no tendría nada que conectar**. Para aceptar, B tiene que
   abrir el link **dentro de MiniPay**. **¿Existe un deep link a MiniPay que abra Chesscito en un
   `?challenge=` dado?** Hasta que esto se mida en device, **el duelo no tiene un camino de
   aceptación comprobado**. *(Medición, no diseño — pero bloquea el envío.)*
2. **Feature flag**: ¿`NEXT_PUBLIC_CHESSCITO_DUELS`? Sin flag, "reversible" es una promesa vacía.
3. **`/api/games` sigue aceptando la wallet del body.** Este spec **no lo arregla** — sólo el duelo
   usa sesión. Queda un endpoint donde cualquiera puede escribir en el archivo de otro. **No bloquea
   el duelo, pero hay que registrarlo como deuda de seguridad conocida.**
4. **El nickname del creador** sale de Identity Lite. ¿Qué dice el slot si A **no** tiene nickname?
   (*"Someone challenged you"*?)
5. **`gameId` compartido por dos wallets** — verificar que el visor y el share no asuman unicidad
   global de `gameId`.
