export const scoreboardAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "submitScore",
    inputs: [
      { name: "levelId", type: "uint256" },
      { name: "score", type: "uint256" },
      { name: "timeMs", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [],
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
