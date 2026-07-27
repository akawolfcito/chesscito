# Spec — ChallengeCard: redistribución al patrón KingdomCard

**Fecha**: 2026-07-26 · **Superficie**: LEARN hub (`components/hub/challenge-card.tsx`)
**Alcance**: layout. **Cero** cambios de copy, de estados o de lógica de negocio.

## Problema

Todo lo que está debajo del título vive dentro de `.challenge-card-top-main`, que es la
columna angosta a la derecha del ícono de 72px. Consecuencias visibles a 390px:

1. La semana de 7 llamas se comprime en ~250px en vez de usar el ancho del panel.
2. `.challenge-card-day-count` usa `justify-content: space-between`, así que
   "Day 1 of 21" y "1-day streak" quedan pegados a bordes opuestos con un hueco muerto
   en el medio. No se lee como una frase.
3. `FOCUS PASSPORT (?)` se interpone **entre** el título y el dato que etiqueta.
4. La fila de stats no tiene separador: flota pegada al CTA sin cerrar el bloque.

`KingdomCard` (PLAY) ya resolvió la misma gramática: `top` (crest + head + body) →
hairline → fila de beneficios → CTA. Adoptamos esa distribución.

## Estructura destino

```
.challenge-card
  .challenge-card-top          icono | top-main
      .challenge-card-head       título (+ chip ACTIVE)
      .challenge-card-day-count  "Day 1 of 21 · 1-day streak"   ← sube acá
      .challenge-card-passport-head  FOCUS PASSPORT (?)
  .challenge-card-passport     ← SALE de top-main: full width, solo la semana
  .challenge-card-bottom
      .challenge-card-stats    ← gana hairline `border-top` (igual que kingdom)
      .challenge-card-cta-row  ← SIN CAMBIOS
```

Cambio adicional dentro de cada día: la letra pasa **antes** de la llama en el DOM
(encabezado de columna, no epígrafe).

## Lo que NO cambia (decisiones cerradas)

- **El CTA queda tal cual.** La barra estilo `.kingdom-card-pro-cta` fue evaluada y
  descartada: ese patrón es el *secundario* de PLAY (chevron = navegación), y el Join es
  el único CTA y la conversión de esta card. Además `ctaState` tiene 4 estados y dos son
  texto de estado con skin de CTA — un chevron ahí promete una navegación inexistente.
- **La fila de stats mantiene sus 3 items** (`21 days` / `+3 Shields` / `Special
  Training`). "Challenge Badges" del mock **no existe** en el código: 0 ocurrencias.
  Introducirlo sería una promesa nueva sin respaldo.
- Copy, `editorial.ts`, slots de tema y handlers: intactos.

## Estados de UI (los 4 se renderizan con la MISMA estructura)

| `data-state` | día/streak | semana | stats | CTA |
|---|---|---|---|---|
| `loading` | "Day 0 of 21", sin streak | 7 slots neutros | visible | `join` disabled |
| `offer` | real | real | `+3 Shields` | `join` |
| `active` + hoy pendiente | real | hoy con glow | `N/M Shields` | `start` |
| `active` + hoy hecho | real | hoy en color | `N/M Shields` | `tomorrow` (status) |
| `active` + completo | "Day 21 of 21" | real | `N/M Shields` | `complete` (status) |

La altura del panel no debe cambiar entre estados — invariante preexistente que este
cambio debe preservar.

## Edge cases

- **Tap del passport**: `canOpenPassport` envuelve ahora **solo la semana** (el ordinal
  salió del botón). Sigue siendo `BUTTON` cuando aplica y `DIV` cuando no; `data-testid`
  y `data-done` no se mueven. El target crece (full width) en vez de encogerse.
- **`streak === 0`**: no se renderiza `.challenge-card-streak` → la línea queda solo con
  el ordinal y el separador `·` **no debe aparecer** (va como `::before` del streak).
- **Chip `ACTIVE` / `PRO Benefit included`**: comparte fila con el título; con el ordinal
  ahora en su propia línea, el título gana ancho en vez de perderlo.
- **ES locale**: "Día 1 de 21" + "racha de 3 días" es más largo que EN. La línea debe
  poder envolver (no `nowrap` sobre el contenedor).

## Riesgo

- **VR**: la card cambia de forma → los baselines de LEARN hub se rompen a propósito.
  Hay que regenerarlos (ya había pendientes por el rediseño del hub y por los scrims de
  login).
- Test existente `'puts "Day N of 21" above the flames"'` sigue verde: el ordinal queda
  antes de `.challenge-card-week` en orden de DOM.

## Adenda — el spotlight del mini-tour (mismo día)

El paso `challenge` iluminaba `.hub-lite-challenge-anchor`, o sea **el panel entero**,
mientras el paso equivalente de PLAY ilumina `.kingdom-card-pro-cta` — la fila, no la
card. Un spotlight sobre el panel cubre cuatro cosas tappables (el `?`, la semana que
abre el Daily, el CTA) y no señala ninguna; además, a 390px el panel del tour tapaba el
HUD.

`data-tour-target="challenge"` se mudó a **`.challenge-card-cta-row`**. La fila, no el
botón: la flecha de nudge es hermana del botón y su regla CSS es
`[data-tour-spotlight="active"] .challenge-card-join-arrow` — un selector de
**descendiente**. Anclado al botón, la flecha se apagaría justo en el paso que la
necesita. La fila contiene botón + flecha, que es exactamente lo que se quiere iluminar.

El badge de precio flota a `top: -9px` fuera de la caja del botón; `RING_PAD = 12` del
tour lo mantiene dentro del recorte iluminado.

### Descartado en la misma revisión

- **"Theme personalizado" como beneficio.** `useOwnedThemes()` (v1) devuelve solo el
  theme default y **ningún slot de piezas tiene variante `pro`**: las 7 variantes `pro`
  del registry son identidad del hub (portal, avatar, bordes dorados, chip, anillo de
  Start Focus). El Season Pass activo SÍ pone LEARN en tier `pro`
  (`use-effective-theme-tier.ts:62`), así que el hub se vuelve dorado — pero eso no es
  "custom" ni son piezas. Además `resolveSurfaceThemeTierPresentation` documenta que el
  tier se aplica *sin* cambiar copy/badges/beneficios. Va como **reveal post-compra**,
  no como viñeta previa.
- **Sacar "21 days" de la fila de stats.** Redundante con el título, sí — pero el stat es
  el **único** consumidor de `hub.focus-passport-calendar`. Sacarlo orfanaría el slot
  (`runtime-coverage.test.ts` cuenta cobertura) y le quitaría a los creadores un slot
  re-skineable. Se queda.

## Verificación

1. Tests nuevos (rojo → verde) en `__tests__/challenge-card.test.tsx`.
2. Suite completa + `tsc --noEmit`.
3. VR de LEARN hub → revisar las fotos nuevas antes de aceptar baselines
   (un VR verde puede ser la foto de un error).
