# Mainnet Deploy Design — Chesscito
Date: 2026-03-08

## Objetivo
Desplegar los contratos de Chesscito en Celo Mainnet (chainId 42220) y conectar el frontend.

## Contratos a desplegar

| Contrato | Script | Notas |
|---|---|---|
| `BadgesUpgradeable` | `deploy-proxies.ts` | Transparent proxy, ERC-1155 + EIP-712 |
| `ScoreboardUpgradeable` | `deploy-proxies.ts` | Transparent proxy, EIP-712 |
| `Shop` | `deploy-shop.ts` | No upgradeable |

## Variables de entorno requeridas (`apps/contracts/.env`)

```
DEPLOYER_PRIVATE_KEY=<wallet_deployer_y_safe_owner>
SAFE_OWNER=<misma_direccion_que_deployer>
SIGNER_PRIVATE_KEY=<hot_wallet_para_firmar_vouchers>
BADGES_BASE_URI=ipfs://chesscito/badges/
USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
CELOSCAN_API_KEY=<api_key>
SCOREBOARD_SUBMIT_COOLDOWN=60
SCOREBOARD_MAX_SUBMISSIONS_PER_DAY=25
INITIAL_MAX_LEVEL_ID=10
MAX_QUANTITY_PER_TX=10
```

## Pasos de deploy

1. Configurar `apps/contracts/.env` con las variables anteriores
2. Compilar contratos: `pnpm hardhat compile`
3. Deploy proxies: `pnpm hardhat run scripts/deploy-proxies.ts --network celo`
   - Genera `deployments/celo.json` con las direcciones
4. Deploy Shop: `pnpm hardhat run scripts/deploy-shop.ts --network celo`
5. Verificar en Celoscan: `pnpm hardhat run scripts/verify.ts --network celo`
6. Actualizar `apps/web/.env` con las direcciones obtenidas
7. Redeploy del frontend (Vercel) con las nuevas env vars

## Frontend env vars resultantes (`apps/web/.env`)

```
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_BADGES_ADDRESS=<badges_proxy>
NEXT_PUBLIC_SCOREBOARD_ADDRESS=<scoreboard_proxy>
NEXT_PUBLIC_SHOP_ADDRESS=<shop_address>
NEXT_PUBLIC_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
SIGNER_PRIVATE_KEY=<hot_wallet_para_firmar_vouchers>
```

## Post-deploy

- `setBaseURI` en `BadgesUpgradeable` cuando los metadatos estén en IPFS
- Verificar que el frontend apunta a los contratos correctos
- Probar flujo completo en MiniPay (badge claim + score submit)
