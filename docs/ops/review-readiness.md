# Source review readiness

Main is the source of truth for Play, Learn and Landing. If retained, production must point to the same commit. Deployments are manual and separate from publishing Git changes.

New PRO purchases are paused in the application; existing entitlement reads remain available. Reopening sales requires a separate review.

The consolidated source includes reviewed application updates and the existing Cloudflare Landing release tooling. Internal findings, operational evidence and rollback records are maintained outside Git.

Before publication or deployment, verify the exact source, relevant checks, runtime prerequisites, target ownership and rollback compatibility. Completion of source consolidation does not certify a production deployment or device validation.
