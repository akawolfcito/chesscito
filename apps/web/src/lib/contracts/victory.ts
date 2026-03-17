export const victoryAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mintSigned",
    inputs: [
      { name: "difficulty", type: "uint8" },
      { name: "totalMoves", type: "uint16" },
      { name: "timeMs", type: "uint32" },
      { name: "token", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    anonymous: false,
    name: "VictoryMinted",
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "difficulty", type: "uint8" },
      { indexed: false, name: "totalMoves", type: "uint16" },
      { indexed: false, name: "timeMs", type: "uint32" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "totalAmount", type: "uint256" },
    ],
  },
] as const;
