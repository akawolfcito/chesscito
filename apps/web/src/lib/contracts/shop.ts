export const shopAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getItem",
    inputs: [{ name: "itemId", type: "uint256" }],
    outputs: [
      { name: "price", type: "uint256" },
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
    ],
    outputs: [],
  },
  {
    type: "event",
    anonymous: false,
    name: "ItemPurchased",
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "itemId", type: "uint256" },
      { indexed: false, name: "quantity", type: "uint256" },
      { indexed: false, name: "unitPrice", type: "uint256" },
      { indexed: false, name: "totalPrice", type: "uint256" },
      { indexed: false, name: "paymentToken", type: "address" },
      { indexed: false, name: "treasury", type: "address" },
    ],
  },
] as const;
