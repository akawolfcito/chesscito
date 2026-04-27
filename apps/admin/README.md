# Chesscito admin CLI

Encode + simulate + send admin transactions (setItem, setAcceptedToken,
pause, etc.) against the Chesscito contracts on Celo mainnet and Sepolia,
with an append-only audit log per execution.

## Why this exists

Direct admin operations from a wallet UI (Celoscan, MetaMask custom data)
are error-prone:

- function selectors and ABI encoding by hand are easy to fat-finger
- no dry-run or pre-state read by default
- no audit trail of what was changed and when

This package wraps the common admin calls behind explicit subcommands,
runs them through viem for encoding + simulation, and delegates signing
to foundry's `cast` keystore so the private key never enters this Node
process.

## Install

The package is part of the pnpm workspace. From the repo root:

```bash
pnpm install
```

You also need foundry installed locally for the `cast` binary used during
signing:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Import your admin EOA private key once into a foundry keystore (you
will be prompted for the PK and a password — never typed elsewhere):

```bash
cast wallet import chesscito-admin --interactive
```

Verify the imported address:

```bash
cast wallet address --account chesscito-admin
# expects the contract owner address, currently 0x917497...
```

## Usage

From the repo root:

```bash
# Help / list of subcommands
pnpm admin --help
pnpm admin shop --help

# Read-only: get the on-chain state of a Shop item
pnpm admin shop get-item --item-id 1 --chain celo
pnpm admin shop get-item --item-id 5 --chain celo
```

Write commands (set-item, set-accepted-token, pause, …) land in commit
2+ — this commit ships the package skeleton plus the first read-only
command end-to-end.

## Where the audit log goes

Every send operation appends a markdown block plus a JSONL line to
`apps/admin/audit-log/<UTC-day>.md` and `<UTC-day>.jsonl`. Both files
are gitignored — they contain operational metadata (tx hashes, sender
address, gas usage) that does not belong in the public repo. The
`audit-log/` directory itself stays tracked via `.gitkeep`.

If you need to share an audit log entry, copy the block manually to
wherever it belongs (a security review doc, a Slack message), redacting
any field you consider sensitive for that audience.

## Security notes

- **The PK never enters the Node runtime.** The CLI builds calldata in
  Node and then spawns `cast send` as a subprocess with `--account
  <name>`. Cast prompts for the keystore password in its own process
  and signs there.
- **Audit log files are gitignored by default.** Do not commit them.
- **No secrets in command flags.** The CLI does not read PKs from env
  vars, files, or stdin — it only knows your keystore name.
- **Simulation before send.** Write commands dry-run via `eth_call`
  with the configured `from` first, so you see the revert reason
  before paying gas.

## Configuration

Network + contract addresses live in `src/config.ts`. They duplicate
parts of `apps/web/src/lib/contracts/chains.ts` — when admin matures
into routine use, the right next step is extracting a shared
`packages/contracts-config` workspace and importing from there.

## Roadmap

- Commit 1 (this one): package skeleton, `tx-runner` + `audit-log`
  libs, `shop get-item` read-only command.
- Commit 2: `shop set-item`, `shop set-accepted-token`, `shop pause` /
  `unpause`, end-to-end with simulation + signing + audit log.
- Commit 3: victory + scoreboard write commands.
- Future: deprecate `apps/contracts/scripts/configure-shop.ts` once the
  CLI covers everything that script does today.
