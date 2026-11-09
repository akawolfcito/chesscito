/**
 * The build seal (spec 2026-08-07-wallet-branch-lazy-load).
 *
 * Only the pure hashing is tested here — the walk is exercised for real every
 * time `pnpm bundle:guard` runs. What must be true of the hash is that it
 * ignores things that do not change a build (read order) and reacts to
 * everything that does (content, and where a file lives).
 */
import { describe, expect, it } from "vitest";

// CJS on purpose: `next.config.js` requires this same module at build time, so
// there is exactly one implementation of the seal.
import { fingerprintEntries } from "../../../../scripts/lib/source-fingerprint.cjs";

const a = { key: "src/a.ts", content: "export const a = 1;" };
const b = { key: "src/b.ts", content: "export const b = 2;" };

describe("fingerprintEntries", () => {
  it("ignores read order — directory order differs between machines", () => {
    expect(fingerprintEntries([a, b])).toBe(fingerprintEntries([b, a]));
  });

  it("changes when a file's content changes", () => {
    expect(fingerprintEntries([a, b])).not.toBe(
      fingerprintEntries([a, { ...b, content: "export const b = 3;" }]),
    );
  });

  it("changes when a file MOVES without being edited", () => {
    // A moved module lands in a different chunk. The path is part of the build.
    expect(fingerprintEntries([a, b])).not.toBe(
      fingerprintEntries([a, { ...b, key: "src/nested/b.ts" }]),
    );
  });

  it("does not collide when content is shuffled between files", () => {
    // Hashing content alone would make these two trees identical.
    expect(fingerprintEntries([a, b])).not.toBe(
      fingerprintEntries([
        { key: a.key, content: b.content },
        { key: b.key, content: a.content },
      ]),
    );
  });
});
