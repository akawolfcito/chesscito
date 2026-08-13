# Spec — Duelo de ajedrez por enlace (p2p-chess-duel-by-link)

**Date**: 2026-08-13
**Status**: draft
**Modo**: **PLAY** (partida de ajedrez completa). La variante corta para LEARN es otro spec.

> **Relación con lo que ya existe.** `docs/specs/2026-07-13-async-link-duel-spec.md` (v3) está
> marcado como artefacto histórico: su **modelo de identidad** (wallet = asiento, sesión firmada
> obligatoria para jugar) quedó superseded. De ahí se **reusa** el árbitro seat-relative, la
> expiración computada al leer, la concurrencia por CAS sobre `version`, la persistencia
> idempotente y la matriz de estados de la Arena.
>
> ⚠️ **Y la directriz D1 también envejeció, en el otro sentido.**
> `docs/product/2026-07-13-direction-where-we-are.md` §10 exigía jugar **sin wallet** porque la
> wallet era una barrera. Hoy hay **wallet por defecto y social login** (founder, 2026-08-13), así
> que esa premisa cambió. **Lo que NO cambió es la regla técnica dura**, y este spec la mantiene
> intacta — ver §Contracts.

---

## Problem

PLAY sólo ofrece rivales de IA (Easy / Medium / Hard). No hay forma de jugarle a una persona. El
duelo se especificó dos veces y ninguna se construyó: la v2 murió porque hacía que un identificador
elegido por el cliente autorizara el asiento, y la v3 porque puso la wallet como barrera de entrada.

Ese primer defecto **sigue vivo en producción**: `apps/web/src/app/api/games/route.ts:21` toma
`walletAddress` del body y lo único que comprueba es `isAddress()` — **el formato, no la
propiedad**. Cualquiera puede escribir una partida a nombre de cualquier wallet.

## Goal

Un jugador en PLAY comparte un enlace; quien lo abre ocupa el otro asiento y juegan una **partida
de ajedrez completa**, arbitrada por el servidor, sin que ningún dato elegido por el cliente
conceda autoridad sobre un asiento.

## Non-goals

- **Espectadores, fans y regalos** (D3–D5). Son el techo, y la directriz avisa que diseñar para la
  tribuna acá es sobre-construir → `project_duel_spectator_economy`.
- **La variante corta de LEARN** (pocas piezas, objetivos tipo "quién tiene más piezas en X
  tiempo"). Founder, 2026-08-13: va después y es su propio spec.
- **Transporte en tiempo real** (WebSocket / SSE / Supabase realtime). El poll con backoff alcanza
  para dos jugadores por turnos.
- **Matchmaking, lobby o emparejamiento público.** El único canal es el enlace.
- **Ranking, Peones o insignias colgando del resultado.** Ver §Apuesta.
- **Reloj de ajedrez** (incrementos, banderas). La única presión temporal es la expiración.

---

## Apuesta: NADA en juego, y es una decisión, no un olvido

El resultado de un duelo **no toca Peones, ni ranking, ni insignias, ni Season Pass**.

⛔ **El día que un resultado de duelo decida algo con valor, este spec deja de ser válido y hay que
incluir server-verified progress.** No es un extra: hoy `/api/sign-badge` y `/api/sign-score` firman
sin verificar lo ganado, y ese riesgo está **aceptado por el founder (2026-08-12) precisamente
porque nada de valor cuelga de un score**. Un duelo con premio activa el disparador escrito en
`docs/backlog/2026-07-10-backlog-index.md` §4.

Como el árbitro de este spec es **server-side y autoritativo**, un duelo es de hecho la primera
superficie del producto donde el resultado **sí** está verificado por el servidor. Eso lo hace el
candidato natural para colgarle valor más adelante — pero recién cuando se decida, y con su spec.

---

## Quién puede entrar (resuelto — founder, 2026-08-13)

El invitado **sí pasa por el gate de acceso**. No hay `JOIN` anónimo: el gate ya decidió que el
acceso web es obligatorio y **no existe "Continue as Guest"**
(`components/web-access-gate.tsx:260`). Este spec se somete a esa decisión.

Tres piezas, y **las tres ya existen o son un cambio chico**:

| pieza | quién entra | estado |
| --- | --- | --- |
| **MiniPay** | entra **por defecto**, sin Privy y sin gastar MAU | ✅ ya es así — `WebAccessGate` **nunca se monta** en MiniPay; el resolver de rama lo deja en el árbol `injected` |
| **Waitlist** | quien no está en MiniPay se registra y espera | ✅ ya construida — `EarlyAccessRequest`, alcanzable desde `unauthenticated`, y **no toca ningún hook de Privy** |
| **Tope por código** | corta login/registro al llegar al umbral | ⬜ por construir — es el seguro |

### El tope: dónde va, y por qué ahí

⛔ **El tope tiene que evaluarse ANTES de llamar a `login()`**, en `startLogin()`
(`web-access-gate.tsx:116-121`, justo encima de la línea 120).

**Why:** Privy define MAU como *"a user who has had their session refreshed in the past thirty
days"*. **El login ya consume el recurso que el tope quiere proteger**, así que un tope que viva
después de `login()` **llega tarde por construcción** — ese error se cometió en la v1 del diseño de
acceso web y lo corrigió el founder. Un contador que se consulta después no protege nada: sólo
informa de lo que ya se gastó.

⚠️ **Y el tope NO es control de acceso: es un presupuesto.** Vive en nuestro cliente, así que es
evitable en principio. Quien **concede** el acceso sigue siendo el **allowlist nativo de Privy**,
que es server-side y sin bypass. Los dos juntos son cinturón y tirantes, que es exactamente lo que
el founder pidió: *"otra opción que es un seguro"*.

### La consecuencia, dicha de frente

Con el gate obligatorio, **un enlace de duelo enviado a un contacto frío que NO esté en MiniPay
aterriza en la waitlist, no en un tablero**. Durante esta fase el enlace funciona como **embudo de
waitlist**, no como canal de *jugá ahora*.

Es una decisión defendible antes del lanzamiento y no la discute este spec — pero hay que **medirla
como lo que es**: el gate del frente es "uso real del duelo", y si el invitado promedio no puede
jugar, esa métrica mide el gate, no el duelo. **El duelo entre dos personas que YA están dentro
(MiniPay ↔ MiniPay, o dos allowlisted) sí se juega entero, y es el que hay que medir.**

---

## Contracts (SDD)

### La regla dura, primero

> **Ningún `walletAddress`, `playerId`, `seatId` ni identificador enviado por el cliente concede
> autoridad sobre un asiento. La autoridad viene de una credencial NO ADIVINABLE emitida por el
> SERVIDOR.**

La wallet **se vincula** a un asiento; nunca lo **autoriza**. Esto se mantiene aunque hoy exista
wallet por defecto, porque una wallet que viaja en un body sigue siendo un dato que el cliente
elige.

```ts
/** Credencial de asiento. Opaca, generada por el servidor, nunca derivada de nada del cliente.
 *  128 bits de CSPRNG. Se guarda HASHEADA — una filtración de la tabla no debe entregar asientos. */
export type SeatToken = string & { readonly __brand: "SeatToken" };

export type DuelColor = "w" | "b";

export type DuelStatus =
  | "awaiting-opponent"  // creado, el segundo asiento está libre
  | "active"             // los dos asientos ocupados, partida en curso
  | "finished"           // terminó por jaque mate, tablas o abandono
  | "expired";           // venció la ventana sin terminar

export type DuelOutcome =
  | { kind: "checkmate"; winner: DuelColor }
  | { kind: "resign"; winner: DuelColor }
  | { kind: "timeout"; winner: DuelColor }   // el rival dejó vencer SU turno
  | { kind: "draw"; reason: DuelDrawReason };

export type DuelDrawReason =
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move"
  | "agreement";

export type DuelSeat = {
  color: DuelColor;
  /** SHA-256 del SeatToken. El token en claro sólo existe en la respuesta que lo emite. */
  tokenHash: string;
  /** Nombre para mostrar. Es cosmético y NO autoriza nada. */
  displayName: string | null;
  /** Wallet VINCULADA (D2), no autorizante. `null` mientras el asiento sea anónimo. */
  linkedWallet: string | null;
  claimedAt: string | null; // ISO; null = asiento libre
  lastSeenAt: string | null;
};

export type Duel = {
  /** No enumerable: 128 bits base64url. NO es un autoincremental ni un UUIDv1. */
  id: string;
  status: DuelStatus;
  seats: Record<DuelColor, DuelSeat>;
  /** La partida ENTERA, en SAN, arbitrada por el servidor. Fuente de verdad única. */
  moves: string[];
  outcome: DuelOutcome | null;
  /** CAS. Todo write manda el `version` que leyó; el servidor rechaza si no coincide. */
  version: number;
  createdAt: string;
  /** Vence si nadie mueve antes. Se recomputa en cada jugada. */
  expiresAt: string;
};

/** Lo que ve un cliente. ⛔ NUNCA incluye `tokenHash` de ningún asiento. */
export type DuelPublic = Omit<Duel, "seats"> & {
  seats: Record<DuelColor, Omit<DuelSeat, "tokenHash">>;
  /** Qué asiento es EL QUE PREGUNTA, resuelto server-side desde su credencial.
   *  `null` = mirón sin credencial (hoy sólo puede leer). */
  you: DuelColor | null;
  /** Derivado, no almacenado: `status === "active" && turnOf === you`. */
  yourTurn: boolean;
  turnOf: DuelColor | null;
  fen: string;
};

export type ApplyMoveResult =
  | { ok: true; duel: DuelPublic }
  | { ok: false; code: "not-your-seat" }      // credencial válida, asiento ajeno
  | { ok: false; code: "not-your-turn" }
  | { ok: false; code: "illegal-move" }
  | { ok: false; code: "duel-not-active" }
  | { ok: false; code: "version-conflict"; duel: DuelPublic }
  | { ok: false; code: "expired"; duel: DuelPublic };

/** El árbitro. Corre SÓLO en el servidor, sobre chess.js@1.4.0 (ya es dependencia).
 *  Recibe la lista completa de movidas y la reconstruye — nunca confía en un FEN del cliente. */
export function applyMove(
  moves: readonly string[],
  seat: DuelColor,
  san: string,
): ApplyMoveResult;
```

### Superficie HTTP

| Ruta | Verbo | Qué hace | Credencial |
| --- | --- | --- | --- |
| `/api/duel` | POST | Crea el duelo, ocupa un asiento, **emite el `SeatToken` del creador** | ninguna |
| `/api/duel/[id]` | GET | Estado (`DuelPublic`), con `you` resuelto | opcional |
| `/api/duel/[id]/join` | POST | Ocupa el asiento libre, **emite el `SeatToken` del invitado** | ninguna |
| `/api/duel/[id]/move` | POST | Aplica una jugada. Body: `{ san, version }` | **requerida** |
| `/api/duel/[id]/resign` | POST | Abandona | **requerida** |
| `/api/duel/[id]/link-wallet` | POST | Vincula una wallet al asiento (D2) | **requerida** |

**Cómo viaja la credencial:** cookie `httpOnly`, `SameSite=Lax`, `Secure`, con `Path` acotado a
`/api/duel/<id>`. Se emite en la respuesta de create/join. ⚠️ **También se devuelve una vez en el
body**, para que el cliente pueda guardarla y recuperar el asiento si la cookie se pierde
(navegador in-app de WhatsApp/Telegram → navegador del sistema es un salto de contexto real).

---

## Behavior

1. Dado un jugador en PLAY, cuando toca *"Jugar con un amigo"*, entonces el servidor crea un duelo
   en `awaiting-opponent`, le asigna un color, le emite su `SeatToken` y devuelve un enlace
   `/[locale]/arena?duel=<id>`.
2. Dado un duelo en `awaiting-opponent`, cuando alguien abre el enlace, entonces **pasa primero por
   el gate de acceso**: MiniPay entra directo; en web, una sesión existente entra directo y quien no
   la tenga ve el gate (con la waitlist un tap abajo). ⚠️ El enlace **se preserva a través del
   login**, o el invitado aterriza en el hub sin saber a qué lo invitaron.
3. Dado un visitante que **pasó el gate**, cuando toca `JOIN`, entonces el servidor ocupa el asiento
   libre, emite su `SeatToken`, y el duelo pasa a `active`.
3b. Dado un visitante que **no** pasa el gate, entonces ve de qué duelo se trata y quién lo invitó,
   y la waitlist. **Nunca ocupa un asiento.**
4. Dado un duelo `active`, cuando el asiento de turno manda una jugada legal con el `version`
   correcto, entonces el servidor la aplica, incrementa `version`, recomputa `expiresAt` y devuelve
   el `DuelPublic` nuevo.
5. Dado un duelo `active`, cuando el asiento que NO es de turno manda una jugada, entonces
   `not-your-turn` y **el estado no cambia**.
6. Dado un duelo `active`, cuando llega una jugada con una credencial que no corresponde a ningún
   asiento de ESE duelo, entonces `not-your-seat` — **y la respuesta no revela de quién es el turno
   ni el estado**.
7. Dado un duelo `active`, cuando la jugada es ilegal en la posición, entonces `illegal-move` y el
   estado no cambia. **La legalidad la decide el servidor**; el cliente puede filtrar por UX pero su
   opinión no cuenta.
8. Dado un duelo `active`, cuando una jugada produce jaque mate, entonces `status: "finished"` con
   `outcome.kind === "checkmate"` y `winner` = el asiento que movió.
9. Ídem para tablas: ahogado, material insuficiente, triple repetición y regla de 50 movidas — las
   cuatro las detecta chess.js y las escribe el servidor.
10. Dado un duelo `active`, cuando un asiento abandona, entonces `finished` con `outcome.kind ===
    "resign"` y `winner` = el otro asiento.
11. Dado un duelo cuyo `expiresAt` ya pasó, cuando **cualquiera lo lee**, entonces se materializa
    como `expired` en ese mismo read. ⚠️ **Sin cron y sin job**: la expiración es una consecuencia
    de leer, no una tarea programada.
12. Dado un duelo `awaiting-opponent` que expiró, entonces `expired` **sin ganador** — nadie perdió
    una partida que nunca empezó.
13. Dado un duelo `active` que expiró, entonces `outcome.kind === "timeout"` y gana **el asiento que
    NO tenía el turno**: dejar vencer tu propio turno es la única lectura defendible de abandono.
14. Dado dos jugadas concurrentes con el mismo `version`, entonces **una gana y la otra recibe
    `version-conflict` con el estado fresco**. Nunca se pierde una jugada en silencio.
15. Dado un duelo `finished` o `expired`, cuando llega cualquier jugada, entonces `duel-not-active`.
16. Dado un asiento con credencial, cuando el jugador vincula su wallet, entonces se guarda en
    `linkedWallet` — **y eso no cambia nada sobre quién puede mover**.

---

## Edge cases

- **La cookie se pierde entre navegadores.** Abrir el enlace en el navegador in-app de WhatsApp y
  después "abrir en Chrome" es un contexto distinto: no viaja la cookie. Por eso el token también
  vuelve en el body la primera vez, y el cliente lo guarda. Sin eso, el jugador queda mirando su
  propia partida sin poder mover.
- **El creador abre su propio enlace.** Trae credencial → `you` resuelve a su asiento, **no** ocupa
  el segundo. Un duelo contra uno mismo no debe ser posible por accidente.
- **Dos personas tocan `JOIN` a la vez.** El CAS decide: una entra, la otra recibe el duelo ya
  `active` y **no** un asiento. Debe leerse como *"alguien se te adelantó"*, no como un error.
- **El enlace se reenvía a un tercero después de empezado.** Sin credencial y con los dos asientos
  ocupados → lectura solamente. Ese es el germen de D3, no una fuga.
- **Promoción de peón.** El SAN la lleva (`e8=Q`); el árbitro la valida. La UI tiene que ofrecer la
  elección o el movimiento es irreproducible.
- **Jaque mate y expiración en la misma lectura.** Gana el **mate**: la partida ya había terminado
  cuando el reloj venció. El orden de evaluación importa y hay que fijarlo.
- **Reloj del cliente adelantado.** `expiresAt` se compara **siempre** contra el reloj del servidor.
- **Idempotencia del `JOIN`.** Un doble tap no debe consumir dos asientos ni emitir dos tokens.
- **Un asiento nunca reclamado.** El duelo vive en `awaiting-opponent` hasta expirar; el creador
  puede cancelarlo.

---

## Acceptance criteria

- [ ] Una jugada con credencial de otro duelo devuelve `not-your-seat` y **no filtra** el estado.
- [ ] Una jugada sin credencial nunca modifica un duelo, en ningún estado.
- [ ] `walletAddress` no aparece en **ninguna** ruta de autorización de este spec.
- [ ] `DuelPublic` no contiene `tokenHash` en ninguna forma (test sobre el serializado, no sobre el tipo).
- [ ] Los ids de duelo no son enumerables ni adivinables (128 bits CSPRNG).
- [ ] Los tokens se guardan hasheados: un dump de la tabla no permite ocupar un asiento.
- [ ] El árbitro rechaza toda jugada ilegal, incluidas las que dejan al rey en jaque.
- [ ] Las cuatro condiciones de tablas se detectan y se escriben con su razón.
- [ ] Dos jugadas concurrentes con el mismo `version`: una aplica, la otra recibe `version-conflict`
      con estado fresco. **Ninguna se pierde en silencio.**
- [ ] Un duelo vencido se materializa como `expired` al leerlo, sin cron.
- [ ] Un duelo `active` vencido da `timeout` a favor del asiento que NO tenía el turno.
- [ ] Un duelo `awaiting-opponent` vencido termina **sin** ganador.
- [ ] `JOIN` es idempotente: dos taps → un asiento, un token.
- [ ] El creador que abre su propio enlace no ocupa el segundo asiento.
- [ ] El enlace abre y **permite jugar** desde un navegador móvil común, sin login y sin wallet.
- [ ] Vincular una wallet no altera quién puede mover.

---

## Out of scope / future

- **D2 — Guardar partida**: reclamar el duelo con la wallet, historial, resultado persistido.
  ⚠️ Arreglar `api/games/route.ts:21` es prerrequisito de D2, no de esto.
- **D3–D5** — viewer, fans, economía social.
- **La variante de LEARN**: partida corta con pocas piezas y objetivos alternativos (más piezas en X
  tiempo, etc.). Founder, 2026-08-13.
- **Reloj de ajedrez** por jugada.
- **Revancha** desde el duelo terminado.

---

## Open questions

1. ✅ **RESUELTO** (founder, 2026-08-13): el invitado pasa por el gate. MiniPay entra por defecto,
   el resto por waitlist, y un tope por código corta el login al llegar al umbral. Ver
   §"Quién puede entrar".
2. **¿Cuál es el umbral del tope, y qué pasa al llegar?** Privy es gratis hasta **499 MAU**. Un tope
   en 499 no deja margen: hay que decidir el número **y** qué ve quien llega tarde — la waitlist
   otra vez, o una pantalla propia. Y si el contador es por MAU (ventana móvil de 30 días) o por
   cuentas totales, que **no son lo mismo**.
3. **¿Cuánto dura la ventana de expiración?** Propuesta: **48 h** por jugada. Sin medición detrás;
   es una perilla, no una verdad.
3. **¿Dónde se guarda el duelo?** Supabase encaja con el resto, pero un duelo no es contenido y no
   necesita RLS por usuario si toda la autorización pasa por el token. Decidir antes de la migración.
4. **¿El creador elige color o se sortea?** Sorteo por defecto es más simple y más justo.
5. **¿Qué ve un tercero sin credencial con la partida en curso?** Hoy: lectura. Confirmar que se
   quiere eso ya, o si el duelo debe ser opaco hasta D3.
