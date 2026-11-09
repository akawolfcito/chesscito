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

const LEVEL_IDS: Record<string, bigint> = {
  rook: 1n,
  bishop: 2n,
  knight: 3n,
  pawn: 4n,
  queen: 5n,
  king: 6n,
};

export function getLevelId(piece: string) {
  return LEVEL_IDS[piece] ?? 0n;
}
