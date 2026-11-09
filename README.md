# Chesscito

Chess learning and play on Celo, designed for mobile use through MiniPay. The product is intended for adults aged 18 and over.

## Workspace

- `apps/web`: shared Play and Learn application.
- `apps/landing`: public landing site.
- `apps/contracts`: blockchain contracts.

Use the pinned pnpm workspace and the scripts in each package. Consult `AGENTS.md` for repository conventions and [the deployment topology guide](docs/ops/deployment-topology.md) before a release. Play, Learn and Landing have separate release targets.

Configuration names are documented in the app-specific `.env.template` files. Real credentials belong only in ignored local configuration or the hosting provider's protected settings. Never commit them or use service credentials in public client variables.

Internal reports, working notes, operational evidence and backup records are maintained outside this repository. Public application source remains available for review. Consult the root license, commercial and brand policy files for applicable terms.
