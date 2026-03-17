import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("VictoryNFTUpgradeable", function () {
  async function deployVictoryFixture() {
    const [owner, player, otherPlayer, treasuryWallet, prizePoolWallet] = await ethers.getSigners();
    const signingWallet = ethers.Wallet.createRandom();

    // Deploy mock ERC20 (18 decimals like cUSD)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Mock cUSD", "mcUSD", 18);
    await mockToken.waitForDeployment();

    // Deploy VictoryNFT via proxy
    const factory = await ethers.getContractFactory("VictoryNFTUpgradeable");
    const victory = await upgrades.deployProxy(
      factory,
      [treasuryWallet.address, prizePoolWallet.address, signingWallet.address, owner.address],
      { kind: "transparent", initializer: "initialize", unsafeAllow: ["constructor"] }
    );
    await victory.waitForDeployment();

    const victoryAddress = await victory.getAddress();
    const tokenAddress = await mockToken.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;

    // Configure: accept token, set prices
    await victory.setAcceptedToken(tokenAddress, 18);
    await victory.setPrice(1, 5_000n);   // Easy  — $0.005
    await victory.setPrice(2, 10_000n);  // Medium — $0.01
    await victory.setPrice(3, 20_000n);  // Hard  — $0.02
    await victory.setBaseURI("https://api.chesscito.xyz/victory/");

    // Mint tokens to player and approve
    const mintAmount = ethers.parseEther("1000");
    await mockToken.mint(player.address, mintAmount);
    await mockToken.connect(player).approve(victoryAddress, mintAmount);

    return {
      owner,
      player,
      otherPlayer,
      treasuryWallet,
      prizePoolWallet,
      signingWallet,
      victory,
      mockToken,
      victoryAddress,
      tokenAddress,
      chainId,
    };
  }

  async function signVictory({
    player,
    difficulty,
    totalMoves,
    timeMs,
    nonce,
    deadline,
    signer,
    chainId,
    verifyingContract,
  }: {
    player: string;
    difficulty: number;
    totalMoves: number;
    timeMs: number;
    nonce: bigint;
    deadline: bigint;
    signer: ethers.Wallet;
    chainId: bigint;
    verifyingContract: string;
  }) {
    return signer.signTypedData(
      {
        name: "VictoryNFT",
        version: "1",
        chainId,
        verifyingContract,
      },
      {
        VictoryMint: [
          { name: "player", type: "address" },
          { name: "difficulty", type: "uint8" },
          { name: "totalMoves", type: "uint16" },
          { name: "timeMs", type: "uint32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        difficulty,
        totalMoves,
        timeMs,
        nonce,
        deadline,
      }
    );
  }

  // ---------- Happy path ----------

  it("mints with valid signature, stores VictoryData, emits VictoryMinted", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const nonce = 1n;
    const signature = await signVictory({
      player: player.address,
      difficulty: 2,
      totalMoves: 42,
      timeMs: 120000,
      nonce,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    const tx = await victory.connect(player).mintSigned(2, 42, 120000, tokenAddress, nonce, deadline, signature);
    const receipt = await tx.wait();

    // Check VictoryData
    const data = await victory.getVictory(1n);
    expect(data.difficulty).to.equal(2n);
    expect(data.totalMoves).to.equal(42n);
    expect(data.timeMs).to.equal(120000n);
    expect(Number(data.mintedAt)).to.be.greaterThan(0);

    // Check token ownership
    expect(await victory.ownerOf(1n)).to.equal(player.address);

    // Check event
    const events = receipt?.logs || [];
    const victoryMintedEvent = events.find((log: any) => {
      try {
        return victory.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "VictoryMinted";
      } catch {
        return false;
      }
    });
    expect(victoryMintedEvent).to.not.be.undefined;
  });

  // ---------- Validation reverts ----------

  it("reverts with InvalidDifficulty for difficulty 0", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 0,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(0, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("InvalidDifficulty");
  });

  it("reverts with InvalidDifficulty for difficulty 4", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 4,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(4, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("InvalidDifficulty");
  });

  it("reverts with InvalidMoves for zero moves", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 0,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 0, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("InvalidMoves");
  });

  it("reverts with InvalidTime for zero time", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 0,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 10, 0, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("InvalidTime");
  });

  it("reverts with SignatureExpired for expired deadline", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) - 1);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("SignatureExpired");
  });

  it("reverts with NonceUsed for reused nonce", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const nonce = 42n;

    const sig1 = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, nonce, deadline, sig1);

    // Wait for cooldown
    await time.increase(31);

    const sig2 = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 20,
      timeMs: 6000,
      nonce,
      deadline: BigInt((await time.latest()) + 600),
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 20, 6000, tokenAddress, nonce, BigInt((await time.latest()) + 600), sig2)
    ).to.be.rejectedWith("NonceUsed");
  });

  it("reverts with InvalidSignature for wrong signer", async function () {
    const { player, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const fakeSigner = ethers.Wallet.createRandom();
    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: fakeSigner,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("InvalidSignature");
  });

  it("reverts with TokenNotAccepted for unaccepted token", async function () {
    const { player, signingWallet, victory, victoryAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const badToken = await MockERC20.deploy("Bad Token", "BAD", 18);
    await badToken.waitForDeployment();
    const badTokenAddress = await badToken.getAddress();

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 10, 5000, badTokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("TokenNotAccepted");
  });

  it("reverts with PriceNotSet when price is zero for difficulty", async function () {
    const { owner, player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    // Deploy a fresh contract without prices set
    const factory = await ethers.getContractFactory("VictoryNFTUpgradeable");
    const [, , , treasuryW, prizePoolW] = await ethers.getSigners();
    const fresh = await upgrades.deployProxy(
      factory,
      [treasuryW.address, prizePoolW.address, signingWallet.address, owner.address],
      { kind: "transparent", initializer: "initialize", unsafeAllow: ["constructor"] }
    );
    await fresh.waitForDeployment();
    const freshAddress = await fresh.getAddress();

    // Accept token but do NOT set price
    await fresh.setAcceptedToken(tokenAddress, 18);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: freshAddress,
    });

    // Need to approve the fresh contract
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = MockERC20.attach(tokenAddress);
    await (mockToken.connect(player) as any).approve(freshAddress, ethers.parseEther("1000"));

    await expect(
      (fresh.connect(player) as any).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("PriceNotSet");
  });

  it("reverts with MintCooldown when minting too quickly", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const sig1 = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, sig1);

    // Try to mint again immediately (cooldown is 30s)
    const sig2 = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 20,
      timeMs: 6000,
      nonce: 2n,
      deadline: BigInt((await time.latest()) + 600),
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 20, 6000, tokenAddress, 2n, BigInt((await time.latest()) + 600), sig2)
    ).to.be.rejectedWith("MintCooldown");
  });

  // ---------- Fee split ----------

  it("splits payment 80% treasury, 20% prizePool", async function () {
    const { player, signingWallet, victory, victoryAddress, mockToken, tokenAddress, chainId, treasuryWallet, prizePoolWallet } =
      await loadFixture(deployVictoryFixture);

    const treasuryBefore = await mockToken.balanceOf(treasuryWallet.address);
    const prizePoolBefore = await mockToken.balanceOf(prizePoolWallet.address);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 2,
      totalMoves: 30,
      timeMs: 60000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(2, 30, 60000, tokenAddress, 1n, deadline, signature);

    const treasuryAfter = await mockToken.balanceOf(treasuryWallet.address);
    const prizePoolAfter = await mockToken.balanceOf(prizePoolWallet.address);

    // Price for difficulty 2 = 10_000 (USD6), normalized to 18 decimals = 10_000 * 10^12 = 10^16
    const expectedTotal = 10_000n * (10n ** 12n);
    const expectedTreasury = expectedTotal * 80n / 100n;
    const expectedPool = expectedTotal - expectedTreasury;

    expect(treasuryAfter - treasuryBefore).to.equal(expectedTreasury);
    expect(prizePoolAfter - prizePoolBefore).to.equal(expectedPool);
  });

  // ---------- Admin functions ----------

  it("owner can setPrice for valid difficulties", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await victory.connect(owner).setPrice(1, 7_000n);
    expect(await victory.priceUsd6(1)).to.equal(7_000n);

    await victory.connect(owner).setPrice(3, 50_000n);
    expect(await victory.priceUsd6(3)).to.equal(50_000n);
  });

  it("setPrice reverts for invalid difficulty", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setPrice(0, 5_000n)).to.be.rejectedWith("InvalidDifficulty");
    await expect(victory.connect(owner).setPrice(4, 5_000n)).to.be.rejectedWith("InvalidDifficulty");
  });

  it("setPrice reverts for zero price", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setPrice(1, 0n)).to.be.rejectedWith("InvalidPrice");
  });

  it("owner can setTreasury", async function () {
    const { owner, victory, otherPlayer } = await loadFixture(deployVictoryFixture);

    await victory.connect(owner).setTreasury(otherPlayer.address);
    expect(await victory.treasury()).to.equal(otherPlayer.address);
  });

  it("setTreasury reverts for address(0)", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.rejectedWith("InvalidAddress");
  });

  it("setTreasury reverts if same as prizePool", async function () {
    const { owner, victory, prizePoolWallet } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setTreasury(prizePoolWallet.address)).to.be.rejectedWith("SameAddress");
  });

  it("owner can setPrizePool", async function () {
    const { owner, victory, otherPlayer } = await loadFixture(deployVictoryFixture);

    await victory.connect(owner).setPrizePool(otherPlayer.address);
    expect(await victory.prizePool()).to.equal(otherPlayer.address);
  });

  it("setPrizePool reverts for address(0)", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setPrizePool(ethers.ZeroAddress)).to.be.rejectedWith("InvalidAddress");
  });

  it("setPrizePool reverts if same as treasury", async function () {
    const { owner, victory, treasuryWallet } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setPrizePool(treasuryWallet.address)).to.be.rejectedWith("SameAddress");
  });

  it("owner can setSigner", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    const newSigner = ethers.Wallet.createRandom();
    await victory.connect(owner).setSigner(newSigner.address);
    expect(await victory.signer()).to.equal(newSigner.address);
  });

  it("setSigner reverts for address(0)", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(owner).setSigner(ethers.ZeroAddress)).to.be.rejectedWith("InvalidSigner");
  });

  it("owner can setMintCooldown", async function () {
    const { owner, victory } = await loadFixture(deployVictoryFixture);

    await victory.connect(owner).setMintCooldown(60);
    expect(await victory.mintCooldown()).to.equal(60n);
  });

  // ---------- Pausable ----------

  it("mint reverts when paused", async function () {
    const { owner, player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    await victory.connect(owner).pause();

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await expect(
      victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature)
    ).to.be.rejectedWith("EnforcedPause()");
  });

  // ---------- Views ----------

  it("tokenURI returns correct format", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, signature);

    expect(await victory.tokenURI(1n)).to.equal("https://api.chesscito.xyz/victory/1.json");
  });

  it("getVictory returns stored data", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signVictory({
      player: player.address,
      difficulty: 3,
      totalMoves: 55,
      timeMs: 300000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(3, 55, 300000, tokenAddress, 1n, deadline, signature);

    const data = await victory.getVictory(1n);
    expect(data.difficulty).to.equal(3n);
    expect(data.totalMoves).to.equal(55n);
    expect(data.timeMs).to.equal(300000n);
  });

  it("totalMinted increments correctly", async function () {
    const { player, signingWallet, victory, victoryAddress, tokenAddress, chainId } =
      await loadFixture(deployVictoryFixture);

    expect(await victory.totalMinted()).to.equal(0n);

    const deadline = BigInt((await time.latest()) + 600);
    const sig1 = await signVictory({
      player: player.address,
      difficulty: 1,
      totalMoves: 10,
      timeMs: 5000,
      nonce: 1n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(1, 10, 5000, tokenAddress, 1n, deadline, sig1);
    expect(await victory.totalMinted()).to.equal(1n);

    // Wait for cooldown
    await time.increase(31);

    const sig2 = await signVictory({
      player: player.address,
      difficulty: 2,
      totalMoves: 20,
      timeMs: 10000,
      nonce: 2n,
      deadline: BigInt((await time.latest()) + 600),
      signer: signingWallet,
      chainId,
      verifyingContract: victoryAddress,
    });

    await victory.connect(player).mintSigned(2, 20, 10000, tokenAddress, 2n, BigInt((await time.latest()) + 600), sig2);
    expect(await victory.totalMinted()).to.equal(2n);
  });

  // ---------- Access control ----------

  it("non-owner cannot call admin functions", async function () {
    const { player, victory } = await loadFixture(deployVictoryFixture);

    await expect(victory.connect(player).setPrice(1, 5_000n)).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(victory.connect(player).setTreasury(player.address)).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(victory.connect(player).setPrizePool(player.address)).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(victory.connect(player).setSigner(player.address)).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(victory.connect(player).setMintCooldown(0)).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(victory.connect(player).pause()).to.be.rejectedWith("OwnableUnauthorizedAccount");
  });

  // ---------- Initialization ----------

  it("sets owner, signer, treasury, prizePool, and cooldown through initialize", async function () {
    const { owner, signingWallet, victory, treasuryWallet, prizePoolWallet } =
      await loadFixture(deployVictoryFixture);

    expect(await victory.owner()).to.equal(owner.address);
    expect(await victory.signer()).to.equal(signingWallet.address);
    expect(await victory.treasury()).to.equal(treasuryWallet.address);
    expect(await victory.prizePool()).to.equal(prizePoolWallet.address);
    expect(await victory.mintCooldown()).to.equal(30n);
    expect(await victory.name()).to.equal("Chesscito Victory");
    expect(await victory.symbol()).to.equal("VICTORY");
  });
});
