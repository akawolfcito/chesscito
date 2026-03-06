import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("BadgesUpgradeable", function () {
  async function deployBadgesFixture() {
    const [owner, player, otherPlayer] = await ethers.getSigners();
    const signingWallet = ethers.Wallet.createRandom();
    const factory = await ethers.getContractFactory("BadgesUpgradeable");
    const badges = await upgrades.deployProxy(
      factory,
      ["ipfs://chesscito/badges", signingWallet.address, owner.address, 10n],
      { kind: "transparent", initializer: "initialize" }
    );

    await badges.waitForDeployment();

    return {
      owner,
      player,
      otherPlayer,
      signingWallet,
      badges,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };
  }

  async function signClaim({
    player,
    levelId,
    nonce,
    deadline,
    signer,
    chainId,
    verifyingContract,
  }: {
    player: string;
    levelId: bigint;
    nonce: bigint;
    deadline: bigint;
    signer: ethers.Wallet;
    chainId: bigint;
    verifyingContract: string;
  }) {
    return signer.signTypedData(
      {
        name: "Badges",
        version: "1",
        chainId,
        verifyingContract,
      },
      {
        BadgeClaim: [
          { name: "player", type: "address" },
          { name: "levelId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        levelId,
        nonce,
        deadline,
      }
    );
  }

  it("sets owner, signer, and metadata uri scheme through initialize", async function () {
    const { owner, signingWallet, badges } = await loadFixture(deployBadgesFixture);

    expect(await badges.owner()).to.equal(owner.address);
    expect(await badges.signer()).to.equal(signingWallet.address);
    expect(await badges.maxLevelId()).to.equal(10n);
    expect(await badges.uri(3n)).to.equal("ipfs://chesscito/badges/3.json");
    expect(await badges.baseURI()).to.equal("ipfs://chesscito/badges/");
  });

  it("mints one badge per wallet and level with a valid server signature", async function () {
    const { player, signingWallet, badges, chainId } = await loadFixture(deployBadgesFixture);
    const deadline = (await time.latest()) + 600;
    const nonce = 101n;
    const signature = await signClaim({
      player: player.address,
      levelId: 1n,
      nonce,
      deadline: BigInt(deadline),
      signer: signingWallet,
      chainId,
      verifyingContract: await badges.getAddress(),
    });

    await badges.connect(player).claimBadgeSigned(1n, nonce, deadline, signature);

    expect(await badges.hasClaimedBadge(player.address, 1n)).to.equal(true);
    expect(await badges.usedNonces(player.address, nonce)).to.equal(true);
    expect(await badges.balanceOf(player.address, 1n)).to.equal(1n);
  });

  it("prevents claiming the same level twice for the same wallet", async function () {
    const { player, signingWallet, badges, chainId } = await loadFixture(deployBadgesFixture);
    const deadline = BigInt((await time.latest()) + 600);
    const firstSignature = await signClaim({
      player: player.address,
      levelId: 2n,
      nonce: 201n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: await badges.getAddress(),
    });

    await badges.connect(player).claimBadgeSigned(2n, 201n, deadline, firstSignature);

    const secondSignature = await signClaim({
      player: player.address,
      levelId: 2n,
      nonce: 202n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: await badges.getAddress(),
    });

    await expect(
      badges.connect(player).claimBadgeSigned(2n, 202n, deadline, secondSignature)
    ).to.be.rejectedWith("BadgeAlreadyClaimed");
  });

  it("rejects invalid or expired signatures and pauses claims", async function () {
    const { owner, player, otherPlayer, signingWallet, badges, chainId } = await loadFixture(
      deployBadgesFixture
    );
    const deadline = BigInt((await time.latest()) + 600);
    const signature = await signClaim({
      player: player.address,
      levelId: 4n,
      nonce: 301n,
      deadline,
      signer: signingWallet,
      chainId,
      verifyingContract: await badges.getAddress(),
    });

    await expect(
      badges.connect(otherPlayer).claimBadgeSigned(4n, 301n, deadline, signature)
    ).to.be.rejectedWith("InvalidSignature");

    await time.increase(601);

    await expect(badges.connect(player).claimBadgeSigned(4n, 301n, deadline, signature)).to.be.rejectedWith(
      "SignatureExpired"
    );

    await badges.connect(owner).pause();

    const freshDeadline = BigInt((await time.latest()) + 600);
    const freshSignature = await signClaim({
      player: player.address,
      levelId: 5n,
      nonce: 302n,
      deadline: freshDeadline,
      signer: signingWallet,
      chainId,
      verifyingContract: await badges.getAddress(),
    });

    await expect(
      badges.connect(player).claimBadgeSigned(5n, 302n, freshDeadline, freshSignature)
    ).to.be.rejectedWith("EnforcedPause()");
  });

  it("lets the owner update the base uri and signer", async function () {
    const { owner, badges } = await loadFixture(deployBadgesFixture);
    const nextSigner = ethers.Wallet.createRandom();

    await badges.connect(owner).setSigner(nextSigner.address);
    await badges.connect(owner).setBaseURI("https://assets.chesscito.xyz/badges");

    expect(await badges.signer()).to.equal(nextSigner.address);
    expect(await badges.uri(7n)).to.equal("https://assets.chesscito.xyz/badges/7.json");
  });
});
