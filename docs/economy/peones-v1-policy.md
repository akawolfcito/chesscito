# Peones — Economy V1

**Vigente desde:** 2026-07-21
**Estado:** política activa. Supersede las calibraciones de Sprint 3/4 y las
recalibraciones del 2026-06-10 y 2026-06-11 en todo lo que contradiga este documento.

Este documento es la fuente canónica de **cuánto se gana, cuánto cuesta y por qué**.
Los precios ejecutables viven en `apps/web/src/lib/peones/spend-service.ts`
(`SPEND_COST_BY_TARGET`) y `apps/web/src/lib/peones/types.ts` (`PEONES_DAILY_CAP`);
si este documento y el código se contradicen, **manda el código** y este archivo está
desactualizado.

---

## Valor de referencia

- **50 Peones = USD 0.50** (pack `peones_pack_50`, el único pack).
- **1 Peón ≈ USD 0.01**, como referencia interna de pricing.
- Los Peones **no son canjeables**: no son dinero, no son saldo fiat, no son stablecoin.
- Los Peones **no son score competitivo**: no afectan el leaderboard, no compran Stars
  ni Focus Points, no dan ventaja competitiva.

Los Peones se ganan lento y se gastan en ayudas opcionales. El progreso normal del
juego nunca debe convertirse en farming.

---

## Fuentes vigentes

| Fuente | Recompensa | Frecuencia |
| --- | --- | --- |
| Welcome | +1 | Una sola vez por wallet |
| Daily Tactic | +1 | Por día UTC |
| Entrenamiento | +1 | Por cada **5 ejercicios nuevos** completados |
| Laberintos | 0 | — |
| Juegos lúdicos | 0 | — |
| Compra | +50 | Por USD 0.50 |

**Cap gratuito: 3 Peones por wallet / día UTC** sobre el conjunto de fuentes capeadas.
Los milestones de ejercicios comparten ese techo con el Daily.

### Milestones de entrenamiento

`rewardTier = floor(ejerciciosÚnicosCompletados / 5)`. Se acredita +1 al alcanzar un
tier nuevo: el 5.º ejercicio, el 10.º, el 15.º, y así indefinidamente.

**No pagan:** un ejercicio individual, una repetición, una mejora de estrellas sobre un
ejercicio ya completado, ni volver a completar contenido ya contado. Las estrellas son
la señal de maestría; los Peones son moneda.

La idempotencia es por tier: `exercise_milestone:{wallet}:{tier}`. El índice único
global sobre `peones_ledger.idempotency_key` garantiza que cada grupo de cinco se pague
**una sola vez por wallet, para siempre** — reintentos, doble tap y re-cruces del mismo
umbral colapsan en la misma fila.

### Fuentes retiradas

`labyrinth_completion`, `daily_lab`, `daily_streak_bonus` y `admin_grant` fueron
**quitadas del allowlist público** de `POST /api/peones/earn`. Las tres primeras no
tenían caller vivo o dejaron de pagar; `admin_grant` además salteaba la validación de
prefijo y aceptaba hasta 50 Peones por llamada desde una ruta pública sin autenticación.

Los literales siguen en el enum y en el CHECK de SQL: sacarlos exigiría una migración
destructiva y las filas históricas son válidas. Lo que cambió es qué acepta el endpoint.

Un juego o evento futuro puede entregar Peones **solo mediante una regla explícita
diseñada para ese evento**. No existe —ni debe construirse por defecto— un sistema
genérico de promociones.

---

## Consumos vigentes

| Sink | Precio | Nota |
| --- | --- | --- |
| Hint | **2** | El más barato; se toma varias veces por sesión |
| Shield rescue | **5** | Salva un ejercicio, no un día entero |
| Coach analysis | **10** | El único sink con costo real de LLM por llamada |

La jerarquía **hint < shield < coach** es política, no casualidad aritmética. La tabla
anterior (1 / 2 / 1) hacía que un análisis LLM completo fuera lo más barato del juego.
Un test la fija explícitamente.

El orden de consumo del Coach **no cambió**: créditos Redis → PRO → Peones → paywall.
Las cuotas de bypass de PRO tampoco cambiaron.

### Sinks retirados

`retry` y `save_game` salieron de `PEONES_SPEND_TARGETS`. Ambas acciones son **gratis**
en el producto: el retry vivo nunca cobró y el guardado básico es incondicionalmente
gratuito desde el 2026-07-08. Un target gastable cuya acción es gratis solo sirve para
quemar saldo por algo que el jugador no compró.

---

## Reglas

- No hay recompensa por repeticiones.
- No hay Peones por leaderboard.
- No se compran Stars, score ni Focus Points.
- Los juegos especiales futuros requieren una política explícita.
- No se agregan packs ni sinks nuevos en esta versión.

---

## Divergencia de balance con PRO bypass (corregida)

Una fila de spend con `pro_bypass = true` se registra para auditoría y para la cuota
diaria, con `debited = 0`, y **no reduce el balance**. Así lo hacen la vista
`peones_balances` y la RPC `peones_spend` desde Sprint 4.

`peones_balance_with_caps` —la función que leen el HUD, `GET /api/peones/balance` y el
endpoint de earn— perdió esa cláusula: las migraciones `20260610010000` y
`20260611010000` la recrearon desde un cuerpo viejo con
`when event_type in ('spend','rollback') then -amount`. Resultado: un suscriptor PRO
veía su saldo bajar sin pagar nada, divergiendo cada vez más de lo que realmente podía
gastar, y podía llegar a ver un negativo que ningún gasto causó.

La migración `20260721030000_peones_v1_economy.sql` restaura la cláusula y baja el cap
a 3 en el mismo `CREATE OR REPLACE`. `computeLedgerBalance` (el gemelo TypeScript) hace
lo mismo. `schema-sync.test.ts` ahora falla si un futuro reemplazo vuelve a perderla.

**Regresión cubierta:** earn 10 → spend normal 2 → spend con bypass 5 ⇒ balance **8**,
y el balance mostrado coincide con el saldo gastable.

---

## Riesgos conscientemente diferidos

Ninguno de estos se resuelve en V1. Están listados para que la próxima persona no los
descubra como sorpresa:

1. **Autenticación y ownership de wallet** en earn/spend. Ambos endpoints son públicos
   y no verifican que quien postea controle la wallet. Es el riesgo más grande abierto.
2. **Earn server-authoritative.** El conteo de ejercicios únicos se deriva del progreso
   durable **en el dispositivo** (`getExercisesCompletedCount`, localStorage). Ver la
   limitación abajo.
3. **Cap concurrentemente seguro.** El cap se lee y se aplica en dos pasos; dos earns
   concurrentes pueden observar el mismo headroom. Acotado por las keys idempotentes
   (un Daily por día, un tier por milestone), así que el peor caso es chico y se
   autolimita. Una reescritura transaccional queda fuera de alcance.
4. **Reservation / commit / rollback** de fulfillment, y refunds automáticos.
5. **Recuperación de pagos legacy.**
6. **Reason codes** en las respuestas de error.
7. **Cap semanal.**
8. **Cosméticos y themes.**
9. **Eventos especiales / promociones.**

### Limitación conocida del milestone de ejercicios

No existe hoy un total durable **server-side** de ejercicios únicos completados: el
progreso vive en `localStorage` por pieza y el cliente es quien lo cuenta. Construir
una tabla de progreso nueva era una reescritura server-authoritative completa, fuera de
alcance para este commit.

Qué protege igual, y qué no:

- **Un tier no se puede cobrar dos veces**, ni siquiera borrando el almacenamiento
  local: la key es el tier y el índice único es global y permanente. Un jugador que
  limpia su progreso y vuelve a cruzar el 5.º ejercicio recibe `duplicate: true`.
- **Un cliente manipulado puede reclamar tiers antes de tiempo** escribiendo un conteo
  falso en `localStorage`. Es exactamente el mismo modelo de confianza que ya tenía el
  earn (cliente-driven, sin autenticación), no una regresión — pero se cierra recién
  con el punto 1 y 2 de la lista de arriba.
