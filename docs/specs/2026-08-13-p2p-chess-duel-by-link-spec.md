# Spec — Duelo de ajedrez por enlace (p2p-chess-duel-by-link)

**Date**: 2026-08-13
**Status**: draft — **versión mínima**
**Modo**: **PLAY** (partida de ajedrez completa). La variante corta de LEARN es otro spec.

> ## El alcance, en una frase
>
> **Dos personas que YA están dentro se pasan un enlace y juegan una partida entera.**
>
> Sin waitlist, sin tope, sin embudo, sin espectadores, sin apuesta. Todo lo demás está listado
> como fuera de alcance con su razón.
>
> ⚠️ **Por qué tan chico:** este es el **tercer spec** del mismo feature. La v2 y la v3 eran
> técnicamente correctas y **ninguna se construyó** — eran demasiado grandes para caber en una
> sesión y demasiado ambiciosas para probarse contra un jugador. La pregunta que ninguna contestó
> es *"¿cuál es la versión más chica que puedo poner frente a dos personas esta semana?"*. Esta lo es.

> **Qué se reusa del v3** (`2026-07-13-async-link-duel-spec.md`, artefacto histórico): el árbitro
> seat-relative, la expiración computada al leer, la concurrencia por CAS sobre `version`, la
> persistencia idempotente y la matriz de estados de la Arena.
> **Qué se reemplaza:** el modelo de identidad. La wallet **se vincula**, nunca autoriza.

---

## Problem

PLAY sólo ofrece rivales de IA (Easy / Medium / Hard). No hay forma de jugarle a una persona.

El defecto que mató a la v2 **sigue vivo en producción**:
`apps/web/src/app/api/games/route.ts:21` toma `walletAddress` del body y lo único que comprueba es
`isAddress()` — **el formato, no la propiedad**. Cualquiera puede escribir una partida a nombre de
cualquier wallet. Este spec no lo arregla (es prerrequisito de D2), pero **no lo hereda**.

## Goal

Un jugador de PLAY comparte un enlace; otro jugador **que ya tiene acceso** lo abre, ocupa el
asiento libre, y juegan una partida de ajedrez completa arbitrada por el servidor.

## Non-goals

- **Contactos fríos.** Quien no tenga acceso ve de qué duelo se trata y quién lo invitó, y nada más.
  El embudo de waitlist, el tope de logins y la apertura al público **no son parte de esto** →
  `2026-08-13-login-capacity-cap-spec.md`.
- **Espectadores, fans y regalos** (D3–D5) → `project_duel_spectator_economy`.
- **La variante corta de LEARN** (pocas piezas, objetivos alternativos). Founder, 2026-08-13.
- **Tiempo real** (WebSocket / SSE). El poll con backoff alcanza para dos jugadores por turnos.
- **Matchmaking, lobby, revancha, reloj de ajedrez.**
- **Guardar la partida / historial** (D2). Al terminar, el duelo se muestra y se deja ir.
- **Ranking, Peones o insignias** colgando del resultado. Ver §Apuesta.

---

## Apuesta: NADA en juego, y es una decisión

El resultado **no toca Peones, ni ranking, ni insignias, ni Season Pass**.

⛔ **El día que un resultado de duelo decida algo con valor, este spec deja de valer y hay que
incluir server-verified progress.** `/api/sign-badge` y `/api/sign-score` firman sin verificar lo
ganado, y ese riesgo está aceptado por el founder (2026-08-12) **precisamente porque nada de valor
cuelga de un score**. Un duelo con premio activa el disparador del backlog §4.

Nota: como el árbitro de acá es **server-side y autoritativo**, el duelo es la primera superficie
donde el resultado sí está verificado por el servidor. Es el candidato natural para colgarle valor
después — con su propio spec.

---

## Quién puede jugar

| | |
| --- | --- |
| **MiniPay** | entra por defecto. `WebAccessGate` **nunca se monta** ahí (el resolver deja MiniPay en el árbol `injected`) y no gasta MAU. |
| **Web con sesión** | entra. |
| **Web sin sesión** | ve el gate que ya existe. **No** ocupa asiento. |

Este spec **no cambia el gate**. Se somete a la decisión vigente: acceso web obligatorio, sin
`Continue as Guest` (`components/web-access-gate.tsx:260`).

⚠️ **Lo único que sí hay que construir del lado del acceso**: que el enlace **sobreviva al login**.
El invitado abre `/arena?duel=<id>`, el gate lo manda a Privy, y al volver tiene que aterrizar en
**ese** duelo. Si el parámetro se pierde, cae en el hub sin saber a qué lo invitaron y el duelo
queda `awaiting-opponent` para siempre.

---

## Contracts (SDD)

### La regla dura, primero

> **Ningún `walletAddress`, `playerId`, `seatId` ni identificador enviado por el cliente concede
> autoridad sobre un asiento. La autoridad viene de una credencial NO ADIVINABLE emitida por el
> SERVIDOR.**

Se mantiene aunque hoy exista wallet por defecto: una wallet que viaja en un body sigue siendo un
dato que el cliente elige. Tener sesión te deja **pedir** un asiento; no te dice **cuál** es tuyo.

```ts
/** Credencial de asiento. Opaca, del servidor, 128 bits de CSPRNG.
 *  Se guarda HASHEADA: un dump de la tabla no debe entregar asientos. */
export type SeatToken = string & { readonly __brand: "SeatToken" };

export type DuelColor = "w" | "b";

export type DuelStatus =
  | "awaiting-opponent"
  | "active"
  | "finished"
  | "expired";

export type DuelOutcome =
  | { kind: "checkmate"; winner: DuelColor }
  | { kind: "resign"; winner: DuelColor }
  | { kind: "abandoned"; winner: DuelColor }
  | { kind: "draw"; reason: DuelDrawReason };

export type DuelDrawReason =
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move";

export type DuelSeat = {
  color: DuelColor;
  /** SHA-256 del SeatToken. El token en claro sólo existe en la respuesta que lo emite. */
  tokenHash: string;
  displayName: string | null;   // cosmético; saneado y con tope de longitud
  claimedAt: string | null;     // null = asiento libre
};

export type Duel = {
  /** 128 bits base64url. NO enumerable, NO autoincremental, NO UUIDv1. */
  id: string;
  status: DuelStatus;
  seats: Record<DuelColor, DuelSeat>;
  /** La partida entera en SAN. Fuente de verdad única. */
  moves: string[];
  /** ⚠️ El FEN de la posición actual, guardado JUNTO a las movidas. No es
   *  redundancia: es lo que evita reconstruir 60 movidas en cada request. Las
   *  movidas quedan para repetición triple y para mostrar la partida. */
  fen: string;
  outcome: DuelOutcome | null;
  /** CAS. Todo write manda el `version` que leyó; el servidor rechaza si no coincide. */
  version: number;
  createdAt: string;
  expiresAt: string;
};

/** Lo que ve un cliente. ⛔ NUNCA incluye `tokenHash`. */
export type DuelPublic = Omit<Duel, "seats"> & {
  seats: Record<DuelColor, Omit<DuelSeat, "tokenHash">>;
  /** Qué asiento es EL QUE PREGUNTA, resuelto server-side desde su credencial. */
  you: DuelColor | null;
  turnOf: DuelColor | null;
  yourTurn: boolean;
};

export type ApplyMoveResult =
  | { ok: true; duel: DuelPublic }
  | { ok: false; code: "not-your-seat" }
  | { ok: false; code: "not-your-turn" }
  | { ok: false; code: "illegal-move" }
  | { ok: false; code: "duel-not-active" }
  | { ok: false; code: "version-conflict"; duel: DuelPublic }
  | { ok: false; code: "expired"; duel: DuelPublic };

export type JoinResult =
  | { ok: true; duel: DuelPublic; seatToken: SeatToken }
  | { ok: false; code: "seat-taken" }
  | { ok: false; code: "already-seated"; duel: DuelPublic }
  | { ok: false; code: "duel-not-joinable" }   // finished / expired
  | { ok: false; code: "not-found" };

/** El árbitro. SÓLO servidor, sobre chess.js@1.4.0 (ya es dependencia).
 *  Valida contra `fen`; usa `moves` sólo donde la historia importa. */
export function applyMove(
  fen: string,
  moves: readonly string[],
  seat: DuelColor,
  san: string,
): ApplyMoveResult;
```

### Superficie HTTP

| Ruta | Verbo | Credencial de asiento |
| --- | --- | --- |
| `/api/duel` | POST | — (emite la del creador) |
| `/api/duel/[id]` | GET | opcional |
| `/api/duel/[id]/join` | POST | — (emite la del invitado) |
| `/api/duel/[id]/move` | POST | **requerida** |
| `/api/duel/[id]/resign` | POST | **requerida** |

**Cómo viaja:** cookie `httpOnly`, `SameSite=Lax`, `Secure`, `Path=/api/duel/<id>`. ⚠️ **Además se
devuelve una vez en el body** y el cliente la guarda: abrir el enlace en el navegador in-app de
WhatsApp y después "abrir en Chrome" es otro contexto y la cookie no viaja. **Ese es el camino
principal en móvil; la cookie es el respaldo.**

⚠️ `POST /api/duel` y `/join` llevan `enforceRateLimit` (ya existe en el repo) o cualquiera crea
duelos infinitos.

---

## Behavior

1. Dado un jugador con acceso en PLAY, cuando toca *"Jugar con un amigo"*, entonces el servidor crea
   el duelo en `awaiting-opponent`, **sortea** su color, emite su `SeatToken` y devuelve el enlace
   `/[locale]/arena?duel=<id>`.
2. Dado un duelo `awaiting-opponent`, cuando alguien **con acceso** abre el enlace, entonces ve el
   tablero, quién invita, y un CTA `JOIN`.
3. Dado ese caso, cuando toca `JOIN`, entonces ocupa el asiento libre, recibe su `SeatToken`, y el
   duelo pasa a `active`.
4. Dado alguien **sin acceso**, cuando abre el enlace, entonces ve de qué duelo se trata y el gate
   existente. **Nunca ocupa un asiento.**
5. Dado el creador, cuando abre su propio enlace, entonces retoma su asiento y **no** ocupa el otro.
6. Dado un duelo `active`, cuando el asiento de turno manda una jugada legal con el `version`
   correcto, entonces se aplica, `version` sube, `fen` y `expiresAt` se recomputan.
7. Dado el asiento que **no** es de turno, cuando manda una jugada, entonces `not-your-turn` y el
   estado no cambia.
8. Dada una credencial que no corresponde a ningún asiento de ESE duelo, entonces `not-your-seat`,
   **sin revelar de quién es el turno**.
9. Dada una jugada ilegal en la posición, entonces `illegal-move`. **La legalidad la decide el
   servidor**; el cliente filtra por UX pero su opinión no cuenta.
10. Dada una jugada que da jaque mate, entonces `finished` con `checkmate` y `winner` = quien movió.
11. Dadas las cuatro condiciones de tablas (ahogado, material insuficiente, triple repetición,
    50 movidas), entonces `finished` con `draw` y su razón. Las detecta chess.js; las escribe el
    servidor.
12. Dado un abandono explícito, entonces `finished` con `resign` y `winner` = el otro asiento.
13. Dado un duelo cuyo `expiresAt` pasó, cuando **cualquiera lo lee**, entonces se materializa como
    `expired` en ese mismo read. ⚠️ **Sin cron y sin job.**
14. Dado un duelo `awaiting-opponent` vencido, entonces `expired` **sin ganador**.
15. Dado un duelo `active` vencido, entonces `finished` con `abandoned` y gana **el asiento que NO
    tenía el turno**. ⚠️ Ver §Edge cases: esto **sí** inventa un ganador y hay que aceptarlo a
    sabiendas.
16. Dadas dos jugadas concurrentes con el mismo `version`, entonces una gana y la otra recibe
    `version-conflict` **con el estado fresco**. Ninguna se pierde en silencio.
17. Dado un duelo `finished` o `expired`, cuando llega cualquier jugada, entonces `duel-not-active`.

---

## Edge cases

- **Orden de evaluación, fijado:** en cada request se evalúa **(1)** expiración, **(2)** la jugada.
  Si el duelo ya venció, la jugada no entra. Si la jugada da mate y el duelo vence en el mismo
  instante, **gana el mate**, porque el (1) se evaluó contra el `expiresAt` anterior a la jugada.
  Las dos lecturas eran defendibles; ésta queda fijada para que dos implementaciones no difieran.
- **Inventar un ganador por inactividad** (comportamiento 15) es lo contrario del 14, y se acepta a
  sabiendas: dejar vencer **tu propio turno** es la única lectura defendible de abandono, mientras
  que nunca contestar un enlace no es una derrota. ⚠️ Como **nada cuelga del resultado**, el costo
  de equivocarse es cero hoy. **Si algún día cuelga valor, esto se re-decide primero.**
- **La cookie no viaja entre navegadores** — por eso el token vuelve en el body. Sin eso el jugador
  mira su propia partida sin poder mover.
- **Dos personas tocan `JOIN` a la vez:** el CAS decide. La perdedora recibe `seat-taken` y debe
  leerse como *"alguien se te adelantó"*, no como un error.
- **El enlace se reenvía ya empezada la partida:** sin credencial y con los dos asientos ocupados →
  sólo lectura. Es el germen de D3, no una fuga.
- **Promoción de peón:** el SAN la lleva (`e8=Q`) y el árbitro la valida. La UI **tiene** que ofrecer
  la elección o el movimiento es irreproducible.
- **`JOIN` idempotente:** un doble tap no consume dos asientos ni emite dos tokens.
- **Reloj del cliente:** `expiresAt` se compara **siempre** contra el reloj del servidor.
- **El write de expiración dentro de un GET** puede fallar. Si falla, el GET devuelve el estado
  vencido **calculado** igual: la expiración es una función del tiempo, no un permiso de escritura.

---

## Acceptance criteria

- [ ] Una jugada con credencial de otro duelo devuelve `not-your-seat` y **no filtra** el estado.
- [ ] Una jugada sin credencial nunca modifica un duelo, en ningún estado.
- [ ] `walletAddress` no aparece en **ninguna** ruta de autorización de este spec.
- [ ] El serializado de `DuelPublic` no contiene `tokenHash` (aserción sobre el JSON, no sobre el tipo).
- [ ] Los tokens se guardan hasheados: un dump de la tabla no permite ocupar un asiento.
- [ ] El árbitro rechaza toda jugada ilegal, incluidas las que dejan al rey en jaque.
- [ ] Las cuatro condiciones de tablas se detectan con su razón.
- [ ] Dos jugadas concurrentes con el mismo `version`: una aplica, la otra recibe
      `version-conflict` con estado fresco. Ninguna se pierde.
- [ ] Un duelo vencido se materializa como `expired` al leerlo, **sin cron**.
- [ ] Un `active` vencido da `abandoned` al asiento que NO tenía el turno.
- [ ] Un `awaiting-opponent` vencido termina **sin** ganador.
- [ ] `JOIN` es idempotente y devuelve `seat-taken` a la segunda persona.
- [ ] El creador que abre su propio enlace no ocupa el segundo asiento.
- [ ] **El enlace sobrevive al login**: abrir `/arena?duel=<id>` sin sesión y volver del gate
      aterriza en ESE duelo.
- [ ] `POST /api/duel` y `/join` tienen rate limit.
- [ ] Aplicar una jugada NO reconstruye la partida desde cero (valida contra `fen`).

---

## Out of scope / future

- **Apertura al público** — waitlist, tope de logins, contactos fríos →
  `2026-08-13-login-capacity-cap-spec.md`.
- **D2 — Guardar partida.** ⚠️ Arreglar `api/games/route.ts:21` es prerrequisito de D2.
- **D3–D5** — viewer, fans, economía social.
- **La variante de LEARN.**
- **Reloj de ajedrez, revancha, notificación de turno.**

---

## Open questions

1. **¿Cuánto dura la ventana?** Propuesta: **48 h** por jugada. Es una perilla, no una verdad.
2. **¿Dónde vive el duelo?** Supabase encaja, y **no necesita RLS por usuario** si toda la
   autorización pasa por el token. Decidir antes de la migración.
3. **¿Cómo se entera un jugador de que le toca?** Sin notificación, un duelo asincrónico depende de
   que abras la app por casualidad. Puede quedar fuera de la versión mínima, pero entonces la
   ventana de 48 h es optimista.
4. **¿Qué métrica declara que esto funcionó?** El gate del frente es "uso real del duelo" y §14 pide
   fijar el umbral **antes**. Propuesta: contar **duelos con al menos una jugada de cada asiento**,
   no duelos creados.
