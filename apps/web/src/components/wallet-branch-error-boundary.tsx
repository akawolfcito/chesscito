"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Terminal state for ONE wallet branch (spec 2026-08-07-wallet-branch-lazy-load,
 * E3 / C2b).
 *
 * WHY A CLASS, AND WHY IT CANNOT BE A HOOK
 * ----------------------------------------
 * A class is the only thing React offers that catches errors thrown during
 * RENDER. That matters here because the branch has two independent ways to
 * fail and both must land in the same place:
 *
 *   1. the lazy `import()` rejects — network gone, deploy rotated mid-session;
 *   2. `requirePrivyAppId()` throws while the branch MOUNTS — a real
 *      configuration failure that, once the branch is lazy, stops being
 *      "page broken instantly" and would otherwise become "shell forever".
 *
 * `<Suspense>` handles neither: its fallback cannot tell "still loading" from
 * "will never load", and that ambiguity is exactly the defect E3 exists to
 * remove.
 *
 * WHAT THIS DOES NOT OWN
 * ----------------------
 * Only `failed`. `loading` belongs to `<Suspense>` and `mounted` belongs to the
 * branch itself (founder, 2026-08-07). Modelling all three here would mean
 * duplicating React's own state machine or inventing callbacks to learn facts
 * React already knows — and a second copy of a state machine drifts from the
 * first on the next change.
 */
type Props = {
  children: ReactNode;
  /** Recovery, provided by the owner. MUST produce a genuinely new attempt —
   *  see the caller. Re-invoking the same `import()` returns the SAME rejected
   *  promise from cache without touching the network, which would make this
   *  button a lie. */
  onRetry: () => void;
};

type State = { failed: boolean };

export class WalletBranchErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only, deliberately: this spec ships no telemetry. Left explicit so
    // the next reader knows the silence is a decision, not an oversight.
    console.error("[wallet-branch] failed to mount:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <WalletBranchLoadError
        onRetry={() => {
          // Clearing the flag alone would re-render straight back into the same
          // rejected module. The owner's `onRetry` is what makes the next
          // attempt real; this only reopens the door for it.
          this.setState({ failed: false });
          this.props.onRetry();
        }}
      />
    );
  }
}

/** Split out so the copy can use `useTranslations`, which a class cannot call. */
function WalletBranchLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("WALLET_LOAD_ERROR_COPY");

  return (
    <div className="wallet-load-error" role="alert">
      <p className="wallet-load-error-title">{t("title")}</p>
      <p className="wallet-load-error-body">{t("body")}</p>
      <button type="button" onClick={onRetry} className="wallet-load-error-retry">
        {t("retry")}
      </button>
    </div>
  );
}
