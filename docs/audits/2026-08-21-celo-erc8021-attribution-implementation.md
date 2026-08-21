# Celo ERC-8021 Attribution — Implementation

**Date**: 2026-08-21
**Scope**: attribution only. No payment economics, no Peones, no Mini-games, no
PRO, no P2P, no DB migration, no real payment, no on-chain transaction, no push,
no deploy.

⛔ **The real issued code appears nowhere in this document, in source, in tests,
in logs or in commits.**

---

## PART 1 · The API, read from the current guide

`BUILDERS.md` (celo-org/attribution-tags) read on 2026-08-21, then checked
against the **installed** `@celo/attribution-tags@0.3.0` type declarations —
the guide describes intent, the `.d.ts` is what actually compiles.

```ts
toDataSuffix(code: string | readonly string[]): Hex
fromDataSuffix(suffix: Hex): { codes: string[]; schemaId: number } | null
verifyTx({ client, hash }): Promise<{ codes, schemaId } | null>
codeFromHostname(hostname: string): string      // NOT USED — see below
ERC_8021_MARKER = "0x80218021802180218021802180218021"
```

**Chosen API**: `toDataSuffix(<single issued code>)`, passed to viem/wagmi as
`dataSuffix`. Issued format is `celo_` + 8 hex characters.

⛔ **`codeFromHostname` is not used.** Chesscito has an issued code. Deriving one
from the hostname would produce a *different, unassigned* code, would make
attribution depend on which host served the page — a Cloudflare tunnel, a
preview URL and production would each attribute differently — and would break
SSR. A test scans the production path (comments stripped) and fails if the
function is ever referenced.

⛔ **No platform codes.** `toDataSuffix` accepts an array; Chesscito passes a
single string. MiniPay has its own attribution, and adding someone else's code
from here would attribute their traffic to a decision they did not make. A test
asserts no array form and no `"minipay"` literal in any write path.

---

## PART 2 · Write-path inventory

| product | tx type | call site | calldata built | submitted by | class |
|---|---|---|---|---|---|
| Get Peones (legacy) | ERC-20 `transfer` | `lib/payments/use-payment-rail.ts` | Chesscito | wallet | **B** |
| Get Peones (canary) | ERC-20 `transfer` | same file, `intent` branch | Chesscito | wallet | **B** |
| PRO | ERC-20 `transfer` | `lib/pro/use-pro-rail.ts` | Chesscito | wallet | **B** |
| Season Pass | ERC-20 `transfer` | `lib/season-pass/use-season-pass-rail.ts` | Chesscito | wallet | **B** |
| Victory mint | `approve`, `mintSigned`, `mintSignedWithPermit` | `lib/coach/use-mint-victory.ts` | Chesscito | wallet | **B** |
| Badge claim | `claimBadgeSigned` | `exercises-screen.tsx`, `profile-sheet.tsx` | Chesscito | wallet | **B** |
| Score submit | `submitScoreSigned` | `exercises-screen.tsx`, `profile-sheet.tsx` | Chesscito | wallet | **B** |
| Shop | `approve`, `buyItem` | `exercises-screen.tsx`, `lib/shop/use-shop-sheet-state.ts` | Chesscito | wallet | **B** |
| `/dev/*` probes | various | `app/dev/**` | Chesscito | wallet | **D** (not production) |

Every production write is **class B** — Chesscito constructs the calldata, the
wallet signs and submits. There is no class-C path: no relayer or facilitator
builds a Chesscito transaction independently.

⚠️ **The inventory was not limited to payments**, and that mattered: mint, badge
claim, score submit and shop are five of the eight write families and none of
them is a payment rail.

---

## PART 3 · The integration points

Four, not eight — each one the smallest existing common boundary. No payment
refactor was introduced to manufacture a shared function.

| boundary | covers |
|---|---|
| `use-payment-rail.ts` request object | Get Peones (legacy) |
| `writeWithOptionalFeeCurrency` in `exercises-screen.tsx` | badge claim, score submit, shop approve, shop buy |
| `writeWithOptionalFeeCurrency` in `use-shop-sheet-state.ts` | shop approve, shop buy (sheet) |
| the resolved `writeAsync` in `use-mint-victory.ts` | approve, mintSignedWithPermit, mintSigned |

Plus two single-write rails tagged at their request object: PRO and Season Pass.

⚠️ **Three of these retry without `feeCurrency` on failure.** Attribution is
applied ONCE, above the `try`, so the retry carries it too — a manual field at
each call site would have had to be remembered *twice* per site.

---

## PART 4–5 · The helper

`lib/payments/attribution.ts`:

```ts
getChesscitoAttributionSuffix(): `0x${string}` | undefined
withChesscitoAttribution<T>(request: T): T & { dataSuffix?: Hex }
isAttributionConfigured(): boolean
```

Pure, memoised, SSR-safe: reads only `process.env`, no browser global, no clock,
no network. A test strips comments from the module and asserts no `window` /
`document` / `navigator` / `localStorage`.

### Missing-config behaviour

⛔ **It never throws.** An unset, empty or malformed tag degrades to "no
attribution" and the transaction proceeds. The alternative — a transaction path
that throws on a config problem — would turn a metadata mistake into a player
who cannot pay. Attribution is worth nothing next to that.

**Observability**: a single `console.warn` per process, **only when
`NODE_ENV === "production"`**, naming the VARIABLE and the failure shape
(`unset` / `invalid`) and never a value. Development and test are silent,
because an unconfigured tag there is normal. `pnpm attribution:verify` is the
explicit check for a deployed build.

⚠️ This is deliberately weaker than a build-time assertion. A hard failure would
have to fire in CI, in preview and in every contributor's `next build` — all of
which legitimately run without the tag — and the brief's own constraint was not
to break unrelated environments.

---

## PART 6–7 · Calldata semantics, proven

`dataSuffix` is native in the installed **viem 2.46.3**
(`actions/wallet/writeContract.d.ts:21`), so no manual concatenation and no
invented field. viem appends the suffix after the encoded calldata and
recalculates gas itself.

Measured, not assumed — a `transfer(0x1234…5678, 50000)`:

```
canonical  0xa9059cbb 0000…1234567890abcdef1234567890abcdef12345678 …c350
suffix     0x63656c6f5f<fake-code-bytes>0d0080218021802180218021802180218021
```

Decoding the canonical and the tagged calldata gives **the same three things**:

| | canonical | tagged |
|---|---|---|
| function | `transfer` | `transfer` |
| recipient | `0x1234…5678` | `0x1234…5678` |
| amount | `50000` | `50000` |

The canonical calldata is an exact **prefix** of the tagged calldata; the only
difference is trailing bytes. Nothing changed: not the target, not the selector,
not the args, not `value`, not the chain, not the account.

⛔ **`transfer-builder.ts` was not touched.** The suffix is a wagmi *request*
field, never baked into a builder's encoded data — so `PEONES_PACKS`, prices,
token selection and the builders themselves are byte-identical.

---

## PART 8–9 · The canary is intentionally UNATTRIBUTED

⛔ **This is the finding that shaped the pass, and it was not on the brief's
list.**

`verifyCanaryTransaction` re-encodes the canonical transfer and compares it to
the on-chain input with **strict equality**:

```ts
// lib/payments/get-peones-canary-verifier.ts:68
if (canonicalInput.toLowerCase() !== transaction.input.toLowerCase()) {
  return { ok: false, reason: "wrong_selector" };
}
```

An ERC-8021 suffix is trailing bytes. A tagged canary transfer would decode
correctly, move the right money to the right treasury — **and then be refused
server-side as `wrong_selector`. The player would have PAID AND NOT BEEN
CREDITED.** That is the single worst failure mode in this codebase, and no
amount of attribution justifies risking it. Relaxing the verifier to accept a
canonical *prefix* is a change to the payment-verification boundary, which this
brief explicitly forbade touching.

⚠️ **In practice the cost is close to zero.** The canary is opt-in
(`NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED === "true"`) and covers only
`peones_pack_50`. With it off — the default — **every** Get Peones purchase,
including every flexible top-up and the planned 5-Peones smoke, takes the legacy
rail and IS attributed.

**Why the legacy rail is safe**: it verifies the ERC-20 `Transfer(from,to,value)`
**event** (`lib/payments/verify-transfer.ts`), never the calldata. A data suffix
cannot touch an event. PRO and Season Pass verify through the same route.

The exclusion is one line, and both it and its cause are pinned by tests:

```ts
const base = intent ? canonical : withChesscitoAttribution(canonical);
```

---

## PART 11 · Tests — 35, all green

| id | covers |
|---|---|
| AT-1 | an issued-style code produces a suffix; round-trips to exactly that one code; deterministic; whitespace-tolerant; SSR-safe |
| AT-2 | unset / malformed / empty → `undefined`, never a throw; request untouched; silent outside production; logs the variable name, never a value |
| AT-3 | tagged vs untagged ERC-20 transfer decode to the same function, recipient and amount; canonical is an exact prefix |
| AT-4 | `transfer` and `approve` keep selector and args, compared against the untagged decode |
| AT-5 | only `dataSuffix` is added; every economic and routing field identical; an explicit suffix is never overwritten |
| AT-6 | all seven write-path files route through the helper; the canary exclusion and its cause are pinned |
| AT-7 | no array form, no platform code |
| AT-8 | `codeFromHostname` absent from every production path (comments stripped) |
| AT-9 | **scans every tracked file** for `celo_[0-9a-f]{8}` and fails on anything outside the two fakes; asserts the env template declares the variable EMPTY |
| AT-10 | `peones_pack_5` = 5 Peones / $0.05 / same transfer amount; builder carries no attribution |
| AT-11 | canary SKU, reward and price unchanged; a flexible SKU is still canary-ineligible |
| AT-12 | PRO / Season Pass / mint still name the same functions |
| AT-13 | the existing payment, canary and flexible-top-up suites run untouched in the full run |

**Test code**: `celo_deadbeef` — structurally valid (`celo_` + 8 hex),
obviously fake. AT-9 is what keeps the real one out: pasting it anywhere tracked
turns the suite red *before* it can reach a commit.

⛔ No test prints the environment variable.

---

## PART 12–13 · Config and verification

**Where the founder configures the real value**, after this pass:

1. `apps/web/.env.local` — local + tunnel testing (founder-owned; this pass did
   not write to it);
2. the Vercel deployment environment for **both** projects, in the environment
   the build actually uses.

`apps/web/.env.template` — this repo's public env reference — now declares
`NEXT_PUBLIC_CELO_ATTRIBUTION_TAG=` **empty**, with the security framing inline.

**Verification script**: `pnpm -C apps/web attribution:verify 0x<txHash>`
(`scripts/verify-attribution.ts`). Read-only: one `eth_getTransactionByHash`,
no key, nothing signed.

```
Attribution marker: FOUND
  schemaId: 0
  codes carried: 1
Configured Chesscito tag: MATCH
OK — this transaction is attributed to Chesscito.
```

⛔ **It never prints a code** — not the configured one, not the on-chain one,
not on an error path. The comparison is done on *encoded suffixes*, so neither
side has to be rendered and casing or whitespace cannot cause a false MISMATCH.
Exit codes: `2` no marker, `3` tag not configured, `4` mismatch.

---

## PART 15 · Founder smoke — PREPARED, NOT EXECUTED

1. configure the real `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` in `.env.local`;
2. **rebuild** — `NEXT_PUBLIC_*` is inlined at build time, so a running server
   will not pick it up;
3. serve through the Cloudflare tunnel, open in MiniPay;
4. Get Peones → **5 Peones / $0.05**, one payment only;
5. confirm the business result: payment succeeds, **+5 Peones credited**;
6. copy the Celo transaction hash;
7. `pnpm -C apps/web attribution:verify 0x<hash>`;
8. expect `Attribution marker: FOUND` and `Configured Chesscito tag: MATCH`;
9. STOP.

⚠️ **Confirm the canary is OFF** (`NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED`
unset or not `"true"`) before the smoke. With it on, `peones_pack_50` would take
the unattributed canary rail — the 5-Peones SKU would still be attributed, but
the check would then only cover the legacy path by accident rather than by
design.

---

## DELIVERABLE

**OFFICIAL GUIDE VERSION / API:** `BUILDERS.md` read 2026-08-21, cross-checked
against installed `@celo/attribution-tags@0.3.0` `.d.ts`. Using
`toDataSuffix(code)` → viem/wagmi `dataSuffix`.

**PACKAGE:** `@celo/attribution-tags` (0.3.0, newly added)

**CONFIG VARIABLE:** `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG`

**REAL TAG COMMITTED:** **NO** — and AT-9 scans every tracked file to keep it so.

**REAL TAG LOGGED:** **NO** — logs name the variable and the failure shape only.

**HOSTNAME DERIVATION:** **NO** — asserted absent from every production path.

**PLATFORM TAGS:** **NONE** — single code, asserted.

**WRITE PATH INVENTORY:** 8 production families across 7 files, all class B
(Chesscito builds calldata, wallet submits). No class C. `/dev/*` probes are
class D and out of scope.

**COMMON ATTRIBUTION POINTS:** 4 shared boundaries + 2 single-write rails.

**ATTRIBUTED TRANSACTION PATHS:** Get Peones (legacy — every flexible SKU), PRO,
Season Pass, Victory mint (`approve` / `mintSigned` / `mintSignedWithPermit`),
badge claim (both surfaces), score submit (both surfaces), shop
(`approve` / `buyItem`, both surfaces).

**INTENTIONALLY UNATTRIBUTED PATHS:** the **Get Peones treasury canary**
(`peones_pack_50`, opt-in). `verifyCanaryTransaction` compares the on-chain
input to a re-encoded canonical transfer with strict equality, so a suffix would
cause a *paid-and-not-credited* failure. Attributing it requires a
prefix-tolerant verifier — a payment-boundary change, out of scope here.

**ERC20 TRANSFER SEMANTICS:** **UNCHANGED** — proven by decode: same function,
same recipient, same amount; canonical calldata is an exact prefix.

**GET PEONES ECONOMICS:** **UNCHANGED**

**CANARY:** **UNCHANGED**

**DB MIGRATION:** **NONE**

**VERIFY SCRIPT:** `pnpm -C apps/web attribution:verify 0x<txHash>` — read-only,
prints verdicts only, never a code.

**MISSING CONFIG BEHAVIOR:** transactions ship unattributed and keep working;
one production-only `console.warn` naming the variable; `attribution:verify` is
the explicit check.

**SSR SAFE:** **YES** — `process.env` only; asserted by test.

**FULL SUITE:** **712 files · 9023 passed · 1 todo · exit 0** — see the note
below on how that number was earned.

**TSC:** clean

**BUILD:** `next build` green; shared First Load JS **89.4 kB**, unchanged from
the pre-attribution build. `pnpm bundle:guard` clean (76 chunks).

**REAL ON-CHAIN SMOKE:** **NOT RUN**

---

## Verification — and how the suite number was earned

| check | result |
|---|---|
| `pnpm exec tsc --noEmit` | **clean** |
| attribution suite | **35 passed** (AT-1…AT-12) |
| payment-adjacent suites (payments, PRO, season-pass, coach, shop, verify-payment) | **83 files · 1027 passed** |
| full Vitest suite | **712 files · 9023 passed · 1 todo · exit 0** |
| `next build` | green; shared First Load JS 89.4 kB (unchanged) |
| `pnpm bundle:guard` | clean, 76 chunks |
| DB / migrations | untouched |

### ⛔ Three earlier full-suite runs were DISCARDED

They reported 705, 709 and 708 files against an expected **712**, with
`Failed to start forks worker` in `Unhandled Errors`, and durations of
970–1060 s against a ~155 s baseline. That is the exact failure CLAUDE.md warns
about: the summary reads "all green" while whole files never ran.

The cause was not the code and not a stray dev server. It was
**`ANECompilerService.xpc` pinned at ~99% CPU for 3h46m** — a runaway macOS
Neural-Engine compiler service — alongside a long-running Virtualization VM.
Neither is a repo process; neither was touched.

⚠️ **A number from those runs would have been a lie in the reassuring
direction**: zero test failures, because the failing work never executed.

### The run that counts

Once the ANE service released the CPU, a `--no-file-parallelism` run produced
the full **712 files / 9024 tests** with no worker errors, in 667 s.

### ⚠️ One real defect that only single-fork exposed — mine, in the test

An earlier single-fork run showed 5 failures across 4 files. They were not
product bugs: `attribution.test.ts` was writing the environment directly. The
environment is PROCESS-global — vitest isolates modules per file but not that —
so the fake tag leaked into other suites. Invisible under the default parallel
pool; fatal the moment anyone runs single-fork.

Fixed with `vi.stubEnv` + `vi.unstubAllEnvs()`, and the suffix fixture moved out
of the `describe` body, where it had been running at collection time — before
any `beforeEach` could own the environment. **The parallel pool would never have
caught this**, which is the argument for having run single-fork at all.

---

## VERDICT

**READY FOR CELO ATTRIBUTION SMOKE**

Eight production write families are attributed through four shared boundaries;
the one path that could not be attributed safely is excluded deliberately, with
its cause pinned by a test rather than left as a comment. ERC-20 semantics are
proven unchanged by decoding real calldata, the real code is kept out of the
repository by a scanner rather than by discipline, and the verification script
reports verdicts without ever echoing an identifier.

⚠️ Two things to carry into the smoke:
- **rebuild after setting the variable** — `NEXT_PUBLIC_*` is inlined at build
  time and a running server will not see it;
- **confirm the canary is off**, so the 5-Peones payment exercises the
  attributed legacy rail by design and not by luck.
