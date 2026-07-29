import { describe, expect, it } from "vitest";

import en from "../en";
import es from "../es";

/**
 * es.ts spreads the EN bundle at the TOP LEVEL only (`{ ...en, NAMESPACE: {…} }`).
 * That spread is NOT a deep merge: the moment ES overrides a namespace, every key
 * of that namespace it forgets to copy stops existing — and next-intl renders the
 * raw key path ("EXERCISE_DRAWER_COPY.claimBadgeCta") straight into the UI.
 *
 * This test enumerates every leaf key of the EN bundle and asserts ES has it too.
 */

type Node = Record<string, unknown>;

function leafKeys(value: unknown, prefix: string, out: string[]): string[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Node)) {
      leafKeys(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

function hasPath(root: unknown, path: string): boolean {
  let cursor: unknown = root;
  for (const segment of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return false;
    if (!(segment in (cursor as Node))) return false;
    cursor = (cursor as Node)[segment];
  }
  return true;
}

describe("message bundle parity — ES must not drop EN keys", () => {
  it("every EN leaf key resolves in the ES bundle", () => {
    const missing = leafKeys(en, "", []).filter((path) => !hasPath(es, path));

    expect(missing).toEqual([]);
  });
});
