import { describe, expect, it } from "vitest";

import {
  DEFAULT_MIN_FREE_GB,
  GB,
  assessDisk,
  parseFreeBytes,
} from "../preflight-disk";

/**
 * The disk guard. It exists because Playwright runs kept dying mid-suite on a
 * machine that lives at 98% full — and a run that dies mid-suite leaves videos
 * and traces behind, which makes the next run likelier to die. The guard breaks
 * that loop by refusing to start, not by cleaning up: it never deletes anything,
 * because deciding what is expendable on someone's disk is not a script's call.
 */

/** Real `df -k` output from the machine this guard was written for. */
const DF_MACOS = `Filesystem   1024-blocks       Used Available Capacity iused      ifree %iused  Mounted on
/dev/disk3s5   482797056  445890560   7224064    99% 7127823 4293839456    0%   /System/Volumes/Data`;

describe("parseFreeBytes", () => {
  it("reads the Available column out of `df -k`", () => {
    // 7_224_064 KiB — the 4th column, not the 3rd (Used) and not a percentage.
    expect(parseFreeBytes(DF_MACOS)).toBe(7_224_064 * 1024);
  });

  it("refuses output it cannot understand rather than guessing a number", () => {
    // Guessing here would be the worst outcome: a wrong "plenty of space" reading
    // silently restores the very failure this guard exists to prevent.
    expect(() => parseFreeBytes("")).toThrow(/could not read/i);
    expect(() => parseFreeBytes("Filesystem 1024-blocks\n")).toThrow(/could not read/i);
    expect(() => parseFreeBytes("a b c notanumber e\nx y z w v")).toThrow(/could not read/i);
  });
});

describe("assessDisk", () => {
  it("passes when there is room", () => {
    const r = assessDisk(20 * GB, DEFAULT_MIN_FREE_GB * GB);
    expect(r.ok).toBe(true);
  });

  it("fails when free space is under the floor", () => {
    const r = assessDisk(3 * GB, 10 * GB);
    expect(r.ok).toBe(false);
  });

  it("treats exactly the floor as enough (the floor is a minimum, not a gap)", () => {
    expect(assessDisk(10 * GB, 10 * GB).ok).toBe(true);
  });

  it("says how much is free, how much is needed, and what to do about it", () => {
    // A guard that only says "no" trains people to switch it off. It has to hand
    // back the numbers AND somewhere to look — without touching anything itself.
    const { message } = assessDisk(3.2 * GB, 10 * GB);
    expect(message).toMatch(/3\.2 GB/);
    expect(message).toMatch(/10\.0 GB/);
    expect(message).toMatch(/ms-playwright/); // stale browsers: the usual suspect
    expect(message).toMatch(/e2e-results/); // last run's videos/traces
    expect(message).toMatch(/DISK_MIN_FREE_GB/); // the floor is overridable, and says so
  });

  it("promises it touched nothing — the guard is a gate, not a cleaner", () => {
    // The whole point of pointing at ~/Library and .next is that a human decides
    // what goes. The message must make that unambiguous, or the next reader will
    // assume the script already helped itself.
    const { message } = assessDisk(1 * GB, 10 * GB);
    expect(message).toMatch(/Nothing has been deleted/i);
  });
});
