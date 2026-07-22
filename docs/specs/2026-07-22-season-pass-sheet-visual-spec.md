# Season Pass Sheet — pase de texto a presentación visual

**Fecha:** 2026-07-22
**Archivo:** `apps/web/src/components/payments/season-pass-sheet.tsx`
**Alcance:** SOLO la rama de compra (líneas 168–292). Cero cambios de lógica, rail,
contratos, hooks de pago o entitlement.

## Por qué

La sheet actual es un muro de 4 párrafos + una lista de 2 bullets. El valor del pase
(21 días · entrenamientos especiales · +3 escudos) se lee, no se ve. La referencia
aprobada lo cuenta con iconos y deja el texto largo detrás de un disclosure.

## Ramas que NO se tocan

| Rama | testid | Estado |
|---|---|---|
| Celebración post-compra | `season-pass-success` | intacta |
| Checking access | `season-pass-status-loading` | intacta |
| Included with PRO | `season-pass-included-pro` | intacta |
| Pass Active | `season-pass-already-active` | intacta |
| Sin wallet / red mala | `season-pass-unavailable` | intacta |
| Fondos insuficientes | `season-pass-insufficient` | intacta |

## Layout objetivo (rama de compra, orden vertical)

1. **`JOIN THE`** — línea de texto, uppercase, tracking amplio, marrón de la sheet.
2. **Wordmark** — `<picture>` de `/art/mini-tour/tour-challenge-title` (avif/webp/png).
   Ancho ~ 100% del panel, `object-contain`. Interlínea pegada al paso 1
   (`-mt-1`, sin el `gap-4` del contenedor).
3. **Subtítulo + chip `?`** — `offerHabit` en una línea, y al final un botón
   circular `?` que hace **toggle** de un panel con el texto que se quita del flujo
   principal: `offerPractice` + `offerShieldsBonus`. Cerrado por defecto.
4. **Fila narrativa** — 3 iconos en horizontal, sin labels, sin flechas:
   `/art/shop/welcome-gift` → `/art/hub/train-pieces` → `/art/focus-passport/flame-color`
5. **Fila de beneficios** — 3 tarjetas con icono + label:
   | asset | label (editorial) |
   |---|---|
   | `/art/21-day-icon` | `21 Days` |
   | `/art/new-icons-chesscito/training-icon-v1` | `Special Trainings` |
   | `/art/redesign/icons/shield` | `+{count} Shields` |
6. **Chip de precio** — `$0.99`, `candy-stat-pill`. Sin cambios.
7. **`PAY WITH`** — label uppercase + separador `/art/screen-mission/adorno-icon`
   (línea fina a cada lado del adorno).
8. **Selector de stablecoin** — el botón actual **sin ningún cambio**: mismo
   `data-testid`, mismo `aria-haspopup`, mismo listbox, misma
   `useStablecoinTokenSelection`.
9. **Error del rail** — sin cambios.
10. **CTA** — `Get Pass` → **`Unlock Challenge`**. Los estados busy
    (`Confirm in wallet` / `Sending...` / `Verifying...`) NO cambian.
11. **Pie** — `offerPriceNote` ("One-time payment · No subscription"). **Reemplaza**
    la línea `Paid with {tokenSymbol} on Celo.`, que se elimina.

## Estados de UI y transiciones

| Estado | Disparador | Resultado |
|---|---|---|
| Detalles cerrados | inicial | solo `offerHabit` + chip `?` |
| Detalles abiertos | tap en `?` | panel con `offerPractice` + `offerShieldsBonus`, `aria-expanded=true` |
| Detalles → cerrados | segundo tap en `?` | vuelve al estado inicial |
| `busy` | rail preparando/firmando/verificando | el `?` sigue operable (no toca el pago); el picker y el CTA se deshabilitan como hoy |
| Cambio de token | tap en opción del listbox | idéntico a hoy; el pie ya no nombra el token |

**Edge cases**
- Tap en `?` durante `busy`: permitido, es solo lectura. No re-renderiza el rail.
- `shieldsOnPurchase` ≠ 3: el label de la tarjeta es interpolado, nunca hardcodeado.
- Imagen del wordmark que no carga: `alt` vacío + `aria-hidden`; el `aria-label` del
  shell (`21-Day Mind Challenge Pass`) ya nombra la sheet para lectores de pantalla.
- Panel abierto + sheet que crece: el shell ya scrollea; no se fija altura.

## Contrato de copy (`lib/content/editorial.ts`, `CHALLENGE_CARD_COPY`)

Se **añaden** (UI en inglés):
```ts
offerJoinKicker: "Join the",
offerBenefitDays: "{days} Days",
offerBenefitTrainings: "Special Trainings",
offerBenefitShields: "+{count} Shields",
offerDetailsLabel: "What's included",
offerCta: "Unlock Challenge",
```
Se **conservan** `offerTitle` (aria/fallback), `offerHabit`, `offerPractice`,
`offerShieldsBonus`, `offerPriceNote`. No se borra ninguna clave.

## Tests

**Existentes que deben seguir verdes sin editarse:**
- `season-pass-sheet.test.tsx:89` — `getByText(/\+3 shields/i)`: lo satisface el label
  de la tarjeta de escudos. Por eso el label es `+3 Shields` y no `3 Shields`.
- Los 5 casos de celebración: no tocan esta rama.

**Nuevos (TDD, se escriben primero y fallan):**
1. Renderiza las 6 imágenes de la rama de compra con sus `src` esperados.
2. `offerPractice` y `offerShieldsBonus` NO están visibles al abrir.
3. Tap en el chip `?` los revela y pone `aria-expanded=true`.
4. Segundo tap los vuelve a ocultar.
5. El CTA dice `Unlock Challenge` y **no** contiene `$0.99`.
6. El pie dice `One-time payment · No subscription` y ya no existe
   `Paid with USDC on Celo`.
7. El token picker conserva `data-testid` y sigue disparando `setSelectedSymbol`.

## CSS

Clases nuevas van a `apps/web/src/app/globals.css` (único CSS del app):
`.season-pass-kicker`, `.season-pass-wordmark`, `.season-pass-story-row`,
`.season-pass-benefit-grid`, `.season-pass-benefit-tile`, `.season-pass-help-chip`,
`.season-pass-paywith`. Sin tokens de color nuevos: se reusa `SHEET_TEXT_COLOR` y
los pills candy existentes.

## Deltas durante la implementación (2026-07-22)

1. **Flechas SÍ, con asset propio.** El spec original las descartaba por no existir
   el arte. El founder entregó `design/season/new-flecha-dere.png` (150×137, alpha),
   convertido a `/art/season/arrow-right.{png,webp,avif}` (10.3K / 4.3K / 3.0K) y
   registrado como slot `season.story-arrow`. Van entre beats, nunca al final.
2. **El chip `?` usa el material del pill de precio** (mismo gradiente, borde e
   inset lights) comprimido en un círculo de 1.5rem, en vez del chip translúcido
   plano del primer intento.
3. **Las llamas del Focus Passport entraron al catálogo.** El audit de themes
   (`ALLOWED_UNREGISTERED_LITERALS` está vacío a propósito) rechazó el path crudo
   de `flame-color`. Resultó que las llamas nunca estuvieron en el catálogo: sus
   consumidores componían el path desde un basename (`"flame-" + kind`), invisible
   para el regex del audit. Se registraron `shared.flame-color/blue/gray` y se
   migraron `focus-passport.tsx` y `challenge-card.tsx` al resolver.
4. **`ThemeAssetPicture.pictureProps` ahora acepta `data-*`** — `HTMLAttributes` no
   los declara, y las llamas cuelgan `data-kind`/`data-glow`/`data-testid` del
   `<picture>`, no del `<img>`.
5. **Tripwires del catálogo movidos**: inventario 162 → 166, categoría inicial
   B 66 → 70, `connectedSlots` 150 → 154, superficie `learn` 31 → 35.

## Riesgos

- **VR**: hay baselines de esta sheet → se regeneran y se revisan a ojo (un VR verde
  puede ser la foto de un error).
- **Altura**: 390px de ancho, 11 bloques verticales. Si excede el viewport, la fila
  narrativa (paso 4) es la primera candidata a compactarse, no los beneficios.
- **Peso**: `21-day-icon.png` pesa 91.8K y `tour-challenge-title.png` 100.7K; se sirve
  avif/webp primero vía `TileIconSlot`, el png es fallback.
