# ¿Los que pagaron no hicieron el daily, o no hicieron nada?

**Fecha:** 2026-08-27 · **Alcance:** los 24 compradores (17 pase + 7 PRO) · **Read-only**

La pregunta del founder tenía tres respuestas posibles, y cada una significa algo distinto:
alguien motivado que compró y ejecutó; alguien que estuvo activo pero **no entendió la
acción que se le pedía**; y alguien que compró y **no volvió**. La tercera es la más cara,
porque sugiere que el producto no comunicó ni siquiera que había algo que hacer.

**La respuesta es que casi nadie desapareció.** De 24 compradores, **22 jugaron.**

---

## Cómo se midió

⛔ **`welcome_pack` NO cuenta como actividad.** Se acredita solo, y lo tienen **7.364
wallets** — o sea todas. Contarlo haría que cualquiera que abrió la app pareciera jugador.
`pack_purchase` tampoco: es la compra misma, no jugar.

Cuenta como actividad: `daily_tactic`, `exercise_completion`, `labyrinth_completion`,
`hint`, `coach`, `shield`, `save_game`, y las partidas de `score_saves`.

⚠️ `analytics_events` no se pudo usar: guarda `account_ref` (HMAC de la wallet), no la
wallet, así que no se puede unir sin el secreto. Todo lo de abajo sale de tablas que sí
llevan wallet, que además son señales de **acción**, no de render.

---

## El resultado

| Cohorte | Grupo | Personas | Acciones de juego | Partidas |
| --- | --- | ---: | ---: | ---: |
| **PASE** | A. hizo el Focus Day | **7** | 98 | 119 |
| **PASE** | B. jugó, pero NUNCA el Focus Day | **9** | 73 | 75 |
| **PASE** | C. no hizo NADA | **1** | 0 | 0 |
| **PRO** | A. hizo el Focus Day | **2** | 90 | 63 |
| **PRO** | B. jugó, pero NUNCA el Focus Day | **4** | 22 | 29 |
| **PRO** | C. no hizo NADA | **1** | 0 | 0 |

**Sólo 2 personas de 24 compraron y no tocaron nada.** El resto entró y jugó: 283 acciones
de juego y 286 partidas guardadas entre todos.

⚠️ Corrección al handoff anterior: **PRO son 7 personas, no 8** — eran 8 *filas*, y una es
una **renovación**. Es la única recompra de todo el producto: **el pase tuvo 0 renovaciones
en 17 ventas.**

---

## ⛔ Lo que esto cambia

La lectura anterior era "10 de 17 compradores nunca jugaron un día", y sonaba a gente que
compró por impulso y se fue. **Es falso como retrato de comportamiento.** Esos 10 no
estuvieron ausentes: **13 de los 24 jugaron sin registrar jamás un Focus Day.**

El problema no fue que no vinieran. Fue que **lo que hicieron no era lo que contaba.**

### Por qué no contó — y acá está lo importante

De los compradores **sin ningún Focus Day** que sí hicieron la táctica diaria, mirando
cuándo la hicieron:

| Caso | Tácticas | Personas |
| --- | ---: | ---: |
| 1. Antes de que el ledger existiera (2026-07-28) | 8 | 5 |
| 2. Antes de comprar — todavía sin derecho | 1 | 1 |
| 3. ⛔ **Con ledger vivo y ya comprado: debió contar** | **3** | **3** |

Los casos 1 y 2 son correctos: el caso 1 es un **artefacto de medición** (el ledger no
existía; ninguna de esas tácticas podía registrarse) y el 2 es la regla funcionando.

**El caso 3 no.** Tres personas hicieron la táctica diaria **teniendo el pase y con el
ledger vivo**, y no se les registró un Focus Day.

### La causa más probable: el Focus Day sólo cuenta en LEARN

`use-focus-day-recorder.ts:92`:

```ts
const canWrite = CHESSCITO_LITE_MODE && Boolean(wallet) && entitlementActive;
```

⚠️ **Hipótesis, no hecho probado.** No se puede confirmar desde la base en qué deploy
jugaron: haría falta cruzar `analytics_events`, que sólo guarda `account_ref`. Pero el
código dice que un Focus Day **sólo se escribe en el deploy de LEARN**. Alguien que compró
el pase y hace su táctica diaria en **PLAY** gana Peones, ve su racha… y su reto de 21 días
no avanza. Nada en pantalla se lo dice.

Si es eso, no es que no entendieron: **hicieron la acción correcta en el lugar equivocado, y
el producto no tenía forma de avisarles.**

---

## Lo que yo leo de esto

**1. La motivación existía y se subestimó.** 22 de 24 compradores jugaron. El problema del
pase nunca fue que la gente comprara y se fuera; fue que **la única acción que definía el
producto era invisible o inalcanzable** para más de la mitad de quienes pagaron.

**2. Pausar sigue siendo correcto, por una razón distinta a la que creíamos.** No se pausó
porque los compradores fueran fantasmas. Se pausó porque **vendíamos un reto de 21 días cuyo
contador no se movía aunque el jugador viniera todos los días.** Eso es peor, y es más
arreglable.

**3. La pregunta para el rediseño ya no es "cómo conseguimos gente motivada".** Es: **¿por
qué la acción que cuenta no es la acción que el jugador cree que está haciendo?** Si el
Focus Day se registrara desde ambos deploys, o si la card dijera "esto no cuenta acá",
7 de esas 13 personas podrían haber estado en el grupo A.

**4. Hay UNA renovación de PRO y CERO del pase.** Con números tan chicos no es una
conclusión, pero es la única señal de recompra que existe, y no está del lado del pase.

---

## Qué haría falta para cerrarlo

1. **Confirmar la hipótesis del deploy.** Requiere calcular el `account_ref` (HMAC) de esas
   3 wallets y cruzarlo con `analytics_events` para ver desde qué host jugaron. Es la única
   forma honesta de pasar de "probable" a "medido".
2. **Decidir si el Focus Day debe contar en PLAY.** Es una decisión de producto, no un bug:
   el código lo restringe a propósito. Pero si el pase vuelve, esta es la pregunta que hay
   que responder antes.
3. ⚠️ **Cualquier reemplazo del pase debe registrar su progreso donde el jugador ya está**,
   no sólo donde el producto espera que esté.
