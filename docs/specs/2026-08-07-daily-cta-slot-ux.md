# Ronda de UX — el slot del CTA de la ChallengeCard

**Fecha:** 2026-08-07 · **Diseñadora:** Sally · **Alcance:** cerrado por el founder
**Superficie:** `.challenge-card-cta-row` + la nota inmediata debajo. Nada más.
**Restricciones:** cero altura nueva · estático · sin CTA secundario · 390px · MiniPay.

---

## 0. El hallazgo que cambia el diagnóstico

El estado muerto no sólo *parece* tocable. Parece **roto**.

```css
.challenge-card-cta--info {
  cursor: default;
  filter: saturate(0.55) brightness(0.94);   /* ← desaturado */
  opacity: 0.92;                              /* ← atenuado */
}
```
`globals.css:8849`

Desaturar + atenuar + conservar la forma de botón es, literalmente, **el vocabulario
universal de un botón deshabilitado**. No estamos diciendo "esto es información".
Estamos diciendo *"acá hay un botón y no te funciona"*.

Y ese mensaje llega **en el instante posterior a un éxito**. El jugador completa su
Diaria, vuelve al hub, y lo primero que su ojo encuentra es un control apagado. La
lectura emocional no es "terminé": es "algo se rompió, o algo se me acabó".

**Esto reencuadra el arreglo.** El problema no es "falta un destino". Es que el slot
tiene **dos naturalezas** (acción / información) y hoy las viste como **un mismo objeto
en dos estados de salud** (encendido / apagado). Eso está al revés. Una acción y una
información no son el mismo objeto sano y enfermo: son **dos objetos distintos**.

---

## 1. Copy del CTA por variante

Regla de escritura que propongo, y la defiendo: **el botón nombra la cosa, no el ánimo.**

Con cero altura nueva y una sola línea, ese label es *todo* lo que el jugador tiene para
saber qué hay del otro lado. "Seguir entrenando" es un sentimiento. "Probar laberinto"
es un lugar. En una pantalla de 390 px donde cada palabra compite por aire, un sustantivo
concreto rinde más que un verbo motivacional.

| Variante | EN (base) | ES | Notas |
|---|---|---|---|
| `daily-pending` | `Today's Focus` | `Enfoque de hoy` | Ya existe. No tocar. |
| `claim-pending` | `Claim your gift` | `Reclama tu regalo` | Recompensa pendiente: gana a todo lo demás. |
| `continue-path` | `Keep training` | `Sigue entrenando` | Aquí sí el verbo: no hay una "cosa" nueva que nombrar, es continuar. |
| `labyrinth-ready` | `Try the labyrinth` | `Probar laberinto` | ⚠️ ES sin artículo: 16 car. vs 19. Entra sin partirse. |
| `improve-stars` | `Beat your score` | `Mejora tu marca` | Nombra la mecánica (estrellas) sin decir "estrellas", que ya vive en la ruta. |
| `next-piece` | `New piece` | `Nueva pieza` | El más corto posible. La pieza concreta ya se ve abajo en la ruta. |
| `view-progress` | `See your progress` | `Ver tu progreso` | Fallback terminal navegable. |

**Techo de caracteres:** ninguno pasa de 18 en ES. El label más largo hoy en producción
es `Enfoque de hoy` (14) y respira. `Reclama tu regalo` (17) es el techo real que hay que
verificar en device.

⚠️ **`Daily` → `Diaria`**, nunca "Diario". Ya es vocabulario cerrado del producto.

⚠️ **No usar los `ctaES` que ya trae `content-loop.ts`.** Son de otra época y otro tono
("Continúa", "Prueba el laberinto"), y viajan **fuera de next-intl**, así que el guard de
paridad del bundle no los cubre. Copy nueva, por next-intl, bajo el guard.

---

## 2. La línea de nota: se muere en los estados accionables

Hoy dice: *"El entrenamiento sigue abierto. Sigue mejorando tus marcas."* — dos líneas en
pantalla chica.

Si el botón de arriba dice **`Sigue entrenando`**, esa nota está diciendo lo mismo otra
vez, más largo y más abajo. Es relleno. **Fuera.**

| Estado | Nota |
|---|---|
| Cualquier variante **con destino** | *(ninguna — el botón ya lo dijo)* |
| `come-back-tomorrow` | `Tu Diaria vuelve mañana` |
| `daily-limit-reached` | `Tu Diaria vuelve mañana` |
| `daily-max-reached` | `Tu Diaria vuelve mañana` |

**Esto devuelve aire en vez de gastarlo.** En el caso accionable —que es el que más se
va a ver— el slot pasa de dos líneas a una. En el terminal se queda en dos, pero la
segunda baja de dos renglones a uno.

Una sola frase, un solo dato: **cuándo vuelve la actividad**. Nada de "sigue mejorando
tus marcas": si hay marcas que mejorar, eso no es una nota, es el botón (`improve-stars`).

---

## 3. El estado terminal: dejar de disfrazarlo de botón

**No es un botón deshabilitado. Es una leyenda.** Se va todo lo que lo hace parecer un
control:

- ⛔ Fuera `filter: saturate() brightness()` y `opacity` — el vocabulario de "roto".
- ⛔ Fuera el fondo, el borde y la sombra de botón.
- ✅ Texto centrado en el marrón apagado que ya existe en la tarjeta (`#7d5a2a`, el mismo
  de `.challenge-card-cta-note`).
- ✅ Peso normal o medio, **no bold de botón**. La jerarquía baja a propósito.
- ✅ **`min-height` igual a la del botón.** El slot conserva su caja exacta.

⚠️ **Ese `min-height` no es cosmético: es el seguro anti-CLS.** Ese anchor es donde vivía
el 0,179 que se cerró ayer. Si el terminal colapsa a la altura del texto, la tarjeta
cambia de alto entre estados y el layout salta. **La caja se reserva siempre.**

El resultado es que el jugador ve un espacio **tranquilo**, no un espacio **averiado**.
La diferencia entre "acá no hay nada que hacer ahora" y "acá algo falló" es exactamente
esta decisión.

---

## 4. ¿Hace falta un `DAILY COMPLETE ✓`? — **Confirmo al founder: no.**

Y agrego el argumento que creo que es el bueno, más fuerte que la redundancia:

**La felicitación ya ocurrió, y ocurrió mejor.** El sistema de overlays de celebración
ya le dio al jugador su momento —headline arqueado, el lobo, el flash de "WELL DONE"—
en la pantalla del ejercicio, con toda la superficie disponible. Para cuando aterriza en
el hub, ese beat **ya se cobró**.

Repetirlo acá en una línea de texto plano no lo refuerza: lo **abarata**. Una celebración
grande seguida de una chiquita se lee como un eco, y el eco siempre suena a menos.

Sumale que el PASAPORTE DE FOCO ya lleva el registro (la V con la llama encendida) y
"Racha de 1 día" ya lleva la cuenta. Tres testigos del mismo hecho es dos de más.

**El hub no es donde se celebra. Es donde se decide qué sigue.** Que el slot haga sólo eso.

---

## 5. Riesgos del swap `<p role="status">` → `<button>`

### 🔴 P0 — `role="status"` es una live region, y se pierde en silencio

`role="status"` = `aria-live="polite"`. Hoy, cuando ese texto cambia, **un lector de
pantalla lo anuncia solo**. Un `<button>` no anuncia nada al aparecer.

Mi lectura: **está bien perderlo acá**, porque el anuncio correcto de "completaste tu
Diaria" pertenece al flujo de celebración, no a una tarjeta del hub que el jugador
todavía no está mirando. Pero tiene que ser una **decisión escrita**, no un efecto
lateral. Y hay que revisar si algún test lo fija — sé que existen dos que documentan
este estado a propósito.

### 🟠 P1 — Memoria muscular: el slot cambia de significado, no sólo de estado

El jugador con pase aprendió que ese lugar, después de su Diaria, **no hace nada**.
Muchos ni lo van a mirar. La conversión no va a ser inmediata y **eso no es un fallo del
diseño**: es el costo de haber enseñado durante meses que ahí no había nada. Se recupera
solo. No agregar un badge "¡Nuevo!" para forzarlo — sería exactamente el relleno que el
founder acaba de sacar.

### 🟠 P1 — El destino tiene que ser indulgente

El jugador que toca por inercia no eligió ese destino: se lo propusimos nosotros. Que
aterrice en un lugar del que **se pueda salir en un tap** (la pantalla de ejercicios de
la pieza), nunca en un puzzle específico que arranque un intento y le consuma cuota.

### 🟢 P2 — Orden de foco y el mini-tour

Aparece un elemento focuseable nuevo en el orden de tabulación. Y el mini-tour ilumina
**esa fila** (`data-tour-target="challenge"`, con la flecha como hermana): un botón real
ahí es **mejor** para el tour que una losa, porque la flecha por fin apunta a algo que se
puede tocar.

### 🟢 P2 — El estado `complete` (reto de 21 días terminado)

No lo tocamos en este sprint, pero queda dicho: ese jugador **terminó el producto**.
Mostrarle la misma leyenda gris que a alguien que sólo hizo su Diaria de hoy es
desperdiciar el único momento en que alguien completó las tres semanas. Merece su propia
ronda. **No acá.**

---

## Resumen de lo que cambia en el slot

```
ANTES (con pase, Diaria hecha)          DESPUÉS
┌──────────────────────────┐            ┌──────────────────────────┐
│ ┌──────────────────────┐ │            │ ┌──────────────────────┐ │
│ │   Vuelve mañana      │ │  ← botón   │ │  PROBAR LABERINTO    │ │ ← botón REAL
│ └──────────────────────┘ │    apagado │ └──────────────────────┘ │
│ El entrenamiento sigue   │            │                          │ ← nota: fuera
│ abierto. Sigue mejorando │            └──────────────────────────┘
│ tus marcas.              │
└──────────────────────────┘            TERMINAL (nada que hacer)
                                        ┌──────────────────────────┐
                                        │    Vuelve mañana         │ ← leyenda, sin caja
                                        │  Tu Diaria vuelve mañana │
                                        └──────────────────────────┘
                                          (misma altura reservada)
```

**Altura neta: igual o menor. Nunca mayor.**
