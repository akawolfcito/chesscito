export const shopAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getItem",
    inputs: [{ name: "itemId", type: "uint256" }],
    outputs: [
      { name: "priceUsd6", type: "uint256" },
      { name: "enabled", type: "bool" },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "buyItem",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "token", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "acceptedTokens",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "decimals", type: "uint8" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "ItemPurchased",
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "itemId", type: "uint256" },
      { indexed: false, name: "quantity", type: "uint256" },
      { indexed: false, name: "unitPriceUsd6", type: "uint256" },
      { indexed: false, name: "totalTokenAmount", type: "uint256" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "treasury", type: "address" },
    ],
  },
] as const;
