# Spec — Duelo de ajedrez por enlace (p2p-chess-duel-by-link)

**Date**: 2026-08-13 · **Revisado**: 2026-08-14 (decisiones del founder, §Relojes)
**Status**: draft — **versión mínima**
**Modo**: **PLAY** (partida de ajedrez completa). La variante corta de LEARN es otro spec.

> ### ⚠️ Cambio de modelo del 2026-08-14 — leer antes que nada
>
> El duelo pasa de **asincrónico por turnos (48 h por jugada)** a **una partida de una sentada
> con reloj de ajedrez**. No es un ajuste de números: cambia qué producto es.
>
> **Por qué:** el founder no quería partidas largas y propuso reloj *"así nos evitamos
> adivinar"*. Tenía razón — las tres reglas que este spec inventaba (ganador por vencimiento,
> tablas por tiempo, guarda de abandono) eran soluciones caseras a un problema que el ajedrez
> resolvió hace 150 años.
>
> **Qué BORRA del spec original:** el reloj total de la partida, la regla *"gana el que no tenía
> el turno"* (comportamiento 15), y toda discusión sobre inventar un ganador por inactividad.
> Se te acaba el tiempo, perdés. Te vas de la partida, tu reloj corre y perdés. Una sola regla,
> conocida por todos.
>
> **Qué NO cambia:** la regla dura de identidad, el árbitro server-side, la expiración
> materializada al leer (la caída de bandera usa **el mismo mecanismo**), el CAS por `version`,
> y el alcance de dos personas que ya están dentro.

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
- **Matchmaking, lobby, revancha.** ⚠️ El **reloj de ajedrez SALIÓ de esta lista** el 2026-08-14
  y ahora es parte del alcance — ver §Relojes.
- **Incremento por jugada** (los 5 s de un `10+5`). Founder: *"lo más básico"*. Se puede agregar
  después sin migrar nada: es un campo más y una suma en el árbitro.
- **Handicap** de tiempo o de piezas. ⚠️ El de tiempo **ya está habilitado por el modelo de
  datos** (ver §Relojes); no se construye ahora, pero no habrá que rediseñar para tenerlo.
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

## Relojes (founder, 2026-08-14)

Son **dos relojes distintos** y responden preguntas distintas. Confundirlos fue el error que
esta revisión corrige.

### 1. La invitación — 1 hora

Cuánto vive el enlace **antes** de que alguien entre. Si nadie ocupa el asiento libre en 1 h, el
duelo pasa a `expired` **sin ganador** (comportamiento 14, intacto). Nunca contestar un enlace
no es una derrota.

### 2. La partida — reloj de ajedrez por asiento

Cada asiento tiene su propio banco de tiempo. Corre el del que tiene el turno.

```
escalera fija:  30s · 1 · 3 · 5 · 10 · 15 · 30 min      default: 10
```

⛔ **Escalera con `−` / `+`, NO un campo numérico.** Dos botones en un teléfono, cero validación
que escribir, e imposible poner un absurdo. El techo de 30 min existe porque sin techo se vuelve
a las partidas largas que este cambio venía a evitar.

⛔ **El tiempo se guarda POR ASIENTO (`remainingMs` en cada `DuelSeat`), nunca como un solo
campo del duelo.** Hoy los dos arrancan iguales, así que un campo único alcanzaría — y sería la
decisión que hay que deshacer con una migración el día del **handicap de tiempo** que el founder
ya nombró como próximo paso. Por asiento, el handicap es *arrancarlos con valores distintos* y
nada más.

⚠️ **Descuenta el SERVIDOR, con SU reloj.** El cliente hace correr los suyos localmente para que
se vean fluidos —sabe `lastMoveAt` y de quién es el turno— pero **su cuenta no vale**: el
descuento real ocurre al aplicar la jugada, `now_servidor − lastMoveAt`.

⚠️ **Y por eso el cliente NO necesita polear más seguido.** Interpola local; el poll sigue siendo
sólo para enterarse de la jugada del rival. El reloj no cambia la cadencia de red.

⛔ **La bandera cae AL LEER, con el mismo mecanismo que la expiración.** Si a alguien se le acaba
el tiempo y nunca vuelve a mover, no hay ningún evento que lo dispare: se materializa en el
próximo GET de cualquiera. **Sin cron y sin job** — igual que `expired`.

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
  /** Se le acabó el tiempo al PERDEDOR. ⛔ Reemplaza a `abandoned`: irse de la
   *  partida ya no necesita una regla propia — tu reloj corre y perdés. */
  | { kind: "timeout"; winner: DuelColor }
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
  /** ⛔ POR ASIENTO, no un campo del duelo. Hoy los dos arrancan iguales; el día
   *  del handicap de tiempo esto es arrancarlos distinto y NADA más. */
  remainingMs: number;
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
  /** ⚠️ Ahora es SÓLO el reloj de la INVITACIÓN (1 h). Una vez `active`, quien
   *  termina la partida es el reloj de ajedrez, no esto. */
  expiresAt: string;
  /** Sello del SERVIDOR en la última jugada. Contra esto se descuenta, y con
   *  esto el cliente interpola sus relojes sin polear más seguido. `null`
   *  mientras el duelo no arrancó. */
  lastMoveAt: string | null;
  /** Minutos iniciales elegidos en la escalera (30s se guarda como 0.5).
   *  Informativo: la verdad del tiempo vive en `seats[color].remainingMs`. */
  initialMinutes: number;
  /** ⛔ Quién invitó, grabado por el SERVIDOR al crear desde la credencial del
   *  creador. NUNCA lo reporta el cliente del invitado: el founder quiere premiar
   *  a quien trae gente, y un dato que el cliente elige se falsifica el día que
   *  vale algo. Es el mismo defecto que mató a la v2. */
  invitedBy: string | null;
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
14. Dado un duelo `awaiting-opponent` cuya hora pasó, entonces `expired` **sin ganador**. Nunca
    contestar un enlace no es una derrota.
15. **(REESCRITO 2026-08-14)** Dado un duelo `active`, cuando el `remainingMs` del asiento de
    turno llega a cero, entonces `finished` con `timeout` y gana **el otro asiento**.
    ⛔ Reemplaza a la regla vieja de `abandoned`. Ya **no se inventa** ningún ganador: perdés
    porque se te acabó tu propio tiempo, que es la regla que todo el mundo ya conoce.
    ⚠️ Y se materializa **al leer**, con el mismo mecanismo que la expiración: si alguien se va y
    no vuelve a mover nunca, no hay evento que lo dispare — lo dispara el próximo GET.
15b. Dado que se aplica una jugada, entonces al asiento que movió se le descuenta
    `now_servidor − lastMoveAt`, y `lastMoveAt` pasa a `now_servidor`. ⛔ **El reloj del cliente
    no participa de la cuenta**, aunque la UI lo use para dibujar.
16. Dadas dos jugadas concurrentes con el mismo `version`, entonces una gana y la otra recibe
    `version-conflict` **con el estado fresco**. Ninguna se pierde en silencio.
17. Dado un duelo `finished` o `expired`, cuando llega cualquier jugada, entonces `duel-not-active`.

---

## Edge cases

- **Orden de evaluación, fijado:** en cada request se evalúa **(1)** expiración, **(2)** la jugada.
  Si el duelo ya venció, la jugada no entra. Si la jugada da mate y el duelo vence en el mismo
  instante, **gana el mate**, porque el (1) se evaluó contra el `expiresAt` anterior a la jugada.
  Las dos lecturas eran defendibles; ésta queda fijada para que dos implementaciones no difieran.
- ~~**Inventar un ganador por inactividad**~~ — **RESUELTO por el reloj (2026-08-14)**, y ya no
  hay nada que aceptar a sabiendas. La asimetría entre el 14 y el 15 dejó de ser una decisión
  incómoda y pasó a ser la regla del ajedrez: no contestar un enlace no es perder; que se te
  acabe **tu** tiempo, sí.
- **Orden de evaluación con el reloj:** en cada request se evalúa **(1)** la caída de bandera,
  **(2)** la jugada. ⚠️ Con el mismo criterio que el orden ya fijado abajo: la bandera se juzga
  contra el `lastMoveAt` **anterior** a la jugada, así que una jugada que da mate **justo** al
  agotarse el tiempo pierde por bandera si el descuento la deja en cero **antes** de aplicarse.
  Las dos lecturas son defendibles; ésta queda fijada para que dos implementaciones no difieran.
- **Un banco en cero exacto es bandera caída**, no "queda 0 y sigo": `remainingMs <= 0`.
- **Latencia:** el descuento se hace contra el reloj del servidor, así que la red le come tiempo
  a quien mueve. Sin incremento en v1 eso es aceptable para partidas casuales; es el primer
  argumento a favor de agregar incremento si alguien se queja.
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
- [ ] Un `awaiting-opponent` pasada la hora termina **sin** ganador.
- [ ] **Bandera:** un `active` cuyo asiento de turno llega a `remainingMs <= 0` da `timeout` y
      gana el otro — **materializado en un GET**, sin que nadie mueva ni corra un job.
- [ ] **El descuento usa el reloj del SERVIDOR**: un cliente que miente sobre cuánto tardó no
      cambia su tiempo restante (aserción sobre el estado, no sobre la UI).
- [ ] **El tiempo vive por asiento**: dos asientos pueden tener `remainingMs` distintos sin que
      nada se rompa (es el handicap futuro, probado hoy aunque no se ofrezca).
- [ ] La escalera sólo admite sus siete valores; no hay forma de crear un duelo con otro.
- [ ] **`invitedBy` lo escribe el servidor** desde la credencial del creador, y un cliente no
      puede fijarlo ni cambiarlo en ninguna ruta.
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

## Open questions — las cuatro CERRADAS el 2026-08-14

1. ✅ **La ventana.** Invitación **1 h**; la partida la termina el **reloj de ajedrez**
   (escalera `30s·1·3·5·10·15·30`, default **10**, sin incremento). Ver §Relojes.
2. ✅ **Dónde vive.** **Supabase**, tabla nueva. Sin RLS por usuario: toda la autorización pasa
   por el `SeatToken`. Se eligió sobre Upstash porque los reads del poll son baratos, se puede
   inspeccionar un duelo para depurar, y el equipo ya sabe operarla.
3. ✅ **Aviso de turno.** **No hace falta.** Era un problema del modelo asincrónico: con los dos
   jugadores sentados en la misma sesión, el rival está mirando la pantalla. Queda fuera de
   alcance sin deuda.
4. ✅ **La métrica.** **Duelos con al menos una jugada de CADA asiento** — no duelos creados. Un
   enlace compartido que nadie contesta no prueba nada.

### Abiertas de la revisión

5. **¿Qué se hace con `invitedBy`?** El dato se graba desde el día uno (bien, server-side), pero
   **premiar** a quien trae gente es un feature propio y sin spec. ⚠️ El día que se premie, el
   premio cuelga de un dato — y ahí aplica el mismo disparador del §Apuesta.
6. **¿Handicap de tiempo?** El modelo ya lo permite (`remainingMs` por asiento). Falta decidir la
   UI y si se ofrece al crear o al invitar.
