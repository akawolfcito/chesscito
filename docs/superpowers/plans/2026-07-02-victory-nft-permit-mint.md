# Victory NFT Permit Mint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mintSignedWithPermit` to `VictoryNFTUpgradeable` and wire a feature-flagged client path so claiming a Victory NFT costs one on-chain transaction instead of two (`approve` + `mintSigned`), with the existing `approve`+`mintSigned` path preserved unchanged as a permanent fallback.

**Architecture:** Additive contract function (new implementation behind the existing proxy, no storage changes) that consumes an EIP-2612 permit signature instead of a pre-existing `approve`. Client hook (`useMintVictory`) gains a flag-gated branch that reads the token's on-chain nonce, signs a permit via `eth_signTypedData_v4`, and calls the new function — falling back transparently to the legacy path on any non-cancellation failure.

**Tech Stack:** Solidity 0.8.28, OpenZeppelin Contracts/Contracts-Upgradeable 5.6.1, Hardhat (ethers + hardhat-upgrades), Next.js/React, wagmi/viem, Vitest.

## Global Constraints

- `mintSigned` (the existing function) is never modified — every task that touches `VictoryNFTUpgradeable.sol` must leave it byte-identical.
- No new contract storage variables — `__gap` (`uint256[39]`) stays untouched.
- Feature flag `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` stays default-OFF through every task in this plan — no task turns it on in any deployed environment.
- All reverts inside `mintSignedWithPermit` bubble unwrapped **except** the internal `permit()` call, which is `try/catch`-wrapped (red-team P1-1 fix, see design spec).
- `nonces(owner)` is always read live on-chain immediately before signing — never cached, never assumed.
- Commit after every task; run the full relevant test suite before each commit and report the pass count in the commit message, per project convention.
- Spec: `docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-design.md`. Red-team review: `docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-redteam.md`. Both already closed (no P0s); this plan implements the P1-folded design as written.

---

## File Structure

**Create:**
- `apps/contracts/test/victory-permit-fork.ts` — one-off mainnet-fork verification script (Task 1), confirms real `permit()` support + domain `version` per accepted token.
- `apps/contracts/contracts/mocks/MockERC20Permit.sol` — local mock implementing `ERC20Permit` for fast offline contract tests (Task 2).
- `apps/web/src/lib/contracts/permit-abi.ts` — extended ERC-20 ABI fragment (`nonces`, `DOMAIN_SEPARATOR`, `permit`) not present in viem's base `erc20Abi` (Task 6).

**Modify:**
- `apps/contracts/contracts/VictoryNFTUpgradeable.sol` — add `mintSignedWithPermit` (Task 3).
- `apps/contracts/test/VictoryNFT.ts` — add new test cases (Tasks 3–5).
- `apps/web/src/lib/feature-flags.ts` — add the flag (Task 6).
- `apps/web/src/lib/contracts/tokens.ts` — add `permitVersion` per token (Task 6).
- `apps/web/src/lib/contracts/victory.ts` — add `mintSignedWithPermit` ABI entry (Task 6).
- `apps/web/src/lib/errors.ts` — new `classifyTxErrorKind` case for permit reverts (Task 7).
- `apps/web/src/lib/coach/use-mint-victory.ts` — permit branch, injected overrides, telemetry, docstring fix (Tasks 8–9).
- `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts` — new test cases (Tasks 8–9).

---

### Task 1: Mainnet-fork permit verification (closes red-team P1-2 / design Rollout step 0)

**Files:**
- Create: `apps/contracts/test/victory-permit-fork.ts`

**Interfaces:**
- Produces: confirmed `permitVersion` string per token (USDC/USDT/cUSD), consumed by Task 6's `tokens.ts` edit. Printed to console, not auto-written — a human copies the confirmed values forward.

This is a discovery script, not a red/green TDD cycle — its purpose is to answer an unknown (does `permit()` really work, and with which domain version) before any contract or client code depends on the answer. It forks Celo Mainnet read-only via the free public RPC (`https://forno.celo.org`, matches `[[no-payg-rpc]]` — no paid tier) inside a single Hardhat test file, and resets back to the default in-memory chain afterward so it doesn't affect any other test file run in the same process.

- [ ] **Step 1: Write the fork verification script**

```typescript
// apps/contracts/test/victory-permit-fork.ts
import { expect } from "chai";
import { ethers, network } from "hardhat";

// Real Celo Mainnet addresses — must match apps/web/src/lib/contracts/tokens.ts
const TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" },
] as const;

const CANDIDATE_VERSIONS = ["1", "2"] as const;

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
```

- [ ] **Step 2: Run the script and record the output**

Run: `pnpm -C apps/contracts exec hardhat test test/victory-permit-fork.ts`

Expected: 3 passing tests, one per token, each printing a `[permit-fork] <SYMBOL> name="..." confirmedVersion="..."` line. **Copy these three lines somewhere durable now** (e.g. paste into the PR description) — Task 6 needs them verbatim.

If any token's test throws "no candidate version worked": stop. That token genuinely doesn't support the assumed EIP-2612 signature scheme with either candidate version — this is exactly the red-team P1-2 failure mode. Do not proceed to Task 6 for that token; escalate to the operator (this contradicts the treasury-unification plan's 2026-07-01 assumption and needs a decision before continuing).

- [ ] **Step 3: Commit**

```bash
git add apps/contracts/test/victory-permit-fork.ts
git commit -m "test(contracts): mainnet-fork verification of EIP-2612 permit support for USDC/USDT/cUSD

Confirms permit() actually succeeds (not just getter presence) and pins
each token's real EIP-712 domain version. Closes red-team P1-2 from
docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-redteam.md.

3/3 passing — see commit description for confirmed name/version per token.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: `MockERC20Permit` mock contract

**Files:**
- Create: `apps/contracts/contracts/mocks/MockERC20Permit.sol`

**Interfaces:**
- Produces: `MockERC20Permit(name, symbol, decimals_)` constructor; inherits `ERC20Permit`'s `permit`/`nonces`/`DOMAIN_SEPARATOR`; adds `mint(address, uint256)`. Consumed by Tasks 3–5's Hardhat tests via `ethers.getContractFactory("MockERC20Permit")`.

Mirrors the existing `MockERC20.sol` exactly, adding the `ERC20Permit` extension so contract tests never need real network access (Task 1's fork test is the only one that touches real tokens).

- [ ] **Step 1: Write the mock**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MockERC20Permit is ERC20, ERC20Permit {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

- [ ] **Step 2: Compile to verify it builds**

Run: `pnpm -C apps/contracts exec hardhat compile`
Expected: compiles with no errors, `MockERC20Permit` artifact generated under `apps/contracts/artifacts/contracts/mocks/MockERC20Permit.sol/`.

- [ ] **Step 3: Commit**

```bash
git add apps/contracts/contracts/mocks/MockERC20Permit.sol
git commit -m "test(contracts): add MockERC20Permit mock for offline permit tests

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: `mintSignedWithPermit` happy path (TDD)

**Files:**
- Modify: `apps/contracts/contracts/VictoryNFTUpgradeable.sol`
- Modify: `apps/contracts/test/VictoryNFT.ts`

**Interfaces:**
- Consumes: `MockERC20Permit` (Task 2); existing `_splitPayment`, `_verifySignature`, `_normalizePrice`, `usedNonces`, `lastMintAt`, `priceUsd6`, `acceptedTokens` (all `VictoryNFTUpgradeable.sol:78-94, 184-204`, unchanged).
- Produces: `mintSignedWithPermit(uint8,uint16,uint32,address,uint256,uint256,bytes,uint256,uint8,bytes32,bytes32)` external function, same `VictoryMinted` event, same `victories[tokenId]` storage shape as `mintSigned`.

- [ ] **Step 1: Write the failing happy-path test**

Add to `apps/contracts/test/VictoryNFT.ts`, after the existing `deployVictoryFixture`/`signVictory` helpers (after line 102), a second fixture + signing helper for permit-enabled tests, then the test itself. Insert this new `describe` block right before the closing `});` of the outer `describe("VictoryNFTUpgradeable", ...)` block (i.e. before line 693):

```typescript
  // ---------- mintSignedWithPermit ----------

  describe("mintSignedWithPermit", function () {
    async function deployVictoryPermitFixture() {
      const base = await deployVictoryFixture();
      const [, , , , , permitOwner] = await ethers.getSigners();

      const MockERC20Permit = await ethers.getContractFactory("MockERC20Permit");
      const permitToken = await MockERC20Permit.deploy("Mock Permit cUSD", "mpcUSD", 18);
      await permitToken.waitForDeployment();
      const permitTokenAddress = await permitToken.getAddress();

      await base.victory.setAcceptedToken(permitTokenAddress, 18);

      const mintAmount = ethers.parseEther("1000");
      await permitToken.mint(permitOwner.address, mintAmount);

      return { ...base, permitToken, permitTokenAddress, permitOwner };
    }

    async function signPermit({
      owner,
      spender,
      value,
      deadline,
      token,
      tokenAddress,
      chainId,
    }: {
      owner: ethers.HDNodeWallet | ethers.Wallet;
      spender: string;
      value: bigint;
      deadline: bigint;
      token: any;
      tokenAddress: string;
      chainId: bigint;
    }) {
      const nonce: bigint = await token.nonces(owner.address);
      const name: string = await token.name();
      const signature = await owner.signTypedData(
        { name, version: "1", chainId, verifyingContract: tokenAddress },
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
      return ethers.Signature.from(signature);
    }

    it("mints with a valid voucher + valid permit, no prior approve", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address,
        difficulty: 2,
        totalMoves: 30,
        timeMs: 60000,
        nonce: 1n,
        deadline: voucherDeadline,
        signer: signingWallet,
        chainId,
        verifyingContract: victoryAddress,
      });

      const totalAmount = 10_000n * 10n ** 12n; // difficulty 2 price, normalized to 18 decimals
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner,
        spender: victoryAddress,
        value: totalAmount,
        deadline: permitDeadline,
        token: permitToken,
        tokenAddress: permitTokenAddress,
        chainId,
      });

      // No approve() call anywhere above — this is the whole point.
      await victory.connect(permitOwner).mintSignedWithPermit(
        2, 30, 60000, permitTokenAddress, 1n, voucherDeadline, voucherSig,
        permitDeadline, sig.v, sig.r, sig.s,
      );

      expect(await victory.ownerOf(1n)).to.equal(permitOwner.address);
      const data = await victory.getVictory(1n);
      expect(data.difficulty).to.equal(2n);
      expect(data.totalMoves).to.equal(30n);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts --grep "mintSignedWithPermit"`
Expected: FAIL — `mintSignedWithPermit is not a function` (the contract function doesn't exist yet).

- [ ] **Step 3: Implement `mintSignedWithPermit` on the contract**

In `apps/contracts/contracts/VictoryNFTUpgradeable.sol`, add the import after the existing `SafeERC20` import (after line 5):

```solidity
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
```

Then add the new function immediately after `mintSigned` (after the closing `}` at line 166, before the `// Views` comment at line 168):

```solidity

    function mintSignedWithPermit(
        uint8 difficulty,
        uint16 totalMoves,
        uint32 timeMs,
        address token,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
        if (difficulty < 1 || difficulty > 3) revert InvalidDifficulty(difficulty);
        if (totalMoves == 0) revert InvalidMoves();
        if (timeMs == 0) revert InvalidTime();
        if (block.timestamp > deadline) revert SignatureExpired(deadline);
        if (usedNonces[msg.sender][nonce]) revert NonceUsed(msg.sender, nonce);
        if (block.timestamp < lastMintAt[msg.sender] + mintCooldown) {
            revert MintCooldown(lastMintAt[msg.sender] + mintCooldown);
        }

        uint8 tokenDecimals = acceptedTokens[token];
        if (tokenDecimals == 0) revert TokenNotAccepted(token);

        uint256 price = priceUsd6[difficulty];
        if (price == 0) revert PriceNotSet(difficulty);

        _verifySignature(msg.sender, difficulty, totalMoves, timeMs, nonce, deadline, signature);

        usedNonces[msg.sender][nonce] = true;
        lastMintAt[msg.sender] = block.timestamp;

        uint256 totalAmount = _normalizePrice(price, tokenDecimals);
        // try/catch: permit() is front-runnable (anyone holding the
        // signature can submit it). If a front-run already granted the
        // exact allowance, swallow the now-reverting internal call and let
        // _splitPayment's transferFrom enforce whatever allowance actually
        // exists. Standard router pattern — see IERC20Permit.sol's own
        // docstring, which documents this exact try/catch shape.
        try IERC20Permit(token).permit(msg.sender, address(this), totalAmount, permitDeadline, v, r, s) {} catch {}
        _splitPayment(token, totalAmount);

        uint256 tokenId = _nextTokenId++;
        victories[tokenId] = VictoryData({
            difficulty: difficulty,
            totalMoves: totalMoves,
            timeMs: timeMs,
            mintedAt: uint64(block.timestamp)
        });
        _mint(msg.sender, tokenId);

        emit VictoryMinted(msg.sender, tokenId, difficulty, totalMoves, timeMs, token, totalAmount);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts --grep "mintSignedWithPermit"`
Expected: PASS (1 passing).

- [ ] **Step 5: Commit**

```bash
git add apps/contracts/contracts/VictoryNFTUpgradeable.sol apps/contracts/test/VictoryNFT.ts
git commit -m "feat(contracts): add mintSignedWithPermit — permit-based Victory NFT mint

Additive-only: mintSigned is byte-identical, no storage changes. Removes
the separate approve() transaction by consuming an EIP-2612 permit
signature inline. permit() call is try/catch-wrapped per red-team P1-1
(front-run griefing fix, matches IERC20Permit.sol's own recommended
pattern).

1/1 new test passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Voucher-validation rejection tests (mirror of `mintSigned`)

**Files:**
- Modify: `apps/contracts/test/VictoryNFT.ts`

**Interfaces:**
- Consumes: `mintSignedWithPermit` (Task 3), `deployVictoryPermitFixture`/`signPermit`/`signVictory` (Task 3, this file).

Every rejection case that already exists for `mintSigned` (lines 151–350 of the current file) must also hold for `mintSignedWithPermit`, using a valid permit alongside the deliberately-invalid voucher. Add these inside the `describe("mintSignedWithPermit", ...)` block from Task 3, after the happy-path `it`:

- [ ] **Step 1: Write the rejection tests**

```typescript
    it("reverts with InvalidDifficulty for difficulty 0", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 0, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: 1_000_000_000_000n, deadline: permitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          0, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.rejectedWith("InvalidDifficulty");
    });

    it("reverts with NonceUsed for reused voucher nonce", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const nonce = 7n;
      const totalAmount = 5_000n * 10n ** 12n; // difficulty 1 price

      const voucherSig1 = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline1 = BigInt((await time.latest()) + 600);
      const sig1 = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: totalAmount, deadline: permitDeadline1,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });
      await victory.connect(permitOwner).mintSignedWithPermit(
        1, 10, 5000, permitTokenAddress, nonce, voucherDeadline, voucherSig1, permitDeadline1, sig1.v, sig1.r, sig1.s,
      );

      await time.increase(31); // clear cooldown

      const voucherDeadline2 = BigInt((await time.latest()) + 600);
      const voucherSig2 = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 20, timeMs: 6000,
        nonce, deadline: voucherDeadline2, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline2 = BigInt((await time.latest()) + 600);
      const sig2 = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: totalAmount, deadline: permitDeadline2,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 20, 6000, permitTokenAddress, nonce, voucherDeadline2, voucherSig2, permitDeadline2, sig2.v, sig2.r, sig2.s,
        ),
      ).to.be.rejectedWith("NonceUsed");
    });

    it("reverts with MintCooldown when minting too quickly", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const totalAmount = 5_000n * 10n ** 12n;
      const voucherDeadline1 = BigInt((await time.latest()) + 600);
      const voucherSig1 = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline1, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline1 = BigInt((await time.latest()) + 600);
      const sig1 = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: totalAmount, deadline: permitDeadline1,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });
      await victory.connect(permitOwner).mintSignedWithPermit(
        1, 10, 5000, permitTokenAddress, 1n, voucherDeadline1, voucherSig1, permitDeadline1, sig1.v, sig1.r, sig1.s,
      );

      const voucherDeadline2 = BigInt((await time.latest()) + 600);
      const voucherSig2 = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 20, timeMs: 6000,
        nonce: 2n, deadline: voucherDeadline2, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline2 = BigInt((await time.latest()) + 600);
      const sig2 = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: totalAmount, deadline: permitDeadline2,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 20, 6000, permitTokenAddress, 2n, voucherDeadline2, voucherSig2, permitDeadline2, sig2.v, sig2.r, sig2.s,
        ),
      ).to.be.rejectedWith("MintCooldown");
    });

    it("reverts with TokenNotAccepted for unaccepted token", async function () {
      const { signingWallet, victory, victoryAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const MockERC20Permit = await ethers.getContractFactory("MockERC20Permit");
      const badToken = await MockERC20Permit.deploy("Bad Permit Token", "BADP", 18);
      await badToken.waitForDeployment();
      const badTokenAddress = await badToken.getAddress();

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: 1_000_000_000_000n, deadline: permitDeadline,
        token: badToken, tokenAddress: badTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 10, 5000, badTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.rejectedWith("TokenNotAccepted");
    });

    it("reverts with InvalidSignature for wrong voucher signer", async function () {
      const { victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const fakeSigner = ethers.Wallet.createRandom();
      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: fakeSigner, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: 1_000_000_000_000n, deadline: permitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.rejectedWith("InvalidSignature");
    });

    it("mint reverts when paused", async function () {
      const { owner, signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      await victory.connect(owner).pause();

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: 1_000_000_000_000n, deadline: permitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.rejectedWith("EnforcedPause()");
    });
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts --grep "mintSignedWithPermit"`
Expected: PASS (7 passing — 1 happy path from Task 3 + 6 new).

- [ ] **Step 3: Commit**

```bash
git add apps/contracts/test/VictoryNFT.ts
git commit -m "test(contracts): mirror mintSigned voucher-validation rejections for mintSignedWithPermit

7/7 mintSignedWithPermit tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: Permit-specific failure tests + front-run simulation (closes red-team P1-1)

**Files:**
- Modify: `apps/contracts/test/VictoryNFT.ts`

**Interfaces:**
- Consumes: same fixtures/helpers as Tasks 3–4.

- [ ] **Step 1: Write the permit-failure and front-run tests**

Add inside the same `describe("mintSignedWithPermit", ...)` block:

```typescript
    it("reverts with an honest insufficient-allowance reason when the permit deadline has expired (no prior allowance)", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });

      // Permit deadline already in the past — permit() will revert
      // internally, but the try/catch swallows it and _splitPayment then
      // fails on its own terms (no allowance exists).
      const expiredPermitDeadline = BigInt((await time.latest()) - 1);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: 1_000_000_000_000n, deadline: expiredPermitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig,
          expiredPermitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.reverted; // ERC20InsufficientAllowance from SafeERC20, not a permit error
    });

    it("reverts with an honest insufficient-allowance reason for a permit signed by the wrong owner", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });

      const impostor = ethers.Wallet.createRandom();
      const permitDeadline = BigInt((await time.latest()) + 600);
      // Signed by `impostor`, but the mint call is made by `permitOwner` —
      // the contract's internal permit(msg.sender=permitOwner, ...) will
      // recover `impostor` as signer, which != owner param → OZ reverts
      // ERC2612InvalidSigner internally, swallowed by try/catch.
      const sig = await signPermit({
        owner: impostor, spender: victoryAddress, value: 1_000_000_000_000n, deadline: permitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      await expect(
        victory.connect(permitOwner).mintSignedWithPermit(
          1, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
        ),
      ).to.be.reverted; // ERC20InsufficientAllowance — the impostor's permit never granted permitOwner's allowance
    });

    it("front-run simulation: mint still succeeds if a third party already submitted the exact signed permit (closes red-team P1-1)", async function () {
      const { signingWallet, victory, victoryAddress, permitToken, permitTokenAddress, permitOwner, chainId } =
        await loadFixture(deployVictoryPermitFixture);

      const totalAmount = 5_000n * 10n ** 12n;
      const voucherDeadline = BigInt((await time.latest()) + 600);
      const voucherSig = await signVictory({
        player: permitOwner.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline: voucherDeadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      const permitDeadline = BigInt((await time.latest()) + 600);
      const sig = await signPermit({
        owner: permitOwner, spender: victoryAddress, value: totalAmount, deadline: permitDeadline,
        token: permitToken, tokenAddress: permitTokenAddress, chainId,
      });

      // A third account (not permitOwner, not the contract) submits the
      // exact signed permit directly to the token BEFORE the player's own
      // mintSignedWithPermit call reaches the chain.
      const [, , frontRunner] = await ethers.getSigners();
      await permitToken.connect(frontRunner).permit(
        permitOwner.address, victoryAddress, totalAmount, permitDeadline, sig.v, sig.r, sig.s,
      );
      expect(await permitToken.allowance(permitOwner.address, victoryAddress)).to.equal(totalAmount);

      // The player's own transaction now carries a stale nonce for its
      // internal permit() call — that call will revert internally, but
      // the try/catch swallows it and _splitPayment proceeds against the
      // allowance the front-run already granted. Mint must still succeed.
      await victory.connect(permitOwner).mintSignedWithPermit(
        1, 10, 5000, permitTokenAddress, 1n, voucherDeadline, voucherSig, permitDeadline, sig.v, sig.r, sig.s,
      );

      expect(await victory.ownerOf(1n)).to.equal(permitOwner.address);
      expect(await permitToken.allowance(permitOwner.address, victoryAddress)).to.equal(0n);
    });
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts --grep "mintSignedWithPermit"`
Expected: PASS (10 passing — 7 from Task 4 + 3 new).

- [ ] **Step 3: Commit**

```bash
git add apps/contracts/test/VictoryNFT.ts
git commit -m "test(contracts): permit-failure + front-run simulation tests for mintSignedWithPermit

Closes red-team P1-1 — proves the try/catch fix means a griefing
front-run does not revert the player's mint, and a genuinely failed
permit surfaces as an honest insufficient-allowance revert instead of
an opaque bubbled permit() error.

10/10 mintSignedWithPermit tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Proxy-upgrade storage safety + full regression

**Files:**
- Modify: `apps/contracts/test/VictoryNFT.ts`

**Interfaces:**
- Consumes: `deployVictoryFixture` (existing, `VictoryNFT.ts:6-53`).

- [ ] **Step 1: Write the upgrade-preserves-state test**

Add as a new top-level `describe` block, after the `mintSignedWithPermit` block from Tasks 3–5 and before the final closing `});` of the file:

```typescript
  // ---------- Proxy upgrade safety ----------

  describe("proxy upgrade", function () {
    it("preserves state and storage layout after upgrading to the mintSignedWithPermit implementation", async function () {
      const { victory, victoryAddress, player, signingWallet, tokenAddress, chainId } =
        await loadFixture(deployVictoryFixture);

      // Mint once on the pre-upgrade implementation so there's real state to check.
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signVictory({
        player: player.address, difficulty: 1, totalMoves: 10, timeMs: 5000,
        nonce: 1n, deadline, signer: signingWallet, chainId, verifyingContract: victoryAddress,
      });
      await victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature);

      const totalMintedBefore = await victory.totalMinted();
      const ownerBefore = await victory.ownerOf(1n);
      const treasuryBefore = await victory.treasury();

      // Upgrade to the SAME implementation source (which now includes
      // mintSignedWithPermit) — hardhat-upgrades throws here if the new
      // implementation's storage layout is incompatible with the old one.
      const factoryV2 = await ethers.getContractFactory("VictoryNFTUpgradeable");
      const upgraded = await upgrades.upgradeProxy(victoryAddress, factoryV2, {
        unsafeAllow: ["constructor"],
      });

      expect(await upgraded.totalMinted()).to.equal(totalMintedBefore);
      expect(await upgraded.ownerOf(1n)).to.equal(ownerBefore);
      expect(await upgraded.treasury()).to.equal(treasuryBefore);
      // The old function still works post-upgrade.
      expect(typeof upgraded.mintSigned).to.equal("function");
      // The new function is now present.
      expect(typeof upgraded.mintSignedWithPermit).to.equal("function");
    });
  });
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts --grep "proxy upgrade"`
Expected: PASS (1 passing). If `hardhat-upgrades` throws a storage-layout error here, stop — that means the plan's "no new storage" claim was wrong; do not proceed until resolved.

- [ ] **Step 3: Run the full existing suite as a regression check**

Run: `pnpm -C apps/contracts exec hardhat test test/VictoryNFT.ts`
Expected: **all** tests pass — the original ~30 `mintSigned`/admin/view tests (unchanged) plus the 10 new `mintSignedWithPermit` tests plus this upgrade test. Report the exact pass count in the commit message.

- [ ] **Step 4: Commit**

```bash
git add apps/contracts/test/VictoryNFT.ts
git commit -m "test(contracts): proxy-upgrade storage safety test + full regression pass

Confirms mintSigned is unaffected by the upgrade and no storage layout
collision was introduced. Full suite: <N>/<N> passing (fill in <N> from
the actual Step 3 output before committing).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 7: `classifyTxErrorKind` — recognize permit reverts

**Files:**
- Modify: `apps/web/src/lib/errors.ts`
- Test: `apps/web/src/lib/__tests__/errors.test.ts` (create if it doesn't exist yet — check first with `ls apps/web/src/lib/__tests__/errors.test.ts`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `classifyTxErrorKind` now returns `"revert"` (already an existing `TxErrorKind`, no new union member needed) for OZ's `ERC2612ExpiredSignature`/`ERC2612InvalidSigner` error names/messages, same bucket as any other on-chain revert — with a comment explaining why, so the residual gap from the design spec's Error handling section is documented in code, not just prose.

- [ ] **Step 1: Write the failing test**

If `apps/web/src/lib/__tests__/errors.test.ts` does not already exist, create it with this content. If it exists, append this `describe` block to it.

```typescript
import { describe, expect, it } from "vitest";
import { classifyTxErrorKind } from "../errors";

describe("classifyTxErrorKind — ERC2612 permit reverts", () => {
  it("classifies ERC2612ExpiredSignature as revert", () => {
    const err = new Error("execution reverted: ERC2612ExpiredSignature(1234)");
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("classifies ERC2612InvalidSigner as revert", () => {
    const err = new Error(
      "execution reverted: ERC2612InvalidSigner(0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222)",
    );
    expect(classifyTxErrorKind(err)).toBe("revert");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails or passes**

Run: `pnpm -C apps/web exec vitest run src/lib/__tests__/errors.test.ts`

Expected: these two cases likely already PASS today, because `classifyTxErrorKind`'s existing catch-all (`errors.ts:69`, `lower.includes("revert")`) matches the `"execution reverted:"` prefix in both messages. **If both already pass, this task needs no implementation change** — skip to Step 3 and commit only the test, documenting in the commit message that this is a regression-lock, not a new behavior. If either fails (e.g. a real wallet surfaces the error without the word "revert" in it, only the bare error name), add a dedicated case immediately before the final `if (lower.includes("revert")...)` line (`errors.ts:69`):

```typescript
  if (lower.includes("erc2612expiredsignature") || lower.includes("erc2612invalidsigner")) {
    return "revert";
  }
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm -C apps/web exec vitest run src/lib/__tests__/errors.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/errors.ts apps/web/src/lib/__tests__/errors.test.ts
git commit -m "test(errors): lock ERC2612 permit revert classification as revert kind

Documents in code (not just the design spec) that a permit-related
on-chain revert is a normal 'revert' TxErrorKind, not a special case —
the client fallback cannot rescue an already-broadcast reverted tx
(design spec, Error handling section).

2/2 passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 8: Feature flag + ABI + tokens.ts `permitVersion`

**Files:**
- Modify: `apps/web/src/lib/feature-flags.ts`
- Modify: `apps/web/src/lib/contracts/tokens.ts`
- Modify: `apps/web/src/lib/contracts/victory.ts`
- Create: `apps/web/src/lib/contracts/permit-abi.ts`
- Test: `apps/web/src/lib/__tests__/feature-flags.test.ts` (create if absent)

**Interfaces:**
- Consumes: confirmed `permitVersion` strings from Task 1's fork-test output.
- Produces: `isVictoryPermitMintEnabled(): boolean`; `ACCEPTED_TOKENS[i].permitVersion: string`; `permitTokenAbi` (exported from the new `permit-abi.ts`); `mintSignedWithPermitAbi` entry in `victoryAbi`. Consumed by Task 9.

- [ ] **Step 1: Write the failing flag test**

Create `apps/web/src/lib/__tests__/feature-flags.test.ts` (or append if it exists):

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { isVictoryPermitMintEnabled } from "../feature-flags";

describe("isVictoryPermitMintEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when the env var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "");
    expect(isVictoryPermitMintEnabled()).toBe(false);
  });

  it("is true only when the env var is exactly \"true\"", () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");
    expect(isVictoryPermitMintEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C apps/web exec vitest run src/lib/__tests__/feature-flags.test.ts`
Expected: FAIL — `isVictoryPermitMintEnabled is not a function`.

- [ ] **Step 3: Implement the flag**

In `apps/web/src/lib/feature-flags.ts`, append after the existing `isLiteModeServer` function:

```typescript

export function isVictoryPermitMintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED === "true";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C apps/web exec vitest run src/lib/__tests__/feature-flags.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Add the extended permit ABI fragment**

Create `apps/web/src/lib/contracts/permit-abi.ts`:

```typescript
/** ERC-20 extension fragment for EIP-2612 permit — not part of viem's
 *  base `erc20Abi` (see lib/contracts/tokens.ts, which only needs
 *  name()/balanceOf()). Used exclusively by the permit-mint client path. */
export const permitTokenAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "nonces",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

- [ ] **Step 6: Add `permitVersion` to `ACCEPTED_TOKENS`**

In `apps/web/src/lib/contracts/tokens.ts`, replace the `ACCEPTED_TOKENS` block (lines 5-9):

```typescript
export const ACCEPTED_TOKENS = [
  // permitVersion confirmed via apps/contracts/test/victory-permit-fork.ts
  // (Task 1) — REPLACE these three values with that script's actual
  // console output before this task is considered done. The values below
  // are informed defaults (Circle's canonical FiatTokenV2 uses "2"; OZ's
  // ERC20Permit, likely what USDT/cUSD on Celo use, defaults to "1"), NOT
  // yet confirmed on-chain.
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const, decimals: 6, permitVersion: "2" },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const, decimals: 6, permitVersion: "1" },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const, decimals: 18, permitVersion: "1" },
] as const;
```

- [ ] **Step 7: Add the `mintSignedWithPermit` ABI entry**

In `apps/web/src/lib/contracts/victory.ts`, add a new entry to the `victoryAbi` array, immediately after the `mintSigned` entry (after line 41, before the `VictoryMinted` event entry):

```typescript
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mintSignedWithPermit",
    inputs: [
      { name: "difficulty", type: "uint8" },
      { name: "totalMoves", type: "uint16" },
      { name: "timeMs", type: "uint32" },
      { name: "token", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
      { name: "permitDeadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
```

- [ ] **Step 8: Typecheck**

Run: `pnpm -C apps/web exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/feature-flags.ts apps/web/src/lib/contracts/tokens.ts apps/web/src/lib/contracts/victory.ts apps/web/src/lib/contracts/permit-abi.ts apps/web/src/lib/__tests__/feature-flags.test.ts
git commit -m "feat(client): add permit-mint feature flag, extended permit ABI, mintSignedWithPermit ABI entry

NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED, default OFF. permitVersion
values in tokens.ts are informed defaults pending Task 1's real
fork-verification output — flagged inline, must be confirmed before
the flag is ever turned on anywhere.

2/2 new tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 9: `useMintVictory` permit branch + fallback + telemetry (TDD)

**Files:**
- Modify: `apps/web/src/lib/coach/use-mint-victory.ts`
- Modify: `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts`

**Interfaces:**
- Consumes: `isVictoryPermitMintEnabled` (Task 8), `permitTokenAbi` (Task 8), `ACCEPTED_TOKENS[i].permitVersion` (Task 8), `mintSignedWithPermit` ABI entry in `victoryAbi` (Task 8), `parseSignature` (viem).
- Produces: `MintVictoryInjected.sendPermit?: (params: {token: \`0x\${string}\`; owner: \`0x\${string}\`; spender: \`0x\${string}\`; value: bigint; nonce: bigint; deadline: bigint; name: string; version: string}) => Promise<{v: number; r: \`0x\${string}\`; s: \`0x\${string}\`}>` and `MintVictoryInjected.sendMintWithPermit?: (params: {address: \`0x\${string}\`; difficulty: number; verifiedMoves: number; elapsedMs: number; token: \`0x\${string}\`; nonce: bigint; deadline: bigint; signature: \`0x\${string}\`; permitDeadline: bigint; v: number; r: \`0x\${string}\`; s: \`0x\${string}\`}) => Promise<\`0x\${string}\`>`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts`, before the file's final closing `});` (after line 409):

```typescript

  // ── permit-mint path (feature-flagged) ─────────────────────────────────────

  describe("permit-mint path", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("flag ON + permit succeeds: calls sendPermit + sendMintWithPermit, never sendApprove/sendMint", async () => {
      vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");

      const txHash = ("0x" + "ee".repeat(32)) as `0x${string}`;
      const sendPermit = vi.fn().mockResolvedValue({
        v: 27,
        r: ("0x" + "11".repeat(32)) as `0x${string}`,
        s: ("0x" + "22".repeat(32)) as `0x${string}`,
      });
      const sendMintWithPermit = vi.fn().mockResolvedValue(txHash);
      const sendApprove = vi.fn();
      const sendMint = vi.fn();
      const waitReceipt = vi.fn().mockResolvedValue({ logs: [] });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nonce: "1",
            deadline: String(Math.floor(Date.now() / 1000) + 300),
            signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
          }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() =>
        useMintVictory({
          gameId: "permit-success-test",
          walletAddress: "0x4444444444444444444444444444444444444444",
          difficulty: "easy",
          result: "win",
          totalMoves: 10,
          elapsedMs: 40_000,
          injected: {
            address: "0x4444444444444444444444444444444444444444",
            chainId: 42220,
            sendPermit,
            sendMintWithPermit,
            sendApprove,
            sendMint,
            waitReceipt,
          },
        }),
      );

      await act(async () => {
        await result.current.start();
      });

      await waitFor(() =>
        expect(["success", "claiming"]).toContain(result.current.phase),
      );

      expect(sendPermit).toHaveBeenCalledTimes(1);
      expect(sendMintWithPermit).toHaveBeenCalledTimes(1);
      expect(sendApprove).not.toHaveBeenCalled();
      expect(sendMint).not.toHaveBeenCalled();
    });

    it("flag ON + technical permit failure: falls back to sendApprove+sendMint in the same start() call", async () => {
      vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");

      const txHash = ("0x" + "ff".repeat(32)) as `0x${string}`;
      const sendPermit = vi.fn().mockRejectedValue(new Error("method not supported"));
      const sendMintWithPermit = vi.fn();
      const sendApprove = vi.fn().mockResolvedValue(("0x" + "01".repeat(32)) as `0x${string}`);
      const sendMint = vi.fn().mockResolvedValue(txHash);
      const waitReceipt = vi.fn().mockResolvedValue({ logs: [] });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nonce: "2",
            deadline: String(Math.floor(Date.now() / 1000) + 300),
            signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
          }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() =>
        useMintVictory({
          gameId: "permit-fallback-test",
          walletAddress: "0x5555555555555555555555555555555555555555",
          difficulty: "easy",
          result: "win",
          totalMoves: 10,
          elapsedMs: 40_000,
          injected: {
            address: "0x5555555555555555555555555555555555555555",
            chainId: 42220,
            sendPermit,
            sendMintWithPermit,
            sendApprove,
            sendMint,
            waitReceipt,
          },
        }),
      );

      await act(async () => {
        await result.current.start();
      });

      await waitFor(() =>
        expect(["success", "claiming"]).toContain(result.current.phase),
      );

      expect(sendPermit).toHaveBeenCalledTimes(1);
      expect(sendMintWithPermit).not.toHaveBeenCalled();
      expect(sendApprove).toHaveBeenCalledTimes(1);
      expect(sendMint).toHaveBeenCalledTimes(1);
    });

    it("flag ON + user rejects permit signature: cancelled phase, no forced fallback", async () => {
      vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");

      const sendPermit = vi.fn().mockRejectedValue(new Error("User rejected the request"));
      const sendApprove = vi.fn();
      const sendMint = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: "3",
          deadline: String(Math.floor(Date.now() / 1000) + 300),
          signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
        }),
      });

      const { result } = renderHook(() =>
        useMintVictory({
          gameId: "permit-cancel-test",
          walletAddress: "0x6666666666666666666666666666666666666666",
          difficulty: "easy",
          result: "win",
          totalMoves: 10,
          elapsedMs: 40_000,
          injected: {
            address: "0x6666666666666666666666666666666666666666",
            chainId: 42220,
            sendPermit,
            sendApprove,
            sendMint,
          },
        }),
      );

      await act(async () => {
        await result.current.start();
      });

      await waitFor(() => expect(result.current.phase).toBe("cancelled"));

      expect(sendApprove).not.toHaveBeenCalled();
      expect(sendMint).not.toHaveBeenCalled();
    });

    it("flag OFF: always legacy path even with sendPermit/sendMintWithPermit injected", async () => {
      vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "false");

      const txHash = ("0x" + "aa".repeat(32)) as `0x${string}`;
      const sendPermit = vi.fn();
      const sendMintWithPermit = vi.fn();
      const sendApprove = vi.fn().mockResolvedValue(("0x" + "01".repeat(32)) as `0x${string}`);
      const sendMint = vi.fn().mockResolvedValue(txHash);
      const waitReceipt = vi.fn().mockResolvedValue({ logs: [] });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nonce: "4",
            deadline: String(Math.floor(Date.now() / 1000) + 300),
            signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
          }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() =>
        useMintVictory({
          gameId: "permit-flag-off-test",
          walletAddress: "0x7777777777777777777777777777777777777777",
          difficulty: "easy",
          result: "win",
          totalMoves: 10,
          elapsedMs: 40_000,
          injected: {
            address: "0x7777777777777777777777777777777777777777",
            chainId: 42220,
            sendPermit,
            sendMintWithPermit,
            sendApprove,
            sendMint,
            waitReceipt,
          },
        }),
      );

      await act(async () => {
        await result.current.start();
      });

      await waitFor(() =>
        expect(["success", "claiming"]).toContain(result.current.phase),
      );

      expect(sendPermit).not.toHaveBeenCalled();
      expect(sendMintWithPermit).not.toHaveBeenCalled();
      expect(sendApprove).toHaveBeenCalledTimes(1);
      expect(sendMint).toHaveBeenCalledTimes(1);
    });
  });
```

Also add `afterEach` and `vi` env-stub imports at the top of the file if not already present — check the current top-of-file `import { describe, expect, it, vi, beforeEach } from "vitest";` (line 1) and change it to:

```typescript
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm -C apps/web exec vitest run src/lib/coach/__tests__/use-mint-victory.test.ts`
Expected: FAIL — the 4 new tests fail because `sendPermit`/`sendMintWithPermit` are never called (the hook doesn't read the flag or branch yet); `MintVictoryInjected` doesn't have these fields (TS error, but Vitest will still run with `any`-ish leniency at test-time — if `tsc` blocks the test run, that's expected too, it's part of "verify it fails").

- [ ] **Step 3: Add the injected type fields**

In `apps/web/src/lib/coach/use-mint-victory.ts`, extend `MintVictoryInjected` (lines 53-64) by adding two fields after `sendMint`:

```typescript
  /** Override for the EIP-2612 permit signTypedData step — for VR fixtures + tests. */
  sendPermit?: (params: {
    token: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
    name: string;
    version: string;
  }) => Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }>;
  /** Override for mintSignedWithPermit writeContract — for VR fixtures + tests. */
  sendMintWithPermit?: (params: {
    address: `0x${string}`;
    difficulty: number;
    verifiedMoves: number;
    elapsedMs: number;
    token: `0x${string}`;
    nonce: bigint;
    deadline: bigint;
    signature: `0x${string}`;
    permitDeadline: bigint;
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
  }) => Promise<`0x${string}`>;
```

- [ ] **Step 4: Add imports**

At the top of `use-mint-victory.ts`, update the viem import (line 17) to also pull in `parseSignature`:

```typescript
import { decodeEventLog, parseSignature } from "viem";
```

Add `useSignTypedData` to the wagmi import (lines 10-16):

```typescript
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
```

Add new imports after the existing `select-payment-token` import (line 29):

```typescript
import { isVictoryPermitMintEnabled } from "@/lib/feature-flags";
import { permitTokenAbi } from "@/lib/contracts/permit-abi";
```

- [ ] **Step 5: Wire the hook**

Add `signTypedDataAsync` alongside the existing `writeContractAsync` destructure (line 142):

```typescript
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
```

Add `signTypedDataAsync` to the `liveRef` object's two spots (the initial `useRef({...})` at line 181 and the sync-every-render assignment at line 195) — same as every other wagmi value already there:

```typescript
    wagmiPublicClient,
    writeContractAsync,
    signTypedDataAsync,
```
(add this line to both the `useRef` initializer and the `liveRef.current = {...}` block, right after `writeContractAsync`).

Also destructure `signTypedDataAsync: signTypedDataAsyncLive` inside `start()`'s existing destructure of `liveRef.current` (line 302-313), adding it to the list:

```typescript
    const {
      input: inp,
      address: addr,
      chainId: cid,
      victoryNFTAddress: nftAddr,
      chainDifficulty: chainDiff,
      mintPriceUsd6: priceUsd6,
      tokenBalances: balances,
      wagmiPublicClient: publicClient,
      writeContractAsync: writeAsync,
      signTypedDataAsync: signPermitAsync,
    } = liveRef.current;
```

Now replace the existing Step 3 ("Check allowance and approve if needed", lines 383-404) with a branch that tries permit first when the flag is on, falling back to the existing approve logic:

```typescript
      // 3. Permit (if enabled) or approve — mutually exclusive per attempt.
      let usedPermit = false;
      let permitResult: { v: number; r: `0x${string}`; s: `0x${string}` } | null = null;
      let permitDeadlineUsed = 0n;

      if (isVictoryPermitMintEnabled() && !inp.injected?.sendMint) {
        try {
          const permitDeadlineCandidate = BigInt(Math.floor(Date.now() / 1000) + 600);
          const tokenMeta = ACCEPTED_TOKENS.find(
            (t) => t.address.toLowerCase() === token.address.toLowerCase(),
          );
          if (!tokenMeta) throw new Error("Token missing permitVersion metadata");

          if (inp.injected?.sendPermit) {
            permitResult = await inp.injected.sendPermit({
              token: token.address,
              owner: effectiveAddr,
              spender: effectiveNFT!,
              value: normalizedAmount,
              nonce: 0n, // injected fixtures own their own nonce simulation
              deadline: permitDeadlineCandidate,
              name: tokenMeta.symbol,
              version: tokenMeta.permitVersion,
            });
          } else {
            const [tokenName, tokenNonce] = await Promise.all([
              publicClient!.readContract({
                address: token.address,
                abi: permitTokenAbi,
                functionName: "name",
              }) as Promise<string>,
              publicClient!.readContract({
                address: token.address,
                abi: permitTokenAbi,
                functionName: "nonces",
                args: [effectiveAddr],
              }) as Promise<bigint>,
            ]);

            const signature = await signPermitAsync({
              domain: {
                name: tokenName,
                version: tokenMeta.permitVersion,
                chainId: cid,
                verifyingContract: token.address,
              },
              types: {
                Permit: [
                  { name: "owner", type: "address" },
                  { name: "spender", type: "address" },
                  { name: "value", type: "uint256" },
                  { name: "nonce", type: "uint256" },
                  { name: "deadline", type: "uint256" },
                ],
              },
              primaryType: "Permit",
              message: {
                owner: effectiveAddr,
                spender: effectiveNFT!,
                value: normalizedAmount,
                nonce: tokenNonce,
                deadline: permitDeadlineCandidate,
              },
            });
            const parsed = parseSignature(signature);
            permitResult = { v: Number(parsed.v ?? 0n), r: parsed.r, s: parsed.s };
          }
          permitDeadlineUsed = permitDeadlineCandidate;
          usedPermit = true;
        } catch (permitErr) {
          if (isUserCancellation(permitErr)) {
            throw permitErr; // explicit rejection — do NOT fall back, propagate to the outer catch as cancelled
          }
          // Technical failure — fall through to the legacy approve path below.
          usedPermit = false;
        }
      }

      if (!usedPermit) {
        if (inp.injected?.sendApprove) {
          await inp.injected.sendApprove(token.address, normalizedAmount);
        } else {
          const allowance = await publicClient!.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [effectiveAddr, effectiveNFT!],
          });
          if ((allowance as bigint) < normalizedAmount) {
            const approveHash = await writeAsync({
              address: token.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [effectiveNFT!, normalizedAmount],
              chainId: cid,
              account: effectiveAddr,
            });
            await waitForReceiptWithTimeout(publicClient!, approveHash);
          }
        }
      }
```

Note: `isUserCancellation` needs to be imported — it already is (see the existing import block around line 33-37: `classifyTxErrorKind, isTransactionTimeout, isUserCancellation, type TxErrorKind`), no change needed there. `ACCEPTED_TOKENS` also already imported (line 23-28).

Now update Step 5 ("Claim (mint) and wait for confirmation", lines 415-445) to branch on `usedPermit`:

```typescript
      // 5. Claim (mint) and wait for confirmation
      let claimHash: `0x${string}`;
      if (usedPermit && permitResult) {
        if (inp.injected?.sendMintWithPermit) {
          claimHash = await inp.injected.sendMintWithPermit({
            address: effectiveNFT!,
            difficulty: effectiveChainDiff,
            verifiedMoves,
            elapsedMs: inp.elapsedMs ?? 0,
            token: token.address,
            nonce: BigInt(payload.nonce),
            deadline: BigInt(payload.deadline),
            signature: payload.signature,
            permitDeadline: permitDeadlineUsed,
            v: permitResult.v,
            r: permitResult.r,
            s: permitResult.s,
          });
        } else {
          claimHash = await writeAsync({
            address: effectiveNFT!,
            abi: victoryAbi,
            functionName: "mintSignedWithPermit",
            args: [
              effectiveChainDiff,
              verifiedMoves,
              inp.elapsedMs ?? 0,
              token.address,
              BigInt(payload.nonce),
              BigInt(payload.deadline),
              payload.signature,
              permitDeadlineUsed,
              permitResult.v,
              permitResult.r,
              permitResult.s,
            ],
            chainId: cid,
            account: effectiveAddr,
          });
        }
      } else if (inp.injected?.sendMint) {
        claimHash = await inp.injected.sendMint({
          address: effectiveNFT,
          difficulty: effectiveChainDiff,
          verifiedMoves,
          elapsedMs: inp.elapsedMs ?? 0,
          token: token.address,
          nonce: BigInt(payload.nonce),
          deadline: BigInt(payload.deadline),
          signature: payload.signature,
        });
      } else {
        claimHash = await writeAsync({
          address: effectiveNFT!,
          abi: victoryAbi,
          functionName: "mintSigned",
          args: [
            effectiveChainDiff,
            verifiedMoves,
            inp.elapsedMs ?? 0,
            token.address,
            BigInt(payload.nonce),
            BigInt(payload.deadline),
            payload.signature,
          ],
          chainId: cid,
          account: effectiveAddr,
        });
      }
```

Finally, add the `payment_path` telemetry dimension to the two `onClaimTelemetry` calls that already fire on success/start (lines 337, 494-499) by adding `payment_path: usedPermit ? "permit" : "approve"` to the `"success"` stage call:

```typescript
      inp.onClaimTelemetry?.({
        stage: "success",
        gameId: inp.gameId,
        txHash: claimHash,
        has_token_id: Boolean(extractedTokenId),
        payment_path: usedPermit ? "permit" : "approve",
      });
```

This requires widening the `onClaimTelemetry` event type (line 86-93) to accept the new optional field:

```typescript
  onClaimTelemetry?: (event: {
    stage: "start" | "signing" | "submitted" | "confirmed" | "success" | "failed" | "cancelled" | "timeout" | "error";
    gameId?: string;
    txHash?: `0x${string}`;
    error?: string;
    error_kind?: string;
    has_token_id?: boolean;
    payment_path?: "permit" | "approve";
  }) => void;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm -C apps/web exec vitest run src/lib/coach/__tests__/use-mint-victory.test.ts`
Expected: PASS — all pre-existing tests in this file still pass (regression) plus the 4 new permit-path tests (total should be the prior count + 4).

- [ ] **Step 7: Typecheck**

Run: `pnpm -C apps/web exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/coach/use-mint-victory.ts apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts
git commit -m "feat(client): wire mintSignedWithPermit path into useMintVictory, flag-gated

Reads the token's live on-chain nonce, signs an EIP-2612 permit, calls
mintSignedWithPermit. Falls back transparently to approve+mintSigned on
any technical failure; explicit user cancellation of the permit
signature short-circuits to 'cancelled' without a forced second prompt.
Adds payment_path telemetry dimension.

<N>/<N> passing (fill in from Step 6 output).

Wolfcito 🐾 @akawolfcito"
```

---

### Task 10: gameId-scoping regression on the permit path

**Files:**
- Modify: `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts`

**Interfaces:**
- Consumes: the permit-mint path from Task 9; existing `chesscito:claim` sessionStorage restore logic (`use-mint-victory.ts:256-287`, unchanged by this plan).

[[mint-hook-gameid-scoping]] requires that a successful claim's sessionStorage restore rejects a mismatched `gameId`. This must hold regardless of which payment path produced the success — add a targeted regression test using the permit path specifically, since Task 9's success test already covers the permit path's happy path but not the gameId-scoping interaction.

- [ ] **Step 1: Write the test**

Append inside the `describe("permit-mint path", ...)` block added in Task 9:

```typescript

    it("gameId-scoping still applies to a permit-path success (mint-hook-gameid-scoping)", async () => {
      vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");

      sessionStorage.setItem(
        "chesscito:claim",
        JSON.stringify({
          phase: "success",
          gameId: "previous-game-id",
          tokenId: "1",
          claimTxHash: "0xabc",
        }),
      );

      const sendPermit = vi.fn().mockResolvedValue({
        v: 27,
        r: ("0x" + "11".repeat(32)) as `0x${string}`,
        s: ("0x" + "22".repeat(32)) as `0x${string}`,
      });
      const sendMintWithPermit = vi.fn().mockResolvedValue(("0x" + "cc".repeat(32)) as `0x${string}`);
      const waitReceipt = vi.fn().mockResolvedValue({ logs: [] });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nonce: "9",
            deadline: String(Math.floor(Date.now() / 1000) + 300),
            signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
          }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() =>
        useMintVictory({
          gameId: "current-game-id",
          walletAddress: "0x8888888888888888888888888888888888888888",
          difficulty: "easy",
          result: "win",
          totalMoves: 10,
          elapsedMs: 40_000,
          injected: {
            address: "0x8888888888888888888888888888888888888888",
            chainId: 42220,
            sendPermit,
            sendMintWithPermit,
            waitReceipt,
          },
        }),
      );

      // The stale previous-game entry must not leak into this mount's
      // initial phase (the existing restore effect already handles this —
      // this assertion just confirms the permit path didn't bypass it).
      expect(result.current.phase).toBe("ready");

      await act(async () => {
        await result.current.start();
      });

      await waitFor(() => expect(result.current.phase).toBe("success"));

      const saved = JSON.parse(sessionStorage.getItem("chesscito:claim")!);
      expect(saved.gameId).toBe("current-game-id");
    });
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm -C apps/web exec vitest run src/lib/coach/__tests__/use-mint-victory.test.ts`
Expected: PASS. This test should pass without any further implementation change — it's a regression lock confirming Task 9's changes didn't disturb the pre-existing gameId-scoping logic (which lives entirely outside the code Task 9 touched). If it fails, that's a real bug introduced by Task 9 — stop and fix Task 9's code before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts
git commit -m "test(client): lock gameId-scoping regression on the permit-mint path

Confirms [[mint-hook-gameid-scoping]] holds regardless of payment path.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 11: Drive-by docstring cleanup (red-team P2-3)

**Files:**
- Modify: `apps/web/src/lib/coach/use-mint-victory.ts`

**Interfaces:** None — comment-only change.

- [ ] **Step 1: Fix the stale docstring**

In `apps/web/src/lib/coach/use-mint-victory.ts`, the hook's docstring (around what was originally lines 123-136, shifted by Task 9's edits — search for the text `"Behind feature flag NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK"`) currently reads:

```typescript
/**
 * Mint victory claim phase machine.
 *
 * Owns all claim-related state (phase, step, data, shareStatus, error) and
 * the sessionStorage keys `chesscito:claim` + `chesscito:optimistic-victory`.
 *
 * Behind feature flag `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` — default OFF.
 * Production reads from the inline path in arena/page.tsx until T13.
 *
 * @remarks
 * Single-game mount expectation: state initializes on mount and does not
 * auto-reset when input identity changes. Pass `key={gameId}` to force a
 * remount between games.
 */
```

Replace with:

```typescript
/**
 * Mint victory claim phase machine.
 *
 * Owns all claim-related state (phase, step, data, shareStatus, error) and
 * the sessionStorage keys `chesscito:claim` + `chesscito:optimistic-victory`.
 *
 * This is the live production path — called unconditionally from
 * `apps/web/src/app/[locale]/arena/page.tsx` and the coach game viewer.
 * (The `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` flag this docstring used to
 * reference no longer gates anything — confirmed stale 2026-07-02, see
 * red-team review docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-redteam.md P2-3.)
 *
 * @remarks
 * Single-game mount expectation: state initializes on mount and does not
 * auto-reset when input identity changes. Pass `key={gameId}` to force a
 * remount between games.
 */
```

- [ ] **Step 2: Run the existing test file to confirm nothing broke**

Run: `pnpm -C apps/web exec vitest run src/lib/coach/__tests__/use-mint-victory.test.ts`
Expected: PASS, same count as Task 10's end state (comment-only change).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/coach/use-mint-victory.ts
git commit -m "docs(client): fix stale NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK docstring in use-mint-victory.ts

Pre-existing doc rot, unrelated to the permit-mint feature but caught
by red-team P2-3 while this file was already being touched.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 12: Pre-flag-enable gate — verify MiniPay's real permit-rejection classification (closes red-team P1-3)

**Files:** None modified unless the probe reveals a mismatch (contingency below).

**This task requires the operator's physical device — it cannot be automated or completed by an agent alone.** It is the last gate before `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` is ever set to `"true"` in any environment (Preview or Production), per the design spec's Client changes section.

- [ ] **Step 1: Reproduce a real permit rejection in MiniPay**

Using the existing `/dev/permit-probe` page (`apps/web/src/app/dev/permit-probe/permit-probe-client.tsx`, already deployed, no changes needed): open it in real MiniPay on a physical device, tap "Sign permit-shaped message", and **deliberately reject/cancel** the signature prompt instead of approving it.

- [ ] **Step 2: Capture the raw error**

The probe's `catch` block (`permit-probe-client.tsx:93-98`) already surfaces `e instanceof Error ? e.message : JSON.stringify(e)` in the "❌ FAILED" result box. Record that exact string.

- [ ] **Step 3: Check it against `isUserCancellation`**

`isUserCancellation` (`apps/web/src/lib/errors.ts:3-7`) matches if the lowercased message contains `"user rejected"`, `"user denied"`, or `"cancelled"`.

- If the captured string contains one of these → **no code change needed**, the classification already works correctly for MiniPay's real rejection format. Record this confirmation in the plan's tracking (e.g. a one-line note in the PR description) and stop here.
- If the captured string does **not** contain any of these → proceed to Step 4.

- [ ] **Step 4 (contingency, only if Step 3 found a mismatch): add the real string to `isUserCancellation`**

Edit `apps/web/src/lib/errors.ts:3-7`, adding the exact substring captured in Step 2 (lowercased) to the `||` chain:

```typescript
export function isUserCancellation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("cancelled") ||
    lower.includes("<exact substring captured in Step 2, lowercased>")
  );
}
```

Add a regression test to `apps/web/src/lib/__tests__/errors.test.ts` (created in Task 7) asserting `isUserCancellation` returns `true` for the exact captured string, then run `pnpm -C apps/web exec vitest run src/lib/__tests__/errors.test.ts` to confirm it passes, and commit:

```bash
git add apps/web/src/lib/errors.ts apps/web/src/lib/__tests__/errors.test.ts
git commit -m "fix(errors): recognize MiniPay's real signTypedData rejection string in isUserCancellation

Captured on-device via /dev/permit-probe 2026-07-0X. Closes red-team
P1-3 — without this, a deliberate permit rejection was misclassified
as a technical failure, forcing an unwanted approve+mint fallback
prompt right after the user declined.

Wolfcito 🐾 @akawolfcito"
```

- [ ] **Step 5: Record the result in the design spec**

Whether or not a code change was needed, edit `docs/superpowers/specs/2026-07-02-victory-nft-permit-mint-design.md`'s P1-3 note (in the "Client changes" section) to append a confirmation line: `**Verified on-device 2026-07-0X**: MiniPay's rejection string [matches / required adding] the existing isUserCancellation classifier.` Commit this doc update alone if Step 4 wasn't needed, or fold it into Step 4's commit if it was.

---

## Self-Review

**Spec coverage:** Architecture (Task 3), Contract changes incl. try/catch fix (Task 3), Token domain data incl. P1-2 fork verification (Task 1), Client changes incl. flag/fallback/telemetry/ABI/P1-3 gate (Tasks 8, 9, 12), Error handling incl. classifyTxErrorKind (Task 7), Testing plan — contract (Tasks 3-6), client (Tasks 9-10), Rollout step 0 (Task 1) and step 1 code-level review (deferred — see below). No task covers Rollout steps 2-6 (Sepolia/Mainnet deploy, flag enablement) — correctly, since the design spec explicitly scopes deploy/rollout as operational work for a later session, not part of this implementation plan.

**Placeholder scan:** The one intentional exception is Task 8 Step 6's `permitVersion` defaults, explicitly marked as informed-but-unconfirmed pending Task 1's real output, with the exact reconciliation instruction inline — this is a real, compilable value with a documented sequential dependency on an earlier task's output, not a "TBD". Task 6 Step 4 and Task 9 Step 8 both ask the implementer to fill in an exact pass count from their own immediately-preceding step's real output — same pattern, not a placeholder.

**Type consistency:** `MintVictoryInjected.sendPermit`/`sendMintWithPermit` (Task 9 Step 3) match their call sites (Task 9 Step 5) exactly. `mintSignedWithPermit`'s Solidity parameter order (Task 3) matches the ABI entry (Task 8 Step 7) and the client call sites (Task 9 Step 5) in the same order throughout. `permitVersion` field name is consistent between `tokens.ts` (Task 8 Step 6) and its two read sites in `use-mint-victory.ts` (Task 9 Step 5).

**Code-level red-team review:** Per the design spec's Rollout step 1, a second, code-level red-team review (distinct from the spec-level review already closed) happens after Task 11, before any deploy — that review is out of scope for this plan (which ends at "code complete, fully tested, not deployed") and should be requested as a separate step once all 12 tasks here are done.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-02-victory-nft-permit-mint.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
