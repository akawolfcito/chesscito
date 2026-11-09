# Deployment topology

Consult this guide before any deployment. Play and Learn share source in `apps/web`, but have separate builds and settings. Landing has its own source in `apps/landing`; its Cloudflare release source is maintained in the same main branch. Preserve each surface's approved source and release mechanism.

Production is the only persistent data environment. A review deployment can use production resources; a branch does not isolate its data. Identify the exact affected surfaces, data dependencies and flags before testing or deploying.

The operator maintains verified project ownership, commands, configuration inventories and rollback records outside Git, in `../chesscito-confidential/`. Consult the private deployment record there; local platform links and old commit metadata do not prove current ownership. Do not create projects, relink environments, change domains or use an unqualified production deploy command.

Before release:

1. Verify source revision, project ownership, target domain and required runtime settings without displaying credentials.
2. Run checks appropriate to the change and verify the upload excludes local credentials, private documents and generated data.
3. Apply and verify any required database changes before publishing code that depends on them. Data changes and deployments require authorization for their actual scope.
4. Preserve a verified backup and the previous deployable artifact, including compatible configuration.
5. Use the approved surface-specific release wrapper or explicit platform target. Verify readiness, alias and source provenance after publication.
6. Review the mobile experience in browser and MiniPay. Use explicitly authorized production checks; do not make transactions or destructive changes as an implicit smoke test.

Main is the source of truth. If retained, the production branch must point to the same commit. Deployments are manual; a Git push is not an application release. A Git history rewrite is not an application release. Check branch protection, open PRs and platform automation before updating shared refs. Code rollback does not restore database, cache, credentials or routing.
