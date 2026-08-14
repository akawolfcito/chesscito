# Plan por etapas — Duelo p2p por enlace

**Fecha:** 2026-08-14
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md` (revisado hoy, §Relojes)
**Red-team:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-redteam.md`

> **Cómo leer esto.** Cada etapa termina **verde y commiteable**, y ninguna deja el sistema a
> medio cablear. El orden no es de dependencia técnica: es **de riesgo**. Lo que puede
> invalidar el diseño va primero, cuando corregirlo todavía es barato.

---

## Etapa 0 — El árbitro, sin red ni base *(pura, sin I/O)*

`lib/duel/referee.ts` + `lib/duel/clock.ts`

Todo lo que decide **qué es legal y quién ganó**, como funciones puras sobre `chess.js@1.4.0`
(ya es dependencia). Sin Supabase, sin rutas, sin React.

- `applyMove(fen, moves, seat, san)` → el `ApplyMoveResult` del spec
- Las cuatro tablas con su razón (ahogado, material insuficiente, triple repetición, 50 movidas)
- Mate, y el rechazo de toda jugada que deje al rey en jaque
- `chargeClock(seat, remainingMs, lastMoveAt, now)` → nuevo `remainingMs`, y si cayó la bandera
- El **orden fijado**: bandera primero, jugada después

⛔ **Por qué primero:** es el único bloque donde un error es *silencioso y permanente*. Una ruta
mal cableada se ve en el primer click; un árbitro que acepta una jugada ilegal en una posición
rara no se ve nunca. Y al ser puro, se prueba exhaustivamente sin levantar nada.

⚠️ **Trampa conocida:** `applyMove` **no** debe reconstruir la partida desde la jugada 1 — valida
contra `fen`. Las `moves` existen para la repetición triple y para mostrar la partida. Hay un
acceptance criterion sobre esto; probarlo con un espía sobre `chess.js`, no leyendo el código.

---

## Etapa 1 — La identidad del asiento *(pura)*

`lib/duel/seat-token.ts`

- Emitir: 128 bits de CSPRNG, base64url
- Guardar: **sólo** el SHA-256
- Resolver: token en claro → `DuelColor | null` para **ese** duelo

⛔ **La regla dura vive acá y en ningún otro lado:** ningún `walletAddress`, `playerId` ni
`seatId` del cliente concede autoridad. Es lo que mató a la v2, y **sigue vivo en producción**
(`api/games/route.ts:21` valida `isAddress()` — el formato, no la propiedad).

⚠️ Test que no puede faltar: una credencial **de otro duelo** da `not-your-seat` y **no filtra**
de quién es el turno.

---

## Etapa 2 — La tabla *(migración)*

`supabase/migrations/2026____duels.sql`

- Sin RLS por usuario: toda la autorización pasa por el token (decisión cerrada)
- `id` de 128 bits, **no** enumerable ni autoincremental
- `remainingMs` **por asiento** — el handicap futuro sale gratis
- `invitedBy` escrito por el servidor

⛔ **Aplicarla con el probe primero** y **nunca con `db push` a ciegas**: hoy el ledger quedó
alineado (45 = 45), y la forma de romperlo de nuevo es arrastrar migraciones ajenas.
Ver `docs/handoffs/2026-08-14-login-capacity-wiring-handoff.md` §4.

---

## Etapa 3 — Las rutas

`/api/duel` · `/api/duel/[id]` · `/join` · `/move` · `/resign`

- CAS sobre `version`; el perdedor recibe `version-conflict` **con estado fresco**
- Expiración y bandera **materializadas al leer**, sin cron
- El token vuelve **una vez en el body**, además de la cookie
- `enforceRateLimit` en `POST /api/duel` y `/join`

⛔ **`DuelPublic` nunca serializa `tokenHash`** — aserción sobre el **JSON**, no sobre el tipo.
Un `Omit<>` de TypeScript no borra un campo en runtime.

⚠️ **Y el export guard aplica:** nada de helpers de test exportados desde un `route.ts`.
`route-exports-guard.test.ts` lo va a atrapar, pero mejor no escribirlo
([[feedback_tsc_does_not_validate_route_exports]]).

---

## Etapa 4 — El enlace que sobrevive al login

**Es el único P0 vivo del red-team y la condición para dar el spec por READY.**

Abrir `/arena?duel=<id>` sin sesión → gate → Privy → volver **a ese duelo**. Si el parámetro se
pierde, el invitado cae en el hub sin saber a qué lo invitaron y el duelo queda
`awaiting-opponent` para siempre.

⚠️ Toca `web-access-gate.tsx`, que **acabo de modificar** para el tope de logins. Releer
`startLogin()` antes de tocarlo.

⛔ **Y la superficie nueva no está verificada hasta abrirla** — dos deploys rotos el 2026-08-14
por exactamente eso ([[feedback_a_new_surface_is_not_verified_until_you_open_it]]).

---

## Etapa 5 — La Arena

Estados: invitando · esperando rival · tu turno · turno del rival · terminado.
Los dos relojes corriendo, con **interpolación local** entre polls.
La elección de promoción de peón (sin ella el movimiento es irreproducible).
La escalera `−`/`+` al crear.

⚠️ El poll **no** necesita ser más frecuente por el reloj: el cliente sabe `lastMoveAt` y de
quién es el turno, así que dibuja solo. El poll es sólo para enterarse de la jugada del rival.

---

## Lo que NO entra, y conviene tenerlo a mano para no discutirlo dos veces

Espectadores y regalos (D3–D5) · guardar la partida (D2) · ranking, Peones o insignias colgando
del resultado · la variante de LEARN · matchmaking, lobby, revancha · incremento por jugada ·
handicap · notificación de turno · tiempo real por WebSocket.

⛔ **Y el disparador que hay que respetar:** el día que un resultado de duelo decida algo con
valor, este spec deja de valer y hay que incluir **server-verified progress** — `sign-badge` y
`sign-score` firman sin verificar lo ganado. Lo mismo aplica a premiar `invitedBy`.
