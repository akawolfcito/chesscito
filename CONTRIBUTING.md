# Contributing

## Working Rules

- Work only on the next issue in the critical path unless scope is explicitly changed.
- Keep changes as vertical slices with small diffs.
- Avoid broad refactors unless they are required to complete the active issue.
- Use TypeScript, Next.js, and viem/wagmi patterns already present in the repo.

## Commit Policy

- Make granular and frequent commits while implementing each issue.
- Each commit should represent a single logical step that can be reviewed independently.
- Do not batch unrelated changes into the same commit.
- Prefer conventional commit messages such as `feat(web): add levels route skeleton`.

## Pull Request Policy

- All changes must land through pull requests, even when only one contributor is actively shipping.
- Keep PRs scoped to one issue or one vertical slice.
- Reference the issue number in the PR title or body.
- Include exact validation commands and any MiniPay device validation notes.

## Auto-merge Policy

- PRs should be set to auto-merge after checks pass.
- Prefer squash merge for small vertical slices unless there is a reason to preserve commit history in the final branch.
- If auto-merge is blocked by repository settings, enable it at the repo level and continue using PRs as the default path to `main`.

## QA Baseline

- Run `pnpm --filter web type-check`
- Run `pnpm --filter web lint`
- Run `pnpm --filter web build`
- For MiniPay-specific changes, validate on a real device with Developer Mode, Load Test Page, and `ngrok`.
