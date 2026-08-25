/**
 * `session_required` is not a save failure, and must not be telemetried as one.
 *
 * ⛔ THE INCIDENT. `score_save_failed` accumulated 2.974 events across 32
 * installs in 14 days, and **2.845 of them (96 %) carried
 * `detail: "session_required"`**. One single `saveId` was reported 1.871 times
 * over 33 consecutive hours — about one per minute.
 *
 * It was never a retry loop. `exercises-screen.tsx:2573` already says it in
 * so many words: *"`session_required` NO es un fallo: es 'ahora no'"* — minting
 * the write session would have cost a prompt the player never asked for, so the
 * save stays local and retries on the next completion. That is the DESIGNED
 * behaviour and it is correct.
 *
 * The defect is that the same path telemetried it as a failure anyway, so a
 * player quietly training for two days generated 1.871 "failures" for something
 * the code itself classifies as fine. It made the third-noisiest event in the
 * product a phantom, buried the 126 REAL failures (`signature_rejected`) under
 * 20× their volume, and burned invocations.
 *
 * Audit: docs/audits/2026-08-25-peones-purchase-flow-audit.md §6
 */
import { describe, expect, it } from "vitest";

import { buildScoreSaveTelemetry } from "../save-telemetry";
import type { BasicScoreSaveResult } from "../save-service";

const base = {
  piece: "rook",
  levelId: 3,
  score: 100,
  timeMs: 5000,
  saveId: "0xabc",
  source: "exercises" as const,
};

/** The exact shape the production path produced 2.845 times. */
const deniedForNow = {
  status: "error",
  reason: "session_required",
} as unknown as BasicScoreSaveResult;

describe("session_required is not a failure", () => {
  it("does NOT emit score_save_failed when the session was merely not minted", () => {
    const mapped = buildScoreSaveTelemetry(deniedForNow, base);

    expect(mapped?.event).not.toBe("score_save_failed");
  });

  it("emits a deferral event instead, so the case stays observable", () => {
    // Silence would trade one blind spot for another: we still want to know how
    // often the save is postponed, just not to call it a failure.
    const mapped = buildScoreSaveTelemetry(deniedForNow, base);

    expect(mapped?.event).toBe("score_save_deferred");
    expect(mapped?.props).toMatchObject({ reason: "session_required" });
  });

  it("STILL reports a genuine failure — this is the 126-event case", () => {
    const rejected = {
      status: "error",
      reason: "signature_rejected",
    } as unknown as BasicScoreSaveResult;

    const mapped = buildScoreSaveTelemetry(rejected, base);

    expect(mapped?.event).toBe("score_save_failed");
    expect(mapped?.props).toMatchObject({ detail: "signature_rejected" });
  });

  it("still reports rate limiting as a failure", () => {
    const limited = {
      status: "rate_limited",
      retryAfterMs: 1000,
    } as unknown as BasicScoreSaveResult;

    expect(buildScoreSaveTelemetry(limited, base)?.event).toBe("score_save_failed");
  });

  it("carries the same identifying props, so the deferral is still auditable", () => {
    const mapped = buildScoreSaveTelemetry(deniedForNow, base);

    expect(mapped?.props).toMatchObject({
      saveId: "0xabc",
      piece: "rook",
      source: "exercises",
    });
  });
});
