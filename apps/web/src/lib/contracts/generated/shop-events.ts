// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Source: apps/contracts/artifacts/contracts/ShopUpgradeable.sol/ShopUpgradeable.json
// Regenerate: pnpm --filter hardhat generate:event-abis
//
// Each export is a single-event ABI fragment ready to pass to viem's
// decodeEventLog({ abi: <FRAGMENT>, ... }). Field names mirror the
// contract source — viem decodes positionally so renames in the .sol
// surface as TypeScript errors at consumer destructure sites, which is
// exactly the signal we want.

/* eslint-disable */
export const ACCEPTED_TOKEN_REMOVED_ABI = [
  {
    type: "event",
    name: "AcceptedTokenRemoved",
    inputs: [
      { name: "token", type: "address", indexed: true },
    ],
  },
] as const;

export const ACCEPTED_TOKEN_UPDATED_ABI = [
  {
    type: "event",
    name: "AcceptedTokenUpdated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "decimals", type: "uint8", indexed: false },
    ],
  },
] as const;

export const INITIALIZED_ABI = [
  {
    type: "event",
    name: "Initialized",
    inputs: [
      { name: "version", type: "uint64", indexed: false },
    ],
  },
] as const;

export const ITEM_CONFIGURED_ABI = [
  {
    type: "event",
    name: "ItemConfigured",
    inputs: [
      { name: "itemId", type: "uint256", indexed: true },
      { name: "priceUsd6", type: "uint256", indexed: false },
      { name: "enabled", type: "bool", indexed: false },
    ],
  },
] as const;

export const ITEM_PURCHASED_ABI = [
  {
    type: "event",
    name: "ItemPurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "itemId", type: "uint256", indexed: true },
      { name: "quantity", type: "uint256", indexed: false },
      { name: "unitPriceUsd6", type: "uint256", indexed: false },
      { name: "totalTokenAmount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: false },
    ],
  },
] as const;

export const MAX_QUANTITY_PER_TX_UPDATED_ABI = [
  {
    type: "event",
    name: "MaxQuantityPerTxUpdated",
    inputs: [
      { name: "maxQuantity", type: "uint256", indexed: false },
    ],
  },
] as const;

export const OWNERSHIP_TRANSFERRED_ABI = [
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
] as const;

export const PAUSED_ABI = [
  {
    type: "event",
    name: "Paused",
    inputs: [
      { name: "account", type: "address", indexed: false },
    ],
  },
] as const;

export const TREASURY_UPDATED_ABI = [
  {
    type: "event",
    name: "TreasuryUpdated",
    inputs: [
      { name: "previous", type: "address", indexed: true },
      { name: "next", type: "address", indexed: true },
    ],
  },
] as const;

export const UNPAUSED_ABI = [
  {
    type: "event",
    name: "Unpaused",
    inputs: [
      { name: "account", type: "address", indexed: false },
    ],
  },
] as const;
