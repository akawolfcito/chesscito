# Smoke — flujo crítico en MiniPay

**Fecha**: 2026-07-10 · **Estado**: matriz lista, **pendiente de ejecución en device**
**Build bajo prueba**: `main` ≥ `#202` · `learn-preview.chesscito.com` · Celo Mainnet

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
| 1 | Entrada y navegación | Abrir la app en MiniPay | Splash resuelve, HUB carga, dock responde | ⬜ | |
| 1 | Navegación | Tocar cada slot del dock | Cada superficie abre y cierra | ⬜ | |
| 2 | Ejercicio | Completar un ejercicio con ≥1 estrella | Estrellas y progreso se registran | ⬜ | |
| 2 | Ejercicio | Completar el siguiente | El drawer avanza, no se traba | ⬜ | |
| 3 | **Score / confirming** | Tocar "Save proof" on-chain | CTA se deshabilita, aparece estado de confirmación (~5s) | ⬜ | **nuevo** |
| 3 | **Score / éxito** | Esperar el receipt | Recién ahí: overlay de éxito, done-hold, y el score aparece en leaderboard | ⬜ | |
| 3 | **Score / persistencia** | Cerrar y reabrir | El score guardado sigue ahí | ⬜ | |
| 4 | **Badge / confirming** | Reclamar un badge ganado | Sin celebración hasta el receipt | ⬜ | **nuevo** |
| 4 | **Badge / éxito** | Esperar el receipt | Háptica, celebración, modal `piece-unlocked`, badge en Owned | ⬜ | |
| 5 | **Cancelación** | Tocar Save, **rechazar** en la wallet | Toast de cancelado. **Sin** overlay de éxito, **sin** overlay de error, score NO persistido | ⬜ | |
| 5 | **Cancelación (badge)** | Tocar Claim, **rechazar** | Vuelve a idle. Sin celebración, `justClaimed` sin setear | ⬜ | |
| 5 | **Error / revert** | Reclamar un badge que la wallet YA tiene (si el CTA lo permite) | Overlay de error con retry. **Nunca** éxito | ⬜ | ver nota |
| 6 | Refresh | Recargar durante `confirming` | Estado coherente al volver: badge se auto-cura leyendo la cadena | ⬜ | |
| 6 | Cierre / reapertura | Cerrar MiniPay durante `confirming`, reabrir | Sin celebración fantasma, sin score falso | ⬜ | ver riesgo |
| 7 | Shop | Abrir Shop desde el dock | Tiles cargan con precio (`$1.99` en PRO), no "Coming soon" | ⬜ | |
| 7 | Shop | Cerrar Shop | Vuelve al HUB, dock intacto | ⬜ | |
| 7 | Navegación | Arena → Coach → HUB | Sin pantallas muertas ni loading infinito | ⬜ | |

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

## Resultado

- Bloqueantes encontrados: _(pendiente)_
- Bloqueantes corregidos: _(pendiente)_
- Recomendación de checkpoint: _(pendiente)_
