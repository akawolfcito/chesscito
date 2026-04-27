#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";

import getItem from "@/commands/shop/get-item";
import isTokenAccepted from "@/commands/shop/is-token-accepted";
import pause from "@/commands/shop/pause";
import setAcceptedToken from "@/commands/shop/set-accepted-token";
import setItem from "@/commands/shop/set-item";
import unpause from "@/commands/shop/unpause";

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
    pause,
    unpause,
  },
});

const main = defineCommand({
  meta: {
    name: "chesscito-admin",
    version: "0.1.0",
    description:
      "Admin operations CLI for Chesscito contracts. Encodes calldata, simulates, sends via foundry's cast keystore (PK never enters this Node process), and writes to an append-only audit log.",
  },
  subCommands: {
    shop,
  },
});

runMain(main);
