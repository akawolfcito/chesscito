# Mainnet Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Desplegar BadgesUpgradeable, ScoreboardUpgradeable y Shop en Celo Mainnet y conectar el frontend.

**Architecture:** Transparent proxy para Badges y Scoreboard (upgradeable). Shop sin proxy. Deploy via Hardhat scripts existentes. Frontend conecta via env vars en Vercel.

**Tech Stack:** Hardhat + hardhat-ignition, OpenZeppelin Upgrades, Celo Mainnet (chainId 42220), Vercel.

> **SEGURIDAD CRÍTICA:** Nunca mostrar, loguear ni commitear valores de `DEPLOYER_PRIVATE_KEY`, `SIGNER_PRIVATE_KEY`, ni ningún secreto. Solo confirmar que las variables están seteadas con `echo "set"` o verificar la dirección pública derivada.

---

### Task 1: Configurar variables de entorno del deployer

**Files:**
- Modify: `apps/contracts/.env`

**Step 1: Copiar el ejemplo**

```bash
cp apps/contracts/.env.example apps/contracts/.env
```

**Step 2: Editar `.env` con los valores reales**

Abrir `apps/contracts/.env` y completar — NUNCA mostrar los valores en terminal:

```
DEPLOYER_PRIVATE_KEY=<tu_private_key>
SAFE_OWNER=<tu_address_publica>
SIGNER_PRIVATE_KEY=<hot_wallet_private_key>
BADGES_BASE_URI=ipfs://chesscito/badges/
USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
CELOSCAN_API_KEY=<tu_celoscan_api_key>
SCOREBOARD_SUBMIT_COOLDOWN=60
SCOREBOARD_MAX_SUBMISSIONS_PER_DAY=25
INITIAL_MAX_LEVEL_ID=10
MAX_QUANTITY_PER_TX=10
```

**Step 3: Verificar que las variables están presentes (sin mostrar valores)**

```bash
cd apps/contracts && node -e "
require('dotenv').config();
const required = ['DEPLOYER_PRIVATE_KEY','SAFE_OWNER','SIGNER_PRIVATE_KEY','USDC_ADDRESS','CELOSCAN_API_KEY'];
required.forEach(k => console.log(k, process.env[k] ? 'SET' : 'MISSING'));
"
```

Esperado: todas muestran `SET`

**Step 4: Confirmar que `.env` está en `.gitignore`**

```bash
grep -r "\.env$" apps/contracts/.gitignore ../../.gitignore 2>/dev/null || echo "verificar manualmente"
```

**Step 5: Verificar balance de gas en la wallet deployer**

```bash
cd apps/contracts && node -e "
require('dotenv').config();
const { ethers } = require('ethers');
const w = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
console.log('Deployer address:', w.address);
"
```

Anotar la dirección pública y verificar que tiene CELO en https://celoscan.io — necesita al menos 0.5 CELO para el deploy completo.

---

### Task 2: Compilar contratos

**Files:**
- No se modifican archivos

**Step 1: Instalar dependencias si hace falta**

```bash
cd /ruta/al/repo && pnpm install
```

**Step 2: Compilar**

```bash
cd apps/contracts && pnpm hardhat compile
```

Esperado: `Compiled N Solidity files successfully`

Sin warnings de upgrades-unsafe. Si hay errores, resolverlos antes de continuar.

---

### Task 3: Deploy BadgesUpgradeable + ScoreboardUpgradeable

**Files:**
- Create: `apps/contracts/deployments/celo.json` (generado automáticamente)

**Step 1: Ejecutar deploy-proxies**

```bash
cd apps/contracts && pnpm hardhat run scripts/deploy-proxies.ts --network celo
```

Esperado en stdout (sin revelar claves):
```
Network: celo
Chain ID: 42220
Deployer: 0x...
Safe owner: 0x...
Signer: 0x...

Deployed Transparent Proxies
Badges proxy: 0x...
Badges implementation: 0x...
Scoreboard proxy: 0x...
Scoreboard implementation: 0x...
ProxyAdmin: 0x...
Deployment file: deployments/celo.json

Frontend env exports
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_BADGES_ADDRESS=0x...
NEXT_PUBLIC_SCOREBOARD_ADDRESS=0x...
```

**Step 2: Verificar que se generó el archivo de deployment**

```bash
cat apps/contracts/deployments/celo.json
```

Guardar las direcciones `badgesProxy` y `scoreboardProxy` — las necesitarás en Task 5.

**Step 3: Commit del deployment record**

```bash
git add apps/contracts/deployments/celo.json
git commit -m "chore(contracts): add celo mainnet deployment record

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Deploy Shop

**Files:**
- No genera archivo automáticamente — anotar la dirección del output

**Step 1: Ejecutar deploy-shop**

```bash
cd apps/contracts && pnpm hardhat run scripts/deploy-shop.ts --network celo
```

Esperado en stdout:
```
Network: celo
Deployer: 0x...
Shop: 0x<SHOP_ADDRESS>
Owner: 0x...
Treasury: 0x...
Payment token (USDC): 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
Max quantity per tx: 10
```

Guardar `0x<SHOP_ADDRESS>`.

**Step 2: Configurar items del Shop**

```bash
cd apps/contracts && SHOP_ADDRESS=0x<SHOP_ADDRESS> pnpm hardhat run scripts/configure-shop.ts --network celo
```

Esperado: `Done.` — los items quedan configurados en el contrato.

---

### Task 5: Verificar contratos en Celoscan

**Files:**
- No se modifican archivos

**Step 1: Setear env vars de verificación**

Agregar a `apps/contracts/.env`:
```
BADGES_PROXY=0x<badges_proxy>
SCOREBOARD_PROXY=0x<scoreboard_proxy>
SHOP_ADDRESS=0x<shop_address>
TREASURY_ADDRESS=0x<safe_owner_address>
```

**Step 2: Ejecutar verificación**

```bash
cd apps/contracts && pnpm hardhat run scripts/verify.ts --network celo
```

Esperado: `✓ verified 0x...` para cada contrato (o `↩ already verified`).

**Step 3: Confirmar en Celoscan**

Visitar manualmente:
- `https://celoscan.io/address/<badges_proxy>#code`
- `https://celoscan.io/address/<scoreboard_proxy>#code`
- `https://celoscan.io/address/<shop_address>#code`

Cada uno debe mostrar el tab "Contract" con código verificado y ABI.

---

### Task 6: Actualizar env vars del frontend

**Files:**
- Modify: `apps/web/.env`

**Step 1: Actualizar las direcciones en `apps/web/.env`**

```
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_BADGES_ADDRESS=0x<badges_proxy>
NEXT_PUBLIC_SCOREBOARD_ADDRESS=0x<scoreboard_proxy>
NEXT_PUBLIC_SHOP_ADDRESS=0x<shop_address>
NEXT_PUBLIC_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
```

SIGNER_PRIVATE_KEY se configura en Vercel como variable de entorno servidor (no en archivo).

**Step 2: Verificar que el frontend compila con las nuevas env vars**

```bash
cd apps/web && pnpm build
```

Esperado: build exitoso sin errores de tipo o de env vars.

---

### Task 7: Deploy frontend en Vercel

**Files:**
- No se modifican archivos de código

**Step 1: Configurar env vars en Vercel Dashboard**

En el proyecto de Vercel, agregar/actualizar todas las variables:
- `NEXT_PUBLIC_CHAIN_ID=42220`
- `NEXT_PUBLIC_BADGES_ADDRESS=0x...`
- `NEXT_PUBLIC_SCOREBOARD_ADDRESS=0x...`
- `NEXT_PUBLIC_SHOP_ADDRESS=0x...`
- `NEXT_PUBLIC_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- `SIGNER_PRIVATE_KEY=<valor_secreto>` — marcar como "Sensitive"

**Step 2: Trigger redeploy**

```bash
git commit --allow-empty -m "chore: trigger vercel redeploy for mainnet

Wolfcito 🐾 @akawolfcito"
git push origin main
```

O desde Vercel Dashboard → Deployments → Redeploy.

**Step 3: Verificar el deploy en vivo**

- Abrir la URL de producción en MiniPay (o simulador)
- Intentar un flujo completo: jugar un ejercicio → badge earned → claim badge
- Confirmar que la TX va a Celo Mainnet (chainId 42220) en el wallet

---

### Task 8: Post-deploy — actualizar Badge metadata URI

> Este task se ejecuta cuando los metadatos de badges estén subidos a IPFS.

**Files:**
- No se modifican archivos de código

**Step 1: Subir metadatos a IPFS**

Subir los JSON de metadata de badges a IPFS (Pinata, NFT.Storage, etc.).
Obtener el CID base, por ejemplo: `ipfs://QmXXX.../`.

**Step 2: Llamar `setBaseURI` en BadgesUpgradeable**

```bash
cd apps/contracts && node -e "
require('dotenv').config();
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://forno.celo.org');
const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const abi = ['function setBaseURI(string) external'];
const contract = new ethers.Contract('0x<badges_proxy>', abi, wallet);
contract.setBaseURI('ipfs://QmXXX.../').then(tx => tx.wait()).then(() => console.log('Done'));
"
```

**Step 3: Verificar**

```bash
cd apps/contracts && node -e "
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://forno.celo.org');
const abi = ['function uri(uint256) view returns (string)'];
const contract = new ethers.Contract('0x<badges_proxy>', abi, provider);
contract.uri(1).then(console.log);
"
```

Esperado: `ipfs://QmXXX.../1.json`
