# Triage de pendientes — 2026-07-09

Auditado **contra el código**, no contra las listas. Dos entradas del backlog ya
estaban cerradas y nadie lo había anotado; un baseline VR está rojo ahora mismo.

---

## 0. Ya está hecho — corregir los docs

| Item | Estado real | Evidencia |
| --- | --- | --- |
| 🔴 "CTA dorado Save proof casi inalcanzable" (`2026-07-08-lote2-smoke-findings`) | **ARREGLADO** en #183 | `canSaveOnChain` ya no comparte `scorePendingNew`; usa `deriveCanSaveOnChain()` gateado por ausencia de recibo real (`exercises-screen.tsx:1066`) |
| Backlog LEARN **#4 Post-Focus Free Practice** | **ARREGLADO** en #191 | `isExerciseReplayable()` deja rejugar todo lo completado y el drawer ya los muestra (`exercise-drawer.tsx:120`) |

El doc de smoke findings todavía los describe como abiertos. Eso es deriva de
documentación: el próximo que lo lea va a trabajar sobre un bug que no existe.

---

## 1. Barato y cerrable hoy (< 1h cada uno)

**a. Baseline VR `hub-shop-sheet-open` — CERRADO** (`28b2f75`). Era **dos** fallos
apilados, no uno:

1. El que este doc predijo: el baseline traía los 3 SKUs retirados
   (`5c8e0f5d`, `6bf6c344`). Refrescado con `--update-snapshots=all`; el PNG
   confirma que el diff son esos 3 tiles + el header `SHOP` → `Shop`.
2. **El que nadie vio: contaminación de env.** El test ni siquiera llegaba al
   screenshot — moría antes en la aserción de precio, con las píldoras en
   "Coming soon". Causa: un `NEXT_PUBLIC_CHAIN_ID=11142220` exportado en el
   shell, que **gana sobre `.env.local`** en Next. `getConfiguredChainId()`
   devolvía Sepolia mientras wagmi resolvía `chainId = 42220` (celo va primera
   en `chains`), así que `getShopAddress()` → `null`, la query quedaba
   `enabled: false` y no salía un solo request RPC.

Refrescar el baseline con ese env sucio habría **congelado "Coming soon" en la
imagen**, dejando un VR verde que certifica una tienda muerta — exactamente
[[feedback_tests_green_against_dead_shape]] otra vez, ahora en el eje del
entorno. Antes de correr VR: `env | grep NEXT_PUBLIC`.

**b. Backlog PLAY #7 — icono de Coach en el HUB.** El asset ya existe en los tres
formatos (`public/art/new-icons-chesscito/training.{png,webp,avif}`). Es un swap
de ruta. Toca UI → baseline VR en el mismo PR.

---

## 2. Barato-medio (1–3h)

**c. Decodificar los custom errors.** Verificado: **nadie** decodifica revert
data en `apps/web/src` (cero hits de `decodeErrorResult` /
`ContractFunctionRevertedError`). Hoy `BadgeAlreadyClaimed`, `CooldownActive`
(`0xc1ab61a1`) y `DailyLimitReached` (`0xeba8fe8a`) salen los tres como un
"Try again" genérico que no dice nada. Un util + un mapa selector→copy, y las
ABIs salen de artifacts, nunca a mano ([[feedback_verifier_abi_lesson]]).
Es el que más dolor de QA quita por hora invertida.

**d. Backlog PLAY #8 — quitar la confirmación redundante de LUZ.** Tocar Coach
Review lanza análisis directo; LUZ conserva personalidad en loading y resultado.
Borrar una pantalla intermedia.

---

## 3. Medio (medio día), necesitan ojo de diseño

- **#9 Coach Analysis Loading Overlay** + **#10 Save Match Success Celebration** —
  ambos son "cerrar el loop emocional después de una acción". Se pueden agrupar.
- **#2 Post-Claim Gift Overlay** — mismo patrón: mostrar QUÉ ganó y para qué sirve.
- **Modal `Piece Unlocked` fuera del vocabulario visual** —
  `2026-07-09-piece-unlocked-modal-visual-vocabulary.md`. Requiere GOAL → Sally →
  mock → código.
- **#11 PLAY Dock 4 slots** — simetría del dock. Ojo en device + baseline VR.
- **#5 Shop Active State** — con Season Pass activo el Shop solo muestra un modal.
  Hay una pregunta de producto adentro (¿merece slot en el dock?).

## 4. Investigación primero, no código

- **#1 "Claim 3 Shields"** — nadie sabe a qué pertenece (Welcome Pack, Season Pass
  bonus, rescue gift), si duplica los 3 shields de onboarding, ni por qué al
  tocarlo lanza el 21-Day Mind Challenge. **No cambiar lógica hasta entenderlo.**
  Es el único pendiente con comportamiento inexplicado; puede esconder un bug.

## 5. Grande — no abrir sin decidirlo

- **Server-verified progress** — el único anti-cheat real. `/api/sign-badge` y
  `/api/sign-score` sellan lo que el cliente afirma. Feature, no un `if`.
- **Belt System** ([[project_belt_system_design]], #189) — incluye
  `BADGE_THRESHOLD` → proporción. La ventana "antes de que se minteen muchos
  badges" sigue abierta: hay exactamente uno.
- **Lote 2.5** Tactical Day Gift + Proof of Consistency (#3).
- Issues de GitHub: #104 Treasure hunt (P1), #101 Prize pool v2 (P2, falta método
  en el contrato), #67 Exercise world map (P2).

---

## Orden recomendado

1. ~~**(a)** VR rojo~~ — CERRADO (`28b2f75`). Ver arriba: eran dos fallos.
2. **(c)** Custom errors — el mejor ratio dolor/hora, y hoy mismo te mordió tres veces.
3. **(b)** Icono de Coach — trivial, el asset ya está.
4. **(d)** Confirmación de LUZ — borrar una pantalla.
5. **(#1)** Investigar "Claim 3 Shields" antes de que se vuelva deuda silenciosa.

Después de eso, la conversación es Belt System vs server-verified progress, y
esa sí es una decisión de producto.
