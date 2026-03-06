// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ⚠️  DEV / TEST ONLY — never deploy to production networks.
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Minimal ERC-20 that mimics USDC (6 decimals) for local / testnet use.
 *         Permissionless mint intentional — do not deploy to mainnet.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @dev Permissionless — test/dev only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
