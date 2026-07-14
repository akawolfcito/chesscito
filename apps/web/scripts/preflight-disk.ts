/**
 * Disk preflight for Playwright runs.
 *
 * Why this exists: the suite kept dying mid-run on a machine sitting at 98% full,
 * and a run that dies mid-way leaves videos and traces behind — which makes the
 * NEXT run likelier to die. The guard breaks that loop at the only safe point:
 * before anything is written.
 *
 * It is preventive and non-destructive by design. It never deletes, moves, or
 * prunes anything: what is expendable on someone's disk is their call, not a
 * script's. All it does is measure, refuse, and say where to look.
 */
import { execFileSync } from "node:child_process";

export const GB = 1024 ** 3;

/** The floor. A full Playwright run writes traces, videos and snapshots; 10 GB
 *  leaves room for that plus the dev server's build cache. Override with
 *  DISK_MIN_FREE_GB. */
export const DEFAULT_MIN_FREE_GB = 10;

/** Pull the Available column out of `df -k`. Throws rather than guesses: a wrong
 *  "plenty of space" reading would silently restore the failure this prevents. */
export function parseFreeBytes(dfOutput: string): number {
  const line = dfOutput.trim().split("\n")[1];
  const kib = Number(line?.trim().split(/\s+/)[3]);
  if (!Number.isFinite(kib)) {
    throw new Error(`preflight-disk: could not read free space from df output:\n${dfOutput}`);
  }
  return kib * 1024;
}

const fmt = (bytes: number) => `${(bytes / GB).toFixed(1)} GB`;

export function assessDisk(
  freeBytes: number,
  minFreeBytes: number,
): { ok: boolean; message: string } {
  if (freeBytes >= minFreeBytes) {
    return { ok: true, message: `Disk preflight OK — ${fmt(freeBytes)} free.` };
  }

  // Nothing below is executed. It is a list of places to look, because a guard
  // that only says "no" gets switched off.
  const message = [
    `Disk preflight FAILED — only ${fmt(freeBytes)} free, ${fmt(minFreeBytes)} required.`,
    ``,
    `Refusing to start Playwright: a run that dies out of disk leaves videos and`,
    `traces behind, which only makes the next run likelier to die.`,
    ``,
    `Nothing has been deleted. Common places this machine hides space:`,
    ``,
    `  ~/Library/Caches/ms-playwright   stale browsers — one Chromium per version`,
    `                                   ever installed; only the newest is used`,
    `  apps/web/e2e-results             last failing run's videos and traces`,
    `  apps/web/.next                   dev/build cache (rebuilds itself)`,
    `  ~/Library/Caches/Google          browser cache (rebuilds itself)`,
    ``,
    `Then re-run. To change the floor: DISK_MIN_FREE_GB=<n>`,
  ].join("\n");

  return { ok: false, message };
}

/** Playwright `globalSetup`. Throwing here aborts the run before the webServer
 *  starts and before a single artifact is written. */
export default function preflightDisk(): void {
  const minFreeGb = Number(process.env.DISK_MIN_FREE_GB ?? DEFAULT_MIN_FREE_GB);
  const df = execFileSync("df", ["-k", process.cwd()], { encoding: "utf8" });
  const { ok, message } = assessDisk(parseFreeBytes(df), minFreeGb * GB);

  if (!ok) throw new Error(`\n\n${message}\n`);
  console.log(message);
}
