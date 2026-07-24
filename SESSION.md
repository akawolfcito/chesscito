# Session Handoff — 2026-07-24

## Completed
- **✅ Gate Fase 0 de Privy × Celo CERRADO, sin condiciones pendientes.** Validado empíricamente
  contra Celo Sepolia con embedded wallet real: login por email → wallet creada → **firma** →
  **tx de 0 CELO con `receipt: success`** → chain `11142220`. **Ninguna incompatibilidad Privy × Celo.**
  Evidencia en §10.3 / veredicto en §10.6 de `docs/validations/2026-07-23-privy-celo-phase-0.md`.
- **Persistencia de address verificada CROSS-BROWSER** — logout + login desde **otro navegador** →
  misma address. Otro navegador = otro localStorage ⇒ vino del servidor de Privy, no de caché local.
  La wallet es **estable por cuenta, no por dispositivo**, que es justo lo que el modelo de
  entitlements (keyed por address EVM) necesita.
- **Bug encontrado y arreglado: `Buffer is not defined`.** El SDK de Privy usa el global `Buffer` de
  Node y **Vite no polyfillea globals de Node**. Rompía firma Y envío. Fix en
  `tools/privy-celo-harness/src/polyfills.ts`, importado primero en `main.tsx`, con test de regresión
  que vigila el **orden de import**. Harness: **29/29** tests, typecheck y build verdes.
- **Docs nuevos**: `docs/validations/2026-07-24-privy-harness-runbook.md` (paso a paso reusable) y
  `docs/validations/2026-07-24-privy-harness-smoke-diagnosis.md` (diagnóstico completo).
- **Ramas separadas**: los 7 commits de assets salieron de la rama del harness a `chore/art-assets`.
  **Ya mergeados y pusheados a `main` por el founder** (`origin/main` = `dfda463d`).

## Current State
- **Branch**: `chore/privy-celo-harness` — 6 commits sobre `origin/main`. NO pusheada, NO PR.
  `33a29ee6`, `c1556fce`, `c1722a77` (harness original) + `72a64554` (fix Buffer),
  `6e65b4ee`, `178af88c` (docs de validación).
- **origin/main**: `dfda463d`, con los assets ya adentro.
- **Uncommitted**: `apps/web/.env.template` (limpiado, ver abajo) y
  `docs/specs/2026-07-23-privy-web-access-audit.md` (untracked).

## Decisión tomada esta sesión: env vars de Privy
- `NEXT_PUBLIC_PRIVY_APP_ID=` → **se queda** (vacío, sin placeholder). Es público, client-side, y el
  slice lo necesita.
- `PRIVY_APP_SECRET` → **eliminado del template.** No se va a usar con el diseño actual: el backend
  **no usa SIWE**, ancla entitlements a tx on-chain keyed por address EVM, así que nunca necesita
  verificar un token de sesión de Privy server-side. Dejar el nombre invitaba a llenarlo y a cargar
  con un secreto para nada.

## Next Tasks
1. **Slice `WebWalletProvider`** ← el paso natural, ya desbloqueado. Requisitos en §8 del doc de
   validación. Paralelo a `WalletProvider`, bifurcado por `isMiniPayEnv()`, detrás de flag
   `NEXT_PUBLIC_PRIVY_ENABLED` (off en prod). MiniPay intacto.
2. **⚠️ Requisito NO opcional del slice (§10.7)**: transport explícito con `fallback([...])`.
   El RPC default de Celo Sepolia (Forno) devuelve **403 bajo ráfaga en browser**. La tx del smoke
   salió igual porque **Privy transmite por su RPC interno** (`Embedded1193Provider`), pero las
   lecturas vía wagmi (`useBalance`, `useWaitForTransactionReceipt`) **sí** dependen del nuestro.
   **MiniPay enmascaró esto siempre** porque inyecta su propio RPC — por eso `http()` pelado nunca
   se ejerció en prod (`apps/web/src/components/wallet-provider.tsx:22-24` lo usa igual).
3. Decidir qué hacer con `docs/specs/2026-07-23-privy-web-access-audit.md` (untracked desde el 23).

## Blockers
- Ninguno. El gate que bloqueaba está cerrado.

## Notes
- El merge/push de `main` lo hace el founder; el agente sólo pushea ramas si se le pide.
- El harness corre **aparte** del app: `pnpm -C tools/privy-celo-harness run dev` → puerto **5173**.
  `pnpm run dev` en la raíz arranca turbo (landing 3000, web 3001) y **no** levanta el harness.
- Si el slice se monta sobre Vite en algún momento, el gotcha de `Buffer` vuelve. Sobre Next/webpack
  hay que verificarlo, no asumirlo.
