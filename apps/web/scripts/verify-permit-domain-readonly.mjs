// Read-only: does our configured permitVersion reproduce each token's
// on-chain DOMAIN_SEPARATOR? A wrong version still SIGNS fine — the wallet
// signs whatever it is handed — and only fails later, inside the contract,
// which is exactly the kind of silent mismatch worth checking directly.
import { encodeAbiParameters, keccak256, stringToHex } from "viem";

const CHAIN_ID = 42220n;
const RPC = "https://forno.celo.org";

const TOKENS = [
  { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", permitVersion: "2" },
  { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", permitVersion: "1" },
  { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", permitVersion: "3" },
];

const TYPEHASH = keccak256(
  stringToHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
);

async function call(to, data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  return (await res.json()).result;
}

function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  // "0x" + [32B offset][32B length][data] → length starts at 66, data at 130.
  const len = parseInt(hex.slice(66, 130), 16);
  return Buffer.from(hex.slice(130, 130 + len * 2), "hex").toString("utf8");
}

for (const t of TOKENS) {
  const onChain = await call(t.address, "0x3644e515"); // DOMAIN_SEPARATOR()
  const name = decodeString(await call(t.address, "0x06fdde03")); // name()

  if (!onChain || onChain === "0x" || name == null) {
    console.log(`${t.symbol}: no EIP-2612 domain on-chain (permit unsupported?)`);
    continue;
  }

  // Try our configured version first, then nearby ones, to name the right value
  // instead of only reporting a mismatch.
  let matched = null;
  for (const version of [t.permitVersion, "1", "2", "3"]) {
    const computed = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
        [TYPEHASH, keccak256(stringToHex(name)), keccak256(stringToHex(version)), CHAIN_ID, t.address],
      ),
    );
    if (computed.toLowerCase() === onChain.toLowerCase()) { matched = version; break; }
  }

  const verdict = matched === t.permitVersion ? "OK" : matched ? `WRONG → should be "${matched}"` : "NO MATCH";
  console.log(`${t.symbol.padEnd(5)} name="${name}" configured="${t.permitVersion}" → ${verdict}`);
}
