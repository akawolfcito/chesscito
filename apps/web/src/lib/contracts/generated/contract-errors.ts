// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Sources:
//   apps/contracts/artifacts/contracts/BadgesUpgradeable.sol/BadgesUpgradeable.json
//   apps/contracts/artifacts/contracts/ScoreboardUpgradeable.sol/ScoreboardUpgradeable.json
//   apps/contracts/artifacts/contracts/VictoryNFTUpgradeable.sol/VictoryNFTUpgradeable.json
//   apps/contracts/artifacts/contracts/ShopUpgradeable.sol/ShopUpgradeable.json
// Regenerate: pnpm --filter hardhat generate:error-abis
//
// Every custom error the four player-facing contracts can revert with, as one
// ABI fragment for viem's decodeErrorResult(). Selectors are derived by viem
// from these signatures at call time — none are written down, so none can rot.
//
// Being in here does NOT give an error player-facing copy. This is the
// vocabulary; lib/errors.ts decides which words the player is shown.

/* eslint-disable */
export const CONTRACT_ERRORS_ABI = [
  {
    type: "error",
    name: "BadgeAlreadyClaimed",
    inputs: [
      { name: "player", type: "address" },
      { name: "levelId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "CanOnlyIncreaseMaxLevel",
    inputs: [
      { name: "current", type: "uint256" },
      { name: "requested", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "CooldownActive",
    inputs: [
      { name: "nextAllowedAt", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "DailyLimitReached",
    inputs: [
      { name: "nextWindowStart", type: "uint256" },
      { name: "maxSubmissionsPerDay", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [
      { name: "length", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [
      { name: "s", type: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "EnforcedPause",
    inputs: [],
  },
  {
    type: "error",
    name: "ERC1155InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InvalidApprover",
    inputs: [
      { name: "approver", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InvalidArrayLength",
    inputs: [
      { name: "idsLength", type: "uint256" },
      { name: "valuesLength", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InvalidOperator",
    inputs: [
      { name: "operator", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InvalidReceiver",
    inputs: [
      { name: "receiver", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InvalidSender",
    inputs: [
      { name: "sender", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC1155MissingApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721IncorrectOwner",
    inputs: [
      { name: "sender", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InsufficientApproval",
    inputs: [
      { name: "operator", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidApprover",
    inputs: [
      { name: "approver", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidOperator",
    inputs: [
      { name: "operator", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidOwner",
    inputs: [
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidReceiver",
    inputs: [
      { name: "receiver", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidSender",
    inputs: [
      { name: "sender", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721NonexistentToken",
    inputs: [
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ExpectedPause",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidBaseURI",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidConfiguration",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDecimals",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDifficulty",
    inputs: [
      { name: "difficulty", type: "uint8" },
    ],
  },
  {
    type: "error",
    name: "InvalidInitialization",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidLevel",
    inputs: [
      { name: "levelId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidMoves",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPrice",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidQuantity",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSigner",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidTime",
    inputs: [],
  },
  {
    type: "error",
    name: "ItemDisabled",
    inputs: [
      { name: "itemId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ItemNotConfigured",
    inputs: [
      { name: "itemId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "LengthMismatch",
    inputs: [],
  },
  {
    type: "error",
    name: "MintCooldown",
    inputs: [
      { name: "nextMintAt", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "NonceUsed",
    inputs: [
      { name: "player", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "NotInitializing",
    inputs: [],
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      { name: "account", type: "address" },
    ],
  },
  {
    type: "error",
    name: "PriceNotSet",
    inputs: [
      { name: "difficulty", type: "uint8" },
    ],
  },
  {
    type: "error",
    name: "QuantityExceedsMax",
    inputs: [
      { name: "quantity", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      { name: "token", type: "address" },
    ],
  },
  {
    type: "error",
    name: "SameAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "SameTreasury",
    inputs: [],
  },
  {
    type: "error",
    name: "SignatureExpired",
    inputs: [
      { name: "deadline", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "TokenNotAccepted",
    inputs: [
      { name: "token", type: "address" },
    ],
  },
] as const;
