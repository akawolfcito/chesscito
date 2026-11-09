// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Shop
 * @notice Players buy in-game items (skins, potions, …) with a single ERC-20 token (USDC).
 *         Entitlements are handled off-chain via the `ItemPurchased` event.
 *         Not upgradeable — redeploy if the payment token or core logic must change.
 */
contract Shop is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────── Errors ────────────────────────────────────
    error InvalidQuantity();
    error QuantityExceedsMax(uint256 quantity, uint256 maxQuantity);
    error ItemNotConfigured(uint256 itemId);
    error ItemDisabled(uint256 itemId);
    error InvalidAddress();
    error InvalidPrice();
    error LengthMismatch();
    error SameTreasury();

    // ─────────────────────────── Events ────────────────────────────────────
    event ItemConfigured(uint256 indexed itemId, uint256 price, bool enabled);
    event TreasuryUpdated(address indexed previousTreasury, address indexed nextTreasury);
    event MaxQuantityPerTxUpdated(uint256 maxQuantity);
    event ItemPurchased(
        address indexed buyer,
        uint256 indexed itemId,
        uint256 quantity,
        uint256 unitPrice,
        uint256 totalPrice,
        address paymentToken,
        address treasury
    );

    // ─────────────────────────── Storage ───────────────────────────────────
    struct ItemConfig {
        uint256 price;   // price in payment token's base unit (e.g. USDC with 6 decimals)
        bool    enabled; // false = item removed from sale without deleting price history
    }

    /// @notice ERC-20 used for all payments (e.g. USDC). Immutable after deploy.
    IERC20 public immutable paymentToken;
    /// @notice Destination for all proceeds.
    address public treasury;
    /// @notice Per-tx quantity cap. Prevents accidental bulk buys. 0 = no cap.
    uint256 public maxQuantityPerTx;

    mapping(uint256 => ItemConfig) public items;

    // ─────────────────────────── Constructor ───────────────────────────────
    /**
     * @param initialOwner          Multisig / deployer.
     * @param paymentTokenAddress   ERC-20 contract address (e.g. USDC on Celo).
     * @param treasuryAddress       Wallet or contract that receives payments.
     * @param initialMaxQuantityPerTx  Per-tx quantity cap (0 = unlimited).
     */
    constructor(
        address initialOwner,
        address paymentTokenAddress,
        address treasuryAddress,
        uint256 initialMaxQuantityPerTx
    ) Ownable(initialOwner) {
        if (paymentTokenAddress == address(0) || treasuryAddress == address(0)) {
            revert InvalidAddress();
        }
        paymentToken = IERC20(paymentTokenAddress);
        treasury = treasuryAddress;
        maxQuantityPerTx = initialMaxQuantityPerTx;
    }

    // ─────────────────────────── Purchase ──────────────────────────────────
    /**
     * @notice Buy `quantity` units of `itemId`.
     * @dev    Caller must have pre-approved this contract for at least `unitPrice * quantity`.
     *         Reentrancy-safe (nonReentrant + check-effect-interact).
     */
    function buyItem(uint256 itemId, uint256 quantity) external whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidQuantity();
        if (maxQuantityPerTx != 0 && quantity > maxQuantityPerTx) {
            revert QuantityExceedsMax(quantity, maxQuantityPerTx);
        }

        ItemConfig memory cfg = items[itemId];
        if (cfg.price == 0) revert ItemNotConfigured(itemId);
        if (!cfg.enabled) revert ItemDisabled(itemId);

        uint256 totalPrice = cfg.price * quantity; // overflow reverts in ^0.8
        address t = treasury;

        paymentToken.safeTransferFrom(msg.sender, t, totalPrice);

        emit ItemPurchased(
            msg.sender,
            itemId,
            quantity,
            cfg.price,
            totalPrice,
            address(paymentToken),
            t
        );
    }

    // ─────────────────────────── Admin ─────────────────────────────────────
    /**
     * @notice Add or update a single item.
     * @param itemId  Arbitrary uint256 identifier matching your off-chain item catalogue.
     * @param price   Unit price in the payment token's smallest unit (e.g. 1 USDC = 1_000_000).
     * @param enabled Set false to delist without erasing price history.
     */
    function setItem(uint256 itemId, uint256 price, bool enabled) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        items[itemId] = ItemConfig({price: price, enabled: enabled});
        emit ItemConfigured(itemId, price, enabled);
    }

    /**
     * @notice Batch-configure items. Arrays must be same length.
     */
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
            items[itemIds[i]] = ItemConfig({price: prices[i], enabled: enabledFlags[i]});
            emit ItemConfigured(itemIds[i], prices[i], enabledFlags[i]);
            unchecked { ++i; }
        }
    }

    /// @notice Delist an item without touching its price.
    function disableItem(uint256 itemId) external onlyOwner {
        items[itemId].enabled = false;
        emit ItemConfigured(itemId, items[itemId].price, false);
    }

    function setTreasury(address nextTreasury) external onlyOwner {
        if (nextTreasury == address(0)) revert InvalidAddress();
        if (nextTreasury == treasury) revert SameTreasury();
        address prev = treasury;
        treasury = nextTreasury;
        emit TreasuryUpdated(prev, nextTreasury);
    }

    /// @notice Update per-tx quantity cap. Set 0 to remove the cap.
    function setMaxQuantityPerTx(uint256 nextMax) external onlyOwner {
        maxQuantityPerTx = nextMax;
        emit MaxQuantityPerTxUpdated(nextMax);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────── View helpers ──────────────────────────────
    /// @notice Returns price and availability for an item. price==0 means unconfigured.
    function getItem(uint256 itemId) external view returns (uint256 price, bool enabled) {
        ItemConfig memory cfg = items[itemId];
        return (cfg.price, cfg.enabled);
    }
}
