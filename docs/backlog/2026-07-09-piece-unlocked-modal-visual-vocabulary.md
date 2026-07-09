# Backlog — El modal "Piece Unlocked" quedó fuera del vocabulario visual

**Detectado:** 2026-07-09, durante el re-smoke de LEARN en device.
**Severidad:** cosmético. No bloquea nada.
**Superficie:** `exercises-screen.tsx:2740-2766`.

## Qué se ve

El modal de desbloqueo de pieza (`Bishop Unlocked!`) llega justo después del
`Badge Earned!`, y los dos no parecen del mismo juego:

| | Badge Earned | Piece Unlocked |
| --- | --- | --- |
| Fondo | Panel con arte, marco verde, banda crema | `CandyGlassShell` — lima plano, sin marco |
| CTA | Verde, primario del sistema | `variant="game-primary"` — marrón |
| Cierre | Botón rojo de asset | Botón rojo de asset (este sí coincide) |

Aparecen **en secuencia**, así que el salto se nota de golpe. El marrón del
`Start Bishop` además compite con el marrón del texto del título en vez de
leerse como la acción de la pantalla.

## Qué hay que hacer

Alinear el modal con el vocabulario del `BadgeEarnedPrompt` (`result-overlay.tsx`)
y del `DailyLimitBanner` (`daily-limit-banner.tsx`), que ya comparten el patrón
de panel con wallpaper de arte + CTA verde.

Antes de tocar nada:

1. **Auditar los assets canónicos** en `public/art/**`. El `DailyLimitBanner` usa
   `bg-sesion-great.png/webp/avif`; puede existir ya un fondo reusable para el
   unlock, o hay que pedirlo en resolución correcta (nunca upscalear).
2. **No mintear un 6.º CTA.** `globals.css :root` ya define 5 familias de tokens
   de CTA (`cta-token-system`). Consumir una existente; `/dev/button-gallery` las
   muestra todas.
3. El modal monta `sparkle-burst.lottie`. Es preexistente, se conserva; la regla
   es no agregar Lotties nuevas.

## Proceso

Es un rediseño de UI, así que aplica `feedback_goal_then_mock_then_code`: el
founder fija el GOAL, Sally (`bmad-agent-ux-designer`) critica, sale un mock, y
recién ahí código. El mock decide la estructura, nunca el acabado.

Al tocarlo, refrescar los baselines VR en el mismo PR.

## Relacionado

- `docs/handoffs/2026-07-09-daily-session-progression-deadlock-handoff.md` — la
  sesión donde apareció.
- El `MAX_STARS` hardcodeado del `Badge Earned` (`result-overlay.tsx:113`) toca
  el mismo archivo vecino. Se pueden agrupar si se abre el cluster de pulido de
  celebraciones.
