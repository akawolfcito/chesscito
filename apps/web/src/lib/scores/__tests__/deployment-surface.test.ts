/**
 * Slice 2B — surface resolution on the READ path (API-6, API-7, API-8).
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-api.md (parent decision D5)
 *
 * Two helpers with deliberately opposite failure modes, which is the whole
 * point of adding a second one:
 *
 *   - `resolveDeploymentSurface` (write path) falls back to `learn`. That is
 *     self-consistent there: the row is written `learn` and read back `learn`.
 *   - `requireDeploymentSurface` (read path) throws. A silent `learn` would
 *     render LEARN's weekly board to PLAY players — correctly ranked,
 *     correctly labelled, and wholly wrong.
 *
 * The env is read at CALL time, not import time, so each case here just sets
 * the variable and calls. If that ever regresses to an import-time read, every
 * test below the first one starts lying.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  requireDeploymentSurface,
  resolveDeploymentSurface,
  UnresolvedSurfaceError,
} from "../deployment-surface";

const ORIGINAL = process.env.NEXT_PUBLIC_CHESSCITO_MODE;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_CHESSCITO_MODE;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_CHESSCITO_MODE;
  else process.env.NEXT_PUBLIC_CHESSCITO_MODE = ORIGINAL;
});

describe("requireDeploymentSurface — fail closed (D5)", () => {
  it("resolves an explicit learn", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    expect(requireDeploymentSurface()).toBe("learn");
  });

  it("resolves an explicit play", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    expect(requireDeploymentSurface()).toBe("play");
  });

  it("maps the internal `full` build to learn — explicitly, not by default", () => {
    // API-8. `full` is not a shipped surface; it behaves as Learn for the
    // exercises flow. It resolves only because it was SET, which is the
    // difference that matters against the case below.
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "full";
    expect(requireDeploymentSurface()).toBe("learn");
  });

  it("tolerates surrounding whitespace, like the write-path helper", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "  play  ";
    expect(requireDeploymentSurface()).toBe("play");
  });

  it("throws when the mode is unset", () => {
    // API-6. This is the case the write path answers with `learn`.
    expect(() => requireDeploymentSurface()).toThrow(UnresolvedSurfaceError);
  });

  it("throws on an empty string", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "";
    expect(() => requireDeploymentSurface()).toThrow(UnresolvedSurfaceError);
  });

  it("throws on whitespace only", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "   ";
    expect(() => requireDeploymentSurface()).toThrow(UnresolvedSurfaceError);
  });

  it("throws on an unrecognised value instead of guessing", () => {
    // API-7. A typo must not become a plausible board.
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "lean";
    expect(() => requireDeploymentSurface()).toThrow(UnresolvedSurfaceError);
  });

  it("is case sensitive — LEARN is not learn", () => {
    // The write-path helper compares exactly too. Accepting variants here
    // would mean the two helpers disagree about what is configured.
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "LEARN";
    expect(() => requireDeploymentSurface()).toThrow(UnresolvedSurfaceError);
  });

  it("names the variable in the error, so the fix is obvious from a log", () => {
    expect(() => requireDeploymentSurface()).toThrow(
      /NEXT_PUBLIC_CHESSCITO_MODE/,
    );
  });
});

describe("resolveDeploymentSurface — unchanged (write path)", () => {
  it("still falls back to learn when the mode is unset", () => {
    // The guard that proves this slice did not "fix" the write path while
    // adding the read one. Score provenance depends on that fallback.
    expect(resolveDeploymentSurface()).toBe("learn");
  });

  it("still maps full to learn", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "full";
    expect(resolveDeploymentSurface()).toBe("learn");
  });

  it("still resolves play", () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    expect(resolveDeploymentSurface()).toBe("play");
  });
});
