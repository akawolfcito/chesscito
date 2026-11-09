import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ⛔ NO OWNER OF `<WelcomePackageModal>` MAY REFUSE ITS DISMISS.
 *
 * The gift modal was reported from the MiniPay smoke as a screen with no exit:
 * "Saving your gift… / Sign in your wallet…", forever. The first fix added an
 * escape hatch to the modal and unblocked ONE of its owners — and the founder
 * hit the dead end again on the next run, because the modal has **four**
 * mounters and three still carried their own copy of:
 *
 *     if (claimPhase === "signing") return
 *
 * The affordance rendered and did nothing. Patching a caller left three other
 * doors, which is the failure mode this repo already has a name for: guard the
 * GRANTOR, not the callers.
 *
 * The grantor here is the modal. It decides when a dismiss is legitimate — it
 * renders no close affordance at all until the signature has visibly stalled —
 * so an owner-side re-check is redundant AND load-bearing in the wrong
 * direction: it can only ever refuse a dismiss the modal already judged safe.
 *
 * ⚠️ This is a SOURCE scan, not a render test, on purpose. A per-owner render
 * test proves three files and says nothing about the fourth one somebody adds
 * next month. What must hold is a property of the codebase: this guard exists
 * in zero places outside the modal itself.
 */

const SRC = resolve(__dirname, "../../..");

/** Any owner-side re-check of the signing phase, however it is spelled. */
const OFFENDING = /claimPhase\s*===\s*"signing"\s*\)\s*return/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !full.includes("__tests__")) out.push(full);
  }
  return out;
}

describe("the welcome-gift signing phase has exactly one gatekeeper", () => {
  it("no component re-checks the signing phase to refuse a dismiss", () => {
    const offenders = walk(SRC)
      .filter((file) => OFFENDING.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(SRC.length + 1));

    expect(
      offenders,
      `These files refuse a dismiss the modal already judged safe, which is how\n` +
        `the dead end survived its first fix. Delete the guard: the modal shows no\n` +
        `close affordance until the signature has stalled, and every one of these\n` +
        `handlers already resets the phase through handleSuccess().\n`,
    ).toEqual([]);
  });
});
