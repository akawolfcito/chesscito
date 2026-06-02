import "@nomicfoundation/hardhat-chai-matchers";

import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("LabyrinthBadges", function () {
  const BASE_URI = "ipfs://chesscito/labyrinth-badges";
  const NORMALIZED_BASE_URI = "ipfs://chesscito/labyrinth-badges/";
  const LAB_ID_PAWN_1 = ethers.id("pawn-lab-1");
  const LAB_ID_PAWN_2 = ethers.id("pawn-lab-2");
  const CAMPAIGN_ZERO = ethers.ZeroHash;
  const CAMPAIGN_ROOK_WEEK = ethers.id("rook-week-2026-06");

  async function deployFixture() {
    const [owner, player, otherPlayer, attacker] = await ethers.getSigners();
    const signingWallet = ethers.Wallet.createRandom();
    const rogueWallet = ethers.Wallet.createRandom();
    const factory = await ethers.getContractFactory("LabyrinthBadges");
    const badges = await upgrades.deployProxy(
      factory,
      [BASE_URI, signingWallet.address, owner.address],
      { kind: "transparent", initializer: "initialize" }
    );
    await badges.waitForDeployment();

    return {
      owner,
      player,
      otherPlayer,
      attacker,
      signingWallet,
      rogueWallet,
      badges,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };
  }

  type SignClaimArgs = {
    player: string;
    labyrinthIdHash: string;
    moves: bigint;
    stars: bigint;
    campaignIdHash: string;
    nonce: bigint;
    deadline: bigint;
    signer: ethers.HDNodeWallet;
    chainId: bigint;
    verifyingContract: string;
  };

  async function signClaim(args: SignClaimArgs) {
    return args.signer.signTypedData(
      {
        name: "LabyrinthBadges",
        version: "1",
        chainId: args.chainId,
        verifyingContract: args.verifyingContract,
      },
      {
        LabyrinthMint: [
          { name: "player", type: "address" },
          { name: "labyrinthId", type: "bytes32" },
          { name: "moves", type: "uint256" },
          { name: "stars", type: "uint256" },
          { name: "campaignId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player: args.player,
        labyrinthId: args.labyrinthIdHash,
        moves: args.moves,
        stars: args.stars,
        campaignId: args.campaignIdHash,
        nonce: args.nonce,
        deadline: args.deadline,
      }
    );
  }

  // ─────────────────────────── Setup / initialize ───────────────────────────
  describe("initialize", function () {
    it("sets owner, signer, and metadata uri scheme", async function () {
      const { owner, signingWallet, badges } = await loadFixture(deployFixture);
      expect(await badges.owner()).to.equal(owner.address);
      expect(await badges.signer()).to.equal(signingWallet.address);
      expect(await badges.baseURI()).to.equal(NORMALIZED_BASE_URI);
    });

    it("rejects InvalidSigner when initialSigner is the zero address", async function () {
      const [owner] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("LabyrinthBadges");
      await expect(
        upgrades.deployProxy(
          factory,
          [BASE_URI, ethers.ZeroAddress, owner.address],
          { kind: "transparent", initializer: "initialize" }
        )
      ).to.be.rejectedWith("InvalidSigner");
    });

    it("rejects InvalidBaseURI when initialBaseURI is empty", async function () {
      const [owner] = await ethers.getSigners();
      const signing = ethers.Wallet.createRandom();
      const factory = await ethers.getContractFactory("LabyrinthBadges");
      await expect(
        upgrades.deployProxy(
          factory,
          ["", signing.address, owner.address],
          { kind: "transparent", initializer: "initialize" }
        )
      ).to.be.rejectedWith("InvalidBaseURI");
    });
  });

  // ─────────────────────────── Happy path (spec §16 tests 1-3) ──────────────
  describe("happy path", function () {
    it("mints one token on a valid signed claim and increments balance (test 1)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const nonce = 101n;
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 3n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 3n, CAMPAIGN_ZERO, nonce, deadline, signature);

      const tokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, 3);
      expect(await badges.balanceOf(player.address, tokenId)).to.equal(1n);
      expect(await badges.usedNonces(player.address, nonce)).to.equal(true);
    });

    it("updates bestMintedStars from 0 to the incoming tier (test 2)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 4n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      expect(await badges.bestMintedStars(player.address, LAB_ID_PAWN_1)).to.equal(0n);
      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 4n, 2n, CAMPAIGN_ZERO, 1n, deadline, signature);
      expect(await badges.bestMintedStars(player.address, LAB_ID_PAWN_1)).to.equal(2n);
    });

    it("emits LabyrinthClaimed with the expected fields (test 3)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const nonce = 42n;
      const moves = 7n;
      const stars = 2n;
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves,
        stars,
        campaignIdHash: CAMPAIGN_ROOK_WEEK,
        nonce,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      const tokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, Number(stars));
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(
            LAB_ID_PAWN_1,
            moves,
            stars,
            CAMPAIGN_ROOK_WEEK,
            nonce,
            deadline,
            signature
          )
      )
        .to.emit(badges, "LabyrinthClaimed")
        .withArgs(
          player.address,
          LAB_ID_PAWN_1,
          tokenId,
          moves,
          Number(stars),
          CAMPAIGN_ROOK_WEEK,
          nonce,
          deadline
        );
    });
  });

  // ─────────────────────────── Anti-spam (spec §16 tests 4-6) ───────────────
  describe("anti-spam strict improvement", function () {
    async function mintTier(
      badges: any,
      player: any,
      signingWallet: any,
      chainId: bigint,
      stars: bigint,
      nonce: bigint
    ) {
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 6n,
        stars,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 6n, stars, CAMPAIGN_ZERO, nonce, deadline, signature);
    }

    it("rejects re-claim at the same star tier (test 4)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      await mintTier(badges, player, signingWallet, chainId, 2n, 1n);

      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 6n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 2n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 6n, 2n, CAMPAIGN_ZERO, 2n, deadline, signature)
      ).to.be.rejectedWith("StarsNotStrictlyBetter");
    });

    it("rejects re-claim at a lower star tier (test 5)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      await mintTier(badges, player, signingWallet, chainId, 3n, 10n);

      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 6n,
        stars: 1n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 11n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 6n, 1n, CAMPAIGN_ZERO, 11n, deadline, signature)
      ).to.be.rejectedWith("StarsNotStrictlyBetter");
    });

    it("accepts re-claim at a higher star tier and updates bestMintedStars (test 6)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      await mintTier(badges, player, signingWallet, chainId, 1n, 21n);
      expect(await badges.bestMintedStars(player.address, LAB_ID_PAWN_1)).to.equal(1n);

      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 4n,
        stars: 3n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 22n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 4n, 3n, CAMPAIGN_ZERO, 22n, deadline, signature);

      expect(await badges.bestMintedStars(player.address, LAB_ID_PAWN_1)).to.equal(3n);
      const tier1TokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, 1);
      const tier3TokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, 3);
      expect(await badges.balanceOf(player.address, tier1TokenId)).to.equal(1n);
      expect(await badges.balanceOf(player.address, tier3TokenId)).to.equal(1n);
    });
  });

  // ─────────────────────────── Signature integrity (tests 7-11) ─────────────
  describe("signature integrity", function () {
    it("rejects an expired signature (test 7)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await time.increase(601);

      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 2n, CAMPAIGN_ZERO, 1n, deadline, signature)
      ).to.be.rejectedWith("SignatureExpired");
    });

    it("rejects a replayed nonce (test 8)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const sig1 = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 1n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 7n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 1n, CAMPAIGN_ZERO, 7n, deadline, sig1);

      const sig2 = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_2,
        moves: 5n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 7n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_2, 5n, 2n, CAMPAIGN_ZERO, 7n, deadline, sig2)
      ).to.be.rejectedWith("NonceUsed");
    });

    it("rejects a signature from the wrong signer (test 9)", async function () {
      const { player, rogueWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 1n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 5n,
        deadline,
        signer: rogueWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 1n, CAMPAIGN_ZERO, 5n, deadline, signature)
      ).to.be.rejectedWith("InvalidSignature");
    });

    it("rejects a tampered field (signed moves differ from calldata moves) (test 10)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 14n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 99n, 2n, CAMPAIGN_ZERO, 14n, deadline, signature)
      ).to.be.rejectedWith("InvalidSignature");
    });

    it("recovers under the exact Phase C endpoint domain shape (test 11)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const verifyingContract = await badges.getAddress();
      const deadline = BigInt((await time.latest()) + 600);
      const nonce = 99n;

      const signature = await signingWallet.signTypedData(
        {
          name: "LabyrinthBadges",
          version: "1",
          chainId,
          verifyingContract,
        },
        {
          LabyrinthMint: [
            { name: "player", type: "address" },
            { name: "labyrinthId", type: "bytes32" },
            { name: "moves", type: "uint256" },
            { name: "stars", type: "uint256" },
            { name: "campaignId", type: "bytes32" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        {
          player: player.address,
          labyrinthId: LAB_ID_PAWN_2,
          moves: 6n,
          stars: 3n,
          campaignId: CAMPAIGN_ROOK_WEEK,
          nonce,
          deadline,
        }
      );

      await badges
        .connect(player)
        .claimLabyrinthSigned(
          LAB_ID_PAWN_2,
          6n,
          3n,
          CAMPAIGN_ROOK_WEEK,
          nonce,
          deadline,
          signature
        );

      expect(await badges.bestMintedStars(player.address, LAB_ID_PAWN_2)).to.equal(3n);
    });
  });

  // ─────────────────────────── Validation (tests 12-13) ─────────────────────
  describe("stars validation", function () {
    it("rejects stars == 0 with InvalidStars (test 12)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 0n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 0n, CAMPAIGN_ZERO, 1n, deadline, signature)
      ).to.be.rejectedWith("InvalidStars");
    });

    it("rejects stars > 3 with InvalidStars (test 13)", async function () {
      const { player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 4n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 4n, CAMPAIGN_ZERO, 1n, deadline, signature)
      ).to.be.rejectedWith("InvalidStars");
    });
  });

  // ─────────────────────────── Admin (tests 14-17) ──────────────────────────
  describe("admin", function () {
    it("blocks non-owner from calling pause, setSigner, setBaseURI (test 14)", async function () {
      const { attacker, badges } = await loadFixture(deployFixture);
      await expect(badges.connect(attacker).pause()).to.be.rejectedWith(
        "OwnableUnauthorizedAccount"
      );
      await expect(
        badges.connect(attacker).setSigner(attacker.address)
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
      await expect(
        badges.connect(attacker).setBaseURI("ipfs://other/")
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("blocks claims while paused with EnforcedPause (test 15)", async function () {
      const { owner, player, signingWallet, badges, chainId } = await loadFixture(deployFixture);
      await badges.connect(owner).pause();

      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 1n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });

      await expect(
        badges
          .connect(player)
          .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 1n, CAMPAIGN_ZERO, 1n, deadline, signature)
      ).to.be.rejectedWith("EnforcedPause");
    });

    it("rejects setSigner(address(0)) with InvalidSigner (test 16)", async function () {
      const { owner, badges } = await loadFixture(deployFixture);
      await expect(
        badges.connect(owner).setSigner(ethers.ZeroAddress)
      ).to.be.rejectedWith("InvalidSigner");
    });

    it("rejects setBaseURI('') with InvalidBaseURI (test 17)", async function () {
      const { owner, badges } = await loadFixture(deployFixture);
      await expect(
        badges.connect(owner).setBaseURI("")
      ).to.be.rejectedWith("InvalidBaseURI");
    });
  });

  // ─────────────────────────── Soulbound (tests 18, 19, 19b) ────────────────
  describe("soulbound", function () {
    async function mintForTransferTests() {
      const ctx = await loadFixture(deployFixture);
      const { player, signingWallet, badges, chainId } = ctx;
      const deadline = BigInt((await time.latest()) + 600);
      const signature = await signClaim({
        player: player.address,
        labyrinthIdHash: LAB_ID_PAWN_1,
        moves: 5n,
        stars: 2n,
        campaignIdHash: CAMPAIGN_ZERO,
        nonce: 1n,
        deadline,
        signer: signingWallet,
        chainId,
        verifyingContract: await badges.getAddress(),
      });
      await badges
        .connect(player)
        .claimLabyrinthSigned(LAB_ID_PAWN_1, 5n, 2n, CAMPAIGN_ZERO, 1n, deadline, signature);
      const tokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, 2);
      return { ...ctx, tokenId };
    }

    it("rejects safeTransferFrom between two non-zero addresses (test 18)", async function () {
      const { player, otherPlayer, badges, tokenId } = await mintForTransferTests();
      await expect(
        badges
          .connect(player)
          .safeTransferFrom(player.address, otherPlayer.address, tokenId, 1n, "0x")
      ).to.be.rejectedWith("LabyrinthBadges: non-transferable");
    });

    it("rejects safeBatchTransferFrom (test 19)", async function () {
      const { player, otherPlayer, badges, tokenId } = await mintForTransferTests();
      await expect(
        badges
          .connect(player)
          .safeBatchTransferFrom(
            player.address,
            otherPlayer.address,
            [tokenId],
            [1n],
            "0x"
          )
      ).to.be.rejectedWith("LabyrinthBadges: non-transferable");
    });

    it("rejects safeTransferFrom to address(0) (burn attempt, test 19b)", async function () {
      const { player, badges, tokenId } = await mintForTransferTests();
      // OZ v5 ERC-1155 base rejects address(0) receiver with
      // ERC1155InvalidReceiver BEFORE the _update hook fires. The burn
      // invariant holds either way; we assert a generic revert and do not
      // couple to OZ internal error names.
      await expect(
        badges
          .connect(player)
          .safeTransferFrom(player.address, ethers.ZeroAddress, tokenId, 1n, "0x")
      ).to.be.reverted;
    });
  });

  // ─────────────────────────── Metadata + tokenId (tests 20-21) ─────────────
  describe("metadata and tokenId", function () {
    it("uri(tokenId) concatenates baseURI + tokenId + .json (test 20)", async function () {
      const { badges } = await loadFixture(deployFixture);
      const tokenId = await badges.tokenIdFor(LAB_ID_PAWN_1, 3);
      const expected = `${NORMALIZED_BASE_URI}${tokenId.toString()}.json`;
      expect(await badges.uri(tokenId)).to.equal(expected);
    });

    it("tokenIdFor is deterministic and unique across (lab, stars) pairs (test 21)", async function () {
      const { badges } = await loadFixture(deployFixture);

      const idP1S1a = await badges.tokenIdFor(LAB_ID_PAWN_1, 1);
      const idP1S1b = await badges.tokenIdFor(LAB_ID_PAWN_1, 1);
      const idP1S2 = await badges.tokenIdFor(LAB_ID_PAWN_1, 2);
      const idP1S3 = await badges.tokenIdFor(LAB_ID_PAWN_1, 3);
      const idP2S1 = await badges.tokenIdFor(LAB_ID_PAWN_2, 1);

      // Determinism
      expect(idP1S1a).to.equal(idP1S1b);

      // Uniqueness across star tiers
      expect(idP1S1a).to.not.equal(idP1S2);
      expect(idP1S2).to.not.equal(idP1S3);
      expect(idP1S1a).to.not.equal(idP1S3);

      // Uniqueness across labs
      expect(idP1S1a).to.not.equal(idP2S1);

      // Non-zero (sanity)
      expect(idP1S1a).to.not.equal(0n);
    });
  });
});
