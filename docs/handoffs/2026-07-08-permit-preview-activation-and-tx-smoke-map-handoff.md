# Handoff — Permit-mint Preview activation + PLAY/LEARN on-chain tx smoke map (2026-07-08)

## TL;DR
- **Root cause found + FIXED**: "Save Victory" en PLAY caía al fallback **approve** (no pedía firma) porque `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` estaba **solo en Production**, no en **Preview** (donde el founder hace QA). Es `NEXT_PUBLIC_` → se congela en build-time; sin el flag, `isVictoryPermitMintEnabled()` = `false` y el bloque permit se salta por completo (no es el "segundo fallback por error técnico", es que el primer path ni se intenta).
- **Founder activó el flag en Preview + redeploy → permit funcionó** (save por `mintSignedWithPermit`, 1 sola tx, sin approve). Confirmado on-device.
- Sesión de QA en curso: smokes **sin Season Pass y sin PRO** en PLAY y LEARN. **Sin cambios de código** (working tree limpio).

## Diagnóstico (cómo se encontró)
1. `useMintVictory` (`apps/web/src/lib/coach/use-mint-victory.ts`): el bloque permit (L426-496) solo corre si `isVictoryPermitMintEnabled()`. En el `catch` (L489) un fallo técnico cae silenciosamente a approve (L498-520); una cancelación de usuario re-lanza.
2. `isVictoryPermitMintEnabled()` (`feature-flags.ts:60`) = `process.env.NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED === "true"`.
3. `vercel env ls` → el flag existía **solo en Production** (seteado ~2026-07-02). Ausente en Preview/Development.
4. El handoff `2026-07-03-victory-nft-permit-mint-mainnet-activation-handoff.md` (L47) ya listaba "Enable flag in Production" como pendiente, pero nunca se replicó a Preview.

## Tx verificada (contexto de la tx que el founder encontró)
`0xfb19c319…301eee` (Celoscan) — save de derrota vía **approve/mintSigned** (path viejo, antes de activar permit):
- `From` wallet `0xCc4179A2…` → `Interacted With` VictoryNFT proxy `0x0eE22F83…`.
- 6 transfers USDT: pago NFT Easy $0.01 = **0.008 → treasury `0xcD3837DD…`** (80%) + **0.002 → prize pool `0x63DEfFD3…`** (20%); resto = gas pagado en USDT vía fee-currency abstraction de Celo/MiniPay (fee-collector `0x…Ce106A5`, con reembolso 0.001457 del gas no usado).
- El mint ERC-721 (`0x0 → wallet`) va en la pestaña **NFT Transfers**/Logs (evento `VictoryMinted` con `tokenId`), no en la vista ERC-20.
- **Permit vs approve** se distingue por el método en "Input Data": `mintSignedWithPermit` (selector `b31e32cc`, 1 tx) vs `mintSigned` (+ tx `approve` separada previa).

## Mapa de smokes on-chain (sin PRO / sin Season Pass)

### PLAY (arena) — **1 sola tx on-chain**
- **Save Match / Save Victory** (`useMintVictory` → `mintSigned` / `mintSignedWithPermit`, VictoryNFT `0x0eE22F83…`). Único write on-chain del gameplay.
- Alcanzable desde **5 end-states** (misma tx, distinta UI): **win/checkmate** (full-screen `VictoryCelebration`) · **loss** · **draw** · **stalemate** · **resign** (los 4 = Save inline en `arena-end-state.tsx`).
- `save-score` al leaderboard **NO existe en PLAY** (vive en LEARN; además el leaderboard de PLAY quedó oculto en Lote 1 B5).
- Faltaba cubrir: **win-save** (UI full-screen) y comparar **permit vs approve**.

### LEARN (exercises) — **4 txs distintas** (`exercises-screen.tsx` L311-313: 3 `useWriteContract`)
1. **Claim Badge** — gas-only, `/api/sign-badge` → `claimBadgeSigned` (Badges `0xf92759E5`). Se desbloquea al llegar a `BADGE_THRESHOLD` estrellas (`badge-sheet.tsx`, estado `claimable`). Único de LEARN.
2. **Save Score on-chain** (Leaderboard Proof) — gas-only, `/api/sign-score` → `submitScoreSigned` (Scoreboard `0x1681aAA1`). Gated `canSaveOnChain = scorePendingNew && scoreboardAddress != null` (L2270). Único de LEARN.
3. **Shop buy** — `writeShopAsync` → Shop `0x24846C77` (Shield, etc.).
4. **Get Peones / PRO / Season Pass** — payment rail single-tx `ERC20.transfer(treasury)` (compartido con PLAY).

**GOTCHA Save Score (dos caminos, `save-client.ts:6-15`):**
- **Default = OFF-CHAIN** (`postScoreSave` → `/api/scores/save`): NO genera tx, no firma ni broadcast. Puede costar peones (ledger off-chain → puede devolver `insufficient_peones`).
- **On-chain = opcional** (#2 arriba). El SAVE verde default NO aparece en Celoscan; solo el botón on-chain/Leaderboard Proof genera tx.

## Estado actual
- **Branch**: `main` (limpio, sin uncommitted). Sin PRs abiertos de esta sesión.
- **Build**: sin cambios de código → baseline previo intacto.
- **Preview**: flag `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED=true` activo + redeployado. Permit verificado on-device.

## Próximos pasos
1. Continuar smokes sin PRO / sin Season Pass:
   - PLAY: **win-save** (VictoryCelebration) por permit.
   - LEARN: **Claim Badge** (gas-only), **Save Score on-chain** (Leaderboard Proof), **Get Peones** (pago), **Shop/Shield**.
2. Reconciliar con el plan MiniPay delivery: Lote 2 (B1 free off-chain save + B2 collapse green SAVE) y Lote 3 (B4 MAX_SHIELDS 30→3). Ver `2026-07-08-minipay-delivery-lote1-handoff.md`.
3. Confirmar consistencia del flag entre Preview y Production antes de listing (scope atómico Vercel).

## Open questions
- ¿El botón "Save Score on-chain" (Leaderboard Proof) está expuesto en la UI actual o queda dormido tras el default off-chain? Verificar en device durante el smoke.
- MiniPay "unknown transaction / dev mode" para el contrato VictoryNFT: ¿bloquea usuarios reales o es solo warning? (pendiente pre-listing, ver handoff 2026-07-03).

Wolfcito 🐾 @akawolfcito
