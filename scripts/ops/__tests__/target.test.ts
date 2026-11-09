/**
 * Target profiles, flag parsing, cross-validation and snapshot separation.
 *
 * The failure this whole file guards against is quiet: reading one environment
 * while believing you are reading the other. On 2026-08-04 production was on
 * `986bb383` and preview on `5d6083f8`, seven commits apart, so a crossed
 * reading would have reported a production advance that never happened.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_TARGET,
  InvalidTargetError,
  OPS_TARGETS,
  TARGET_PROFILES,
  parseTarget,
  profileFor,
} from "../lib/target";
import {
  collectVercel,
  normalizeDeploymentTarget,
  probeDomain,
  validateTargetMatch,
} from "../collectors/vercel";
import {
  SNAPSHOT_SCHEMA_VERSION,
  checkCompatibility,
  readLatest,
  writeSnapshot,
  type SnapshotEnvelope,
} from "../lib/snapshot-store";

const T0 = 1_785_810_000_000;

function lsJson(opts: { target?: string; ref?: string; sha?: string } = {}) {
  return `Vercel CLI\n${JSON.stringify({
    deployments: [
      {
        url: "chesscito-abc-goodwolf.vercel.app",
        state: "READY",
        target: opts.target ?? "production",
        ready: T0 - 60_000,
        meta: {
          githubCommitSha: opts.sha ?? "986bb38320d99a49807803e48f4d5390250a47cb",
          githubCommitRef: opts.ref ?? "production",
        },
      },
    ],
  })}`;
}

function fetchOk(domainStatus = 200) {
  return vi.fn(async (input: unknown) =>
    String(input).includes("api.vercel.com")
      ? new Response("{}", { status: 200 })
      : new Response("ok", { status: domainStatus }),
  ) as unknown as typeof fetch;
}

function envelope(over: Partial<SnapshotEnvelope> = {}): SnapshotEnvelope {
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    target: "production",
    taken_at_utc: "2026-08-04T04:00:00.000Z",
    taken_at_local: "2026-08-03 23:00:00",
    duration_ms: 1_000,
    credentials: [],
    supabase: {},
    vercel: {},
    upstash: {},
    classification: {},
    ...over,
  };
}

describe("flag parsing", () => {
  it("defaults to production with no flag", () => {
    expect(parseTarget([])).toBe("production");
    expect(DEFAULT_TARGET).toBe("production");
  });

  it("accepts both --target preview and --target=preview", () => {
    expect(parseTarget(["--target", "preview"])).toBe("preview");
    expect(parseTarget(["--target=preview"])).toBe("preview");
  });

  it("THROWS on an unknown value instead of falling back", () => {
    // `--target prod` is a plausible typo. A silent fallback would report
    // production while the operator believes they are looking at preview, and
    // every number in the report would describe the wrong system.
    expect(() => parseTarget(["--target", "prod"])).toThrow(InvalidTargetError);
    expect(() => parseTarget(["--target", "staging"])).toThrow(InvalidTargetError);
    expect(() => parseTarget(["--target"])).toThrow(InvalidTargetError);
  });

  it("names the valid values in the error", () => {
    try {
      parseTarget(["--target", "prod"]);
      throw new Error("should have thrown");
    } catch (error) {
      expect(String(error)).toContain("production");
      expect(String(error)).toContain("preview");
    }
  });

  it("ignores unrelated argv", () => {
    expect(parseTarget(["--verbose", "--target", "preview", "--other"])).toBe("preview");
  });
});

describe("profiles", () => {
  it("maps production to the public production domains", () => {
    const p = profileFor("production");
    expect(p.expectedGitRef).toBe("production");
    expect(p.projects.map((x) => x.domain)).toEqual([
      "play.chesscito.com",
      "learn.chesscito.com",
    ]);
  });

  it("maps preview to the preview domains, tracking main", () => {
    const p = profileFor("preview");
    expect(p.expectedGitRef).toBe("main");
    expect(p.projects.map((x) => x.domain)).toEqual([
      "preview.chesscito.com",
      "learn-preview.chesscito.com",
    ]);
  });

  it("never includes the landing project", () => {
    // www.chesscito.com is a separate project with its own lifecycle.
    for (const target of OPS_TARGETS) {
      const projects = TARGET_PROFILES[target].projects.map((p) => p.project);
      expect(projects).not.toContain("chesscito-landing");
      expect(projects).toEqual(["chesscito", "lite-chesscito"]);
    }
  });
});

describe("Vercel's target encoding", () => {
  it("reads null as PREVIEW — it is the marker, not a missing value", () => {
    // Measured live: production carries target:"production", preview carries
    // target:null with the key present. Reading null as unknown made every
    // preview run report a mismatch against itself.
    expect(normalizeDeploymentTarget(null)).toBe("preview");
    expect(normalizeDeploymentTarget(undefined)).toBe("preview");
    expect(normalizeDeploymentTarget("production")).toBe("production");
  });

  it("passes an unexpected value through so it fails validation loudly", () => {
    expect(normalizeDeploymentTarget("staging")).toBe("staging");
    expect(normalizeDeploymentTarget(42)).toBeNull();
  });

  it("a real preview payload validates against the preview profile", () => {
    const fromApi = { url: "x", state: "READY", target: null, commit_sha: "a",
      commit_ref: "main", ready_at: null, age_minutes: 1 };
    const normalized = { ...fromApi, target: normalizeDeploymentTarget(fromApi.target) };
    expect(validateTargetMatch(normalized, profileFor("preview")).ok).toBe(true);
  });
});

describe("cross-validation of BOTH signals", () => {
  const production = profileFor("production");
  const preview = profileFor("preview");

  const deployment = (target: string | null, ref: string | null) => ({
    url: "x", state: "READY", target, commit_sha: "abc", commit_ref: ref,
    ready_at: null, age_minutes: 1,
  });

  it("accepts a deployment matching both target and ref", () => {
    expect(validateTargetMatch(deployment("production", "production"), production).ok).toBe(true);
    expect(validateTargetMatch(deployment("preview", "main"), preview).ok).toBe(true);
  });

  it("rejects production that resolved to a preview deployment", () => {
    const v = validateTargetMatch(deployment("preview", "main"), production);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.mismatch.expected_target).toBe("production");
    expect(v.mismatch.actual_target).toBe("preview");
  });

  it("rejects preview that resolved to a production deployment", () => {
    const v = validateTargetMatch(deployment("production", "production"), preview);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.mismatch.actual_ref).toBe("production");
    expect(v.mismatch.expected_ref).toBe("main");
  });

  it("rejects a RIGHT target with a WRONG ref", () => {
    // Both signals are checked because they come from different systems. A
    // preview build off an unexpected branch is a topology change, not noise.
    const v = validateTargetMatch(deployment("preview", "feature/x"), preview);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.mismatch.reason).toMatch(/git ref/);
  });

  it("rejects unknown fields rather than assuming a match", () => {
    expect(validateTargetMatch(deployment(null, null), production).ok).toBe(false);
  });
});

describe("collector honours the profile", () => {
  it("asks the CLI for the requested environment, never --prod", async () => {
    const calls: string[][] = [];
    await collectVercel(undefined, "preview", {
      cli: (args) => {
        calls.push(args);
        return args[0] === "ls" ? lsJson({ target: "preview", ref: "main" }) : "";
      },
      fetchImpl: fetchOk(),
      now: () => T0,
    });

    const ls = calls.filter((c) => c[0] === "ls");
    expect(ls.length).toBeGreaterThan(0);
    for (const call of ls) {
      expect(call).toContain("--environment");
      expect(call).toContain("preview");
      expect(call).not.toContain("--prod");
    }
  });

  it("reports target_mismatch when preview resolves to production", async () => {
    const r = await collectVercel(undefined, "preview", {
      // Vercel hands back a production deployment despite the request.
      cli: (a) => (a[0] === "ls" ? lsJson({ target: "production", ref: "production" }) : ""),
      fetchImpl: fetchOk(),
      now: () => T0,
    });

    const p = r.projects[0]!;
    expect(p.status).toBe("target_mismatch");
    if (p.status !== "target_mismatch") return;
    expect(p.mismatch.expected_target).toBe("preview");
    expect(p.mismatch.actual_target).toBe("production");
  });

  it("a mismatch is NOT observable rather than a warning about the system", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: (a) => (a[0] === "ls" ? lsJson({ target: "preview", ref: "main" }) : ""),
      fetchImpl: fetchOk(),
      now: () => T0,
    });

    // The system may be perfectly healthy; the monitor just could not find
    // what it was told to look at.
    expect(r.not_observable.join(" ")).toMatch(/deployment/);
    expect(r.projects.every((p) => p.status !== "observable")).toBe(true);
  });

  it("stops before reading logs on a mismatch", async () => {
    // Log numbers from the wrong environment would be labelled with a target
    // they do not belong to.
    const calls: string[][] = [];
    await collectVercel(undefined, "production", {
      cli: (a) => {
        calls.push(a);
        return a[0] === "ls" ? lsJson({ target: "preview", ref: "main" }) : "";
      },
      fetchImpl: fetchOk(),
      now: () => T0,
    });
    expect(calls.filter((c) => c[0] === "logs")).toHaveLength(0);
  });

  it("carries the target on the result", async () => {
    const r = await collectVercel(undefined, "preview", {
      cli: (a) => (a[0] === "ls" ? lsJson({ target: "preview", ref: "main" }) : ""),
      fetchImpl: fetchOk(),
      now: () => T0,
    });
    expect(r.target).toBe("preview");
  });
});

describe("public domain probe", () => {
  it("reports status, latency and the final URL", async () => {
    let tick = 0;
    const probe = await probeDomain(
      "play.chesscito.com",
      vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch,
      () => (tick += 40),
    );

    expect(probe.status).toBe("observable");
    if (probe.status !== "observable") return;
    expect(probe.http_status).toBe(200);
    expect(probe.healthy).toBe(true);
    expect(probe.latency_ms).toBeGreaterThan(0);
  });

  it("only ever requests /", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    await probeDomain("x.com", fetchImpl as unknown as typeof fetch, () => 0);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://x.com/");
    expect((fetchImpl.mock.calls[0]![1] as { method: string }).method).toBe("GET");
  });

  it("treats a followed redirect ending in 2xx as healthy", async () => {
    // `/` → `/en` is the locale router working as designed.
    const probe = await probeDomain(
      "play.chesscito.com",
      vi.fn(async () => {
        const r = new Response("ok", { status: 200 });
        Object.defineProperty(r, "redirected", { value: true });
        Object.defineProperty(r, "url", { value: "https://play.chesscito.com/en" });
        return r;
      }) as unknown as typeof fetch,
      () => 0,
    );
    if (probe.status !== "observable") throw new Error("expected observable");
    expect(probe.healthy).toBe(true);
    expect(probe.final_url).toContain("/en");
  });

  it("marks a 5xx as unhealthy without throwing", async () => {
    const probe = await probeDomain(
      "x.com",
      vi.fn(async () => new Response("boom", { status: 503 })) as unknown as typeof fetch,
      () => 0,
    );
    if (probe.status !== "observable") throw new Error("expected observable");
    expect(probe.healthy).toBe(false);
  });

  it("degrades to not_observable on a network failure", async () => {
    const probe = await probeDomain(
      "x.com",
      vi.fn(async () => { throw new Error("ETIMEDOUT"); }) as unknown as typeof fetch,
      () => 0,
    );
    expect(probe.status).toBe("not_observable");
  });

  it("is probed even when the deployment lookup fails", async () => {
    const r = await collectVercel(undefined, "production", {
      cli: () => { throw new Error("not logged in"); },
      fetchImpl: fetchOk(),
      now: () => T0,
    });
    // A domain answering while the build cannot be identified is itself a
    // state worth reporting.
    expect(r.projects[0]!.status).toBe("not_observable");
  });
});

describe("snapshot separation", () => {
  const tempRepo = () => mkdtempSync(path.join(tmpdir(), "ops-target-"));

  it("writes each target to its own directory", () => {
    const root = tempRepo();
    writeSnapshot(root, "s1", envelope({ target: "production" }), "# prod");
    writeSnapshot(root, "s1", envelope({ target: "preview" }), "# prev");

    expect(
      readFileSync(path.join(root, "artifacts", "ops", "production", "latest.md"), "utf8"),
    ).toBe("# prod");
    expect(
      readFileSync(path.join(root, "artifacts", "ops", "preview", "latest.md"), "utf8"),
    ).toBe("# prev");
  });

  it("a production run never reads the preview snapshot", () => {
    const root = tempRepo();
    writeSnapshot(root, "s1", envelope({ target: "preview" }), "# prev");
    expect(readLatest(root, "production")).toBeNull();
    expect(readLatest(root, "preview")).not.toBeNull();
  });

  it("REFUSES a diff across targets even if one is handed in directly", () => {
    // Second line of defence: separate directories make this unlikely, the
    // guard makes it impossible when someone copies a latest.json by hand.
    const verdict = checkCompatibility(
      envelope({ target: "preview" }),
      envelope({ target: "production", taken_at_utc: "2026-08-04T05:00:00.000Z" }),
    );
    expect(verdict.comparable).toBe(false);
    if (verdict.comparable) return;
    expect(verdict.reason).toMatch(/entornos distintos/);
  });

  it("compares two snapshots of the same target", () => {
    expect(
      checkCompatibility(
        envelope({ target: "preview" }),
        envelope({ target: "preview", taken_at_utc: "2026-08-04T05:00:00.000Z" }),
      ),
    ).toEqual({ comparable: true });
  });

  it("REFUSES a v1 snapshot against v2", () => {
    // v1 predates `target`: it did not know which environment it described,
    // and guessing now would be exactly the confident nonsense to avoid.
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(2);
    const verdict = checkCompatibility(
      envelope({ schema_version: 1 }),
      envelope({ taken_at_utc: "2026-08-04T05:00:00.000Z" }),
    );
    expect(verdict.comparable).toBe(false);
    if (verdict.comparable) return;
    expect(verdict.reason).toMatch(/schema/);
  });
});
