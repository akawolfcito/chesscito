/**
 * Seam for non-critical work.
 *
 * ⚠️ **TODAY THIS DOES NOT RUN ANYTHING AFTER THE RESPONSE.** The default is a
 * plain `await`: the caller waits, exactly as it did before this module
 * existed. The name describes the seam's *intent*, not current behaviour — do
 * not read a call to `afterResponse()` as "this is off the critical path",
 * because right now it is not. Decision of 2026-08-03: no `@vercel/functions`,
 * no `waitUntil`, and **no fire-and-forget promises** in this hotfix.
 *
 * ── Why it is a seam and not a `waitUntil` call ───────────────────────────
 *
 * Next 14.2 has no `after()` (that lands in 15) and `waitUntil` on Vercel comes
 * from `@vercel/functions`, which is NOT a dependency of this app. An optional
 * `import("@vercel/functions")` is not a way around that: both vite and webpack
 * resolve dynamic imports statically, so the specifier fails the test run and
 * the production build. It was tried; it broke both.
 *
 * So this module exposes the seam and defaults to awaiting. Awaiting is slower;
 * it is never wrong. The alternative — firing the promise and returning — would
 * let the platform freeze the instance mid-write and lose analytics rows with
 * no error anywhere, which is strictly worse than a few ms of latency on a
 * 204 nobody reads.
 *
 * **Deferred, not rejected:** adding `@vercel/functions` and calling
 * `setAfterResponseRunner(waitUntil)` would make the handoff real. Ruled out
 * for this hotfix on purpose. Note what it would and would not buy: it removes
 * the write from the response's critical path (latency + billed wall time), but
 * the Supabase write still happens, so it does **nothing** for the Disk IO
 * budget. The batching in `lib/telemetry.ts` is what reduces the actual load.
 */

type Runner = (promise: Promise<unknown>) => void;

let runner: Runner | null = null;

/**
 * Install a platform runner (e.g. Vercel's `waitUntil`). Until one is
 * installed, {@link afterResponse} awaits.
 */
export function setAfterResponseRunner(fn: Runner | null): void {
  runner = fn;
}

/**
 * Hand `work` to the installed runner if there is one; otherwise await it.
 * Never throws and never rejects — the caller is a handler that must not fail
 * because a background write failed.
 */
export async function afterResponse(work: () => Promise<unknown>): Promise<void> {
  const promise = (async () => {
    try {
      await work();
    } catch {
      /* swallowed by contract — see the module header */
    }
  })();

  if (runner) {
    runner(promise);
    return;
  }
  await promise;
}

/** Test hook. */
export function __resetAfterResponseRunner(): void {
  runner = null;
}
