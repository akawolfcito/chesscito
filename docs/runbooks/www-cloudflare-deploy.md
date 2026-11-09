# Cloudflare landing release

Landing is maintained in `apps/landing` on main. Read `docs/ops/deployment-topology.md` and the private operator record before a release. Preserve the existing Worker and domain attachment.

Use the pinned Node version in `apps/landing/.nvmrc`, pnpm workspace, and the existing `build:vinext`, `verify:vinext --release`, and `deploy:vinext --execute` scripts from the repository root. Use the same approved public inputs for build and verification. Do not bypass the deployment wrapper.

Preserve a compatible artifact and configuration for rollback. Deployment is manual and requires authorization for its actual scope; consolidating source in main does not publish the application.
