// apps/contracts/test/victory-permit-fork.ts
import { expect } from "chai";
import { ethers, network } from "hardhat";

// Real Celo Mainnet addresses — must match apps/web/src/lib/contracts/tokens.ts
const TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" },
] as const;

const CANDIDATE_VERSIONS = ["1", "2", "3"] as const;

const PERMIT_ABI = [
  "function name() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
];

describe("Victory NFT permit — Celo Mainnet fork verification", function () {
  this.timeout(120_000);

  before(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
          },
        },
      ],
    });

    // Work around a known Hardhat/EDR issue: calls made at the exact fork
    // block (before any local block is mined) require a historical
    // hardfork-activation history the EDR provider doesn't have for Celo.
    // Mining one block moves the local chain head past the fork block, so
    // subsequent calls use the network's current hardfork instead.
    // https://github.com/NomicFoundation/hardhat/issues/5511
    await network.provider.request({ method: "evm_mine", params: [] });
  });

  after(async function () {
    // Reset back to a plain in-memory chain so later test files in the
    // same process aren't accidentally forked.
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });

  for (const token of TOKENS) {
    it(`${token.symbol} at ${token.address}: permit() succeeds with a real signature`, async function () {
      const contract = await ethers.getContractAt(PERMIT_ABI, token.address);
      const name: string = await contract.name();

      const owner = ethers.Wallet.createRandom();
      const spender = "0x000000000000000000000000000000000000dEaD";
      const value = 1n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce: bigint = await contract.nonces(owner.address);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      let confirmedVersion: string | null = null;
      let lastError: unknown = null;

      for (const version of CANDIDATE_VERSIONS) {
        const signature = await owner.signTypedData(
          { name, version, chainId, verifyingContract: token.address },
          {
            Permit: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
              { name: "value", type: "uint256" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          },
          { owner: owner.address, spender, value, nonce, deadline },
        );
        const sig = ethers.Signature.from(signature);

        try {
          // Fund the owner with a trivial amount of native CELO so it can
          // pay gas for its own permit() call (permit itself needs no
          // token balance, only a broadcastable transaction).
          const [funder] = await ethers.getSigners();
          await funder.sendTransaction({ to: owner.address, value: ethers.parseEther("1") });

          const connected = contract.connect(
            new ethers.Wallet(owner.privateKey, ethers.provider),
          );
          await (connected as any).permit(owner.address, spender, value, deadline, sig.v, sig.r, sig.s);
          confirmedVersion = version;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!confirmedVersion) {
        throw new Error(
          `${token.symbol}: no candidate version worked. Last error: ${String(lastError)}`,
        );
      }

      // eslint-disable-next-line no-console
      console.log(`[permit-fork] ${token.symbol} name="${name}" confirmedVersion="${confirmedVersion}"`);
      expect(confirmedVersion).to.not.be.null;
    });
  }
});
