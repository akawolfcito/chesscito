// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title ShopUpgradeable
 * @notice Players buy in-game items with any accepted ERC-20 stablecoin (USDC, USDT, cUSD).
 *         Prices are stored in USD with 6 decimals and normalized per token at purchase time.
 *         Entitlements are handled off-chain via the `ItemPurchased` event.
 * @dev Deploy behind a TransparentUpgradeableProxy.
 *      OZ v5 ReentrancyGuard uses ERC-7201 namespaced storage, so it is proxy-safe.
 */
contract ShopUpgradeable is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ─────────────────────────── Errors ────────────────────────────────────
    error InvalidQuantity();
    error QuantityExceedsMax(uint256 quantity, uint256 max);
    error ItemNotConfigured(uint256 itemId);
    error ItemDisabled(uint256 itemId);
    error TokenNotAccepted(address token);
    error InvalidAddress();
    error InvalidPrice();
    error InvalidDecimals();
    error SameTreasury();
    error LengthMismatch();

    // ─────────────────────────── Events ────────────────────────────────────
    event ItemPurchased(
        address indexed buyer,
        uint256 indexed itemId,
        uint256 quantity,
        uint256 unitPriceUsd6,
        uint256 totalTokenAmount,
        address indexed token,
        address treasury
    );
    event AcceptedTokenUpdated(address indexed token, uint8 decimals);
    event AcceptedTokenRemoved(address indexed token);
    event ItemConfigured(uint256 indexed itemId, uint256 priceUsd6, bool enabled);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event MaxQuantityPerTxUpdated(uint256 maxQuantity);

    // ─────────────────────────── Storage ───────────────────────────────────
    struct ItemConfig {
        uint256 priceUsd6; // price in USD with 6 decimals (e.g. 25000 = $0.025)
        bool enabled;
    }

    // ── Own storage (4 slots) ─────────────────────────────────────────────
    // slot 0: acceptedTokens mapping — decimals per token (0 = not accepted)
    mapping(address => uint8) public acceptedTokens;
    // slot 1: items mapping
    mapping(uint256 => ItemConfig) public items;
    // slot 2: treasury
    address public treasury;
    // slot 3: maxQuantityPerTx
    uint256 public maxQuantityPerTx;

    // ── Gap (46 free = 50 budget − 4 own) ─────────────────────────────────
    uint256[46] private __gap;

    // ─────────────────────────── Constructor ───────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────── Initializer ──────────────────────────────
    function initialize(
        address initialTreasury,
        uint256 initialMaxQuantityPerTx,
        address initialOwner
    ) public initializer {
        if (initialTreasury == address(0)) revert InvalidAddress();
        __Ownable_init(initialOwner);
        __Pausable_init();
        treasury = initialTreasury;
        maxQuantityPerTx = initialMaxQuantityPerTx;
    }

    // ─────────────────────────── Purchase ──────────────────────────────────
    function buyItem(uint256 itemId, uint256 quantity, address token) external whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidQuantity();
        if (maxQuantityPerTx != 0 && quantity > maxQuantityPerTx) {
            revert QuantityExceedsMax(quantity, maxQuantityPerTx);
        }
        if (token == address(0)) revert InvalidAddress();

        uint8 tokenDecimals = acceptedTokens[token];
        if (tokenDecimals == 0) revert TokenNotAccepted(token);

        ItemConfig memory cfg = items[itemId];
        if (cfg.priceUsd6 == 0) revert ItemNotConfigured(itemId);
        if (!cfg.enabled) revert ItemDisabled(itemId);

        uint256 unitAmount = _normalizePrice(cfg.priceUsd6, tokenDecimals);
        if (unitAmount == 0) revert InvalidPrice();
        uint256 totalAmount = unitAmount * quantity;
        address t = treasury;

        IERC20(token).safeTransferFrom(msg.sender, t, totalAmount);

        emit ItemPurchased(msg.sender, itemId, quantity, cfg.priceUsd6, totalAmount, token, t);
    }

    // ─────────────────────────── Internal ──────────────────────────────────
    /**
     * @notice Convert a USD-6 price to the token's native amount.
     * @dev For tokens with < 6 decimals, integer division truncates.
     *      No current accepted token uses < 6 decimals.
     */
    function _normalizePrice(uint256 priceUsd6, uint8 tokenDecimals) internal pure returns (uint256) {
        if (tokenDecimals >= 6) {
            return priceUsd6 * 10 ** (tokenDecimals - 6);
        }
        return priceUsd6 / 10 ** (6 - tokenDecimals);
    }

    // ─────────────────────────── Admin ─────────────────────────────────────
    function setAcceptedToken(address token, uint8 tokenDecimals) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        if (tokenDecimals < 6 || tokenDecimals > 18) revert InvalidDecimals();
        acceptedTokens[token] = tokenDecimals;
        emit AcceptedTokenUpdated(token, tokenDecimals);
    }

    function removeAcceptedToken(address token) external onlyOwner {
        acceptedTokens[token] = 0;
        emit AcceptedTokenRemoved(token);
    }

    function setItem(uint256 itemId, uint256 priceUsd6, bool enabled) external onlyOwner {
        if (priceUsd6 == 0) revert InvalidPrice();
        items[itemId] = ItemConfig({priceUsd6: priceUsd6, enabled: enabled});
        emit ItemConfigured(itemId, priceUsd6, enabled);
    }

    function setItems(
        uint256[] calldata itemIds,
        uint256[] calldata prices,
        bool[] calldata enabledFlags
    ) external onlyOwner {
        if (itemIds.length != prices.length || itemIds.length != enabledFlags.length) {
            revert LengthMismatch();
        }
        for (uint256 i = 0; i < itemIds.length; ) {
            if (prices[i] == 0) revert InvalidPrice();
            items[itemIds[i]] = ItemConfig({priceUsd6: prices[i], enabled: enabledFlags[i]});
            emit ItemConfigured(itemIds[i], prices[i], enabledFlags[i]);
            unchecked { ++i; }
        }
    }

    function disableItem(uint256 itemId) external onlyOwner {
        items[itemId].enabled = false;
        emit ItemConfigured(itemId, items[itemId].priceUsd6, false);
    }

    function setTreasury(address nextTreasury) external onlyOwner {
        if (nextTreasury == address(0)) revert InvalidAddress();
        if (nextTreasury == treasury) revert SameTreasury();
        address prev = treasury;
        treasury = nextTreasury;
        emit TreasuryUpdated(prev, nextTreasury);
    }

    function setMaxQuantityPerTx(uint256 nextMax) external onlyOwner {
        maxQuantityPerTx = nextMax;
        emit MaxQuantityPerTxUpdated(nextMax);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────── View helpers ─────────────────────────────
    function getItem(uint256 itemId) external view returns (uint256 priceUsd6, bool enabled) {
        ItemConfig memory cfg = items[itemId];
        return (cfg.priceUsd6, cfg.enabled);
    }
}
