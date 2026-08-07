/**
 * The stable hole the app renders while no wallet branch is mounted
 * (spec 2026-08-07-wallet-branch-lazy-load, C3).
 *
 * It covers TWO different waits and deliberately looks the same in both:
 *   - `undecided` — hydration has not told us which branch this device gets;
 *   - the chunk is in flight — the branch is known, its code is not here yet.
 *
 * ⚠️ It must occupy the FINAL layout from the very first render. CLS is 0 today
 * and that is an invariant, not an accident: anything that grows or shifts when
 * the branch arrives makes the shell the thing that broke the metric (E2/AC8).
 * That is why it renders no copy, no spinner and no art — an empty box of the
 * window's size shifts nothing when it is replaced.
 *
 * It carries NO children and NO wagmi hooks: mounting the app tree here just to
 * move it under the real provider is the double-mount this whole design exists
 * to avoid (AC7).
 */
export function WalletShell() {
  return <div data-wallet-shell="undecided" />;
}
