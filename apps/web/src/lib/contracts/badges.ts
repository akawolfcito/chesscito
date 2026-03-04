export const badgesAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimBadge",
    inputs: [{ name: "levelId", type: "uint256" }],
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
] as const;
