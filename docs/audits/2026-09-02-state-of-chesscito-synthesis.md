# Estado de Chesscito — síntesis y cómo seguir

**Fecha:** 2026-09-02 · **Tipo:** síntesis de auditorías read-only. Sin implementación.
**Se apoya en:** `2026-09-02-{telemetry-verified-and-real-state, where-they-quit-and-why-they-return, unread-experiment-result}.md`, `2026-09-01-farcaster-feasibility.md`, `2026-08-28-core-loop-diagnostic.md`, y dos barridos de código.

---

## 0. Corrección importante que me debo a mí mismo

Ayer escribí que el duelo era **asincrónico por link** y construí sobre eso el argumento
*"hay alguien esperando tu movimiento, por eso volvés mañana"*.

⛔ **Es falso, y el spec dice por qué.** El 2026-08-14 el duelo pasó de *asincrónico por
turnos (48 h por jugada)* a **una partida de una sentada con reloj de ajedrez**. Y lo pidió el
founder:

> *"el founder no quería partidas largas y propuso reloj «así nos evitamos adivinar». Tenía
> razón — las tres reglas que este spec inventaba (ganador por vencimiento, tablas por tiempo,
> guarda de abandono) eran soluciones caseras a un problema que el ajedrez resolvió hace 150
> años."*
> — `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md:7-17`

**Fue la decisión correcta** y no la estoy discutiendo. Lo que cambia es mi argumento: **una
partida de una sentada no crea una razón para volver mañana.** Yo estaba mezclando dos
mecanismos distintos y presentándolos como uno.

---

## 1. Lo que sabemos, en cinco hechos

| # | Hecho | Fuente |
|---|---|---|
| 1 | **La telemetría está sana.** 100% de cobertura de dimensiones, sin acantilados. | serie diaria |
| 2 | **93,4% juega un solo día.** 7.192 de 7.700 cuentas. El grupo que vuelve es ~30/día y es **plano**. | cohortes |
| 3 | **87,7% llega al tablero y mueve.** La fuga NO es la puerta ni la transición. | `first_move_made`, n=302 |
| 4 | **No hay banda de victoria.** En `easy` (la que elige casi todo el mundo): 29,7% gana, **50,8% tablas**, p50 **70 movimientos / 4m25s**. En `medium`/`hard` le hacen mate al jugador el 61–69%. | `arena_game_end`, 14 d |
| 5 | **Forzar la actividad del día 1 no retiene.** Experimento n=1.264: completar el Daily 26,4% → **60,2%**; volver otro día 6,0% → **4,6%**. | experimento retirado |

**El hecho 5 es el que manda**, porque descarta la explicación más obvia del hecho 2.

---

## 2. Las hipótesis vivas, después de la poda

- ❌ **"Que hagan algo el primer día"** — probado con n=1.264. No mueve la retención.
- ❌ **"Que lleguen al tablero"** — el 87,7% ya llega.
- ❓ **"Que la partida tenga un desenlace"** — no probado. Hoy el desenlace modal es un empate
  tras 70 movimientos. **[INFERENCIA]** Dos humanos producen partidas decisivas; una máquina
  de `easy` ajustada para no aplastar produce tablas largas.
- ❓ **"Que exista una razón para volver que viva fuera de la app"** — no probado, **y no
  construido**: el duelo de una sentada no la crea.

⚠️ **Son dos mecanismos distintos, y el duelo actual sólo ataca el primero.** Eso es lo que
ayer presenté mal.

---

## 3. El activo enterrado: el duelo está terminado y se puede probar HOY

Del barrido de código, verificado contra el código:

- **Está completo, no es prototipo.** Ajedrez entero, árbitro server-side autoritativo
  (`lib/duel/referee.ts`), CAS por `version`, reloj (3/5/10/15/30 min, default 10), polling de
  3 s en partida y 1,2 s esperando rival.
- **No necesita wallet.** La autoridad del asiento es un token de servidor de 128 bits
  (`seat-token.ts`).
- **En MiniPay el invitado no necesita ni login** — `WebAccessGate` no se monta ahí.
- ⛔ **Y el dato que cambia todo: el flag `NEXT_PUBLIC_ENABLE_DUEL` tapa UNA TARJETA.** Las
  cinco rutas de API y la Arena **no lo leen** — está escrito así a propósito
  (`duel-flag.ts:5-9`): *"a gate on the routes would break an invitation that had already been
  handed out"*.

> **Un link de duelo repartido hoy, en producción, se juega hoy en producción.**
> Sin deploy, sin prender ninguna bandera, sin escribir una línea.

**[HECHO] Se usó 16 veces en toda su historia. 1 partida terminada. 6 cuentas abrieron el
setup.** No hay evidencia sobre si funciona porque nunca se expuso.

---

## 4. Sobre "más vitrinas"

Tu instinto es correcto y quiero afinarlo con lo medido, no contradecirlo.

**A favor:** hoy tenés **exactamente un canal**. MiniPay es el 95–99% del tráfico y hay días
con **cero** sesiones de navegador. Un solo canal es una dependencia, no una estrategia.

**El matiz:** una vitrina nueva multiplica lo que el producto ya hace. Hoy eso es retener
6,6%. Poner el mismo embudo en más lados te trae más gente al mismo agujero — y eso es
literalmente lo que midió el experimento: más actividad, misma retención.

**Dónde tu instinto y los datos coinciden:** Farcaster no es "otra tienda". Es el único lugar
donde la vitrina y el problema de producto se tocan — porque ahí **la invitación ES el
contenido**. Un cast que dice "estoy jugando ahora, el primero que entra juega conmigo" es una
señal de *presencia*, y la presencia es justo lo que un duelo de una sentada necesita y un
link de WhatsApp no da. ⚠️ Pero eso es una hipótesis mía, no un dato.

---

## 5. Cómo seguir — mi recomendación

**Ordenado por costo, no por ambición.**

### 🥇 Probar el duelo esta semana, con cero código
Repartí links a gente real y jugá. Ya funciona en producción. Lo que querés saber no es si el
código anda — anda: **es si una partida contra una persona se termina**, cuando el 48% de las
partidas contra la máquina no se terminan. Con 20 duelos ya tenés señal.

⚠️ Hacelo en MiniPay: en web el invitado choca con el allowlist de Privy y queda en un
callejón sin salida, que está documentado como deuda aceptada (`duel-flag.ts:20-22`).

### 🥈 Un campo: `game_id` en `arena_game_end`
Es el requisito #1 del diagnóstico del 2026-08-28 y quedó a medias. Sin él "no terminó" se
infiere por ausencia. Con él sabés **en qué movimiento** se van. Es una línea.

### 🥉 Atacar el desenlace, no la puerta
El 50,8% de tablas en `easy` tras 70 movimientos es la hipótesis viva más barata y es **de
diseño de juego**, no de código. Acá sí conviene traer
`gds-agent-game-designer` — es exactamente su dominio.

### Después, y sólo después
Farcaster (`2026-09-01-farcaster-feasibility.md`). Sigue siendo el camino correcto para el
segundo canal, y el duelo sigue siendo la punta de lanza correcta. Pero **medí primero si una
partida entre personas se termina.** Si no se termina, un canal nuevo no lo arregla.

---

## 6. Deuda encontrada de paso (ninguna tocada)

| Qué | Dónde | Severidad |
|---|---|---|
| `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` sigue en **50** en producción sin ningún consumidor | el propio código pide ponerlo en 0 | cosmética, confunde |
| Venta del Season Pass pausada pero `verify-payment` **igual acredita** y loguea `season_pass_sold_while_sales_paused` | `api/verify-payment/route.ts:178` | ⚠️ revisar |
| Dos knobs muertos que nadie lee | `NEXT_PUBLIC_ENABLE_MINIPAY_RAWTX`, `NEXT_PUBLIC_QA_MODE` en `.env.template` | cosmética |
| `app_opened` inservible: 12.425 eventos, **10 cuentas** | se emite antes de `account_ref` | no usar en análisis |
| Estado real de `FOCUS_DAYS_LEDGER` y del tope de logins **no es determinable desde el código** (gana Redis / la fila) | por diseño | saberlo, no arreglarlo |

---

## 7. Lo último, que no es un dato

Pasaste de una idea parada quince años a **7.700 personas que la tocaron** y a un producto con
árbitro server-side, telemetría honesta y un monitor que se niega a estimar lo que no puede
medir. Eso último es raro y es lo que hizo posible todo este documento: casi nada de acá lo
descubrí yo, lo **leí** de instrumentos que alguien decidió construir bien.

El 93,4% no es un veredicto sobre el juego. Es un dato sobre un juego que todavía no tiene por
qué llamarte mañana — y ahora sabés cuál es la única hipótesis de retención que queda sin
probar, y que se puede probar esta semana repartiendo links.
