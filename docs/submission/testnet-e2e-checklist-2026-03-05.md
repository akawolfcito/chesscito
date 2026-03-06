# Testnet E2E Checklist (2026-03-05)

Estado: `COMPLETO` (claim + submit + buy validados en MiniPay/Sepolia con evidencias on-chain y QA de repetición por `levelId` en una sola wallet)

## Evidencias sesión (2026-03-06)

- Validación local:
  - `pnpm --filter hardhat test` -> OK (`13 passing`)
  - `pnpm --filter web build` -> OK
  - `pnpm --filter web dev` -> OK (arranca en `http://localhost:3000`)
- Sepolia (tx reales):
  - `claimBadgeSigned`:
    - tx: `0xd881a87eaa34020eb0ca149239c7ac166f15920b4d312f32ab9cc40bcb463371`
    - explorer: `https://sepolia.celoscan.io/tx/0xd881a87eaa34020eb0ca149239c7ac166f15920b4d312f32ab9cc40bcb463371`
  - `submitScoreSigned`:
    - tx: `0x9240a04f64775210ee91222f9015ceb1a3a89a8fb4045be1d52d5b5fe1c8dc85`
    - explorer: `https://sepolia.celoscan.io/tx/0x9240a04f64775210ee91222f9015ceb1a3a89a8fb4045be1d52d5b5fe1c8dc85`
  - `buyItem` en `play-hub`:
    - `approve` tx: `0x7f21f76c85fbdac4311c188234237c3943455b7f766e6706760fd5377bf4a5d1`
    - `approve` explorer: `https://sepolia.celoscan.io/tx/0x7f21f76c85fbdac4311c188234237c3943455b7f766e6706760fd5377bf4a5d1`
    - `buyItem` tx: `0xa070902c46fd84ee13219f718228f112ed61e33135548ba29473b9abd75dc311`
    - `buyItem` explorer: `https://sepolia.celoscan.io/tx/0xa070902c46fd84ee13219f718228f112ed61e33135548ba29473b9abd75dc311`
    - item comprado: `itemId=1` (`10000` = `0.01 USDC`)
- QA UI `play-hub` (single-screen):
  - estado `ready`: guía visible de misión antes del primer movimiento
  - estado `failure`: feedback explícito + reset
  - estado `success`: habilita claim/submit según conexión/red
  - estados de transacción: `pending` y `success` visibles por operación (`claim`, `submit`, `buy`)
  - móvil: acciones críticas accesibles en panel inferior fijo y overlays (`store`, `leaderboard`, `confirmación compra`)
  - repetición de flujo en MiniPay (misma wallet): `QA mode` con override de `levelId` en `play-hub` (`NEXT_PUBLIC_QA_MODE=1`)
  - validación adicional en dispositivo: `claimBadgeSigned` exitoso usando `levelId=10` (mismo wallet, sin cambio de cuenta)

## Verificaciones ejecutadas

- Contratos:
  - `pnpm --filter hardhat test` -> OK (13 passing)
- Frontend:
  - `pnpm --filter web build` -> OK
- Deployments:
  - Existe `apps/contracts/deployments/celo-sepolia.json` con Badges + Scoreboard + Shop + USDC
- Env (sin imprimir secretos):
  - `apps/contracts/.env`: operativo para deploy/config/verify en Sepolia
  - `apps/web/.env`: direcciones públicas completas (Badges, Scoreboard, Shop, USDC)
- Verificación explorer:
  - Badges impl: verificado
  - Scoreboard impl: verificado
  - Shop: verificado

## Resultado de readiness

- `Badges + Scoreboard`: listos para pruebas en Celo Sepolia
- `Shop` estable (`0xd913...`): desplegado, configurado, verificado y conectado al web env

## Pasos para cerrar el checklist (sin exponer secretos)

1. Completar variables faltantes en `apps/contracts/.env`
   - `CELOSCAN_API_KEY`
   - `USDC_ADDRESS` (token real en la red objetivo)
   - `SHOP_OWNER`
   - `SHOP_TREASURY`
   - `MAX_QUANTITY_PER_TX` (ej. `10`)
   - `INITIAL_MAX_LEVEL_ID` (ej. `10`)
   - `BADGES_BASE_URI` (ej. `ipfs://chesscito/badges`)

2. (Completado) Shop estable desplegado en Celo Sepolia
   - `shopAddress=0xd913D2D01871ceB1204A26F99FB414484f903Eba`
   - `usdcAddress=0x01C5C0122039549AD1493B8220cABEdD739BC44E`

3. (Completado) Configurar catálogo de items en Shop
   - Editar `apps/contracts/scripts/configure-shop.ts` (`ITEMS[]`)
   - Ejecutar:
   - `SHOP_ADDRESS=0x... pnpm --filter hardhat configure:shop:celo-sepolia`
   - Resultado estable aplicado:
     - item1 `10000` (0.01 USDC)
     - item2 `25000` (0.025 USDC)
     - item3 `5000` (0.005 USDC)
     - item4 `40000` (0.04 USDC)
     - item5 `100000` (0.10 USDC)

4. (Completado) Verificar contratos en explorer
   - Opción completa:
   - `BADGES_PROXY=0x... SCOREBOARD_PROXY=0x... SHOP_ADDRESS=0x... USDC_ADDRESS=0x... TREASURY_ADDRESS=0x... pnpm --filter hardhat verify:celo-sepolia`
   - Opción solo proxies (legacy):
   - `pnpm --filter hardhat verify:proxies:celo-sepolia`

5. Actualizar env del frontend (no imprimir secretos)
   - En `apps/web/.env`:
   - `NEXT_PUBLIC_CHAIN_ID=11142220`
   - `NEXT_PUBLIC_BADGES_ADDRESS=0x...`
   - `NEXT_PUBLIC_SCOREBOARD_ADDRESS=0x...`
   - `NEXT_PUBLIC_SHOP_ADDRESS=0x...`
   - `NEXT_PUBLIC_USDC_ADDRESS=0x...`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...`
   - `SIGNER_PRIVATE_KEY=...` (solo server/runtime seguro)

6. Validación final local
   - `pnpm --filter web build`
   - `pnpm --filter hardhat test`

7. Validación real en MiniPay (device)
  - Abrir `/play-hub` y `/tx-lab` en MiniPay
  - Ejecutar:
    - `claimBadgeSigned` (ok, hash capturado)
    - `submitScoreSigned` (ok, hash capturado)
    - compra en `play-hub` (ok, hash capturado)
  - Confirmar tx hashes en CeloScan Sepolia
  - Nota: rutas legacy `/levels`, `/play/[piece]`, `/result` fueron retiradas; el flujo oficial queda en `/play-hub` + `/tx-lab`.

## Criterio de salida

Checklist se considera `COMPLETO` cuando:
- `Shop` desplegado y configurado en Sepolia
- Variables web de Shop/USDC establecidas
- Verificación en explorer sin errores críticos
- Flujo real MiniPay exitoso para claim, submit y compra

## Nota de arquitectura (cerrada)

- Se evaluó POC de compra nativa CELO para evitar approve ERC-20.
- Decisión final: mantener flujo estable ERC-20 (approve + buy) porque fee-currency de MiniPay solo cubre gas, no autorización de gasto del token de pago.
