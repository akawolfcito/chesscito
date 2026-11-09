export const badgesAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimBadgeSigned",
    inputs: [
      { name: "levelId", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "hasClaimedBadge",
    inputs: [
      { name: "player", type: "address" },
      { name: "levelId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "BadgeClaimed",
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: true, name: "levelId", type: "uint256" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
    ],
  },
] as const;
