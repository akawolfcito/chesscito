# Chesscito admin CLI

Encode + simulate + send admin transactions (setItem, setAcceptedToken,
pause, etc.) against the Chesscito contracts on Celo mainnet and Sepolia,
with an append-only audit log per execution.

Self-contained: no global tooling, no foundry install, no PATH
manipulation. The signing key lives encrypted inside the repo at
`apps/admin/.private/admin-key.enc` (gitignored). The decryption only
happens in memory when you run a write command and pass the keystore
password.

## Why this exists

Direct admin operations from a wallet UI (Celoscan, MetaMask custom
data) are error-prone:

- function selectors and ABI encoding by hand are easy to fat-finger
- no dry-run or pre-state read by default
- no audit trail of what was changed and when

This package wraps the common admin calls behind explicit subcommands,
runs them through viem for encoding + simulation + signing, and writes
one structured entry to the audit log per execution — success,
dry-run, and failure alike.

## Install

The package is part of the pnpm workspace. From the repo root:

```bash
pnpm install
```

That's it. No additional binaries to install, nothing added to your
PATH.

## First-run — create the local keystore (one time per machine)

```bash
pnpm admin wallet init
```

Two prompts, both no-echo:

1. **Private key**: paste the admin EOA's PK (with or without `0x`).
2. **New keystore password**: choose a strong one (≥ 12 chars). You'll
   need it every time you sign.

The result is an encrypted file at `apps/admin/.private/admin-key.enc`
containing:

- scrypt-derived key from your password (N=16384, r=8, p=1)
- AES-256-GCM ciphertext of the PK
- Plaintext address metadata (so `pnpm admin wallet address` can show
  "which key is this?" without typing the password)

Verify any time:

```bash
pnpm admin wallet address           # shows metadata only
pnpm admin wallet address --verify  # decrypts and confirms
```

## Usage

From the repo root:

```bash
# Help / list of subcommands
pnpm admin --help
pnpm admin shop --help
pnpm admin wallet --help

# Read-only (no password required)
pnpm admin shop get-item --item-id 1 --chain celo
pnpm admin shop is-token-accepted --token CELO --chain celo

# Write (prompts for keystore password, simulates, asks y/N)
pnpm admin shop set-item --item-id 5 --price-usd6 1000000 --enabled true --chain celo
pnpm admin shop set-accepted-token --token CELO --accepted true --chain celo
pnpm admin shop pause --chain celo
pnpm admin shop unpause --chain celo

# Dry-run — never broadcasts, still logs to audit-log
pnpm admin shop set-item --item-id 5 --price-usd6 1000000 --enabled true \
  --chain celo --dry-run --yes

# Skip the y/N confirmation (for scripting)
pnpm admin shop set-item ... --yes
```

## What runs where

When you invoke a write command:

1. `getPublicClient` reads pre-state and the contract owner via the
   public RPC.
2. The CLI prints a preview: chain, contract, signature, args,
   calldata, signer address, owner, pre-state.
3. `simulate` does an `eth_call` with the owner as `from` so the
   revert reason surfaces before you spend gas.
4. If `--dry-run`, that's it — entry written to audit-log, exit.
5. Otherwise, the CLI prompts for the keystore password (no echo).
6. `decryptKeystore` runs scrypt + AES-GCM-decrypt in memory only.
   The buffer holding the derived KDF key is zeroed after use.
7. viem's `walletClient.writeContract` signs and broadcasts.
8. `waitForTransactionReceipt` blocks until the tx is mined.
9. Post-state is read and printed.
10. One entry is appended to `apps/admin/audit-log/<UTC-day>.{md,jsonl}`
    capturing chain, contract, signature, args, calldata, sender,
    txHash, block, gas used, outcome, and pre/post state.

Steps 1-9 happen entirely inside this Node process.

## Where the audit log goes

Every send operation appends a markdown block plus a JSONL line to
`apps/admin/audit-log/<UTC-day>.md` and `<UTC-day>.jsonl`. Both files
are gitignored — they contain operational metadata (tx hashes, sender
address, gas usage) that does not belong in the public repo. The
`audit-log/` directory itself stays tracked via `.gitkeep`.

## Where the keystore goes

`apps/admin/.private/admin-key.enc`. The whole `.private/` directory
is gitignored — even though the contents are encrypted, keeping it out
of git eliminates any chance of an accidental commit feeding a
brute-force attempt.

## Security notes

- **Self-contained**: no global tools, no PATH changes, no system
  packages. Delete the repo and the keystore goes with it.
- **PK never on disk in plaintext.** The init command reads it from a
  raw-mode (no-echo) prompt and writes only the AES-256-GCM
  ciphertext.
- **PK in memory only during signing.** The decrypted PK lives inside
  a viem `Account` while a write command runs, then is dropped. The
  scrypt-derived KDF key is zeroed explicitly after use.
- **Simulation before send.** Write commands `eth_call` the
  transaction as the owner first, so a revert reason surfaces before
  you spend gas.
- **Audit log gitignored by default.** Do not commit it.
- **No secrets in command flags.** The CLI does not read PKs from env
  vars, files, or stdin args — only from the encrypted keystore.

## Configuration

Network + contract addresses live in `src/config.ts`. They duplicate
parts of `apps/web/src/lib/contracts/chains.ts` — when admin matures
into routine use, the right next step is extracting a shared
`packages/contracts-config` workspace and importing from there.

## Roadmap

- ✅ Commit 1: package skeleton, `tx-runner` + `audit-log` libs,
  `shop get-item` read-only command.
- ✅ Commit 2: pin every dependency to an exact version (no `^`/`~`)
  across the workspace.
- ✅ Commit 3: `shop set-item`, `shop set-accepted-token`, `shop pause`
  / `unpause`, end-to-end with simulation + signing + audit log
  (initial cast-subprocess implementation).
- ✅ Commit 4 (this one): drop foundry / cast entirely. Sign locally
  with viem, key encrypted at rest in `apps/admin/.private/`.
- Future: victory + scoreboard write commands. Maybe a shared
  `packages/contracts-config` workspace once duplication bites.
