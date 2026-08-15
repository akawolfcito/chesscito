# Spec — La Arena del duelo: estados de UI, transiciones y edge cases

**Fecha:** 2026-08-15 · **Etapa 5** de `docs/plans/2026-08-14-p2p-duel-tdd-plan.md`
**Spec padre:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Status:** borrador — **pendiente de aprobación antes de implementar**

> **Por qué existe este documento.** CLAUDE.md exige que todo feature con flujo interactivo
> enumere **sus estados, sus transiciones y sus edge cases por estado** ANTES de implementar,
> porque sin eso los bugs de flujo aparecen en QA post-entrega. El plan listaba cinco estados
> sueltos; esto es la matriz.
>
> ⚠️ Y cierra un finding del red-team que seguía abierto: *"el spec no menciona **cómo entra el
> duelo a la Arena**, que es la superficie donde vive. Falta la matriz de estados de la Arena."*

---

## 0. Lo que ya existe y se reusa (auditado, no supuesto)

| pieza | archivo | por qué sirve tal cual |
| --- | --- | --- |
| Tablero | `components/arena/arena-board.tsx` | **Totalmente presentacional**: recibe `pieces`, `legalMoves`, `onSquareClick`, `isLocked`. Y `playerColor="b"` **ya voltea el tablero**, que el duelo necesita y la IA no usaba con invitados |
| Promoción | `components/arena/promotion-overlay.tsx` | `onSelect(q\|r\|b\|n)` / `onCancel`. Sin esto el movimiento es irreproducible |
| FEN → piezas | `lib/game/arena-utils.ts` → `fenToPieces` | Ya existe, ya tolera un FEN inválido |

⛔ **Nada de esto se copia.** Un tablero nuevo sería una segunda geometría que ningún test
compara con la primera → [[feedback_duplicated_geometry_passes_every_behavioural_test]].

---

## 1. La URL es FIJA y no se discute

```
/[locale]/arena?duel=<id>
```

⛔ **No se puede cambiar a `/duel/<id>`.** El único P0 del red-team —*"el enlace sobrevive al
login"*— se cerró **midiendo esta URL exacta** en un teléfono con el redirect de Google. Mover la
ruta invalida esa medición y hay que rehacerla en un dispositivo real.

**Dónde vive el código, en cambio, sí es una decisión:** `arena/page.tsx` tiene **1655 líneas** y
corre la partida contra la IA. La propuesta es un **return temprano** al principio de
`ArenaPageInner`: si hay `?duel=`, montar `<DuelArena id={...} />` y no ejecutar nada del árbol de
la IA. La URL queda igual; el archivo grande no crece.

---

## 2. Los ocho estados

Todos son función de `(duelPublic, miCredencial)` — no hay estado de UI que el servidor no pueda
reconstruir, salvo la interpolación del reloj.

| # | estado | condición | tablero | CTA |
| --- | --- | --- | --- | --- |
| S0 | **Cargando** | primer GET en vuelo | esqueleto | — |
| S1 | **No existe** | 404 | — | volver a PLAY |
| S2 | **Invitando** | `awaiting-opponent` · `you ≠ null` | posición inicial, bloqueado | **Compartir enlace** |
| S3 | **Invitado** | `awaiting-opponent` · `you = null` | posición inicial, bloqueado | **JOIN** |
| S4 | **Tu turno** | `active` · `yourTurn` | **desbloqueado** | rendirse |
| S5 | **Turno del rival** | `active` · `you ≠ null` · `!yourTurn` | bloqueado | rendirse |
| S6 | **Mirando** | `active` · `you = null` | bloqueado | — |
| S7 | **Terminado** | `finished` | bloqueado, posición final | volver a PLAY |
| S8 | **Vencido** | `expired` | bloqueado | volver a PLAY |

⚠️ **S6 no es una fuga.** El enlace reenviado con la partida empezada da sólo lectura; el spec lo
llama *"el germen de D3"*. `you` es `null` y `yourTurn` es `false`, resueltos en el servidor.

---

## 3. Las transiciones

```
S0 ─┬─ 404 ──────────────► S1
    ├─ awaiting + asiento ► S2        (yo invité)
    ├─ awaiting + libre ──► S3        (me invitaron)
    ├─ active ───────────► S4 / S5 / S6
    ├─ finished ─────────► S7
    └─ expired ──────────► S8

S3 ─┬─ JOIN ok ──────────► S4 o S5    (según el color que sorteó el creador)
    ├─ 409 seat-taken ───► S6         "alguien se te adelantó", NO es un error
    ├─ 410 not-joinable ─► S8
    └─ alreadySeated ────► S2/S4/S5   (el creador abriendo su propio enlace)

S2 ─┬─ poll ve active ───► S4 o S5
    └─ poll ve expired ──► S8

S4 ─┬─ jugada aplicada ──► S5  (o S7 si hubo mate/tablas)
    ├─ illegal-move ─────► S4  aviso transitorio, la posición NO cambia
    ├─ not-your-turn ────► S5  el servidor sabe más que yo; adoptar su estado
    └─ version-conflict ─► S4/S5/S7  ⛔ adoptar el duelo fresco de la respuesta

S5 ─┬─ poll ve la jugada ► S4
    └─ poll ve el final ─► S7        (mate, tablas, rendición o BANDERA)

S4/S5 ── rendirse ──────► S7
```

⛔ **`version-conflict` NUNCA se reintenta solo.** La ruta ya devuelve el estado fresco; la
Arena lo **adopta** y deja que decida un humano. Reaplicar una jugada de ajedrez contra una
posición que cambió abajo es como se corrompe una partida sin que nada parezca roto.

---

## 4. Edge cases POR ESTADO

### S2 — Invitando

- ⛔ **El enlace se arma desde el `id` y con el host de PLAY absoluto.** Nunca desde
  `window.location.href`: después del login la barra arrastra el `privy_oauth_code` del invitador,
  y un enlace relativo abierto desde el host de LEARN rebota cross-domain, donde la cookie del
  asiento no viaja. Las dos razones están **medidas** (Etapa 4).
- Sin `navigator.share` (desktop, o navegador in-app que no lo expone) → **copiar al portapapeles**
  con confirmación visible. Nunca un botón que no hace nada.
- La hora de la invitación se agota mientras miro → S8, y **el botón de compartir desaparece**:
  compartir un enlace muerto es peor que no ofrecerlo.
- Recargo la página → la credencial sale del **localStorage**, no de la cookie (ver §5).
- ⚠️ **Cuenta regresiva de la invitación**: se muestra, y es la única cuenta en este estado. Los
  relojes de ajedrez todavía no corren — `lastMoveAt` es `null` hasta que alguien se sienta.

### S3 — Invitado

- **Soy el creador abriendo mi propio enlace** → la ruta responde `alreadySeated: true` y **no**
  emite una segunda credencial. La UI no debe mostrar JOIN.
- **Doble tap en JOIN** → el servidor es idempotente, pero el botón se deshabilita en vuelo igual:
  dos requests que ganan los dos serían dos cobros de latencia sobre el mismo asiento.
- **Sin sesión web** → se monta el `WebAccessGate` que ya existe. ⛔ **Nunca ocupa un asiento**, y
  el enlace sobrevive al login (medido). Ve de qué duelo se trata y quién invita (comportamiento 4).
- **Alguien se sienta en el mismo instante** → 409 `seat-taken`, que se lee *"alguien se te
  adelantó"*, no *"algo falló"*. Pasa a S6.

### S4 — Tu turno

- **Peón llegando a la última fila** → `PromotionOverlay`. El SAN lleva la pieza (`e8=Q`).
  **Cancelar** limpia la selección y **no manda nada**.
- **Toco una pieza que no es mía, o sin movimientos legales** → no pasa nada. El cliente filtra por
  UX; su opinión no cuenta (comportamiento 9), el servidor decide.
- ⛔ **Mi reloj llega a 0 en pantalla** → el contador **se queda en 0** y se dispara un GET
  inmediato. **La derrota NO se declara localmente.** El reloj del cliente no participa de la
  cuenta; sólo el servidor materializa la bandera, y una derrota pintada por el cliente que el
  servidor no confirma es un número que el jugador no puede reconciliar
  → [[feedback_an_unauditable_number_reads_as_a_lie]].
- **Falla la red a mitad de la jugada** → ⛔ **re-GET, nunca re-POST.** Con la versión vieja el CAS
  lo rechazaría (inofensivo), pero si la primera sí aplicó, un reintento con la versión NUEVA
  jugaría dos veces. Ante cualquier error: refrescar y que decida el jugador.

### S5 — Turno del rival

- **Cadencia del poll: ~3 s mientras `active`.** ⚠️ El reloj **no** exige polear más seguido: el
  cliente conoce `lastMoveAt` y de quién es el turno, así que dibuja solo. El poll es sólo para
  enterarse de la jugada del rival.
- **Pestaña oculta** (`visibilitychange`) → backoff. Volver a foco → un GET inmediato.
- **El reloj del rival llega a 0** → misma regla que S4: disparar un GET, **no** cantar la victoria.

### S6 — Mirando

- Sin CTA, sin rendirse, sin tablero interactivo. Poll igual que S5.

### S7 — Terminado

- Cuatro finales, y cada uno con su copia: **mate · rendición · tiempo · tablas** (con sus cuatro
  razones: ahogado, material insuficiente, repetición triple, 50 movidas).
- ⛔ **No se otorga NADA.** Ni Peones, ni ranking, ni insignias, ni Season Pass. El día que un
  resultado de duelo decida algo con valor, el spec padre deja de valer y hay que incluir
  server-verified progress.
- **Revancha está fuera de alcance** → la única salida es volver a PLAY.
- El poll **se detiene**. Un duelo terminado no cambia más.

### S8 — Vencido

- **Sin ganador**, y la copia lo dice: nadie contestó. Nunca contestar un enlace no es una derrota.

---

## 5. Transversales

**Dónde vive mi credencial.** `localStorage`, con clave por duelo (`chesscito:duel:<id>:seat`),
**además** de la cookie. ⚠️ El body es el camino **principal**: la cookie no sobrevive el salto
de navegador in-app → navegador del sistema, ni el rebote cross-domain del modo `learn`.

**Interpolación del reloj.** Para el asiento de turno se dibuja
`remainingMs − (now − lastMoveAt)`; el otro queda quieto. Un solo `setInterval` por pantalla.

**El poll se detiene** en S1, S7 y S8. Un duelo terminado no vuelve a cambiar.

---

## 6. Decisiones del founder (2026-08-15) — CERRADAS

**1. La entrada es una CUARTA opción en el selector de rival de PLAY**, junto a Easy / Medium /
Hard (`arena-select-scaffold.tsx`). Es donde el jugador ya está eligiendo rival, así que no hay
que enseñarle un lugar nuevo.

```
┌──────── ELEGI RIVAL ────────┐
│  [ EASY ]  [ MEDIUM ]       │
│  [ HARD ]  [ 👥 UN AMIGO ]  │
└─────────────────────────────┘
```

**2. El reloj se elige ANTES de compartir.** Tocar *"un amigo"* abre la escalera `−`/`+`; recién
al confirmar se crea el duelo y aparece el enlace. Un solo momento de decisión, y **el invitado
ve el reloj ya fijado** — no puede cambiarle las reglas después de que miró el enlace.

```
┌─── PARTIDA CON UN AMIGO ────┐
│      ─   10 min   +         │
│   [  CREAR Y COMPARTIR  ]   │
└─────────────────────────────┘
```

⚠️ **Consecuencia para S2:** la escalera **no** vive en la pantalla de invitación. Una vez creado
el duelo, el reloj es inmutable — y eso ya es cierto en la base, porque `initial_minutes` y los
dos `remaining_ms` se escriben al crear y ninguna ruta los cambia.

---

## Criterios de aceptación

- [ ] Abrir `/arena?duel=<id>` sin credencial y con asiento libre muestra JOIN, y **sólo** eso.
- [ ] El creador abriendo su propio enlace **no** ve JOIN y **no** ocupa el segundo asiento.
- [ ] El enlace para compartir contiene el `id` y el host de PLAY, y **nunca** `privy_oauth_code`.
- [ ] El tablero está bloqueado en S2, S3, S5, S6, S7 y S8; desbloqueado **sólo** en S4.
- [ ] Un peón en la última fila abre la elección de promoción, y cancelar no manda ninguna jugada.
- [ ] Un `version-conflict` adopta el estado fresco y **no** reenvía la jugada.
- [ ] Con el reloj local en 0 la UI **no** declara un resultado: dispara un GET y espera al servidor.
- [ ] El poll se detiene en `finished` y en `expired`.
- [ ] El tablero se ve desde el lado del jugador cuando su asiento es negras.
