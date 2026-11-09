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
 * @title BadgesUpgradeable
 * @notice ERC-1155 badge contract. One badge per level, claimed via EIP-712 signed voucher.
 * @dev UUPS-compatible (gaps preserved). Deploy behind an ERC1967Proxy.
 */
contract BadgesUpgradeable is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    // ─────────────────────────── Errors ────────────────────────────────────
    error BadgeAlreadyClaimed(address player, uint256 levelId);
    error InvalidSignature();
    error SignatureExpired(uint256 deadline);
    error NonceUsed(address player, uint256 nonce);
    error InvalidSigner();
    error InvalidBaseURI();
    error InvalidLevel(uint256 levelId);
    error CanOnlyIncreaseMaxLevel(uint256 current, uint256 requested);

    // ─────────────────────────── Events ────────────────────────────────────
    event BadgeClaimed(
        address indexed player,
        uint256 indexed levelId,
        uint256 indexed tokenId,
        uint256 nonce,
        uint256 deadline
    );
    event BaseURIUpdated(string baseURI);
    event SignerUpdated(address indexed signer);
    event MaxLevelUpdated(uint256 maxLevelId);

    // ─────────────────────────── Constants ─────────────────────────────────
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("BadgeClaim(address player,uint256 levelId,uint256 nonce,uint256 deadline)");

    // ─────────────────────────── Storage ───────────────────────────────────
    /// @dev player → levelId → claimed
    mapping(address => mapping(uint256 => bool)) public hasClaimedBadge;
    /// @dev player → nonce → used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    string private baseMetadataURI;
    address public signer;
    /// @notice Maximum valid levelId. Owner-adjustable as new levels ship.
    uint256 public maxLevelId;

    // ─────────────────────────── Constructor ───────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────── Initializer ───────────────────────────────
    /**
     * @param initialBaseURI    IPFS / CDN base URI (e.g. "ipfs://Qm.../")
     * @param initialSigner     Backend hot-wallet that signs vouchers
     * @param initialOwner      Multisig / deployer
     * @param initialMaxLevelId Number of levels live at deploy time
     */
    function initialize(
        string memory initialBaseURI,
        address initialSigner,
        address initialOwner,
        uint256 initialMaxLevelId
    ) public initializer {
        if (initialSigner == address(0)) revert InvalidSigner();
        if (initialMaxLevelId == 0) revert InvalidLevel(initialMaxLevelId);

        __ERC1155_init("");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __EIP712_init("Badges", "1");

        baseMetadataURI = _normalizeBaseURI(initialBaseURI);
        signer = initialSigner;
        maxLevelId = initialMaxLevelId;

        emit BaseURIUpdated(baseMetadataURI);
        emit SignerUpdated(initialSigner);
        emit MaxLevelUpdated(initialMaxLevelId);
    }

    // ─────────────────────────── Core ──────────────────────────────────────
    /**
     * @notice Claim a badge for a completed level.
     * @dev Signature must be produced by `signer` off-chain after verifying level completion.
     *      One badge per (player, levelId). Nonces are single-use.
     */
    function claimBadgeSigned(
        uint256 levelId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        if (levelId == 0 || levelId > maxLevelId) revert InvalidLevel(levelId);
        if (block.timestamp > deadline) revert SignatureExpired(deadline);
        if (usedNonces[msg.sender][nonce]) revert NonceUsed(msg.sender, nonce);
        if (hasClaimedBadge[msg.sender][levelId]) revert BadgeAlreadyClaimed(msg.sender, levelId);

        _verifyClaimSignature(msg.sender, levelId, nonce, deadline, signature);

        usedNonces[msg.sender][nonce] = true;
        hasClaimedBadge[msg.sender][levelId] = true;

        uint256 tokenId = tokenIdForLevel(levelId);
        _mint(msg.sender, tokenId, 1, "");

        emit BadgeClaimed(msg.sender, levelId, tokenId, nonce, deadline);
    }

    // ─────────────────────────── Views ─────────────────────────────────────
    /// @notice tokenId is 1:1 with levelId for simplicity.
    function tokenIdForLevel(uint256 levelId) public pure returns (uint256) {
        return levelId;
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
     * @dev Badges are non-transferable (soulbound). Only minting (from == address(0)) is allowed.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (from != address(0)) revert("Badges: non-transferable");
        super._update(from, to, ids, values);
    }

    // ─────────────────────────── ERC-165 ───────────────────────────────────
    /**
     * @dev Explicit override required when multiple parents expose supportsInterface.
     */
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

    /// @notice Call this whenever a new batch of levels goes live. Cannot decrease.
    function setMaxLevelId(uint256 nextMaxLevelId) external onlyOwner {
        if (nextMaxLevelId == 0) revert InvalidLevel(nextMaxLevelId);
        if (nextMaxLevelId < maxLevelId) revert CanOnlyIncreaseMaxLevel(maxLevelId, nextMaxLevelId);
        maxLevelId = nextMaxLevelId;
        emit MaxLevelUpdated(nextMaxLevelId);
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
        uint256 levelId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_TYPEHASH, player, levelId, nonce, deadline))
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
        // Reject a URI that is only "/"
        if (b.length == 1 && b[0] == bytes1("/")) revert InvalidBaseURI();
        if (b[b.length - 1] == bytes1("/")) return input;
        return string.concat(input, "/");
    }

    // ─────────────────────────── Gap ───────────────────────────────────────
    // Inherited slot budgets (OZ v5):
    //   Initializable          : 0  (uses InitializableStorageLayout, not raw slots)
    //   ERC1155Upgradeable     : __gap[47]
    //   OwnableUpgradeable     : __gap[49]
    //   PausableUpgradeable    : __gap[49]
    //   EIP712Upgradeable      : __gap[48]
    // Own vars (5 slots): hasClaimedBadge, usedNonces, baseMetadataURI, signer, maxLevelId
    // Reserve 50 slots so total own-contract budget stays at 50 (5 used + 45 free).
    uint256[45] private __gap;
}
