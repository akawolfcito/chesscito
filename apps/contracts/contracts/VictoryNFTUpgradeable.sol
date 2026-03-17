// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract VictoryNFTUpgradeable is
    Initializable,
    ERC721Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;

    // Reentrancy guard (upgrade-safe, no constructor)
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus;

    error ReentrancyGuardReentrantCall();

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyGuardReentrantCall();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // Errors
    error InvalidDifficulty(uint8 difficulty);
    error InvalidMoves();
    error InvalidTime();
    error InvalidAddress();
    error InvalidPrice();
    error InvalidDecimals();
    error InvalidSigner();
    error InvalidSignature();
    error SignatureExpired(uint256 deadline);
    error NonceUsed(address player, uint256 nonce);
    error TokenNotAccepted(address token);
    error PriceNotSet(uint8 difficulty);
    error MintCooldown(uint256 nextMintAt);
    error SameAddress();

    // Events
    event VictoryMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint8 difficulty,
        uint16 totalMoves,
        uint32 timeMs,
        address indexed token,
        uint256 totalAmount
    );
    event PriceUpdated(uint8 difficulty, uint256 priceUsd6);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event PrizePoolUpdated(address indexed previous, address indexed next);
    event SignerUpdated(address indexed signer);
    event MintCooldownUpdated(uint256 cooldown);
    event AcceptedTokenUpdated(address indexed token, uint8 decimals);
    event AcceptedTokenRemoved(address indexed token);

    // Constants
    bytes32 private constant VICTORY_TYPEHASH = keccak256(
        "VictoryMint(address player,uint8 difficulty,uint16 totalMoves,uint32 timeMs,uint256 nonce,uint256 deadline)"
    );

    // Storage
    struct VictoryData {
        uint8 difficulty;
        uint16 totalMoves;
        uint32 timeMs;
        uint64 mintedAt;
    }

    mapping(address => uint8) public acceptedTokens;
    mapping(uint8 => uint256) public priceUsd6;
    address public treasury;
    address public prizePool;
    address public signer;
    uint256 public mintCooldown;
    mapping(address => uint256) public lastMintAt;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(uint256 => VictoryData) public victories;
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    // Own slots: _reentrancyStatus, acceptedTokens, priceUsd6, treasury, prizePool, signer,
    //   mintCooldown, lastMintAt, usedNonces, victories, _nextTokenId, _baseTokenURI = 12
    // Gap: 50 - 12 = 38 free
    uint256[38] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address initialTreasury,
        address initialPrizePool,
        address initialSigner,
        address initialOwner
    ) public initializer {
        if (initialTreasury == address(0)) revert InvalidAddress();
        if (initialPrizePool == address(0)) revert InvalidAddress();
        if (initialSigner == address(0)) revert InvalidSigner();
        if (initialTreasury == initialPrizePool) revert SameAddress();

        __ERC721_init("Chesscito Victory", "VICTORY");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __EIP712_init("VictoryNFT", "1");

        _reentrancyStatus = _NOT_ENTERED;

        treasury = initialTreasury;
        prizePool = initialPrizePool;
        signer = initialSigner;
        mintCooldown = 30;
        _nextTokenId = 1;
    }

    // Core
    function mintSigned(
        uint8 difficulty,
        uint16 totalMoves,
        uint32 timeMs,
        address token,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
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

        // Payment split
        uint256 totalAmount = _normalizePrice(price, tokenDecimals);
        _splitPayment(token, totalAmount);

        // Mint
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

    // Views
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, Strings.toString(tokenId), ".json");
    }

    function getVictory(uint256 tokenId) external view returns (VictoryData memory) {
        _requireOwned(tokenId);
        return victories[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // Internal
    function _splitPayment(address token, uint256 totalAmount) internal {
        uint256 treasuryAmount = totalAmount * 80 / 100;
        uint256 poolAmount = totalAmount - treasuryAmount;
        IERC20(token).safeTransferFrom(msg.sender, treasury, treasuryAmount);
        IERC20(token).safeTransferFrom(msg.sender, prizePool, poolAmount);
    }

    function _normalizePrice(uint256 _priceUsd6, uint8 tokenDecimals) internal pure returns (uint256) {
        if (tokenDecimals >= 6) return _priceUsd6 * 10 ** (tokenDecimals - 6);
        return _priceUsd6 / 10 ** (6 - tokenDecimals);
    }

    function _verifySignature(
        address player, uint8 difficulty, uint16 totalMoves, uint32 timeMs,
        uint256 nonce, uint256 deadline, bytes calldata signature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(VICTORY_TYPEHASH, player, difficulty, totalMoves, timeMs, nonce, deadline))
        );
        if (ECDSA.recover(digest, signature) != signer) revert InvalidSignature();
    }

    // Admin
    function setPrice(uint8 difficulty, uint256 price) external onlyOwner {
        if (difficulty < 1 || difficulty > 3) revert InvalidDifficulty(difficulty);
        if (price == 0) revert InvalidPrice();
        priceUsd6[difficulty] = price;
        emit PriceUpdated(difficulty, price);
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        if (next == prizePool) revert SameAddress();
        address prev = treasury;
        treasury = next;
        emit TreasuryUpdated(prev, next);
    }

    function setPrizePool(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        if (next == treasury) revert SameAddress();
        address prev = prizePool;
        prizePool = next;
        emit PrizePoolUpdated(prev, next);
    }

    function setSigner(address next) external onlyOwner {
        if (next == address(0)) revert InvalidSigner();
        signer = next;
        emit SignerUpdated(next);
    }

    function setMintCooldown(uint256 seconds_) external onlyOwner {
        mintCooldown = seconds_;
        emit MintCooldownUpdated(seconds_);
    }

    function setAcceptedToken(address token, uint8 decimals) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        if (decimals < 6 || decimals > 18) revert InvalidDecimals();
        acceptedTokens[token] = decimals;
        emit AcceptedTokenUpdated(token, decimals);
    }

    function removeAcceptedToken(address token) external onlyOwner {
        acceptedTokens[token] = 0;
        emit AcceptedTokenRemoved(token);
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
