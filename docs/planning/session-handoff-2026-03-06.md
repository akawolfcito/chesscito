# Session Handoff — 2026-03-06

## Estado actual

- Rama: `main`
- Commits recientes ya aplicados:
  - `e3a22ee` web flows + shop UX MiniPay
  - `44b16e9` contracts deploy/config/verify alignment
  - `0a91d16` docs/runbooks/findings
- Frontend y contracts pasan validación local:
  - `pnpm --filter hardhat test` ✅
  - `pnpm --filter web build` ✅

## Configuración activa (Sepolia)

- `CHAIN_ID`: `11142220`
- `BADGES_PROXY`: `0x8da0175d515ddc09bE3ECC6E0A267F7C52afE032`
- `SCOREBOARD_PROXY`: `0x9b091AC8f8Db060B134A2FCE33563b3eF4A74015`
- `SHOP_ADDRESS` estable: `0xd913D2D01871ceB1204A26F99FB414484f903Eba`
- `USDC` Sepolia: `0x01C5C0122039549AD1493B8220cABEdD739BC44E`

## Decisiones de producto/técnicas cerradas

1. `/play-hub` centraliza experiencia (single-screen + overlays).
2. Se mantiene checkout ERC-20 (approve + buy).
3. POC de compra nativa CELO se retiró del código fuente (no forma parte de la arquitectura estable).
4. Mensajes `unknown transaction`/`unknown contract` en MiniPay no son personalizables por la app.

## Documentación clave

- Diseño prompt Play Hub: `docs/design/figma-prompt-play-hub-worldbuilding.md`
- Findings pagos MiniPay: `docs/submission/minipay-shop-payment-findings-2026-03-05.md`
- Checklist testnet: `docs/submission/testnet-e2e-checklist-2026-03-05.md`

## Pendientes para próxima sesión

1. Cerrar QA final en dispositivo MiniPay (smoke de claim, submit, buy).
2. Capturar tx hashes finales y anexarlos al checklist/runbook.
3. Publicación final (si aplica): validar entorno de despliegue web y smoke post-deploy.

## Comandos de arranque rápido (próxima sesión)

```bash
pnpm --filter hardhat test
pnpm --filter web build
pnpm --filter web dev
```

## Higiene de repositorio

- No commitear:
  - `.env*` con secretos
  - `private/`
  - claves o tokens
- Hay cambios locales no relacionados pendientes fuera de este scope (mantenerlos aislados).

