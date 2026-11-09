/**
 * Deployment target profiles.
 *
 * The monitor watches two environments that are NOT the same system, and can
 * be running different code at the same moment. Measured on 2026-08-04, right
 * after a push: production was on `986bb383` and preview on `5d6083f8`, seven
 * commits apart. A monitor that could not tell them apart would compare a
 * preview run against a production snapshot and announce that "the deployed
 * commit changed" — describing an advance that never happened.
 *
 * So a target is chosen explicitly, travels through every artefact, and is
 * checked against what Vercel actually returns.
 *
 * `chesscito-landing` (www.chesscito.com) is deliberately out of scope: it is
 * a separate project with its own lifecycle and no shared backend.
 */

export type OpsTarget = "production" | "preview";

/** Running the monitor without a flag looks at what users are on. */
export const DEFAULT_TARGET: OpsTarget = "production";

export const OPS_TARGETS: readonly OpsTarget[] = ["production", "preview"] as const;

export type TargetProject = {
  project: "chesscito" | "lite-chesscito";
  /** Public domain, probed separately from the internal deployment. */
  domain: string;
  label: "play" | "learn";
};

export type TargetProfile = {
  target: OpsTarget;
  /**
   * The git ref Vercel should report for this target. Validated ALONGSIDE
   * `deployment.target` rather than instead of it: the two signals come from
   * different systems — one from Vercel, one from git — so a disagreement
   * means the topology moved, not that one field is stale.
   */
  expectedGitRef: string;
  projects: TargetProject[];
};

export const TARGET_PROFILES: Record<OpsTarget, TargetProfile> = {
  production: {
    target: "production",
    expectedGitRef: "production",
    projects: [
      { project: "chesscito", domain: "play.chesscito.com", label: "play" },
      { project: "lite-chesscito", domain: "learn.chesscito.com", label: "learn" },
    ],
  },
  preview: {
    target: "preview",
    expectedGitRef: "main",
    projects: [
      { project: "chesscito", domain: "preview.chesscito.com", label: "play" },
      { project: "lite-chesscito", domain: "learn-preview.chesscito.com", label: "learn" },
    ],
  },
};

export class InvalidTargetError extends Error {
  constructor(readonly received: string) {
    super(
      `unknown --target "${received}". Valid values: ${OPS_TARGETS.join(", ")}`,
    );
    this.name = "InvalidTargetError";
  }
}

/**
 * Read `--target` from argv.
 *
 * An unrecognised value THROWS rather than falling back to the default. The
 * failure mode being avoided is quiet and expensive: `--target prod` is a
 * plausible typo that would silently return production while the operator
 * believes they are looking at preview, and every number in the report would
 * be about the wrong system. The caller turns this into exit 3 — a monitor
 * failure, not a statement about production.
 */
export function parseTarget(argv: readonly string[]): OpsTarget {
  const index = argv.findIndex((arg) => arg === "--target" || arg.startsWith("--target="));
  if (index === -1) return DEFAULT_TARGET;

  const raw = argv[index]!.startsWith("--target=")
    ? argv[index]!.slice("--target=".length)
    : argv[index + 1];

  if (!raw) throw new InvalidTargetError("(missing value)");
  if (!OPS_TARGETS.includes(raw as OpsTarget)) throw new InvalidTargetError(raw);
  return raw as OpsTarget;
}

export function profileFor(target: OpsTarget): TargetProfile {
  return TARGET_PROFILES[target];
}
