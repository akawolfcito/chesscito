import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tests for the Vercel Ignored Build Step.
 *
 * ⚠️ WHY THIS FILE EXISTS. The previous guard lived only in Vercel's dashboard,
 * where it could not be read or exercised, and `chesscito-landing` carried a
 * defective version of it for months without anyone noticing. A deploy guard
 * that nobody has run against a failing case is a guard nobody knows works —
 * the same lesson as `hitCeiling`, which compared against an unreachable 10,000
 * and therefore never fired once.
 *
 * ⚠️ EXIT CODES ARE BACKWARDS FROM INTUITION and that is Vercel's contract:
 *
 *     exit 0      → CANCEL the build
 *     exit non-0  → RUN the build
 *
 * Every assertion below spells out which one it means, because `toBe(0)`
 * reading as "success" is exactly how this gets inverted by a later edit.
 *
 * The `turbo-ignore` delegation is stubbed with VERCEL_SHOULD_BUILD_DRY_RUN:
 * it needs the network and a Vercel deployment history, and it is third-party
 * code. What is tested here is OUR logic — flag precedence and the fail-safe.
 */

const SCRIPT = path.resolve(__dirname, "../vercel-should-build.sh");

const SKIP = 0;
const BUILD = 1;

function run(
  args: string[],
  env: Record<string, string> = {},
): { code: number; out: string } {
  const res = spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      // Stubbed by default so no test can reach the network by omission.
      VERCEL_SHOULD_BUILD_DRY_RUN: "1",
      ...env,
    },
  });
  return { code: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
}

describe("vercel-should-build · explicit flags win over everything", () => {
  it("cancels the build on [skip build], even when the workspace changed", () => {
    const { code, out } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "fix(board): rewrite the whole hit-grid [skip build]",
    });
    expect(code).toBe(SKIP);
    expect(out).toContain("explicit flag");
  });

  it("cancels on the bracket-free spelling, which is safe to type in zsh", () => {
    // Unquoted brackets are globs in zsh, and that has already broken `main`
    // here once via a bracketed `git add` pathspec.
    const { code } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "docs: handoff skip-build",
    });
    expect(code).toBe(SKIP);
  });

  it("forces a build on [force build], even for a docs-only commit", () => {
    const { code, out } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "docs: touch nothing at all [force build]",
    });
    expect(code).toBe(BUILD);
    expect(out).toContain("explicit flag");
  });

  it("forces on the bracket-free spelling too", () => {
    const { code } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "chore: force-build after a config change",
    });
    expect(code).toBe(BUILD);
  });

  it("matches flags regardless of case", () => {
    expect(run(["web"], { VERCEL_GIT_COMMIT_MESSAGE: "x [SKIP BUILD]" }).code).toBe(SKIP);
    expect(run(["web"], { VERCEL_GIT_COMMIT_MESSAGE: "x [Force Build]" }).code).toBe(BUILD);
  });

  it("lets skip win when a message somehow carries both", () => {
    // Ambiguity must resolve to the CHEAP outcome, and it must be documented
    // rather than emergent: skip is checked first.
    const { code } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "[skip build] and also [force build]",
    });
    expect(code).toBe(SKIP);
  });

  it("does NOT fire on a message that merely discusses the flags", () => {
    // The word boundaries matter: prose about the mechanism must not trip it.
    const { code } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE: "docs(ops): explain when to skipbuilding things",
    });
    expect(code).toBe(BUILD);
  });
});

describe("vercel-should-build · fail-safe", () => {
  it("builds when no workspace argument is given", () => {
    // A broken guard may waste a build. It may never leave production without
    // a deploy.
    const { code, out } = run([], { VERCEL_GIT_COMMIT_MESSAGE: "feat: something" });
    expect(code).toBe(BUILD);
    expect(out).toContain("fail-safe");
  });

  it("builds when the commit message is absent entirely", () => {
    const { code } = run(["web"]);
    expect(code).toBe(BUILD);
  });

  it("builds when the commit message is empty", () => {
    const { code } = run(["web"], { VERCEL_GIT_COMMIT_MESSAGE: "" });
    expect(code).toBe(BUILD);
  });

  it("delegates to turbo-ignore when no flag is present", () => {
    const { code, out } = run(["landing"], {
      VERCEL_GIT_COMMIT_MESSAGE: "feat(landing): a real change",
    });
    expect(out).toContain("would delegate");
    expect(out).toContain("landing");
    expect(code).toBe(BUILD);
  });

  it("never dies on a multi-line commit message", () => {
    // Real commit messages in this repo are long and multi-line, with bullet
    // lists and quoted output.
    const { code } = run(["web"], {
      VERCEL_GIT_COMMIT_MESSAGE:
        "feat(stats): add RPCs\n\n- one\n- two\n\n  quoted 'text' and $vars and `ticks`\n[skip build]",
    });
    expect(code).toBe(SKIP);
  });
});

describe("vercel-should-build · the contract itself", () => {
  it("documents that exit 0 cancels and non-zero builds", () => {
    // Pinned in a test because it is the single most invertible fact here:
    // 0 reads as "success" everywhere else in a shell.
    expect(SKIP).toBe(0);
    expect(BUILD).toBe(1);
  });

  it("is executable as bash from the repo root path Vercel uses", () => {
    const { code } = run(["web"], { VERCEL_GIT_COMMIT_MESSAGE: "[skip build]" });
    expect(code).not.toBe(-1); // -1 means the script could not be spawned
  });
});
