export const scoreboardAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "submitScoreSigned",
    inputs: [
      { name: "levelId", type: "uint256" },
      { name: "score", type: "uint256" },
      { name: "timeMs", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    anonymous: false,
    name: "ScoreSubmitted",
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: true, name: "levelId", type: "uint256" },
      { indexed: false, name: "score", type: "uint256" },
      { indexed: false, name: "timeMs", type: "uint256" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
    ],
  },
] as const;

export function getLevelId(piece: string) {
  if (piece === "rook") {
    return 1n;
  }

  if (piece === "bishop") {
    return 2n;
  }

  if (piece === "knight") {
    return 3n;
  }

  return 0n;
}
