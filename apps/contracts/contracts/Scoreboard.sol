// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Scoreboard is Ownable {
    error CooldownActive(uint256 nextAllowedAt);
    error DailyLimitReached(uint256 nextWindowStart, uint256 maxSubmissionsPerDay);
    error InvalidConfiguration();

    event ScoreSubmitted(
        address indexed player,
        uint256 indexed levelId,
        uint256 score,
        uint256 timeMs,
        uint256 nonce
    );
    event SubmitCooldownUpdated(uint256 submitCooldown);
    event MaxSubmissionsPerDayUpdated(uint256 maxSubmissionsPerDay);

    struct DailyWindow {
        uint64 windowStart;
        uint32 count;
    }

    uint256 public submitCooldown;
    uint256 public maxSubmissionsPerDay;

    mapping(address => uint256) public lastSubmissionAt;
    mapping(address => DailyWindow) private dailyWindows;

    constructor(
        uint256 initialSubmitCooldown,
        uint256 initialMaxSubmissionsPerDay,
        address initialOwner
    ) Ownable(initialOwner) {
        if (initialMaxSubmissionsPerDay == 0) {
            revert InvalidConfiguration();
        }

        submitCooldown = initialSubmitCooldown;
        maxSubmissionsPerDay = initialMaxSubmissionsPerDay;
    }

    function submitScore(
        uint256 levelId,
        uint256 score,
        uint256 timeMs,
        uint256 nonce
    ) external {
        uint256 currentTimestamp = block.timestamp;
        uint256 nextAllowedAt = lastSubmissionAt[msg.sender] + submitCooldown;

        if (submitCooldown > 0 && currentTimestamp < nextAllowedAt) {
            revert CooldownActive(nextAllowedAt);
        }

        _consumeDailySubmission(msg.sender, currentTimestamp);
        lastSubmissionAt[msg.sender] = currentTimestamp;

        emit ScoreSubmitted(msg.sender, levelId, score, timeMs, nonce);
    }

    function setSubmitCooldown(uint256 nextSubmitCooldown) external onlyOwner {
        submitCooldown = nextSubmitCooldown;
        emit SubmitCooldownUpdated(nextSubmitCooldown);
    }

    function setMaxSubmissionsPerDay(uint256 nextMaxSubmissionsPerDay) external onlyOwner {
        if (nextMaxSubmissionsPerDay == 0) {
            revert InvalidConfiguration();
        }

        maxSubmissionsPerDay = nextMaxSubmissionsPerDay;
        emit MaxSubmissionsPerDayUpdated(nextMaxSubmissionsPerDay);
    }

    function getDailyWindow(address player) external view returns (uint256 windowStart, uint256 count) {
        DailyWindow memory window = dailyWindows[player];
        return (window.windowStart, window.count);
    }

    function _consumeDailySubmission(address player, uint256 currentTimestamp) internal {
        uint64 currentWindowStart = uint64((currentTimestamp / 1 days) * 1 days);
        DailyWindow memory window = dailyWindows[player];

        if (window.windowStart != currentWindowStart) {
            window.windowStart = currentWindowStart;
            window.count = 0;
        }

        if (window.count >= maxSubmissionsPerDay) {
            revert DailyLimitReached(currentWindowStart + 1 days, maxSubmissionsPerDay);
        }

        window.count += 1;
        dailyWindows[player] = window;
    }
}
