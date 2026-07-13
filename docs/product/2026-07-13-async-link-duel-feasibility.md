# Feasibility — Duelo asíncrono por enlace (PvP)

**Date**: 2026-07-13
**Status**: medición de costo, NO es un spec
**Pregunta**: ¿cuánto cuesta un PvP simple donde A comparte un enlace y B juega contra él?

---

## Veredicto

**~2–3 días para un MVP jugable de punta a punta. No son meses.**

El parking lot (`chesscito-monetization-parking-lot-2026-06-01.md`) dice
*"Multiplayer es un milestone de meses, no de un cluster"* y *"Multiplayer
infrastructure (no existe)"*. **Esa estimación es correcta para lo que estaba
midiendo** — multiplayer en vivo + torneos + matchmaking + entry fees. **No es lo
que se está preguntando acá.** El duelo asíncrono por enlace no necesita ninguna de
esas cuatro cosas.

El costo real es bajo porque la mayor parte ya está construida y testeada.

---

## Lo que YA existe (reuso, costo ~0)

| Pieza | Dónde | Por qué sirve |
| --- | --- | --- |
| **Árbitro de servidor** | `lib/coach/validate-game.ts` | Replica una lista de movimientos con chess.js y computa jaque mate / ahogado / tablas. **Es exactamente el árbitro que el PvP necesita.** Ya corre server-side en `/api/sign-victory`. |
| **Tablero** | `components/arena/arena-board.tsx` | **100% presentacional**: recibe `pieces`, `legalMoves`, `lastMove`, `checkSquare`, `onSquareClick` y `playerColor` (que ya voltea el tablero para negras). **Cero acoplamiento a la IA.** Se reusa tal cual con otra fuente de estado. |
| **Store con TTL + atomicidad** | Upstash Redis, `api/games/route.ts` | Ya cableado, con TTL de 90 días, cap de lista y un `eval` de Lua para evitar carreras. El match record entra acá sin infra nueva. |
| **Estado de partida como move list** | `moves-to-fen.ts`, `GameRecord` | La partida ya se modela como `string[]` de SAN. El match compartido es el mismo shape. |
| **Rails de jugador** | `arena-player-rail.tsx` | Rival arriba / vos abajo, con avatar + nombre + meta. Ya soporta un rival arbitrario vía `avatarSrc` y `name` — hoy Pipo, mañana tu amigo. |
| **Pantallas de fin de partida** | `arena-end-state.tsx` (+ 12 baselines VR) | Win / loss / draw / resign ya están diseñadas y con red visual. |
| **Enlace público + OG card** | `/victory/[id]`, `/api/og` | Ya existe una landing pública server-rendered que se comparte y renderiza card. El patrón del `/duel/[id]` es el mismo. |
| **Identidad** | Identity Lite (nickname) | Ya hay nombre de jugador sin fricción. |

---

## Lo que hay que construir (el costo real)

### 1. Match store compartido — **medio día**
Hoy Redis guarda partidas **por wallet** (`REDIS_KEYS.game(wallet, gameId)`): es un
archivo personal de partidas TERMINADAS para el Coach. Un duelo es lo contrario: **un
registro compartido y vivo**, escrito por dos personas por turnos.

```ts
type Duel = {
  id: string;                    // short code para el link
  moves: string[];               // SAN, la única fuente de verdad
  white: Seat; black: Seat | null;  // black vacío hasta que alguien acepte
  status: "awaiting-opponent" | "active" | "finished";
  result?: GameResult;
  createdAt: number; lastMoveAt: number;
};
type Seat = { wallet: string; name: string };
```
Escritura por turno con guard atómico (el `eval` de Lua ya usado en `api/games`).

### 2. Tres rutas — **medio día**
- `POST /api/duels` → crea, devuelve el link.
- `POST /api/duels/[id]/join` → toma el asiento negro (first-come).
- `POST /api/duels/[id]/move` → **el corazón**: replica `moves`, valida que
  **sea tu turno**, que el movimiento sea legal, lo appendea y detecta el final.
  Es `validateGameRecord` + un check de turno.

### 3. Pantalla `/duel/[id]` — **1 día**
Reusa `ArenaBoard` + los rails + los end-states. Lo nuevo es el estado
**"esperando al rival"**: la partida existe, no es tu turno, y tenés que volver.
Es la pantalla que no existe hoy en ninguna forma.

### 4. Entrada + share — **medio día**
Un CTA "Retar a un amigo" en la arena que crea el duelo y abre el share sheet
nativo (WhatsApp/Telegram).

---

## Los riesgos REALES (ninguno es técnico)

1. **No hay push. El enlace ES la notificación.** MiniPay no nos da notificaciones,
   así que cuando tu rival juega, no te enterás: tenés que volver a abrir el link.
   **Este es el riesgo de producto que hunde o salva la feature**, y no se arregla con
   código nuestro. Mitigación honesta: el flujo asume que los dos están en el mismo
   chat de WhatsApp, y que *el jugador que mueve reenvía el link*. Ese es el bucle
   social real, y hay que diseñarlo a propósito, no dejarlo librado al azar.
2. **Partidas zombie.** La mitad de los duelos van a morir sin respuesta. Hace falta
   expiración (TTL) y una copia honesta ("tu rival no volvió"), o el historial se
   llena de basura.
3. **¿Quién es B si no tiene wallet?** El asiento negro necesita un dueño. Con wallet
   es trivial; sin wallet hay que emitir un token de asiento. **Decisión de producto,
   no técnica** — y define si el enlace convierte a un no-usuario o exige onboarding
   primero (que es justo el momento de mayor fricción).
4. **Hijacking de asiento.** El primero que abre el link se queda de negras. Si el
   link se filtra, se lo queda un extraño. Aceptable para un MVP entre amigos; hay que
   decirlo, no esconderlo.

---

## Hallazgo colateral: hoy el enlace MIENTE

`/victory/[id]` ya se comparte y muestra un botón **"Accept challenge"**
(`accept-challenge-button.tsx`), que hace:

```ts
onClick={() => router.push("/arena?fresh=1")}
```

Te manda a jugar **solo contra la IA**. No te conecta con quien compartió, no replica
su posición, no compara nada. La superficie del reto ya está construida y **está
hueca**: el enlace promete un duelo y entrega un solitario.

O sea que ya existe el punto de entrada, la landing pública y la card — le falta el
duelo. Eso **baja** el costo y **sube** la urgencia: hoy hay una promesa incumplida en
producción.

---

## Comparación con el Belt System

| | Duelo por enlace | Belt System |
| --- | --- | --- |
| Alcance | Superficie nueva, aislada | **Espina**: redefine qué significa un badge |
| Toca progresión/economía | No | Sí (umbral, rank, leaderboard) |
| Reversible | Sí (feature flag, borrar la ruta) | No (el bit de rank es monótono) |
| Costo | ~2–3 días | GDD + cluster |
| Bloquea a otros | No | Sí — bloquea el progreso verificado |

**El duelo no colisiona con nada.** No toca badges, ni estrellas, ni el umbral, ni el
leaderboard. Se puede construir antes, durante o después del Belt System sin deshacer
una línea.
