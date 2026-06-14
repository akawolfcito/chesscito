# Manual QA checklist — Coach analysis cluster (Plans 1-3)

**Build:** main preview `https://chesscito-iuznygbbc-goodwolf.vercel.app` (merge `dc501dd6`)
**How:** viewport móvil **390px** (MiniPay), probar **EN y ES**. Lo que sigue NO se
cubre por curl/VR — requiere estado de partida real.

## Plan 2 — Render-A (el fix del bug original del founder)

| # | Qué probar | Resultado esperado |
|---|-----------|--------------------|
| 1 | Ganar en `/arena` → tap **Ask Coach** ("Why did you win?") | El análisis SE RENDERIZA en el visor `/coach/[id]`. NUNCA un Match Review vacío. |
| 2 | Loading del coach | "Coach is thinking" se ve en el popup de arena; recién navega al visor cuando el análisis está listo (un solo tap, sin re-tap). |
| 3 | Forzar fallback (modo avión / cortar red antes de Ask Coach) | Quick review inline EN el popup de arena. No redirige a visor vacío. |
| 4 | Refrescar `/coach/[id]` tras analizar | El análisis persiste (cold-load lo lee). |
| 5 | (regresión) Tap coach sin partida persistida | No descuenta Peón ni crédito. |

## Plan 3 — Cost ribbon + copy por desenlace

| # | Qué probar | Resultado esperado |
|---|-----------|--------------------|
| 6 | Popup de **victoria** (free) | CTA coach = "Why did you win?" con ribbon **♟ 1** (esquina sup-der). |
| 7 | Popup post-mint (Save → success) | Mismo CTA "Why did you win?" + ribbon ♟ 1. |
| 8 | Popup de **derrota/resign** (con jugadas) | CTA = "Let's see what happened." + ribbon ♟ 1. |
| 9 | Popup de **empate** | CTA = "How did this end?" + ribbon ♟ 1. |
| 10 | **Visor** `/coach/[id]` tile Ask Coach (free, pre-análisis) | Label outcome-specific + ribbon ♟ 1 + hint "Uses 1 credit · N left" (si hay créditos). |
| 11 | Usuario **PRO** (en todas las superficies) | Ribbon = corona **PRO** (no ♟ 1) + hint "Unlimited · PRO active". |
| 12 | Partida **too-short** (0 jugadas, p.ej. resign inmediato) | CTA coach deshabilitado y **SIN ribbon** (no se muestra costo en acción no disponible). |
| 13 | Tras analizar, re-abrir visor | Label pasa a "Ask Coach again"; ribbon sigue (re-ask cuesta, salvo PRO). |
| 14 | Locale **ES** (`/es/...`) | "¿Por qué ganaste?" / "Vamos a ver qué pasó." / "¿Cómo terminó esto?" + "PRO" / "Ilimitado · PRO activo". |

## Plan 1 — 4 botones (ya shippeado, revalidar en el merge)

| # | Qué probar | Resultado esperado |
|---|-----------|--------------------|
| 15 | Popup de victoria + Match Review | 4 acciones siempre: **Play Again · Save · Share · Ask Coach**. |
| 16 | **Re-save** (Save → success → Save again) | Permite guardar de nuevo (re-save ilimitado = feature); cada save mintea. |
| 17 | Share en derrota / partida no-minteada | Share funciona (URL canónica si no hay card minteada). |
| 18 | Doble-tap rápido en Save | Un solo mint (idempotencia `claimingRef`). |

## Cosas a vigilar (deferidos conocidos, NO bloqueantes)
- Visor no distingue invitado de free-conectado → muestra ♟ 1 a no-PRO en el visor.
- Share del visor no-minteado = URL genérica (página de match con OG card = backlog).
- Props muertos `shareLinkUrl` / `shareStatus` (limpieza pendiente).

## Pregunta abierta para el founder
- ¿Guardar partidas no-victoria? Hoy Save es win-only (derrota/empate muestran Play Again · Share · Ask Coach).
