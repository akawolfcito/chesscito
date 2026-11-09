export const chesscitoTreasuryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "acceptedToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "payoutAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "AcceptedTokenUpdated",
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "accepted", type: "bool" },
    ],
  },
] as const;
