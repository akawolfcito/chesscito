# Smoke — flujo crítico en MiniPay

**Fecha**: 2026-07-10 · **Estado**: **ejecutada en device — 17/17 pasan**
**Build bajo prueba**: `main` ≥ `#202` · `learn-preview.chesscito.com` · Celo Mainnet

> **Procedencia de los resultados.** Las 17 filas las corrió el founder en device y
> las reportó verdes en sesión. No fueron presenciadas por el agente: se registran
> como reporte del founder, no como observación directa. La única anomalía reportada
> (label de confirm pegado) ya cerró en #204 y se reverificó en device.

Lo que cambió desde el último smoke: **badge y score ya no celebran sobre el hash**,
sino sobre un receipt verificado (#199, #200). Eso agrega un estado `confirming`
de unos segundos que antes no existía. Este smoke busca regresiones ahí.

---

## Antes de empezar

- Wallet con saldo chico de un stable. Sin CELO no hay gas (`feeCurrency`).
- Anotá modelo, versión de MiniPay, y el commit del deploy.
- El badge de la **torre ya está minteado** en la wallet de prueba. Para probar el
  claim hace falta una pieza sin badge, o una wallet limpia.

---

## Matriz

| # | Criterio | Paso | Esperado | Resultado | Notas |
| --- | --- | --- | --- | --- | --- |
| 1 | Entrada y navegación | Abrir la app en MiniPay | Splash resuelve, HUB carga, dock responde | ✅ | |
| 1 | Navegación | Tocar cada slot del dock | Cada superficie abre y cierra | ✅ | |
| 2 | Ejercicio | Completar un ejercicio con ≥1 estrella | Estrellas y progreso se registran | ✅ | |
| 2 | Ejercicio | Completar el siguiente | El drawer avanza, no se traba | ✅ | |
| 3 | **Score / confirming** | Tocar "Save proof" on-chain | CTA se deshabilita, aparece estado de confirmación (~5s) | ✅ | label pegado → #204 |
| 3 | **Score / éxito** | Esperar el receipt | Recién ahí: overlay de éxito, done-hold, y el score aparece en leaderboard | ✅ | |
| 3 | **Score / persistencia** | Cerrar y reabrir | El score guardado sigue ahí | ✅ | |
| 4 | **Badge / confirming** | Reclamar un badge ganado | Sin celebración hasta el receipt | ✅ | |
| 4 | **Badge / éxito** | Esperar el receipt | Háptica, celebración, modal `piece-unlocked`, badge en Owned | ✅ | |
| 5 | **Cancelación** | Tocar Save, **rechazar** en la wallet | Toast de cancelado. **Sin** overlay de éxito, **sin** overlay de error, score NO persistido | ✅ | |
| 5 | **Cancelación (badge)** | Tocar Claim, **rechazar** | Vuelve a idle. Sin celebración, `justClaimed` sin setear | ✅ | |
| 5 | **Error / revert** | Reclamar un badge que la wallet YA tiene (si el CTA lo permite) | Overlay de error con retry. **Nunca** éxito | ✅ | ver nota |
| 5 | **Cancelación (victory mint)** | En Arena, ganar, tocar Claim, **rechazar** en la wallet | Vuelve a la pantalla de victoria. El claim sigue disponible ahí y en el Diario | 🔴 | **fila agregada post-hoc** — ver abajo |
| 6 | Refresh | Recargar durante `confirming` | Estado coherente al volver: badge se auto-cura leyendo la cadena | ✅ | |
| 6 | Cierre / reapertura | Cerrar MiniPay durante `confirming`, reabrir | Sin celebración fantasma, sin score falso | ✅ | |
| 7 | Shop | Abrir Shop desde el dock | Tiles cargan con precio (`$1.99` en PRO), no "Coming soon" | ✅ | |
| 7 | Shop | Cerrar Shop | Vuelve al HUB, dock intacto | ✅ | |
| 7 | Navegación | Arena → Coach → HUB | Sin pantallas muertas ni loading infinito | ✅ | |

**Nota sobre el revert (fila 5c):** la UI esconde el CTA de Claim si el badge ya
está poseído. Si no se puede disparar desde la pantalla normal, usar
`/dev/tx-error-probe` botón 3, que ya demostró el camino: MiniPay rechaza en
estimación y el error nunca pasa por éxito.

---

## Riesgos conocidos, a observar (no son bloqueantes por defecto)

1. **Espera de `confirming`.** Antes 0s, ahora hasta 120s en el peor caso. Si el
   WebView pausa timers al ir a background, la percepción puede ser peor. Si se
   observa un spinner colgado > 30s, **anotarlo**: hay un umbral de UI diferido
   en `receipt-status-learn-handlers.md`.
2. **Divergencia asimétrica al cerrar en `confirming`.** El badge se auto-cura
   (se lee de la cadena al montar). El score **no**: `recordSaveFor` escribe
   localStorage y nadie reconcilia. Si la tx confirma con la app cerrada, el
   score existe on-chain y no en local.
3. **`/api/cache-score` es fire-and-forget** con `.catch(() => {})`. Si falla tras
   un receipt exitoso, el leaderboard no ve el score y no hay señal.
4. **Telemetría**: `stage: "success"` ahora significa "minada", no "broadcast".
   Las tasas van a caer. No es regresión.

---

## Qué se corrige dentro del bloque

Solo lo que **impida completar los flujos** o **corrompa progreso, pagos o estado**.
Copy, decoder, refactors y mejoras no bloqueantes se difieren.

---

## El agujero de la matriz — cancelación del mint de victory

La matriz cubría la cancelación de **score** y de **badge**, ambos en LEARN. No tenía
una sola fila para el **mint de victory** en PLAY, que es el tercer camino que pide
firma. Por eso el bug sobrevivió al smoke: nadie lo miró.

**Síntoma:** ganás en Arena, tocás Claim, rechazás en la wallet, y en vez de volver a
la pantalla de victoria caés en un popup `PAUSED` cuyas tres salidas son *Try Again*
(reintenta la tx), *Play Again* (descarta la partida) y la X (te saca al HUB).
La celebración se perdió por una cancelación.

**Causa (código, no heurística):** `use-mint-victory.ts:703` clasifica bien la
cancelación (`isUserCancellation` → fase `"cancelled"`). El problema está aguas abajo:
`arena-end-state.tsx:303` monta `VictoryClaimError` para esa fase, reemplazando a
`VictoryCelebration`. El hook expone un `reset()` (`:760`) que devuelve la fase a
`"ready"`, y **nadie lo llama**. La cancelación de un flujo opcional quedó modelada
como estado terminal.

Esto **no** es el decoder de custom errors. No hay revert que decodificar: hay una
cancelación correctamente tipada que se renderiza como si fuera un fallo.

**Decisión:** cancelar es un no-op. Vuelve a `VictoryCelebration` con un toast breve
"Not saved yet". El claim sigue disponible ahí y en el Diario. `error` y `timeout`
conservan el popup — ahí sí pasó algo que el jugador necesita saber.

**Anotado, no mezclado:** en fase `timeout` el CTA primario también es *Try Again*,
pero un timeout es `WaitForTransactionReceiptTimeoutError` (`errors.ts:16`): la tx ya
se firmó y transmitió. Reintentar sobre un mint que quizá aterrizó necesita evidencia
propia antes de tocarse.

---

## Resultado

- **Ejecutada en device** (reporte del founder, 2026-07-10). 17/17 filas originales ✅.
- Bloqueantes encontrados durante el smoke: **1** — label de confirm pegado.
- Bloqueantes corregidos: **1** — #204, reverificado en device.
- Encontrado **fuera** de la matriz: dead-end de cancelación en el mint de victory
  (fila agregada arriba, 🔴). Rompe UX, no corrompe estado: no hay progreso perdido
  ni pago hecho. La partida se descarta solo si el jugador toca *Play Again*.
- **Recomendación de checkpoint: FIRMAR.** El criterio del bloque era "impide completar
  los flujos o corrompe progreso, pagos o estado". El dead-end no corrompe nada y el
  claim sobrevive en el Diario. Se arregla como fix chico dedicado, con su fila de
  smoke ya escrita, sin reabrir el bloque.
