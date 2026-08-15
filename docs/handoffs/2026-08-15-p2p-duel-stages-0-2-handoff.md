# Handoff — Duelo p2p: etapas 0, 1 y 2 construidas, y el P0 cerrado midiendo

**Fecha:** 2026-08-15
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Red-team:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-redteam.md`
**Plan:** `docs/plans/2026-08-14-p2p-duel-tdd-plan.md` ← **tiene la tabla de estado por etapa**

---

## 1. Dónde retomar

**Etapa 3 — las rutas** (`/api/duel`, `/api/duel/[id]`, `/join`, `/move`, `/resign`).

Todo lo que necesitan ya existe y está probado: el árbitro, los relojes, la identidad del
asiento y la tabla. La ruta sólo tiene que **componerlos en el orden fijado** y hacer el CAS.

⛔ **El orden que hoy no vive en ningún código y es de la ruta:** primero la **bandera**,
después la jugada. `resolveFlag()` y `applyMove()` existen por separado a propósito — cada uno
es puro y no sabe del otro. Quien los ordena mal produce una partida donde un mate en el último
segundo le gana al reloj, que es exactamente la decisión que el spec fijó al revés.

---

## 2. Qué se construyó

| etapa | archivos | verificación |
| --- | --- | --- |
| 0 — árbitro + reloj | `lib/duel/{types,clock,referee}.ts` | 32 tests; **mutación: 10 rojas de 32** |
| 1 — identidad | `lib/duel/seat-token.ts` | 12 tests |
| 2 — la tabla | `supabase/migrations/20260814120000_p2p_duels.sql` | smoke contra Postgres vivo (13 casos) + guard de vitest; **mutación: 2 constraints ⇒ 2 rojas** |
| 4 — enlace y login | `components/__tests__/web-access-gate-preserves-url.test.tsx` | **medición en vivo** + mutación (2 de 3 rojas) |

**Suite al cerrar: 666 archivos / 8201 tests, exit 0. `tsc` limpio.**

### Lo que decide el árbitro, y lo que no

`applyMove(fen, moves, seat, san)` juzga contra el **FEN**, nunca replayeando — era un P0 del
red-team y se cierra en el esquema (el `fen` vive junto a `moves`). Probado **por comportamiento**:
se le pasa un historial de otra partida y el veredicto no cambia.

⚠️ **La única excepción, y está acotada:** la triple repetición es la única regla que la posición
actual no puede contestar sola (un `Chess` construido de un FEN vio su posición una sola vez).
Esa camina el historial, y la puerta es el reloj de medias jugadas: tres ocurrencias necesitan
≥8, así que **la jugada común no toca el historial**. Es literalmente la receta que el red-team
propuso al cerrar ese P0 ("usando la lista sólo para repetición triple").

📌 **La palanca si algún día molesta**: guardar las claves de posición en la fila y no caminar
nunca. Sale gratis hoy porque la tabla **todavía no está aplicada**.

### Lo que la tabla impide por constraint, no por comentario

- `id ~ '^[A-Za-z0-9_-]{22}$'` — que alguien lo "simplifique" a un serial y el enlace se adivine
- la escalera de siete valores — el criterio de aceptación deja de depender de que la ruta se acuerde
- `active` exige dos asientos **y** `last_move_at` — sin sello el reloj no tiene contra qué correr
- ⛔ **`expired` sólo sin segundo jugador** — sin este check una ruta podía escribir `expired`
  encima de una partida viva y **borrar una victoria por bandera** sin que nada se queje
- `remaining_ms` por asiento, con un caso que prueba que pueden diferir (el handicap futuro)

### Por qué NO rota el token

El red-team decía que un asiento robado "juega para siempre". **En este diseño no**: la
credencial no autoriza sola, autoriza *dentro de un duelo*, y el duelo se muere solo (1 h de
invitación + techo de 30 min por lado). Rotar sería **peor**: en móvil el token lo guarda el
cliente, así que una rotación perdida deja al jugador afuera de su propia partida **con su reloj
corriendo** — cambia un robo hipotético por una derrota real.

La revocación real es **borrar la fila**: `purge_duels(interval)`, que existe y **no la llama
nadie** (está escrito así en la migración). Quién la dispara es una decisión abierta.

---

## 3. El P0 del red-team: cerrado midiendo, no construyendo

Era *"el único P0 vivo y la condición para dar el spec por READY"*. **No había que construir
nada.** Medido en un teléfono, con Google —el camino riesgoso, porque en móvil Privy usa
**redirect de página completa** y en desktop **popup**:

```
/arena?duel=test123&privy_oauth_state=…&privy_oauth_provider=google&privy_oauth_code=…
```

Privy **conserva la query y anexa la suya**; el invitado aterrizó en la Arena con su duelo puesto.

⚠️ **Lección del camino, no del resultado:** se estuvo a punto de construir el estacionamiento
dos veces. La primera medición fue con **email** (modal, nunca navega) y no probaba nada del
redirect; la segunda fue en **desktop** (popup) y tampoco. **Sólo el teléfono medía el caso real.**
Un método de login que no navega no prueba nada sobre uno que sí.

---

## 4. Hallazgos que dejó el smoke (ninguno estaba en el spec)

1. ⛔ **El enlace compartido no se arma desde `window.location.href`** — después del login la
   barra arrastra el `privy_oauth_code` del invitador. Se arma desde el `id`. (Etapa 5)
2. ⛔ **Y con el host de PLAY, absoluto.** En modo `learn` el middleware rebota `/arena`
   cross-domain al host de play. La query sobrevive; **la cookie del asiento no**. Ahí el token
   del body deja de ser respaldo y pasa a ser lo único. (Etapa 5)
3. ⚠️ **El invitado sin allowlist queda en un callejón sin salida.** Privy dice *"You don't have
   access to this app — Have you been invited?"* y detrás nuestra pantalla dice *"Something
   interrupted your sign in"* con un **Try again** que no va a funcionar nunca. **Ninguno lo
   lleva a la waitlist**, que existe y tiene la copia correcta. Es el camino que este feature va
   a estrenar y no tiene spec.
4. ⚠️ **El banner `DEV: PRO origin mismatch` estuvo arriba toda la sesión**: el túnel cambió de
   nombre (`britannica-…` → `wooden-…`) y las env quedaron en el viejo. En esa sesión el estado
   PRO es **desconocido** — no sacar conclusiones sobre entitlements ahí.

---

## 5. Estado del repo al cerrar

| | |
| --- | --- |
| `main` local | limpio, **53 commits** por delante de `origin/main` |
| Suite | 666 archivos / 8201 tests, exit 0 |
| `tsc` | limpio |
| Migración de duelos | ⛔ **NO aplicada a ninguna base.** El ledger sigue 45 = 45; ésta lo llevaría a 46 |

---

## Preguntas abiertas

1. **¿Se aplica la migración de duelos, y cuándo?** No hace falta hasta la Etapa 3. Cuando se
   aplique: con el probe, nunca con `db push` a ciegas.
2. **¿Quién dispara `purge_duels`?** Hoy nadie. No urge (no hay duelos), y el día que urja ya
   hay filas colgadas.
3. **¿Se arregla el callejón del invitado sin allowlist?** Es chico y toca el camino que este
   feature estrena. No es del duelo, pero sin eso el primer invitado real rebota.
4. **El pozo pasó de 6 a 7** por la cuenta de prueba creada durante el smoke.
