import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { childEnv } from "../lib/child-env";

const OPS = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(OPS, rel), "utf8");

/**
 * Every ops script that opens a database through Docker. Listed explicitly:
 * a glob would silently stop covering a file somebody moves, and this guard
 * exists precisely because a convention was not enough.
 */
const DB_SCRIPTS = [
  "archive.ts",
  "backup.ts",
  "no-token-observation.ts",
  "read-only-query.ts",
  "verify-stats-rpcs.ts",
  "collectors/supabase.ts",
] as const;

/**
 * An inline `-e NAME=…` whose value is INTERPOLATED or CONCATENATED.
 *
 * ⚠️ A plain literal is deliberately allowed — see the exception documented in
 * `lib/child-env.ts`. `POSTGRES_PASSWORD=throwaway` on a disposable container
 * leaks nothing that cloning this public repository does not already give you;
 * `PGCONN=${conn}` leaks a production password.
 */
const INTERPOLATED_INLINE = /"--?e(nv)?",\s*(`[A-Z_]+=[^`]*\$\{|"[A-Z_]+="\s*\+)/;

describe("childEnv", () => {
  it("carries the parent environment plus the extras", () => {
    const out = childEnv({ PGCONN: "postgres://x" });
    expect(out.PGCONN).toBe("postgres://x");
    expect(out.PATH).toBe(process.env.PATH);
  });

  it("does not mutate the real environment", () => {
    const before = process.env.PGCONN;
    childEnv({ PGCONN: "postgres://x" });
    expect(process.env.PGCONN).toBe(before);
  });

  it("lets the extras win over an inherited value", () => {
    expect(childEnv({ PATH: "/nowhere" }).PATH).toBe("/nowhere");
  });
});

describe("the guard pattern itself", () => {
  /* Asserted directly, because a scanner nobody has watched fail is a scanner
     nobody knows the shape of. */
  it("catches a template-interpolated value", () => {
    expect(INTERPOLATED_INLINE.test('"-e", `PGCONN=${conn}`,')).toBe(true);
    expect(INTERPOLATED_INLINE.test('"-e", `PGPASSWORD=${creds.password}`,')).toBe(true);
  });

  it("catches a concatenated value", () => {
    expect(INTERPOLATED_INLINE.test('"-e", "PGPASSWORD=" + creds.password,')).toBe(true);
  });

  it("catches the long form", () => {
    expect(INTERPOLATED_INLINE.test('"--env", `PGCONN=${conn}`,')).toBe(true);
  });

  it("allows a plain literal, which the source already reveals", () => {
    expect(INTERPOLATED_INLINE.test('"-e", "POSTGRES_PASSWORD=throwaway",')).toBe(false);
    expect(INTERPOLATED_INLINE.test('"-e", "POSTGRES_DB=restore",')).toBe(false);
  });

  it("allows a bare name", () => {
    expect(INTERPOLATED_INLINE.test('"-e", "PGCONN",')).toBe(false);
  });
});

/**
 * ⛔ THE REGRESSION GUARD.
 *
 * Every one of these files once carried a comment promising that the
 * connection string "never travels in argv" while `-e NAME=${conn}` put it
 * exactly there. `verify-stats-rpcs.ts` even spelled out the threat — "argv is
 * visible in `ps` on the host" — directly above the line that created it. The
 * intent was right in all six places and the code was wrong in all six.
 *
 * Source-scanned rather than executed: these functions shell out to Docker
 * against production, so reading them is the only honest way to assert the
 * rule across all of them.
 */
describe("no ops script passes a secret through docker argv", () => {
  it.each(DB_SCRIPTS)("%s never inlines an interpolated value", (rel) => {
    expect(INTERPOLATED_INLINE.test(read(rel))).toBe(false);
  });

  it.each(DB_SCRIPTS)("%s supplies its values through childEnv", (rel) => {
    const source = read(rel);
    expect(source).toContain("childEnv(");
    expect(source).toMatch(/^import \{ childEnv \}/m);
  });

  it("covers every ops script that runs psql or pg_dump in Docker", () => {
    // If a new script starts opening the database it must join the list above,
    // rather than quietly escaping the rule.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(
      "grep -rl -e 'psql \"$PGCONN\"' -e 'pg_dump \"$PGCONN\"' --include=*.ts .",
      { cwd: OPS, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .map((f) => f.replace(/^\.\//, ""))
      .filter((f) => !f.includes("__tests__"));

    expect(hits.length).toBeGreaterThan(0);
    for (const file of hits) expect(DB_SCRIPTS).toContain(file);
  });
});
