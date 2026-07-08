# Handoff — MiniPay delivery Lote 1 + reset tooling (2026-07-08)

## Estado
Branch `chore/minipay-delivery-lote1-copy-visibility` → merge a `main`.
Full unit suite verde: **4681 passing** (390 files). Typecheck + lint limpios.

## Qué se hizo

### Auditoría (pre-trabajo)
- `docs/superpowers/specs/2026-07-07-minipay-delivery-audit.md` — auditoría A–E
  producto+ingeniería para cerrar entregable MiniPay.
- `docs/superpowers/specs/2026-07-07-save-score-onchain-diagnosis.md` — el save
  on-chain gas-only YA está LIVE en mainnet (`handleSaveScoreOnChain` →
  `submitScoreSigned`, Scoreboard `0x1681aAA1…`, nonpayable).
- **Decisión de producto:** Shield = **COMBO Shield (S1)**, NO rescata Daily
  Streak (S2). Taxonomía: S1 combo ejercicios / S2 daily / S3 arena-wins.

### Lote 1 — copy/visibility (cero lógica de negocio nueva)
- **B5** (`4ba75b1`): ocultar tab Leaderboard en `/arena` (PLAY) hasta ELO real.
  Filtro puro en `persistent-dock.tsx`; LEARN conserva su leaderboard.
- **B6/B8/B9** (`6d4d8cb`): copy softening (ES/EN parity):
  - On-chain LEARN save: "Yours for life"/"Save" → "Save today's training
    proof"/"Save proof".
  - Welcome Package hint: "Tap to claim your reward" → "Tap to open your
    Welcome Package".
  - Roadmap pass: "Entry passes tied to future Celo community events" →
    "Consistent players may qualify for community events and prizes".

### Reset tooling (`9461ea0`)
- `apps/web/scripts/reset-wallet.ts` — reset reutilizable server-side. Default
  = limpia PRO + Season Pass (re-comprables); `--full` = new-user completo.
  Safe by default (dry-run salvo `--commit`). El usuario lo corre.
- `docs/runbooks/2026-07-07-reset-wallet-for-testing.md` — mapa LEARN/PLAY/
  compartido + comandos manuales.

## Próximos pasos (próxima sesión — RESUME AQUÍ)
1. **Prueba manual del founder** (cuenta MiniPay nueva + reset):
   - Re-comprar PRO y Season Pass por separado; validar interacción distinguida
     (PRO **incluye** el Pass → "included with PRO"; Pass solo → "Pass Active").
   - Validar tx in-game: save score on-chain (gas-only), Victory NFT mint.
   - Confirmar once-per-account (Welcome Pack / Pass / PRO) tras cambios de PLAY.
   - Reportar resultado → decide si algo se rompió.
2. **Lote 2** (post revisión visual): B1 volver GRATIS el save off-chain
   (`save_game` deja de cobrar) + B2 colapsar/ocultar botón verde pago.
3. **Lote 3**: B4 `MAX_SHIELDS` 30→3 (revisar bonus Season Pass).

## Open questions
- **NFT claim "valores raros"**: el founder recuerda querer simplificar el claim
  del Victory NFT. Hoy el pre-mint muestra precio ($ por dificultad) + dificultad/
  movidas/tiempo; post-mint "Claimed!" es limpio. Falta que el founder precise
  QUÉ valor vio como raro (screenshot) → decidir si es bug o copy.
- **VR baselines**: B5 (tab dock) y B6 (texto botón) cambian visuales. Correr
  `pnpm test:e2e:visual` y refrescar baselines si aplica (no corrido esta sesión).

## No implementar (evitar scope creep)
Merkle claim de scores, NFT de LEARN, ELO/ranking, leaderboard nuevo de PLAY,
Daily Streak recovery / Daily Recovery Shield, rediseño de Save Victory.
