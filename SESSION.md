# Session Handoff — 2026-07-24

## Reanudar con "continuemos"
Estás **a mitad del slice `WebWalletProvider`**, en la rama `feat/web-wallet-provider`.
El plan detallado, contratos, tests pendientes y riesgos viven en:
**`docs/handoffs/2026-07-23-web-wallet-provider-handoff.md`** — leelo primero.
Primer comando: `git switch feat/web-wallet-provider`. Primer paso: transport `fallback`
(lógica pura, TDD, sin navegador). NO montar Privy en MiniPay · NO mergear · NO tocar prod.

## Completed (esta sesión)
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
- **Harness Fase 0 mergeado a `main` local** (`--no-ff`). Docs de validación + runbook + diagnóstico.
- **`PRIVY_APP_SECRET` eliminado del `.env.template`** (el backend no usa SIWE; nunca verifica sesiones
  server-side). `NEXT_PUBLIC_PRIVY_APP_ID=` se queda (vacío, público).
- **Slice `WebWalletProvider` ARRANCADO** — primer ladrillo: `resolveWalletBranch` + tipo
  `WalletBranch` + 6 tests verdes. Ver handoff.

## Current State
- **Branch activa**: `feat/web-wallet-provider` — 2 commits sobre `main`:
  - `bbf9448` feat(wallet): resolver de rama sin leer estado no-hidratado (6/6 tests)
  - `59e1c30` docs(handoffs): handoff del slice
- **`main` local**: assets (pusheados por el founder) + harness Fase 0 mergeado + handoff de sesión.
  **Listo para que el founder pushee.** El agente NO pushea `main`.
- **Working tree**: limpio. Queda untracked `docs/specs/2026-07-23-privy-web-access-audit.md`
  (del 23, NO pertenece al slice — decidir si commitear/descartar).

## Next Tasks (slice — detalle completo en el handoff)
1. **Transport `fallback([...])` sólo para la rama web** (§10.7: Forno da 403 en browser; endpoints a
   confirmar contra doc de Celo). ← empezar por acá, TDD.
2. Deps en `apps/web`: `@privy-io/react-auth`, `@privy-io/wagmi`.
3. `WebWalletProvider` paralelo a `WalletProvider`. Chain: **mainnet Celo 42220**.
4. `NEXT_PUBLIC_PRIVY_ENABLED` al `.env.template`.
5. Client boundary que consuma `resolveWalletBranch` y monte el provider **tras** hidratar
   (`undecided` = shell estable, NINGÚN provider).
6. 7 tests pendientes (lista en el handoff).

## Blockers
- Ninguno. El gate que bloqueaba está cerrado.

## Notes
- ⚠️ **§8.2 del doc de validación quedó obsoleto** ("mismos transports que hoy"): se escribió antes del
  smoke. Manda §10.7 — la rama web lleva transport propio.
- ⚠️ **Decisión SSR cerrada**: `isMiniPayEnv()` lee `window` → `false` en SSR. NO bifurcar en el render;
  usar `resolveWalletBranch` con `hydrated` explícito. Detalle en el handoff.
- El merge/push de `main` lo hace el founder; el agente sólo pushea ramas si se le pide.
- Harness corre aparte: `pnpm -C tools/privy-celo-harness run dev` → puerto **5173** (no lo levanta el
  `dev` de la raíz).
