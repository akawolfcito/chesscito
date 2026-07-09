# Landing slides 1/2/3 + Welcome Back — redesign spec

Decisiones del founder (2026-07-08), sobre la crítica en
`2026-07-08-landing-slides-123-ux-critique.md`:

1. Separar `welcomeBack.headline` de `slide1.headline`. **Sí.** Y de paso
   arreglar la tipografía y el tamaño del wordmark en Welcome Back.
2. Idea única del slide 2: **la toma de decisiones.**
3. Sacar "free" del headline del slide 3. **Sí.**

---

## Bug transversal: la jerarquía de la Pill está invertida

`components/onboarding/pill.tsx` líneas 35-36:

```tsx
<span className="text-[0.6rem]">{label}</span>
{sublabel ? <span className="text-[0.7rem] opacity-80">{sublabel}</span> : null}
```

El **sublabel es más grande que el label**. Hoy, en el slide 2, `Focus Passport`
se renderiza a 0.6rem y `21 focus days` a 0.7rem. El dato secundario pesa más
que el nombre. Y el `opacity-80` sobre el más grande empuja en la dirección
contraria a la que la escala ya empujó.

Esto no lo vimos antes porque solo el slide 2 usa `sublabel`. En cuanto el slide
1 estrene sublabels (abajo), el defecto se multiplica por tres.

**Fix:** label `text-[0.7rem]`, sublabel `text-[0.6rem] opacity-80`.

---

## Welcome Back — qué está mal, exactamente

`components/onboarding/welcome-back.tsx` vs `Slide1Body`:

| Elemento | Slide 1 | Welcome Back | Diagnóstico |
|---|---|---|---|
| "Welcome to" | `fantasy-title text-xl` | `text-sm` | **Sin `fantasy-title`.** Cae al body face en vez de Rowdies. Este es el "font que no se muestra bien". |
| Wordmark | `h-12 w-auto` | `h-14 w-6/12` | No hay deformación (`ArtImage` es `object-contain`). Lo que pasa es que **`w-6/12` topea antes que `h-14`**: el wordmark es ancho, la caja mide 50% del contenedor, y la imagen se encoge para caber en el ancho sin llegar nunca a los 3.5rem de alto. Se ve chico. |
| Avatar | `relative top-9 w-48` | `relative top-3 w-48` | Distinto offset vertical, sin razón registrada. |
| Headline | `text-sm` (body face, a propósito) | `text-2xl` (body face) | A `text-2xl` el body face pide `fantasy-title`, o baja de tamaño. |

**Fix:** `fantasy-title` en "Welcome to"; wordmark a `h-12 w-auto`; alinear el
offset del avatar; headline propio (`welcomeBack.headline`) con face y tamaño
decididos una vez.

---

## Esqueleto común

```
[ arte / avatar ]
[ título ]              ← qué es
[ una frase ]           ← por qué te importa
[ ─── divider ─── ]
[ evidencia ]           ← pills, 2 máx
[ precio ]              ← una línea de texto, NO una pill
```

El precio deja de ser pill. Una pill es un chip de HUD, un objeto que poseés. Un
precio es una condición. Ponerlo en el mismo contenedor que `Focus Passport` le
dice al ojo que son la misma categoría de cosa.

---

## Copy propuesto (`messages/en.ts`)

> Propuesta, no decisión. El copy es tuyo. Sin em-dashes (gate `anti-ai-prose`).
> Todo cambio va simultáneo a `en.ts` y `es.ts` (`feedback_i18n_key_parity`).

### Slide 1 — orientación

| key | hoy | propuesto |
|---|---|---|
| `welcomeTo` | Welcome to | *(igual)* |
| `headline` | Turn chess into your daily focus ritual. | **Two ways into chess.** |
| `support` | Train your mind, build consistency, and grow one move at a time. | **Learn the pieces, or jump straight into a match.** |
| `learnPill` | Learn | Learn + sublabel **Start from zero** |
| `playPill` | Play | Play + sublabel **Full matches** |

El headline viejo se muda de barrio: era el pitch del hábito, y el hábito es el
slide 2.

### Slide 2 — Season Pass, idea única = decisiones

| key | hoy | propuesto |
|---|---|---|
| `headline` | Build a daily chess habit. | **Decide better in 21 days.** |
| `support` | Train every day and unlock your reward path. | **A daily habit that trains how you choose, on the board and off it.** |
| pills | Focus Passport / Season Pass $0.99 | solo **Focus Passport** + sublabel **21 focus days** |
| precio | *(era pill)* | línea de texto: **Season Pass, $0.99** |
| `footnote` | Season Pass unlocks the reward path. PRO includes Season Pass. | **eliminado** |

Se va "reward path" (rozaba la promesa de valor monetario que tu propio goal
prohíbe, y no decía de quién viene el reward). Se va el footnote: nombraba PRO
una pantalla antes de que PRO exista, respondiendo una objeción que nadie tiene
todavía. Ese argumento es el titular del slide 3.

### Slide 3 — Coach PRO

| key | hoy | propuesto |
|---|---|---|
| `headline` | Play free. Upgrade for Coach PRO. | **Coach PRO includes the Season Pass.** |
| `support` | Play matches, save progress, and improve with Coach PRO. | **Your games get reviewed, and the 21 Day Challenge comes with it.** |
| pills | Saved games / Coach PRO | **Saved games** / **Coach review** |
| `proPill` | PRO $1.99 includes Season Pass. *(pill dorada)* | línea de texto: **Coach PRO, $1.99** |

El argumento que estaba enterrado en un chip dorado sube a titular. Sale "free".

---

## Cambios de código

1. `pill.tsx` — invertir la escala label/sublabel.
2. `messages/en.ts` + `messages/es.ts` — copy nuevo, `welcomeBack.headline` nueva,
   `slide2.footnote` y `slide3.proPill` fuera.
3. `slide-bodies.tsx` — esqueleto común; matar el `h-2` del slide 2 (fija el
   contenedor de pills en 8px y las pills lo desbordan; el `mt-6` del footnote
   compensa a mano) y su `mt-6` acompañante; precio como línea.
4. `welcome-back.tsx` — `fantasy-title`, wordmark `h-12 w-auto`, offset del
   avatar, headline propio.
5. Tests: `onboarding-carousel.test.tsx` referencia el copy. VR baselines de
   landing si existen.

---

## Preguntas abiertas

- **Slide 2:** ¿el "apoyo de la comunidad" (rewards no monetarios) queda fuera
  del carrusel? Recomiendo que sí. Es una idea entera y vos elegiste decisiones.
- **Slide 3:** las features futuras (avatares, personalizaciones, distribución
  del pool) ¿quedan fuera? Recomiendo que sí, por lo mismo. PRO se vende con
  "te llevás los dos", no con una lista.
- **Slide 1:** ¿`headline` en `fantasy-title` ahora que es más corto? Hoy está en
  body face a propósito, porque compite con "Welcome to" y el wordmark.
