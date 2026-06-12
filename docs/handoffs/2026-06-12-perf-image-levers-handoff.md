# Handoff — Perf Push: image levers + LCP re-anchor (2026-06-12, sesión 2)

## Resultado final

**/hub móvil: 76 → 89** (LCP 5.6s → 3.5s) · **/exercises: 55 → 83** (LCP 7.7s → 4.0s) · ~330KB
menos por visita. Todo live en producción (`main` = `production` = `865b986c`). Suite 3654/3654.
Real-Chrome (sin throttle): LCP /hub ≈ 1.78s.

## Lo que cambió el diagnóstico (leer antes de seguir con perf)

1. El handoff anterior decía "lever #2 = JS render-delay". **Obsoleto**: el patch del BuildVersionGate
   ya había matado el render delay (142ms). El cuello era **contención de ancho de banda** sobre la
   imagen LCP, no hidratación.
2. **El score es por-URL** (cada ruta su propia medición); el LCP lo gana el elemento más grande
   que pinte, y la clave es CUÁNDO termina su descarga, no el peso total de la página.
3. **El elemento LCP de /hub cambió dos veces hoy**: bg-new-hub → daily tile (preload stale) →
   portal (tras el re-encode q35 el fondo salió de la candidatura LCP). El ancla final es el
   portal (26KB, preloaded, high priority) — un ancla 5x más liviana que la original.

## Commits (todos en main+production; tags: `pre-perf-push-lcp-2026-06-12` = estado inicial, `perf-image-levers-shipped-2026-06-12` = tras los 3 primeros fixes)

- `d8258d55` pieceIconSrc negocia avif/webp (play-chess 95→10KB, train-pieces 53→5KB, enter-arena 40→5KB)
- `758f623d` bg-new-hub re-encode q42 (127→52KB)
- `db4705ab` fix preload stale del daily tile (ejercicio-diario-chess → daily-icon-v1)
- `828678d0` hint sprite /exercises negociado (52→8KB)
- `6cd20047` bg-ch (43→21KB, carga en TODAS las rutas) + splash-loading (108→68KB)
- `1cefe9e9` portales q28 (41→26KB / 58→35KB) + bg q35 (52→37KB) + portal priority demote
- `dd07799d` portal priority restore (racional inverso: ahora ES el LCP)
- `865b986c` preload del portal en hub/page.tsx (client-rendered → URL solo descubrible post-hidratación)

## Recetas que quedaron probadas

- Re-encode: `avifenc -q 42 -s 6` (fondos), `-q 28` (sprites con área plana), `cwebp -q 70 -m 6`.
  El arte cartoon plano aguanta q35-42 sin diff visible; VR pasó sin refresh de baselines en todo.
- Patrón `<picture>` negotiation para cualquier `<img src=*.png>` con siblings avif/webp en disco.
- Imagen LCP client-rendered ⇒ SIEMPRE `preload()` en la page server (patrón daily-icon, ahora portal).
- Verificación LCP real sin Lighthouse: probe PerformanceObserver vía Playwright (script en este handoff's session).

## OPEN QUESTION (P1): NO_LCP intermitente en prod — CERRADO (`0e821c18`, fade-in-5; validado 5/5 corridas, scores 67-90 mediana ~80)

~50% de corridas Lighthouse contra prod devuelven Score 0 / NO_LCP desde el deploy `1cefe9e9`.
Localhost NUNCA lo reproduce; cuando registra, da 79-89. Hipótesis principal: cuando el portal
llega lo bastante rápido, pinta dentro de la ventana del `animate-in fade-in duration-200` del
`template.tsx` (opacity 0 con `fill-mode: both`); el cambio de opacity es compositor-only y no
re-emite candidato LCP. Fix candidato de bajo riesgo: arrancar el fade en opacity 0.01 (califica
como contentful) o quitar el fade del wrapper. Validar con 4-5 corridas seguidas + PSI API con key.
Afecta la óptica del packet MiniPay (un PSI de Google podría dar error).

## NEXT (en orden)

1. ~~NO_LCP fix~~ HECHO (`0e821c18`).
2. **PSI con API key en prod** (cuota anónima agotada) + screenshot para el §8 packet appendix
   (`docs/submission/2026-06-05-minipay-stage-2-packet.md`) → devolver el form MiniPay.
3. **/arena 75**: LCP con Load Delay 4s (contenido client-rendered) — aplicar la misma medicina
   (identificar elemento + preload). JS 603KB.
4. **Cluster JS defer wagmi/RainbowKit** — sigue siendo el techo para 90+ estable en todas las
   rutas; alto riesgo documentado (arena-play-timer-fragility, hook-ref-stability). Sesión propia.
5. Backlog previo intacto (nickname onboarding, geo+retention self-built, economía narrativa).

## Lecciones de proceso

- CDN frío post-deploy da NO_LCP transitorio: warm-up con un request antes de medir.
- Lighthouse en bg shell pierde PATH (exit 127): correr foreground desde `apps/web`.
- PSI API anónima se agota rápido: pedir key es el unblock barato.
