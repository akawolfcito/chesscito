import type { WalletShellVariant } from "@/lib/wallet/wallet-shell-variant";

/**
 * The stable hole the app renders while no wallet branch is mounted
 * (spec 2026-08-07-wallet-shell-skeleton).
 *
 * It covers TWO different waits and, on the hub, looks the same in both:
 *   - `undecided` — hydration has not told us which branch this device gets;
 *   - the chunk is in flight — the branch is known, its code is not here yet.
 *
 * WHY IT STOPPED BEING AN EMPTY DIV
 * ---------------------------------
 * Measured under Slow 4G + CPU 4× (docs/audits/2026-08-07-minipay-perceived-load-report.md):
 * a MiniPay player looked at flat `#0b1220` for ~4 s and then the hub appeared
 * whole. Nothing on screen was "contentful", so that emptiness WAS the FCP.
 *
 * ⚠️ `variant` defaults to `plain`. The boundary lives in the ROOT layout, so
 * this shell renders on `/terms`, `/stats`, `/exercises` too — a hub silhouette
 * there would promise a screen that never arrives, which is worse than the
 * blank, because the blank does not lie. A caller that forgets the prop gets
 * the safe answer.
 *
 * It carries NO children and NO wagmi hooks: mounting the app tree here just to
 * move it under the real provider is the double-mount the lazy-branch design
 * exists to avoid.
 */
export function WalletShell({
  variant = "plain",
}: {
  variant?: WalletShellVariant;
}) {
  return (
    <div data-wallet-shell="undecided">
      {variant === "hub" ? <HubSkeleton /> : null}
    </div>
  );
}

/**
 * The hub's silhouette: three bands, no content.
 *
 * ⛔ NO TEXT, NO DATA, NO IMAGES FROM THE REPO. Every block is painted by CSS
 * with an inline `data:` SVG — the primitive EXP1b validated. A `linear-gradient`
 * was measured NOT to advance FCP: the block was on screen at 194 ms and the
 * metric still read 3.928 ms, because Chromium counts image RESOURCES, not
 * paint.
 *
 * ⚠️ It is a FIXED layer, outside the flow. The hub computes its layout as if
 * this had never existed, so its removal cannot move a single element: CLS of
 * the swap is 0 by construction, not by matching measurements. That is also why
 * the silhouette may be approximate — it communicates a shape, it does not
 * trace one.
 */
function HubSkeleton() {
  return (
    <div className="wallet-shell-skeleton" aria-hidden="true">
      <div className="wallet-shell-skeleton-hud">
        <span className="wallet-shell-skeleton-chip" />
        <span className="wallet-shell-skeleton-chip wallet-shell-skeleton-chip--wide" />
      </div>

      <div className="wallet-shell-skeleton-body">
        <div className="wallet-shell-skeleton-rail">
          <span className="wallet-shell-skeleton-slot" />
          <span className="wallet-shell-skeleton-slot" />
          <span className="wallet-shell-skeleton-slot" />
        </div>
        <div className="wallet-shell-skeleton-panel" />
        <div className="wallet-shell-skeleton-rail">
          <span className="wallet-shell-skeleton-slot" />
          <span className="wallet-shell-skeleton-slot" />
        </div>
      </div>

      <div className="wallet-shell-skeleton-cta">
        <span className="wallet-shell-skeleton-button" />
        <span className="wallet-shell-skeleton-button" />
      </div>
    </div>
  );
}
