import path from "node:path";

import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";

loadEnv({ path: path.resolve(__dirname, ".env") });
loadEnv({ path: path.resolve(__dirname, "../../.env"), override: false });
const explorerApiKey = process.env.CELOSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "";
const etherscanV2ApiUrl = "https://api.etherscan.io/v2/api";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    alfajores: {
      url: process.env.ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 44787,
    },
    "celo-sepolia": {
      url: process.env.CELO_SEPOLIA_RPC_URL || "https://forno.celo-sepolia.celo-testnet.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11142220,
    },
    celo: {
      url: process.env.CELO_RPC_URL || "https://forno.celo.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 42220,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: explorerApiKey,
    customChains: [
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: etherscanV2ApiUrl,
          browserURL: "https://alfajores.celoscan.io",
        },
      },
      {
        network: "celo-sepolia",
        chainId: 11142220,
        urls: {
          apiURL: etherscanV2ApiUrl,
          browserURL: "https://sepolia.celoscan.io",
        },
      },
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: etherscanV2ApiUrl,
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
