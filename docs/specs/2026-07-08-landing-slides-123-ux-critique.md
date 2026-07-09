# Landing slides 1/2/3 — UX critique (Sally, 2026-07-08)

Contra los goals en `2026-07-08-landing-slides-123-goals.md`.
Código: `apps/landing/src/components/onboarding/slide-bodies.tsx` · copy `lib/content/messages/en.ts`.

---

## El hallazgo que reordena todo

Los slides 2 y 3 tienen botón **NEXT**. No hay botón de compra. No existe
destino de conversión en ninguna de las dos pantallas.

Entonces el goal "por esto deberías adquirirlo" no se puede cumplir como está
escrito, porque *no hay dónde adquirirlo*. Estas pantallas no venden: **siembran
una idea que el visitante tiene que reconocer semanas después**, cuando el
paywall aparezca dentro del juego. Se ven una sola vez en la vida.

Eso cambia el criterio de diseño. No hay que meter el argumento de venta
completo en 390px. Hay que dejar **una idea que sobreviva al olvido**, por
pantalla. Una. Si el visitante sale del slide 2 recordando "el Season Pass es la
puerta a los 21 días", ganamos. Si sale recordando cuatro beneficios y un precio,
no recuerda ninguno.

---

## Slide 1 — el headline no es de esta pantalla

**Goal:** ajedrez + dos modos. Nada más.

**Hoy dice:** *"Turn chess into your daily focus ritual."* / *"Train your mind,
build consistency, and grow one move at a time."*

Eso es el pitch del **hábito**, que es el goal del slide 2. El slide 1 está
gastando su único momento de atención en un mensaje que la pantalla siguiente
repite mejor y con evidencia. Y no dice lo que sí tiene que decir: que hay dos
modos y que son dos caminos distintos.

Las pills `Learn` / `Play` cargan el mensaje entero de la pantalla, pero son dos
etiquetas sueltas sin sublabel. Leen como *features*, no como *modos*. El `Pill`
ya soporta `sublabel` (lo usa el slide 2) y acá está sin usar.

**Acoplamiento crítico:** `welcome-back.tsx` renderiza `slide1.headline` a
`text-2xl`, solo, sin support ni pills. O sea el mismo string tiene que funcionar
como orientación para un desconocido y como saludo para alguien que vuelve.
Son dos trabajos. **Recomiendo separar la key**: `welcomeBack.headline` propia.
Sin eso, cualquier reescritura del slide 1 arrastra la pantalla de regreso.

---

## Slide 2 — jerarquía plana y un bug de layout

**Goal:** qué es, cuánto vale, por qué lo querés.

1. **Las dos pills no son hermanas.** `Focus Passport / 21 focus days` es una
   *feature*. `Season Pass / $0.99` es el *producto con su precio*. Ponerlas lado
   a lado, mismo tamaño, mismo tono, convierte el precio en un atributo más y no
   en la propuesta. El producto no puede tener el mismo peso visual que su
   contenido.

2. **"unlock your reward path"** roza la promesa de valor monetario que el propio
   goal prohíbe. "Reward path" además es vago: no dice qué es ni de quién viene.
   El goal habla de *apoyo de la comunidad*; el copy no lo refleja.

3. **El footnote nombra PRO** antes de que PRO exista para el visitante. Está
   respondiendo una objeción que todavía nadie tiene. Ese argumento es el
   corazón del slide 3 — dejarlo allá, donde pega.

4. **El "por qué" no está.** Hábito, foco, decisiones, dispersión: nada de eso
   sobrevivió al copy. Es lo único que el visitante debería llevarse.

5. **Bug de composición:** `<div className="h-2 flex gap-2.5">` fija la altura del
   contenedor de pills en **8px**. Las pills desbordan. Después un `mt-6` en el
   footnote compensa a mano. Está sostenido con alambre.

---

## Slide 3 — la pantalla contradice su propio goal

**Goal:** esto es Coach PRO, cuesta $1.99, por esto lo elegís.

**Hoy dice:** *"Play free. Upgrade for Coach PRO."*

Dos problemas, y el segundo es serio:

1. **Lidera con Play**, no con PRO. La mitad del headline vende un producto que
   no es el de esta pantalla.

2. **Reintroduce "free"** — exactamente la palabra que el slide 4 eliminó, y por
   la misma razón por la que la eliminó. El visitante lee "Play free" en el slide
   3 y en el slide 4 le recomendamos Learn, que pasa por un Season Pass de $0.99.
   Es la **misma inversión de preferencia** que ya se corrigió una pantalla más
   adelante, reinstalada una pantalla antes. El slide 4 quedó blindado y el 3 le
   abre la puerta de atrás.

3. **El mejor argumento está enterrado.** "PRO includes Season Pass" vive como
   *label de una pill dorada*. Es la razón entera por la que PRO tiene sentido
   —te llevás los dos— y está tipografiada como un chip de HUD. Eso es un
   titular, no una etiqueta.

---

## Pregunta abierta del founder: ¿2→3 es el orden correcto?

**Sí, mantenerlo.** El visitante ve $0.99, lo entiende, y recién entonces aparece
$1.99 diciendo "incluye eso que acabás de entender". El ancla baja primero hace
que la inclusión se sienta como ganancia. Invertirlo obliga a explicar el Season
Pass dos veces: una dentro de PRO y otra como producto suelto.

---

## Esqueleto propuesto (los tres iguales)

Hoy cada slide inventa su propia estructura. Un carrusel se lee como *una* cosa,
no como tres. Propongo un molde común, y que la variación viva en el arte:

```
[ arte / avatar ]
[ título ]                 ← qué es
[ una frase ]              ← por qué te importa a vos
[ ─── divider ─── ]
[ evidencia ]              ← pills: 2 máx, jerarquía clara
[ precio, si aplica ]      ← una línea, no una pill
```

Slide 1 omite precio y evidencia (solo las dos pills de modo). Slides 2 y 3 lo
usan completo. El divider ya existe y ya marca ese quiebre.

---

## Lo que le pido al founder antes del mock

1. **Slide 1**: ¿separo `welcomeBack.headline` del `slide1.headline`? (Recomiendo
   que sí; sin eso el rediseño del slide 1 toca la pantalla de regreso.)
2. **Slide 2**: de las cinco ideas del goal —hábito, foco, decisiones,
   dispersión, bienestar— ¿cuál es **la única** que quiere que sobreviva?
3. **Slide 3**: ¿saco "free" del headline? (Recomiendo que sí, por lo de arriba.)
