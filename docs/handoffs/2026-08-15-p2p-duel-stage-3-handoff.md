# Handoff — Duelo p2p: la tabla vive en prod y la Etapa 3 cerró entera

**Fecha:** 2026-08-15
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Plan:** `docs/plans/2026-08-14-p2p-duel-tdd-plan.md` ← **tiene la tabla de estado por etapa**
**Handoff anterior:** `docs/handoffs/2026-08-15-p2p-duel-stages-0-2-handoff.md`

---

## 1. Dónde retomar

**Etapa 5 — la Arena.** El backend está entero: hay tabla en producción, cinco rutas y 125 tests
sobre ellas. Lo que falta es la pantalla.

⛔ **Las dos reglas del enlace, medidas en la Etapa 4 y todavía sin construir:** el enlace para
compartir se arma **desde el `id` del duelo** y con el **host de PLAY absoluto**, nunca desde
`window.location.href`. La URL post-login arrastra el `privy_oauth_code` del invitador, y un
enlace relativo abierto desde el host de LEARN rebota cross-domain, donde la cookie del asiento
no viaja.

⚠️ **Lo que la Arena tiene que ofrecer sí o sí:** la elección de promoción de peón. Sin ella el
movimiento es irreproducible — el SAN la lleva (`e8=Q`) y el árbitro la valida.

---

## 2. La migración: aplicada a producción

✅ `20260814120000_p2p_duels.sql` está **aplicada y en el ledger** (46 filas). Detalle completo en
`[[project_duels_table_is_live]]`.

| verificación | resultado |
| --- | --- |
| tabla / índice / función | `duels` · `duels_created_at_idx` · `purge_duels` (1) |
| CHECK constraints | **17** |
| RLS | activa, **0 policies** (deny-total a propósito) |
| grants de `anon` / `authenticated` | **ninguno**, y `DENIED` al intentar leer |
| filas | 0 |

⚠️ **La negación de `anon` se probó devolviendo un VALOR, no un `raise notice`: el pooler de
Supabase se come los NOTICE**, y un `DO` que sólo imprime `DO` no prueba nada.

⛔ **Y una corrección que costó una vuelta:** yo le dije al founder que había **dos** migraciones
pendientes y que un `db push` arrastraría `content_overlay_sweeps`. **Era falso.** Él se acordaba
bien: medido, el ledger ya tenía `20260811150000` y de 46 archivos locales el único sin fila era
el del duelo. La regla quedó guardada — [[feedback_measure_the_ledger_dont_recall_it]].

---

## 3. Qué se construyó en la Etapa 3

| paso | archivo | tests |
| --- | --- | --- |
| 3a | `lib/duel/row.ts` | 12 |
| 3b | `lib/duel/lifecycle.ts` | 15 |
| 3c | `lib/duel/operations.ts` | 35 |
| 3d | `lib/duel/repository.ts` | 14 |
| — | `lib/duel/http.ts` + `lib/duel/service.ts` | 19 |
| 3e | las cinco rutas | 31 |

**Suite completa al cerrar: 673 archivos / 8332 tests, `EXIT=0`, 156 s. `tsc` limpio.**

### Las cinco reglas que la etapa dejó escritas y que no estaban en ningún lado

1. ⛔ **El orden vive en UN portón compartido** (`openWriteGate`): asiento → reloj → versión →
   tablero. Quien agregue un cuarto camino de escritura lo hereda gratis.
2. ⛔ **Ni la credencial ni el ID DEL DUELO se loguean.** El id *es* el enlace de invitación: un
   log drain lleno de ids es un drain lleno de duelos donde alguien se puede sentar.
3. ⛔ **La credencial no se lee nunca de la query string** — y el test asegura que se **ignora**,
   no que "todavía no se implementó".
4. ⛔ **`invitedBy` queda en `null`.** Ver §4.
5. ⚠️ **Los eventos de telemetría llevan el `session_id` del cliente**, no uno sintético.

### El CAS, probado dos veces

El unitario aserta sobre la **query construida**, porque sacar el `.eq("version", n)` es
invisible desde afuera: toda jugada sigue "funcionando" y el perdedor de una carrera pisa al
ganador en silencio.

Después, contra la tabla real: dos writers concurrentes con la misma versión → **gana
exactamente uno**, el otro recibe cero filas y ningún error, y un write con la versión vieja no
matchea nada. La fila del probe se borró y la tabla quedó en 0.

📌 El probe además **corrigió un comentario mío de 3a**: por PostgREST `initial_minutes` llega
como **number**, no como string. Lo había afirmado por la reputación general de los `numeric`.

---

## 4. ⛔ Lo que el spec pidió y NO se pudo honrar

**`invitedBy` se escribe `null` en todos los duelos.**

El spec dice que lo escribe el servidor *"desde la credencial del creador"* y que **nunca** lo
reporta el cliente. Pero **esta app no tiene identidad verificable server-side**: Privy se valida
en el browser y no existe `@privy-io/server-auth` en el repo — verificado por grep, no supuesto.

Tomar el valor del body y llamarlo *server-written* sería el defecto que mató a la v2 con otro
nombre, así que la ruta lo ignora y hay un test de eso.

**Hoy no se pierde nada** (la open question 5 del spec ya dice que premiar a quien trae gente es
un feature aparte). Lo que hay que saber es que **el dato va a estar vacío el día que se quiera
usar**, y que llenarlo requiere primero verificación de sesión server-side.

---

## 5. Lo que la mutación encontró EN LOS TESTS

11 mutantes, todos muertos. Pero dos rondas fallaron primero, y no por el código:

1. **Un guard redundante enmascaraba la regla que duplicaba.** El mutante que expira una partida
   viva —el que borra una victoria por bandera— sobrevivió, porque el caso lo atajaba un guard de
   asientos y no el de status. Se sacó el redundante: **un guard que tapa la falla de la regla que
   duplica no es profundidad, es una venda.** El segundo candado vive donde sí se hace cumplir, en
   `duels_expired_never_had_two_players`.
2. **Un test asertaba sobre `seats.w` cuando el color del creador SE SORTEA** — pasaba una de cada
   dos. Habría sido leído como flake de CI en vez de como un test preguntando lo que no era.

---

## 6. Estado del repo al cerrar

| | |
| --- | --- |
| `main` local | limpio, **7 commits** por delante de `origin/main` |
| Suite | 673 archivos / 8332 tests, `EXIT=0`, 156 s |
| `tsc` | limpio |
| Migración de duelos | ✅ **aplicada a producción**, ledger 46 |
| Rutas | 5, ninguna abierta todavía desde una pantalla |

⚠️ **Ninguna de las cinco rutas se abrió jamás desde un navegador.** Están probadas por unidad y
el CAS está medido contra la base, pero
[[feedback_a_new_surface_is_not_verified_until_you_open_it]] aplica entero: la Etapa 5 no está
hecha hasta que dos personas jueguen un duelo de verdad.

---

## Preguntas abiertas

1. **¿Quién dispara `purge_duels`?** Sigue sin dueño. Ahora hay tabla, así que empieza a correr
   el reloj de las filas colgadas — aunque el default de 7 días es 80× la vida de un duelo.
2. **¿Se arregla el callejón del invitado sin allowlist?** Heredada del handoff anterior y sin
   tocar: Privy dice *"You don't have access to this app"* y detrás nuestra pantalla ofrece un
   **Try again** que no va a funcionar nunca. Ninguno lleva a la waitlist, que existe. Es el
   camino que este feature va a estrenar.
3. **¿Cuándo se llena `invitedBy`?** Requiere verificación de sesión server-side (§4).
4. **¿El cliente reintenta un `version-conflict`?** La ruta **no** reintenta nunca, a propósito.
   Qué hace la Arena con esa respuesta es decisión de la Etapa 5.
