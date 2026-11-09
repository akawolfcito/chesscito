// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title LabyrinthBadges
 * @notice Soulbound ERC-1155 contract for verifiable labyrinth completion proofs.
 * @dev UUPS-compatible (gaps preserved). Deploy behind a Transparent proxy.
 *      Spec: docs/superpowers/specs/2026-06-02-labyrinth-badges-contract-v0.1.md
 */
contract LabyrinthBadges is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    // ─────────────────────────── Errors ────────────────────────────────────
    error InvalidSignature();
    error SignatureExpired(uint256 deadline);
    error NonceUsed(address player, uint256 nonce);
    error StarsNotStrictlyBetter(uint8 prior, uint8 incoming);
    error InvalidStars(uint256 stars);
    error InvalidSigner();
    error InvalidBaseURI();

    // ─────────────────────────── Events ────────────────────────────────────
    event LabyrinthClaimed(
        address indexed player,
        bytes32 indexed labyrinthIdHash,
        uint256 indexed tokenId,
        uint256 moves,
        uint8 stars,
        bytes32 campaignIdHash,
        uint256 nonce,
        uint256 deadline
    );
    event SignerUpdated(address indexed signer);
    event BaseURIUpdated(string baseURI);

    // ─────────────────────────── Constants ─────────────────────────────────
    bytes32 private constant LABYRINTH_MINT_TYPEHASH =
        keccak256(
            "LabyrinthMint(address player,bytes32 labyrinthId,uint256 moves,uint256 stars,bytes32 campaignId,uint256 nonce,uint256 deadline)"
        );

    // ─────────────────────────── Storage ───────────────────────────────────
    /// @dev player → labyrinthIdHash → best minted star tier (0 if none)
    mapping(address => mapping(bytes32 => uint8)) public bestMintedStars;
    /// @dev player → nonce → used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    address public signer;
    string private baseMetadataURI;

    // ─────────────────────────── Constructor ───────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────── Initializer ───────────────────────────────
    /**
     * @param initialBaseURI IPFS / CDN base URI (e.g. "ipfs://Qm.../")
     * @param initialSigner  Backend hot-wallet that signs claim vouchers
     * @param initialOwner   Multisig / deployer
     */
    function initialize(
        string memory initialBaseURI,
        address initialSigner,
        address initialOwner
    ) public initializer {
        if (initialSigner == address(0)) revert InvalidSigner();

        __ERC1155_init("");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __EIP712_init("LabyrinthBadges", "1");

        baseMetadataURI = _normalizeBaseURI(initialBaseURI);
        signer = initialSigner;

        emit BaseURIUpdated(baseMetadataURI);
        emit SignerUpdated(initialSigner);
    }

    // ─────────────────────────── Core ──────────────────────────────────────
    /**
     * @notice Claim a labyrinth proof for a completed run.
     * @dev Signature must be produced by `signer` off-chain after verifying
     *      labyrinth completion. Mint is rejected unless `stars` strictly
     *      improves over the player's prior best for this labyrinth.
     *      Nonces are single-use.
     */
    function claimLabyrinthSigned(
        bytes32 labyrinthIdHash,
        uint256 moves,
        uint256 stars,
        bytes32 campaignIdHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        if (stars == 0 || stars > 3) revert InvalidStars(stars);
        if (block.timestamp > deadline) revert SignatureExpired(deadline);
        if (usedNonces[msg.sender][nonce]) revert NonceUsed(msg.sender, nonce);

        uint8 incomingStars = uint8(stars);
        uint8 priorStars = bestMintedStars[msg.sender][labyrinthIdHash];
        if (incomingStars <= priorStars) {
            revert StarsNotStrictlyBetter(priorStars, incomingStars);
        }

        _verifyClaimSignature(
            msg.sender,
            labyrinthIdHash,
            moves,
            stars,
            campaignIdHash,
            nonce,
            deadline,
            signature
        );

        usedNonces[msg.sender][nonce] = true;
        bestMintedStars[msg.sender][labyrinthIdHash] = incomingStars;

        uint256 tokenId = tokenIdFor(labyrinthIdHash, incomingStars);
        _mint(msg.sender, tokenId, 1, "");

        emit LabyrinthClaimed(
            msg.sender,
            labyrinthIdHash,
            tokenId,
            moves,
            incomingStars,
            campaignIdHash,
            nonce,
            deadline
        );
    }

    // ─────────────────────────── Views ─────────────────────────────────────
    /**
     * @notice Computes the ERC-1155 token id for a (labyrinth, stars) pair.
     * @dev Namespaced via a "labyrinth" prefix so the id space cannot
     *      collide with any small-uint Badge id space.
     */
    function tokenIdFor(bytes32 labyrinthIdHash, uint8 stars)
        public
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked("labyrinth", labyrinthIdHash, stars)));
    }

    function baseURI() external view returns (string memory) {
        return baseMetadataURI;
    }

    /// @notice Returns full metadata URI for a given tokenId.
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string.concat(baseMetadataURI, Strings.toString(tokenId), ".json");
    }

    // ─────────────────────────── Soulbound ─────────────────────────────────
    /**
     * @dev Proofs are non-transferable AND non-burnable. Only minting
     *      (`from == address(0)`) is allowed. The OZ ERC-1155 base also
     *      rejects `safeTransferFrom(_, address(0), ...)` with
     *      `ERC1155InvalidReceiver` before reaching this hook, so burn
     *      attempts via the transfer API revert at the base layer.
     *      No external burn function is exposed.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (from != address(0)) revert("LabyrinthBadges: non-transferable");
        super._update(from, to, ids, values);
    }

    // ─────────────────────────── ERC-165 ───────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─────────────────────────── Admin ─────────────────────────────────────
    function setSigner(address nextSigner) external onlyOwner {
        if (nextSigner == address(0)) revert InvalidSigner();
        signer = nextSigner;
        emit SignerUpdated(nextSigner);
    }

    function setBaseURI(string memory nextBaseURI) external onlyOwner {
        baseMetadataURI = _normalizeBaseURI(nextBaseURI);
        emit BaseURIUpdated(baseMetadataURI);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────── Internals ─────────────────────────────────
    function _verifyClaimSignature(
        address player,
        bytes32 labyrinthIdHash,
        uint256 moves,
        uint256 stars,
        bytes32 campaignIdHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LABYRINTH_MINT_TYPEHASH,
                    player,
                    labyrinthIdHash,
                    moves,
                    stars,
                    campaignIdHash,
                    nonce,
                    deadline
                )
            )
        );
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();
    }

    /**
     * @dev Ensures baseURI always ends with "/" for clean concatenation.
     *      Reverts on empty string or bare "/".
     */
    function _normalizeBaseURI(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        if (b.length == 0) revert InvalidBaseURI();
        if (b.length == 1 && b[0] == bytes1("/")) revert InvalidBaseURI();
        if (b[b.length - 1] == bytes1("/")) return input;
        return string.concat(input, "/");
    }

    // ─────────────────────────── Gap ───────────────────────────────────────
    // Inherited slot budgets (OZ v5):
    //   Initializable          : 0  (uses InitializableStorageLayout)
    //   ERC1155Upgradeable     : __gap[47]
    //   OwnableUpgradeable     : __gap[49]
    //   PausableUpgradeable    : __gap[49]
    //   EIP712Upgradeable      : __gap[48]
    // Own vars (4 slots): bestMintedStars, usedNonces, signer, baseMetadataURI
    // Reserve 46 slots so total own-contract budget stays at 50 (4 used + 46 free).
    uint256[46] private __gap;
}
