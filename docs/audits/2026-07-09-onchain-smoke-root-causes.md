# Smoke on-chain — causas raíz (2026-07-09)

Investigación read-only. **Ningún fix aplicado.** Metodología: systematic-debugging,
Fase 1–3 completas para los dos bugs; Fase 4 (test + fix) pendiente de tu ok.

## Resultado del smoke

| # | Ítem | Resultado |
|---|------|-----------|
| 1 | LEARN Save proof (dorado) | 🔴 falla en device con >15★ · CTA aparece = fix #183 OK |
| 2 | LEARN Claim Badge | 🔴 nunca aparece, para nadie |
| 3 | LEARN/PLAY Shop Shield | ✅ no es bug — retirado a propósito |
| 4 | LEARN Get Peones | ✅ |
| 5 | PLAY Save Victory (permit) | ✅ |

---

## 🔴 Bug 1 — `/api/sign-score` 400: el cap de score es la mitad del score alcanzable

**Evidencia:** tu log de Vercel, `POST /api/sign-score → 400`, 40ms, sin tocar la cadena.
No es rate limit (sería 429) ni origin (403). Un 400 solo sale de un `parseInteger` fuera de rango.

**Cadena causal:**

```
exercises-screen.tsx:826   score = max(1, totalStars) * 100n     // totalStars es POR PIEZA
sign-score/route.ts:31     parseInteger(score, "score", 0, 1_500)  → throw "Invalid score" → 400
```

El comentario del route dice *"Max score: 15 stars × 100 pts = 1500 per piece level"*.
Pero el catálogo real (`puzzles.generated.ts`, verificado hoy) tiene **10 ejercicios por pieza
en las 6 piezas** → `getMaxPossibleStars = 10 × 3 = 30★` → score máximo **3000**.

El cap asume pools de 5 ejercicios. Los pools crecieron a 10 y el cap no se movió.

**Consecuencia:** cruzar 15★ en una pieza **inhabilita permanentemente** el save on-chain de
esa pieza. Mientras peor juegas, mejor funciona. Tu teléfono viejo tiene 18★ → 1800 > 1500 → 400.
Web y celu nuevo funcionaban porque su progreso estaba por debajo de 15★. Por eso cerrar y
reabrir no cambia nada: no es estado corrupto, es el valor del score.

**Blast radius:** cualquier jugador que pase 15★ en cualquier pieza. Es la mitad del recorrido.
`ScoreboardUpgradeable.submitScoreSigned` acepta `uint256` sin cap, así que el límite es 100%
del servidor. Los limitadores on-chain (leídos hoy en mainnet: `submitCooldown=60s`,
`maxSubmissionsPerDay=25`, `paused=false`) están sanos y no intervienen aquí.

**Fix propuesto:** subir el cap a 3000 y atarlo al catálogo con un test, para que no vuelva a
derivar cuando cambie el tamaño de los pools. El cap sigue siendo una cota anti-cheat legítima;
solo está mal calibrada.

**Deuda relacionada (no bloqueante):** el frontend no decodifica los custom errors del contrato
(`CooldownActive` `0xc1ab61a1`, `DailyLimitReached` `0xeba8fe8a`). Si algún día te pega el
cooldown de 60s, verás el mismo "Try again" genérico y no sabrás por qué. Vale un ticket aparte.

---

## 🔴 Bug 2 — Claim Badge: el sheet lee `stars` como array; hace un año que es un mapa

**No es un problema de descubribilidad. El botón no existe para nadie**, con cualquier número
de estrellas. Tu instinto de que "debería estar ahí" era correcto.

```
badge-sheet.tsx:49   Array.isArray(parsed.stars) ? parsed.stars : [0, 0, 0, 0, 0]
types.ts:102         stars: Record<string, number>   // id-keyed desde 2026-06-16
```

`Array.isArray()` sobre un objeto da `false` **siempre** → el sheet cae al fallback `[0,0,0,0,0]`
→ `totalStars = 0` → `earned = 0 >= 10` = false → las 6 piezas se pintan `locked` → el pill verde
"Claim" nunca se renderiza (`badge-sheet.tsx:151`).

Es una regresión de la migración a progreso id-keyed (cluster Exercises-Builder, 2026-06-16).
El otro consumidor de la misma clave, `use-hub-data.ts:83-87`, **sí** fue migrado y tolera las dos
formas — con un comentario que cita la migración por nombre. `badge-sheet.tsx` se quedó afuera.

Daños colaterales del mismo bug: la barra de progreso del sheet siempre marca 0%, y
`maxStars = stars.length * 3` da 15 en vez de 30.

**Fix propuesto:** reusar el adaptador que ya existe (`progress-adapter.ts`, `starsIdMapToArray`)
en vez de re-parsear a mano. Test primero, reproduciendo un `stars` id-keyed con 18★.

---

## ✅ No-bug 3 — el Shield ya no se compra en el Shop

Mi checklist estaba mal, no la app. `5c8e0f5d refactor(shop): retire Shield Shop-TX purchase path
(itemId 2)`: los Shields ahora vienen del Season Pass, del welcome-pack, o de 2 Peones por rescate.
`SHOP_ITEMS` (shop-catalog.ts:55) contiene PRO + Founder Badge + el sibling CELO, nada más.

Esto además explica el **baseline VR `hub-shop-sheet-open` en rojo**: espera Coach Credits +
PRO $1.99 + Shield $0.03, tres SKUs retirados. El baseline está viejo, la app está bien.
Refrescarlo ya no es una decisión de producto, es limpieza.

---

## Lo que pediste como UX (no son bugs, son cambios de diseño)

1. **CTA dorado enterrado en MISSION.** De acuerdo con el diagnóstico. Tu propuesta: llevarlo a la
   zona de iconos especiales (labyrinth/tactics), o un punto rojo sobre el pill de MISSION.
2. **Punto rojo de "algo para reclamar"** (como el globo rojo del regalo de tu referencia), como
   patrón general que guíe hacia lo reclamable.

Ambas son la misma pieza: **un sistema de badge de notificación** para superficies con algo
pendiente. No las toco sin pasar por el flujo de diseño (GOAL → Sally → mock → código).
Ojo con el orden: el punto rojo sobre el badge no sirve de nada hasta que el Claim exista (bug 2).

---

## Orden que propongo

1. **Bug 2** (badge) — puro, testeable, sin plata de por medio. Empieza aquí.
2. **Bug 1** (cap de score) — un número y un test que lo ata al catálogo.
3. Re-smoke de 1 y 2 en tu teléfono viejo (el de 18★ es el mejor caso de prueba que tenemos).
4. Refrescar baseline VR del shop.
5. Sistema de notificación (punto rojo) + reubicación del CTA dorado → flujo de diseño.
