// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ScoreboardUpgradeable
 * @notice Records signed score submissions on-chain. Enforces per-player cooldown and
 *         daily submission caps. Actual leaderboard ranking lives off-chain (indexed by
 *         the ScoreSubmitted event).
 * @dev Deploy behind an ERC1967Proxy.
 */
contract ScoreboardUpgradeable is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    // ─────────────────────────── Errors ────────────────────────────────────
    error CooldownActive(uint256 nextAllowedAt);
    error DailyLimitReached(uint256 nextWindowStart, uint256 maxSubmissionsPerDay);
    error InvalidConfiguration();
    error InvalidSignature();
    error SignatureExpired(uint256 deadline);
    error NonceUsed(address player, uint256 nonce);
    error InvalidSigner();

    // ─────────────────────────── Events ────────────────────────────────────
    event ScoreSubmitted(
        address indexed player,
        uint256 indexed levelId,
        uint256 score,
        uint256 timeMs,
        uint256 nonce,
        uint256 deadline
    );
    event SubmitCooldownUpdated(uint256 submitCooldown);
    event MaxSubmissionsPerDayUpdated(uint256 maxSubmissionsPerDay);
    event SignerUpdated(address indexed signer);

    // ─────────────────────────── Constants ─────────────────────────────────
    bytes32 private constant SUBMIT_TYPEHASH =
        keccak256(
            "ScoreSubmission(address player,uint256 levelId,uint256 score,uint256 timeMs,uint256 nonce,uint256 deadline)"
        );

    // ─────────────────────────── Storage ───────────────────────────────────
    /**
     * @dev Packed into a single 256-bit slot:
     *   windowStart : uint64  (unix timestamp truncated to day boundary)
     *   count       : uint32  (submissions within current window)
     */
    struct DailyWindow {
        uint64 windowStart;
        uint32 count;
    }

    /// @notice Seconds a player must wait between successive submissions. 0 = disabled.
    uint256 public submitCooldown;
    /// @notice Maximum submissions per 24 h window per player. Must be ≤ uint32 max.
    uint256 public maxSubmissionsPerDay;
    /// @notice Backend hot-wallet that signs score vouchers.
    address public signer;

    mapping(address => uint256) public lastSubmissionAt;
    mapping(address => DailyWindow) private dailyWindows;
    /// @dev player → nonce → used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // ─────────────────────────── Constructor ───────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────── Initializer ───────────────────────────────
    /**
     * @param initialSubmitCooldown       Seconds between submissions (0 to disable).
     * @param initialMaxSubmissionsPerDay Daily cap (e.g. 10). Must be 1–4294967295.
     * @param initialSigner               Backend signing key.
     * @param initialOwner                Multisig / deployer.
     */
    function initialize(
        uint256 initialSubmitCooldown,
        uint256 initialMaxSubmissionsPerDay,
        address initialSigner,
        address initialOwner
    ) public initializer {
        if (initialSigner == address(0)) revert InvalidSigner();
        if (initialMaxSubmissionsPerDay == 0) revert InvalidConfiguration();
        if (initialMaxSubmissionsPerDay > type(uint32).max) revert InvalidConfiguration();

        __Ownable_init(initialOwner);
        __Pausable_init();
        __EIP712_init("Scoreboard", "1");

        submitCooldown = initialSubmitCooldown;
        maxSubmissionsPerDay = initialMaxSubmissionsPerDay;
        signer = initialSigner;

        emit SignerUpdated(initialSigner);
        emit SubmitCooldownUpdated(initialSubmitCooldown);
        emit MaxSubmissionsPerDayUpdated(initialMaxSubmissionsPerDay);
    }

    // ─────────────────────────── Core ──────────────────────────────────────
    /**
     * @notice Submit a signed score. The backend verifies gameplay validity before signing.
     * @dev Order of checks: deadline → nonce → signature → cooldown → daily limit.
     *      All checks must pass atomically.
     */
    function submitScoreSigned(
        uint256 levelId,
        uint256 score,
        uint256 timeMs,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        if (block.timestamp > deadline) revert SignatureExpired(deadline);
        if (usedNonces[msg.sender][nonce]) revert NonceUsed(msg.sender, nonce);

        _verifySubmitSignature(msg.sender, levelId, score, timeMs, nonce, deadline, signature);

        // Mark nonce before state changes (CEI pattern)
        usedNonces[msg.sender][nonce] = true;

        uint256 ts = block.timestamp;

        if (submitCooldown > 0) {
            uint256 nextAllowed = lastSubmissionAt[msg.sender] + submitCooldown;
            if (ts < nextAllowed) revert CooldownActive(nextAllowed);
        }

        _consumeDailySubmission(msg.sender, ts);
        lastSubmissionAt[msg.sender] = ts;

        emit ScoreSubmitted(msg.sender, levelId, score, timeMs, nonce, deadline);
    }

    // ─────────────────────────── UX helpers (read-only) ────────────────────
    /**
     * @notice Timestamp when the player's cooldown expires.
     * @dev    Returns a past timestamp (≤ block.timestamp) when no cooldown is active,
     *         so frontends should check: `nextAllowedAt(player) <= block.timestamp`.
     */
    function nextAllowedSubmitAt(address player) external view returns (uint256) {
        return lastSubmissionAt[player] + submitCooldown;
    }

    /**
     * @notice Returns the raw daily-window struct for a player (for debugging / advanced UX).
     */
    function getDailyWindow(address player)
        external
        view
        returns (uint256 windowStart, uint256 count)
    {
        DailyWindow memory w = dailyWindows[player];
        return (w.windowStart, w.count);
    }

    /**
     * @notice Human-friendly daily quota summary.
     * @return remaining       Submissions left in the current 24 h window.
     * @return windowStart     UTC timestamp of the current window's start (aligned to day).
     * @return nextWindowStart UTC timestamp when the next window opens.
     */
    function remainingDaily(address player)
        external
        view
        returns (
            uint256 remaining,
            uint256 windowStart,
            uint256 nextWindowStart
        )
    {
        uint64 currentWindowStart = uint64((block.timestamp / 1 days) * 1 days);
        DailyWindow memory w = dailyWindows[player];

        if (w.windowStart != currentWindowStart) {
            // Player hasn't submitted today — full quota available.
            return (maxSubmissionsPerDay, currentWindowStart, currentWindowStart + 1 days);
        }

        uint256 used = uint256(w.count);
        uint256 left = used >= maxSubmissionsPerDay ? 0 : maxSubmissionsPerDay - used;
        return (left, currentWindowStart, currentWindowStart + 1 days);
    }

    // ─────────────────────────── Admin ─────────────────────────────────────
    function setSigner(address nextSigner) external onlyOwner {
        if (nextSigner == address(0)) revert InvalidSigner();
        signer = nextSigner;
        emit SignerUpdated(nextSigner);
    }

    /// @notice Set to 0 to disable cooldown enforcement.
    function setSubmitCooldown(uint256 nextSubmitCooldown) external onlyOwner {
        submitCooldown = nextSubmitCooldown;
        emit SubmitCooldownUpdated(nextSubmitCooldown);
    }

    function setMaxSubmissionsPerDay(uint256 nextMax) external onlyOwner {
        if (nextMax == 0) revert InvalidConfiguration();
        if (nextMax > type(uint32).max) revert InvalidConfiguration();
        maxSubmissionsPerDay = nextMax;
        emit MaxSubmissionsPerDayUpdated(nextMax);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────── Internals ─────────────────────────────────
    function _verifySubmitSignature(
        address player,
        uint256 levelId,
        uint256 score,
        uint256 timeMs,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(SUBMIT_TYPEHASH, player, levelId, score, timeMs, nonce, deadline))
        );
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();
    }

    function _consumeDailySubmission(address player, uint256 ts) internal {
        uint64 currentWindowStart = uint64((ts / 1 days) * 1 days);
        DailyWindow memory w = dailyWindows[player];

        if (w.windowStart != currentWindowStart) {
            w.windowStart = currentWindowStart;
            w.count = 0;
        }

        if (w.count >= maxSubmissionsPerDay) {
            revert DailyLimitReached(uint256(currentWindowStart) + 1 days, maxSubmissionsPerDay);
        }

        // Safe: maxSubmissionsPerDay ≤ uint32.max (enforced at set-time)
        unchecked {
            w.count += 1;
        }
        dailyWindows[player] = w;
    }

    // ─────────────────────────── Gap ───────────────────────────────────────
    // Own vars (6 slots): submitCooldown, maxSubmissionsPerDay, signer,
    //                     lastSubmissionAt, dailyWindows, usedNonces
    // Reserve 50 total → 44 free slots.
    uint256[44] private __gap;
}
