# MiniPay denies `eth_sendTransaction` with `-32604 Permission denied`

**Report for MiniPay / Celo developer support**
**Date:** 2026-07-21
**App:** Chesscito — `preview.chesscito.com`, `play.chesscito.com`, `learn.chesscito.com`
**Wallet:** `0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd`
**Chain:** Celo Mainnet (42220) — testnet toggle OFF
**Loaded via:** MiniPay → Developer Settings → Load Test Page

---

## The decisive fact: it is scoped to the domain, not the app

**The identical build works on `*.vercel.app` and fails on `*.chesscito.com`.**

| Host | Same build? | Get Peones | Victory mint |
|---|---|---|---|
| `chesscito-dcdbivh4i-goodwolf.vercel.app` | yes, current | ✅ works | ✅ works |
| `preview.chesscito.com` | yes, current | ❌ `-32604` | ❌ `-32604` |
| `play.chesscito.com` | yes, current | ❌ `-32604` | ❌ `-32604` |
| `learn-preview.chesscito.com` | yes, current | ❌ `-32604` | — |

Response headers are byte-identical across all of these hosts (`permissions-policy`,
`x-frame-options`, CSP, HSTS — all the same). Nothing we serve varies by hostname, so no
change on our side can produce this. The decision is made by MiniPay from the origin.

**This rules our code out entirely** and reframes the question: what policy makes MiniPay
refuse `eth_sendTransaction` for `chesscito.com` while allowing it for an unlisted
`vercel.app` origin?

---

## Summary

MiniPay grants this app **every** provider method we use **except** `eth_sendTransaction`,
which is refused with a proprietary code:

```json
{ "code": -32604, "message": "Permission denied" }
```

`-32604` is not an EIP-1193 or EIP-1474 code, so we cannot interpret it from the specs.

**This worked until 2026-07-17 06:21:16 UTC** and has failed on every attempt since. Our
transaction-path code and dependencies are unchanged across that boundary (see §4).

---

## 1. Evidence — raw provider, no libraries

Called directly on `window.ethereum`, bypassing wagmi and viem entirely. Payload is
`{from, to, data}` plus optionally `feeCurrency` — **no gas fields of our own**.

| Method | Result |
|---|---|
| `eth_accounts` | ✅ `0xcc4179…c2dd` |
| `eth_chainId` | ✅ `0xa4ec` (42220) |
| `eth_estimateGas` | ✅ `0xac7b` |
| `eth_call` | ✅ returns `0x…01` — the transfer would succeed |
| `eth_gasPrice` with `feeCurrency` param | ✅ `0x353dd900b`, mode `feeCurrencyParam` |
| `eth_signTypedData_v4` | ✅ (EIP-2612 permit signs fine) |
| `eth_requestAccounts` | ✅ returns `["0xcc4179…c2dd"]` — the account **is** authorized on request |
| `wallet_getPermissions` | ❌ `-32601 Method not found` — EIP-2255 is not implemented |
| **`eth_sendTransaction`** | ❌ **`-32604 Permission denied`** |

So the denial is not a missing account grant: calling `eth_requestAccounts` immediately
before the send returns the account, and the send is still refused. And it cannot be resolved
through EIP-2255, because MiniPay does not expose that permission system at all.

The exact request that is refused:

```json
{
  "from": "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
  "to":   "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  "data": "0xa9059cbb000000000000000000000000cd3837dd017dfa5e31a2e3cf390721e16ac8fbf00000000000000000000000000000000000000000000000000000000000000001",
  "feeCurrency": "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72"
}
```

A plain `ERC20.transfer` of **1 unit (0.000001 USDT)** to our treasury. Retrying **without**
`feeCurrency` returns the identical `-32604`.

Note the contradiction: MiniPay **validates this exact payload** in `eth_estimateGas` and
`eth_call`, and quotes a gas price for that very `feeCurrency` — then refuses to send it.

## 2. Wallet state

| Item | Value |
|---|---|
| Native CELO | 0 (expected for MiniPay) |
| USD₮ | 526.57 |
| Fee-currency adapter | `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` (USD₮) |

The same wallet **successfully sent CIP-64 transactions to other dapps on 2026-07-19 and
2026-07-21** (e.g. tx nonce 472, `type 0x7b`, `feeCurrency 0x0e2a3e05…`). So the wallet, the
fee currency and gasless sending all work — just not for this app.

## 3. Last successful transaction from this app

`0xf55659f5c1524c762210c25d20f1ec9e4fe123a4779c81203b59537b76905ddc`

| Field | Value |
|---|---|
| Timestamp | 2026-07-17 06:21:16 UTC (block 72368518) |
| Type | `0x7b` (CIP-64) |
| `feeCurrency` | `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` — **injected by MiniPay**, our app did not set it |
| Call | `mintSignedWithPermit` on our Victory NFT contract |

## 4. What we ruled out, with evidence

| Hypothesis | Why it is not the cause |
|---|---|
| Our code changed | The transaction path is unchanged between the last working build and now. `use-mint-victory.ts` untouched since 2026-07-17; wagmi 2.19.5 / viem 2.46.3 / lockfile unchanged. |
| Payload malformed | `eth_estimateGas` and `eth_call` accept the identical payload. |
| A library adds something MiniPay rejects | The raw probe uses no library at all and is refused the same way. |
| Missing / wrong `feeCurrency` | Refused identically with and without it; `eth_gasPrice` accepts that adapter. |
| No gas | The wallet sends gasless CIP-64 to other dapps on the same days. |
| Testnet toggle | OFF. With it ON the app correctly hides mint actions (chain gating works). |
| Wrong chain | `eth_chainId` returns 42220, which is what we request. |
| Domain | `preview`, `play` and `learn` subdomains all fail identically. |
| Insufficient balance | 526.57 USD₮ available; the transfer is 0.000001. |
| Our app being unreachable | Every other provider method succeeds. |
| Missing account authorization | `eth_requestAccounts` succeeds immediately before the send; the send is still refused. |
| A revocable EIP-2255 permission | `wallet_getPermissions` returns `-32601 Method not found`. |

## 5. Questions for MiniPay

0. **Why is `eth_sendTransaction` refused for `chesscito.com` but allowed for the same build
   on `*.vercel.app`?** Is `chesscito.com` registered, pending review, or flagged in a way
   that blocks sends when the domain is opened via **Load Test Page** instead of the official
   listing? If so, what is the supported way to test a registered domain?
1. What does `-32604 Permission denied` mean, and which policy emits it?
2. Does `eth_sendTransaction` require a mini app to be **registered/approved**, while
   read methods and signing do not? Did that requirement change on or after 2026-07-17?
3. Does **Load Test Page** grant send permission at all, or must the app be published?
4. Is there a permission a user can grant to unblock it, and where in the UI? `eth_requestAccounts`
   already succeeds and `wallet_getPermissions` is not implemented, so we have no way to
   discover or request whatever is missing.

## 6. Reproduction

The probe is in our repo at `apps/web/src/app/dev/minipay-raw-send/`. It renders every step on
screen (MiniPay offers no console) and has a **Copy report** button. Open
`preview.chesscito.com/dev/minipay-raw-send` inside MiniPay and tap *Send WITH feeCurrency*.
