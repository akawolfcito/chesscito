# Re-smoke — 3 fixes (2026-07-09)

**Dónde:** `preview.chesscito.com` desde MiniPay, con el **teléfono de 18★** (el que fallaba).
Ese device reproduce los tres bugs a la vez; en uno nuevo no verías nada.

**Plata real:** Celo Mainnet. Todo este checklist es **gas-only**, ~$0 en tokens.

**Antes de empezar:** confirma que el preview trae `195ce2a6` o posterior.

---

## 1. Badge Claim — el botón que no existía

Abre el sheet de badges (tab del dock).

- [ ] La **torre** aparece como **Claimable**, con el pill verde `Claim`.
      Antes: las 6 piezas en `Locked`, sin importar tus estrellas.
- [ ] La línea de stats dice algo como `18/180 ★`, no `0/90 ★`.
      Ambos números estaban mal: el numerador siempre 0, el denominador con pools de 5.
- [ ] Toca `Claim` → firma → tx a Badges `0xf92759E5…`. Gas-only.
- [ ] Tras el claim, la torre pasa a **Owned**.

**Si el pill verde no aparece:** el fix no llegó, o tu torre tiene <10★. Revisa el contador.

## 2. Save proof on-chain — el 400 con 18★

- [ ] Con la torre en 18★, abre el mission sheet y toca el CTA dorado.
- [ ] Debe **firmar** y mandar tx a Scoreboard `0x1681aAA1…`. Gas-only.
      Antes: `POST /api/sign-score → 400` en 40ms, la tx nunca salía.
- [ ] Vuelve a abrir el sheet: el CTA dorado ya **no** debe estar (ya hay proof on-chain).

**Cómo confirmar que fue de verdad:** busca la tx en Celoscan, método `submitScoreSigned`.

**Ojo con el cooldown:** el contrato tiene `submitCooldown = 60s` y `maxSubmissionsPerDay = 25`.
Si guardas dos veces seguidas verás un error genérico "Try again" que en realidad es el cooldown.
No es un bug nuevo; es la deuda de decodificar los custom errors. Espera un minuto.

## 3. Display de estrellas (sanity, no bloqueante)

- [ ] El mission sheet muestra el máximo de la pieza como **30**, no 15.
      Solo se notaría si el catálogo crece; se verifica de paso.

---

## Qué NO smokear

- **Shield en el Shop**: no existe, se retiró en `5c8e0f5d`. No es un bug.
- **Laberintos**: no alimentan el score. Nada que verificar acá.
- **PLAY Save Victory** y **Get Peones**: ya pasaron el 2026-07-08, sin cambios desde entonces.

---

## Resultado

| # | Ítem | ✅/❌ | Hash / nota |
|---|------|------|-------------|
| 1 | Badge Claim visible + tx | | |
| 1b | Stats line `18/180 ★` | | |
| 2 | Save proof firma (era 400) | | |
| 2b | CTA dorado desaparece post-proof | | |
| 3 | Máximo de pieza = 30 | | |

Si el 2 pasa, LEARN queda con su primer smoke on-chain completo y se puede cerrar el bloque.
