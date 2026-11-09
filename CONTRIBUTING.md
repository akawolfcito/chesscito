# Contributing

Follow `AGENTS.md` and keep changes focused on the active issue. Use the existing TypeScript and workspace conventions, English UI copy, and mobile-first MiniPay validation.

Use Conventional Commits and the public signature specified in `AGENTS.md`. Review the staged diff before committing; exclude credentials, personal data and internal reports.

Use focused pull requests with appropriate validation for ordinary changes. Shared-history replacement is an exceptional operator action requiring explicit authorization, a verified backup and a reviewed reference map. Do not merge the replaced history back into the new baseline.

Before a release consult `docs/ops/deployment-topology.md`, verify affected surfaces and run the checks appropriate to the change. Production data access, transactions and deployment require authorization for their actual scope.
