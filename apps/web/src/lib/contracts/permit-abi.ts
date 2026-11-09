/** ERC-20 extension fragment for EIP-2612 permit — not part of viem's
 *  base `erc20Abi` (see lib/contracts/tokens.ts, which only needs
 *  name()/balanceOf()). Used exclusively by the permit-mint client path. */
export const permitTokenAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "nonces",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
