# Dónde abandonan y por qué vuelven — el cierre de la fuga #1

**Fecha:** 2026-09-02 · **Tipo:** auditoría read-only (sin implementación)
**Método:** `pnpm ops:query` contra producción, SELECT-only. 17 consultas.
**Continúa:** `2026-08-28-core-loop-diagnostic.md` (que dejó la fuga #1 abierta a propósito)
y `2026-09-02-telemetry-verified-and-real-state.md`.

Tipos: **[HECHO]** medido · **[INFERENCIA]** derivada · **[NO MEDIBLE]** fuera de la
instrumentación actual.

---

## 0. El titular

El diagnóstico del 2026-08-28 midió que el 48% nunca termina una partida y **se negó a
explicar por qué**, porque no existía ningún evento durante el juego: *"tocó Start y se fue"*
y *"jugó 40 movimientos en silencio y se le perdió el lote"* producían la misma traza. Pidió
cuatro instrumentos.

**Dos de ellos se desplegaron el 2026-08-31 y nadie había leído los datos todavía.** Esta
auditoría los lee. La respuesta es lo contrario de lo que se venía asumiendo:

> **[HECHO] El 87,7% de las partidas que arrancan reciben un primer movimiento.**
> La gente **no** rebota en la pantalla de transición. Llega al tablero y juega.
> **La fuga está DENTRO de la partida, no en la puerta.**

---

## 1. El cierre de la fuga #1

Desde el 2026-08-31, `arena_game_start` lleva `game_id` y existe `first_move_made`:

| | Partidas | % |
|---|---:|---:|
| Starts apareables por `game_id` | 302 | 100% |
| **Con primer movimiento** | **265** | **87,7%** |
| Sin ningún movimiento | 37 | 12,3% |

**[HECHO]** El escenario "tocó Start, vio los 1.800 ms de transición y se fue" explica como
mucho **12,3%**, no 48%.

⛔ **[NO MEDIBLE todavía] `arena_game_end` NO lleva `game_id`.** El requisito #1 del
diagnóstico anterior — *"sin id no se puede aparear un start con su end"* — **quedó a
medias**: el id se mintea en el start (`arena/page.tsx:703`), lo reusan `first_move_made` y
el persist, pero el `track("arena_game_end", …)` de `page.tsx:1009` no lo incluye. Es un
campo. Mientras falte, "no terminó" se sigue infiriendo por ausencia y **no se puede decir en
qué movimiento se fue cada uno**.

---

## 2. Por qué se van a mitad: **no existe una banda de victoria**

Partidas terminadas, últimos 14 días:

| Dificultad | Partidas | Gana | **Tablas** | Abandona | **Le hacen mate** | p50 movs | p50 dur |
|---|---:|---:|---:|---:|---:|---:|---:|
| **easy** | 654 | 29,7% | **50,8%** | 14,4% | 5,2% | **70** | 4m25s |
| medium | 216 | 15,3% | 6,5% | 9,3% | **69,0%** | 50 | 4m28s |
| hard | 300 | 5,7% | 17,7% | 15,0% | **61,7%** | 46 | 4m38s |

⛔ **[HECHO] El desenlace más probable de Chesscito es un empate en `easy` después de 70
movimientos y cuatro minutos y medio.** No una victoria. No una derrota. Tablas.

Y `easy` es la dificultad que elige la enorme mayoría. Subir de nivel no arregla nada: en
`medium` y `hard` **le hacen mate al jugador en el 61–69% de las partidas.**

**[INFERENCIA]** Un juego donde el mejor caso realista es *"empataste tras 70 movimientos"* y
el siguiente escalón es *"te dieron mate"* no tiene un momento de recompensa. Eso es
consistente con que la gente se vaya a mitad de partida: **no se van porque el juego sea
difícil de entender, se van porque no está yendo a ningún lado.**

---

## 3. Qué separa a quien vuelve de quien no: **terminar una partida**

Comparación del **día 1 de cada cuenta**, entre las que jugaron un solo día y las que
volvieron (cohortes desde 2026-08-06):

| Hizo esto en su día 1 | Un día | **Vuelven** | Δ |
|---|---:|---:|---:|
| `arena_select_view` | 28,9% | 47,9% | +19,0 |
| **`arena_game_end`** (terminó una partida) | 25,6% | **42,4%** | **+16,8** |
| `tx_progress_done` | 25,5% | 43,2% | +17,7 |
| `coach_preview_viewed` | 25,6% | 42,4% | +16,8 |
| `monetization.play_again_tap` | 8,8% | 24,9% | +16,1 |
| `coach_viewer_viewed` | 16,6% | 32,3% | +15,7 |
| `peones_earned` | 21,3% | 35,4% | +14,1 |
| `daily_tactic_completed` | 20,5% | 34,6% | +14,1 |
| **`coach_viewer_play_again_tap`** | 2,4% | 12,8% | **5,3× (el mayor ratio)** |

**[HECHO]** El evento más discriminante es **terminar una partida**, y todo lo que aparece
arriba de él en la lista es una *consecuencia* de haber terminado: persistir, ver el preview
del Coach, ganar Peones, tocar "play again".

> ⛔ **La fuga del 48% y el problema de retención del 93,4% no son dos problemas. Son uno.**
> La gente que no termina es la gente que no vuelve.

⚠️ **[INFERENCIA, no causalidad]** Esto es correlación. Puede ser que quien ya venía
enganchado termine *y* vuelva, sin que terminar cause volver. Pero es la señal más fuerte del
dataset y la única accionable: **el experimento correcto es hacer que más gente termine y ver
si la retención se mueve.**

---

## 4. Tu intuición sobre jugar contra personas

**[HECHO] La tabla `duels` tiene 16 filas en toda su historia.** Eventos de 30 días:
`duel_setup_open` **6 cuentas**, `duel_created` 16, `duel_joined` 7, `duel_finished` **1**.

⛔ **Eso no refuta ni confirma nada**, porque el duelo **nunca estuvo expuesto**:
`DUEL_DISCOVERY_ENABLED` está apagado y esconde la cuarta tarjeta del selector de oponente.
Nadie lo eligió porque casi nadie pudo verlo.

**Lo que sí se puede decir [INFERENCIA]:** tu intuición y estos números apuntan al mismo lugar
por caminos distintos.

- Los datos dicen: **quien termina una partida vuelve**. La pregunta es qué hace que alguien
  termine.
- Una partida contra una máquina no tiene ninguna razón externa para terminarse. Si se pone
  aburrida a los 40 movimientos, cerrarla no le cuesta nada a nadie.
- Una partida contra una persona sí la tiene: **hay alguien esperando tu movimiento.** Es la
  apuesta más barata que existe — no hace falta dinero, alcanza con que del otro lado haya un
  humano.
- Y el problema del 50,8% de tablas es un artefacto del oponente: una máquina en `easy`
  ajustada para no aplastar produce tablas largas. **Dos humanos producen partidas
  decisivas.**

**Lo social que SÍ está expuesto es minúsculo:** `share_modal_open` 199 cuentas,
`hub_trophy_tap` 137, `coach_viewer_share_tap` 82, `share_tile_tap` 40. Todo eso es
single-player con adorno: compartir un resultado no es jugar con alguien.

---

## 5. Falsa alarma que casi reporto

Sobre 30 días, `monetization.play_again_tap` da 700 sesiones y `play_again_game_started` 35 —
parecería una fuga del 95%. **Es falso.** `play_again_game_started` se desplegó el 2026-08-31;
dividir ventanas de distinto span no es un ratio.

Medido en la ventana donde ambos existen: **104 taps → 80 llegadas al tablero = 76,9%**, y en
los últimos dos días las llegadas igualan o superan a los taps. **No hay fuga ahí.**

---

## 6. Lo que sigue sin poder medirse

| Pregunta | Por qué |
|---|---|
| ¿En qué movimiento abandona cada uno? | falta `game_id` en `arena_game_end` |
| ¿Cerró la app o navegó a otro lado? | no existe `arena_game_abandoned` (requisito #2 del 08-28, no desplegado) |
| ¿Llegó al tablero o no? | `first_move_made` lo aproxima, pero `reached_board` (requisito #3) no existe |
| ¿Cuántos comandos consume Upstash? | faltan `UPSTASH_EMAIL` + `UPSTASH_API_KEY` |

⚠️ Y el caveat que aplica a todo: `created_at` es **hora de inserción en el servidor**, los
eventos van en lotes de 20 / 5 s, y **un flush fallido se descarta sin reintento**. Los huecos
≤5 s no se pueden resolver.

---

## 7. Las respuestas de mayor valor, ordenadas

Pediste saber cuáles rinden más. Con lo medido hasta acá:

1. **🥇 Terminar una partida es lo que predice que alguien vuelva.** Es el único hallazgo que
   conecta las dos fugas y dice qué empujar.
2. **🥈 El juego no tiene banda de victoria** — 50,8% tablas en `easy` tras 70 movimientos. Es
   la explicación más probable de por qué no terminan, y es de diseño, no de código.
3. **🥉 El 87,7% llega al tablero.** Mata la hipótesis de "rebotan en la transición" y evita
   que se gaste trabajo en la pantalla equivocada.
4. Un campo (`game_id` en `arena_game_end`) desbloquea la pregunta "¿en qué movimiento?".
5. El duelo nunca se probó: 16 filas. No hay evidencia, y por eso mismo es barato generarla.

---

*Consultas en el scratchpad de la sesión. Reproducibles con `pnpm ops:query <archivo.sql>`.*
