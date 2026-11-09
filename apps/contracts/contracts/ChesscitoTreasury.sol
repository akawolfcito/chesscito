// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ChesscitoTreasury
 * @notice Minimal custody contract for direct ERC-20 transfers.
 * @dev Users pay by calling the token contract's `transfer` function with
 *      this contract as recipient. ERC-20 transfers do not call this contract,
 *      so `acceptedToken` is metadata for admin tooling and frontend gating.
 */
contract ChesscitoTreasury is Ownable2Step {
    using SafeERC20 for IERC20;

    error InvalidAddress();
    error SamePayoutAddress();
    error OwnershipRenunciationDisabled();

    event AcceptedTokenUpdated(address indexed token, bool accepted);
    event PayoutAddressUpdated(address indexed previous, address indexed next);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    mapping(address => bool) public acceptedToken;
    address public payoutAddress;

    constructor(address initialOwner, address initialPayoutAddress) Ownable(initialOwner) {
        if (initialPayoutAddress == address(0) || initialPayoutAddress == address(this)) {
            revert InvalidAddress();
        }
        payoutAddress = initialPayoutAddress;
        emit PayoutAddressUpdated(address(0), initialPayoutAddress);
    }

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        acceptedToken[token] = accepted;
        emit AcceptedTokenUpdated(token, accepted);
    }

    function setPayoutAddress(address nextPayoutAddress) external onlyOwner {
        if (nextPayoutAddress == address(0) || nextPayoutAddress == address(this)) {
            revert InvalidAddress();
        }
        if (nextPayoutAddress == payoutAddress) revert SamePayoutAddress();

        address previous = payoutAddress;
        payoutAddress = nextPayoutAddress;
        emit PayoutAddressUpdated(previous, nextPayoutAddress);
    }

    /**
     * @notice Recover any ERC-20 held by this contract.
     * @dev Intentionally not restricted by `acceptedToken`, so unsupported
     *      tokens sent accidentally are never permanently trapped.
     */
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        _withdrawToken(token, to, amount);
    }

    function withdrawTokenToPayout(address token, uint256 amount) external onlyOwner {
        _withdrawToken(token, payoutAddress, amount);
    }

    /** @dev Funds must always retain a recoverable owner-controlled path. */
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function _withdrawToken(address token, address to, uint256 amount) internal {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokenWithdrawn(token, to, amount);
    }
}
