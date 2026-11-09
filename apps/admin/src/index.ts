#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";

import getItem from "@/commands/shop/get-item";
import isTokenAccepted from "@/commands/shop/is-token-accepted";
import pause from "@/commands/shop/pause";
import removeAcceptedToken from "@/commands/shop/remove-accepted-token";
import setAcceptedToken from "@/commands/shop/set-accepted-token";
import setItem from "@/commands/shop/set-item";
import unpause from "@/commands/shop/unpause";
import walletAddress from "@/commands/wallet/address";
import walletInit from "@/commands/wallet/init";

const wallet = defineCommand({
  meta: {
    name: "wallet",
    description: "Local admin keystore management.",
  },
  subCommands: {
    init: walletInit,
    address: walletAddress,
  },
});

const shop = defineCommand({
  meta: {
    name: "shop",
    description: "ShopUpgradeable admin operations.",
  },
  subCommands: {
    "get-item": getItem,
    "is-token-accepted": isTokenAccepted,
    "set-item": setItem,
    "set-accepted-token": setAcceptedToken,
    "remove-accepted-token": removeAcceptedToken,
    pause,
    unpause,
  },
});

const main = defineCommand({
  meta: {
    name: "chesscito-admin",
    version: "0.1.0",
    description:
      "Admin operations CLI for Chesscito contracts. Encodes calldata, simulates, signs locally with viem (key encrypted at rest in apps/admin/.private/), and writes to an append-only audit log.",
  },
  subCommands: {
    wallet,
    shop,
  },
});

runMain(main);
