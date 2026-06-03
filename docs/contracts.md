# Chesscito — Contract Addresses

## Celo Mainnet (chainId: 42220)

| Contrato | Proxy / Address | Explorer |
|---|---|---|
| BadgesUpgradeable | `0xf92759E5525763554515DD25E7650f72204a6739` | [celoscan.io](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739) |
| ScoreboardUpgradeable | `0x1681aAA176d5f46e45789A8b18C8E990f663959a` | [celoscan.io](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a) |
| Shop | `0xc66773A9e897641951DAACa8Bae90dA15d90588B` | [celoscan.io](https://celoscan.io/address/0xc66773A9e897641951DAACa8Bae90dA15d90588B) |
| USDC (nativo) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | [celoscan.io](https://celoscan.io/address/0xcebA9300f2b948710d2653dD7B07f33A8B32118C) |
| LabyrinthBadges | _pending deploy (Phase D.2)_ | _n/a_ |

Deployed: 2026-03-09 · ProxyAdmin: `0xe5B8BCc63D59137D42d3EEBc00DC5310e40Df94D`

---

## Celo Sepolia Testnet (chainId: 11142220)

| Contrato | Proxy / Address | Explorer |
|---|---|---|
| BadgesUpgradeable | `0x8da0175d515ddc09bE3ECC6E0A267F7C52afE032` | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0x8da0175d515ddc09bE3ECC6E0A267F7C52afE032) |
| ScoreboardUpgradeable | `0x9b091AC8f8Db060B134A2FCE33563b3eF4A74015` | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0x9b091AC8f8Db060B134A2FCE33563b3eF4A74015) |
| Shop | `0xd913D2D01871ceB1204A26F99FB414484f903Eba` | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0xd913D2D01871ceB1204A26F99FB414484f903Eba) |
| USDC (mock) | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0x01C5C0122039549AD1493B8220cABEdD739BC44E) |
| LabyrinthBadges | `0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b` | [sepolia.celoscan.io](https://sepolia.celoscan.io/address/0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b) |

Deployed: 2026-03-04 · ProxyAdmin: `0x3e42ad59D0E4fB9E4C195EFb610A7Bd8Db122897`
LabyrinthBadges deployed: 2026-06-03 · ProxyAdmin: `0xE98b6aBF59FACD94B13FBDC3392f7933D832bB54` · Implementation: `0xade28F98E4B25e20859164Eef5354a4845C87372` · Owner: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` · Signer: `0x50c75be158168eCB3df326610f5E8Ea51F0B3CAe` · Phase D smoke ✅ (tx [0x8e499599…](https://sepolia.celoscan.io/tx/0x8e499599d356898a77b8a30cca13ceb785fe61593ca8a7d43dc486d6ebbb3897), [0x412ceee3…](https://sepolia.celoscan.io/tx/0x412ceee34a00bf5e1a1c6f62e263be6c5cba885749946e99a78eeade35479418))

---

## Notas

- Todos los contratos usan **Transparent Proxy** (ERC-1967)
- `BadgesUpgradeable` requiere voucher EIP-712 firmado por el `signer` para reclamar badges
- `ScoreboardUpgradeable` requiere voucher EIP-712 firmado por el `signer` para registrar scores
- `LabyrinthBadges` requiere voucher EIP-712 (domain `LabyrinthBadges` v1) firmado por el `signer` para reclamar proofs de laberintos. Soulbound: no transferible, no burneable. Strict-improvement: solo se permite mint cuando `stars > bestMintedStars[player][labyrinthId]`. ProxyAdmin dedicado (separable del ProxyAdmin de Badges/Scoreboard/Shop) para aislar la autoridad de upgrade.
- `BADGES_BASE_URI` es placeholder — actualizar con `setBaseURI()` cuando los metadatos estén en IPFS
- `LABYRINTH_BADGES_BASE_URI` (Sepolia: `ipfs://chesscito/labyrinth-badges/`) es placeholder — actualizar con `setBaseURI()` cuando los metadatos finales estén en IPFS
