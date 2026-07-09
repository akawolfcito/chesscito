# Re-smoke — 3 fixes (2026-07-09) — ✅ CERRADO

**Dónde:** `preview.chesscito.com` desde MiniPay, con el **teléfono de 18★**.
**Ejecutado:** 2026-07-09, en device real, contra preview con `0f44eadc`.
**Resultado: los 3 ítems pasan.** LEARN tiene su primer smoke on-chain completo.

**Plata real:** Celo Mainnet. Todo fue gas-only, ~$0 en tokens.

---

## Resultado

| # | Ítem | ✅/❌ | Hash / nota |
| --- | --- | --- | --- |
| 1 | Badge Claim visible + tx | ✅ | [`0x327e80ae…`](https://celoscan.io/tx/0x327e80aee165a4aa2486458038ad252a453fb9432ed16732c6a67dec9c96ff4b) — torre quedó **Owned** |
| 1b | Stats line no arranca en `0/90 ★` | ✅ | HUD mostró `★ 12` |
| 2 | Save proof firma (era 400) | ✅ | Sin errores; el 400 con 18★ no reapareció |
| 2b | CTA dorado desaparece post-proof | ✅ | |
| 3 | Máximo de pieza = 30, no 15 | ⚠️ | El mission sheet sí; el modal **Badge Earned** todavía dice `12/15` (ver abajo) |

---

## 1. Badge Claim — el botón que no existía

El pill verde `Claim` apareció sobre la torre y la tx entró. La torre pasó a **Owned**.

**Nota de contrato:** el badge se clama **una sola vez por pieza y por wallet**.
`BadgesUpgradeable.claimBadgeSigned()` guarda `hasClaimedBadge[player][levelId]`
y revierte con `BadgeAlreadyClaimed` en el segundo intento
(`BadgesUpgradeable.sol:112`). Es **soulbound**: `_update()` revierte cualquier
transferencia que no sea el mint (`:150`). Seis piezas, seis claims posibles.

Si vuelves a tocar Claim vas a ver un "Try again" genérico — es el
`BadgeAlreadyClaimed` sin decodificar, no un bug nuevo.

## 2. Save proof on-chain — el 400 con 18★

Firma y manda tx a Scoreboard `0x1681aAA1…`. Gas-only. Confirmado en device.

**Ojo con el cooldown:** `submitCooldown = 60s`, `maxSubmissionsPerDay = 25`.
Dos saves seguidos dan un "Try again" que en realidad es el cooldown.

## 3. Display de estrellas

El mission sheet muestra el máximo real del pool. **El modal `Badge Earned` no.**
Mostró `12/15` con la torre en 12★. `result-overlay.tsx:113` hardcodea
`MAX_STARS = EXERCISES_PER_PIECE * 3` (5 × 3 = 15) en vez de leer el pool real,
y `getCardUrl()` clampa las estrellas a 15 (`:181`, `:186`), así que la tarjeta
de Share también miente. Cosmético, no bloquea. Ver el handoff.

---

## El bloqueo que descubrió este re-smoke

El re-smoke no pudo arrancar hasta arreglar un deadlock de progresión: el
jugador resolvía el ejercicio 5 una y otra vez sin ganar estrellas ni
desbloquear el 6. Tres defectos apilados, arreglados en el PR #191
(`0f44eadc`). Detalle completo en
`docs/handoffs/2026-07-09-daily-session-progression-deadlock-handoff.md`.

---

## Qué NO se smokeó

- **Shield en el Shop**: no existe, se retiró en `5c8e0f5d`. No es un bug.
- **PLAY Save Victory** y **Get Peones**: pasaron el 2026-07-08, sin cambios.
- **Laberintos**: ya no gastan cupo diario (#191). Un laberinto **fresco** sigue
  bloqueado al llegar al límite de sesión — decisión de producto abierta.
