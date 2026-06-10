# Handoff — Get Peones surface + Coach auto-run gate (release)

> 2026-06-09. Cierre del bloque antes de abrir SaveScore. Estado: listo para
> promote a production pendiente de smoke interactivo del founder + go explícito.

## Alcance del release

Dos entregables cerrados sobre `main`:
1. **Get Peones surface** — comprar 50 Peones ($0.50) con el Stablecoin Direct
   Payment Rail (1 tx, sin approve), surface candy/premium, dropdown de token,
   estados cancelado/insufficient/success pulidos.
2. **Coach auto-run gate** — el análisis real/API del Coach ahora es 100%
   user-triggered (se eliminó el auto-run en mount del viewer).

`main` está **22 commits adelante** de `production` (`origin/production` = `0d2a38be`).

## Commits relevantes

**Coach gate**
- `7fe150ac` fix(coach): gate viewer auto-run behind explicit user action

**Get Peones — pulido/fixes de esta sesión**
- `d6d5fe37` fix(payments): friendly cancel, MiniPay add-cash deeplink, CTA font
- `248c6399` style(payments): center Get Peones in the forest-frame popup shell
- `7e85377f` style(payments): collapsible token dropdown + drop no-approve line
- `90e54ba8` style(payments): candy/premium polish for GetPeonesSheet

**Get Peones — surface base (rail cluster previo)**
- `31a3e7f5` feat(payments): wire Get Peones sheet to Peones HUD chip
- `c68ccc6c` feat(payments): auto-select stablecoin balance for Get Peones
- `ba122535` feat(payments): add GetPeonesSheet component
- `59ca62a2` feat(payments): add usePaymentRail hook for Get Peones

**Rail backend (verify + builder + guardrails)**
- `335d91bb` fix(payments): treasury env fallback + anti-replay guard for verify-payment
- `f7000669` feat(api): add verify-payment endpoint for Peones pack
- `bb5d3eab` feat(payments): add Transfer-event verification helper
- `c2026d24` feat(payments): add pure stablecoin transfer tx builder
- `ca66eccc` feat(payments): add stablecoin rail constants and treasury config

**Docs**
- `67d25890` docs(product): tx primitives note + payment/economy/coach audit

## Estado preview

- Deployment Ready: `https://chesscito-7j0ybo2nv-goodwolf.vercel.app`
- Alias estable de main: `https://chesscito-git-main-goodwolf.vercel.app`
- Commit en preview: `67d25890`.

## Resultado de smoke

**Automatizado (carga / no-crash):**
- `/hub` → HTTP 200, app shell con Peones chip + Connect. ✅
- `/coach/[uuid]` → HTTP 200, sin server error (los "500" en el HTML son ruido
  CSS/IDs; un 500 real devolvería código 500). ✅

**Validado por tests (gate Coach):**
- 6 tests en `coach-game-client.test.tsx`: montar el viewer sin análisis NO llama
  `askCoach`/`/api/coach/analyze` (cold-load, PRO, cached, re-entry post-cancel);
  el tap SÍ dispara; quick review local renderiza sin API. Suite 3366/3366.

**Interactivo (pendiente founder, requiere wallet):**
- Get Peones: tap chip → sheet candy → token auto-select → (compra real opcional).
- Coach: `/coach/[gameId]` conectado sin análisis → NO auto-run → Quick Review/CTA
  → tap Ask Coach dispara → PRO muestra incluido sin auto-arrancar.

## Guardrails (confirmados en código)

- **No approve para Get Peones** — el rail hace `ERC20.transfer(treasury)` directo;
  nunca `approve`/`transferFrom`. (`usePaymentRail` + tx builder).
- **No Shop** — el rail no toca `Shop.sol` `buyItem`; surface aislado.
- **Token auto-select** — `selectPayableToken` elige USDC→USDT→cUSD por balance;
  nunca deja pagar sobre balance insuficiente; dropdown manual respeta el guard.
- **Idempotency** — `/api/verify-payment` usa `pack_purchase:{chainId}:{txHash}:
  {logIndex}` (ledger append-only, unique key); reverifica → `duplicate:true`, sin
  doble crédito. Anti-replay `receipt.to == token` (rechaza transfers a Shop).
- **Coach real/API user-triggered** — sin auto-run en mount; solo tap `Ask Coach`
  (y entradas ya manuales: immediate/victory-mint/history).
- **PRO incluido pero manual** — PRO no auto-arranca; el tile muestra "Unlimited ·
  PRO active" y el análisis se dispara al tap (bypass de paywall, no auto-run).

## Production actual (intacta antes del promote)

- `origin/production` = `0d2a38be` feat(exercises): add guest session seed for rotation.
- **No tocada** en todo este bloque (todos los push fueron a `origin/main`).

## Recomendación de promote

**Promover `main → production`** (fast-forward, flujo `docs/release/release-process.md`)
una vez el founder confirme el smoke interactivo en verde. Riesgo bajo: prelaunch,
sin usuarios reales, FF reversible. Tras promote: confirmar `origin/main` ==
`origin/production` y smoke mínimo en prod (`/hub` carga, chip abre sheet, Coach no
auto-run).

## Próximo bloque (no en este cierre)

**SaveScore off-chain/Peones** — spec corto antes de tocar código (mover el save
básico fuera de on-chain para matar el 429 del sign-score; proof on-chain opcional).
Ver `docs/product/chesscito-payment-economy-and-coach-flow-audit-2026-06-09.md` §2.
