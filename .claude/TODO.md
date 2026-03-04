## Session Plan - 2026-03-04

### Current State
- ✅ **Completed**: Monorepo base generado con Celo Composer; app web y contracts separados en `apps/web` y `apps/contracts`.
- 🚧 **In Progress**: Correcciones iniciales de wallet/navbar en `apps/web`; backlog y execution plan para Buildathon/MiniPay.
- ⚠️ **Blockers**: No existen milestones/labels/issues de ejecución; no hay routes MVP, contracts productivos ni guía MiniPay en el repo.
- 🔧 **Tech Debt**: README genérico, contrato ejemplo `Lock.sol`, sin leaderboard/indexing y sin estructura de submission pack.

### Project Context
- **Type**: Web + Smart Contracts monorepo
- **Stack**: Next.js 14, TypeScript, Tailwind, wagmi/viem, RainbowKit, Hardhat, Turborepo
- **Testing**: TypeScript type-check en web, Hardhat tests en contracts

### Next Steps (Prioritized)

#### Priority 1: Critical
1. **Backlog operativo en GitHub** - M
   - **Why**: Sin milestones/issues no hay ruta crítica visible ni ownership claro.
   - **Acceptance**: Milestones M0-M4, labels por tipo/área/prioridad e issues creados con AC/DoD.
   - **Notes**: Mantener títulos cortos y labels consistentes para PRs pequeños.

2. **Baseline MiniPay + app skeleton** - M
   - **Why**: Todo el MVP depende de rutas móviles, detección MiniPay y guía de prueba en device real.
   - **Acceptance**: `/`, `/levels`, `/play/[piece]`, `/result`, `/leaderboard`; wallet UX compatible con MiniPay; README actualizado.

3. **Gameplay Torre + contracts base** - L
   - **Why**: La demo solo es creíble si el loop jugar -> score -> badge existe de punta a punta.
   - **Acceptance**: Renderer 8x8, rules engine Torre, challenge local, `submitScore`, `claimBadge`, deploy scripts reproducibles.

#### Priority 2: High
1. **Leaderboard v1 por eventos** - M
   - **Dependencies**: `ScoreSubmitted` desplegado en chain.
   - **Acceptance**: API con cache 60s y top 10 visible en `/leaderboard`.

2. **Submission pack** - M
   - **Dependencies**: Demo funcional en mainnet.
   - **Acceptance**: Deck, video, Karma GAP y links públicos listos.

#### Priority 3: Medium
1. **Passport gating** - M
   - **Description**: Bonus bounty para ranked leaderboard o special badge.

2. **Second/third pieces** - M
   - **Description**: Alfil y Caballo solo después de cerrar M2/M3.

### Technical Decisions Made
- **Ruta crítica cerrada en Torre primero**: Evitar scope creep; Alfil/Caballo van después del loop on-chain completo.
- **Leaderboard sin subgraph al inicio**: Leer eventos vía RPC para reducir complejidad y tiempo de integración.
- **MiniPay como entorno primario**: UX debe ocultar connect redundante y usar transacciones legacy con `feeCurrency` solo cuando aplique.

### Notes for Next Session
- Validar en device real, nunca en emulador.
- Documentar `ngrok` y Developer Mode en README.
- Convertir `apps/contracts/contracts/Lock.sol` en contracts productivos de Scoreboard y Badges.

---
