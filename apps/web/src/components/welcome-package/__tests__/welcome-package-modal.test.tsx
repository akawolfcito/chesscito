import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { WelcomePackageModal } from "../welcome-package-modal";

describe("<WelcomePackageModal>", () => {
  it("renders title, subtitle, body text", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("You did it.")).toBeInTheDocument();
    expect(screen.getByText("Your first Focus Day is complete.")).toBeInTheDocument();
    expect(screen.getByText("Here's something to mark the moment.")).toBeInTheDocument();
  });

  it("renders claim CTA button", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^claim$/i })).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /later/i })).toBeInTheDocument();
  });

  it("calls onClaim when claim button is tapped", () => {
    const onClaim = vi.fn();
    render(<WelcomePackageModal onClaim={onClaim} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^claim$/i }));
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when dismiss button is tapped", () => {
    const onDismiss = vi.fn();
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /later/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows stamp fallback text 'Focus Stamp: Day 1' when no asset", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Focus Stamp: Day 1")).toBeInTheDocument();
  });

  it("copy contains no prohibited terms", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />);
    const text = document.body.textContent ?? "";
    const prohibited = ["mint", "nft", "on-chain", "proof", "verified", "blockchain", "brain health", "cure", "improves memory", "improves focus"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});

describe("<WelcomePackageModal> claimed state", () => {
  it("shows claimed confirmation message when claimed=true", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} claimed />);
    expect(screen.getByText(/focus stamp.*day 1.*saved/i)).toBeInTheDocument();
  });

  it("does not show claim/dismiss buttons when claimed=true", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} claimed />);
    expect(screen.queryByRole("button", { name: /^claim$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /later/i })).toBeNull();
  });
});

describe("<WelcomePackageModal> phase=signing", () => {
  it("shows signing title", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="signing" />);
    expect(screen.getByTestId("wp-signing-title")).toBeInTheDocument();
    expect(screen.getByText("Saving your gift...")).toBeInTheDocument();
  });

  it("does not show claim or dismiss buttons while signing", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="signing" />);
    expect(screen.queryByRole("button", { name: /^claim$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /later/i })).toBeNull();
  });

  it("signing copy contains no prohibited terms", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="signing" />);
    const text = document.body.textContent ?? "";
    const prohibited = ["on-chain", "nft", "mint", "tx hash", "ledger", "smart contract"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});

describe("<WelcomePackageModal> phase=success", () => {
  it("shows success title and body", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="success" />);
    expect(screen.getByTestId("wp-success-title")).toBeInTheDocument();
    expect(screen.getByText("Welcome Gift Claimed")).toBeInTheDocument();
    expect(screen.getByText(/your first chesscito reward is ready/i)).toBeInTheDocument();
  });

  it("shows Continue CTA", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="success" />);
    expect(screen.getByTestId("wp-success-cta")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("calls onSuccess when Continue is tapped", () => {
    const onSuccess = vi.fn();
    render(
      <WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="success" onSuccess={onSuccess} />,
    );
    fireEvent.click(screen.getByTestId("wp-success-cta"));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("success copy contains no prohibited terms", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="success" />);
    const text = document.body.textContent ?? "";
    const prohibited = ["on-chain", "nft", "mint", "tx hash", "ledger", "smart contract", "proof"];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});

describe("<WelcomePackageModal> phase=error", () => {
  it("shows error body and retry CTA", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="error" />);
    expect(screen.getByTestId("wp-error-body")).toBeInTheDocument();
    expect(screen.getByTestId("wp-retry-cta")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows dismiss link in error state", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="error" />);
    expect(screen.getByRole("button", { name: /later/i })).toBeInTheDocument();
  });

  it("calls onRetry when Try again is tapped", () => {
    const onRetry = vi.fn();
    render(
      <WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="error" onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByTestId("wp-retry-cta"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when Later is tapped in error state", () => {
    const onDismiss = vi.fn();
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={onDismiss} phase="error" />);
    fireEvent.click(screen.getByRole("button", { name: /later/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("<WelcomePackageModal> ES locale", () => {
  it("renders ES title and CTA", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} />, { locale: "es" });
    expect(screen.getByText("Lo lograste.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reclamar/i })).toBeInTheDocument();
  });

  it("renders ES success title", () => {
    render(<WelcomePackageModal onClaim={vi.fn()} onDismiss={vi.fn()} phase="success" />, { locale: "es" });
    expect(screen.getByText("Welcome Gift recibido")).toBeInTheDocument();
  });
});

/* ── ⛔ THE SIGNING PHASE MUST NEVER BE A DEAD END ──────────────────────────
 * Reported from the MiniPay smoke (2026-08-20): "Saving your gift… / Sign in
 * your wallet…" with no way out — it never finished and never closed.
 *
 * The mechanism, read from `use-lite-welcome-gift-claim.ts`: the phase only
 * leaves `signing` through `signMessageAsync().then` or `.catch`. A wallet that
 * neither resolves NOR rejects — a Privy/MiniPay provider in a bad state, which
 * the founder's own console showed ("Wallet did not respond to eth_accounts",
 * `drpc` 500s) — fires neither, so the phase is stuck forever. And the shell
 * was mounted with `onClose={isSigning ? undefined : …}`, so there was no exit.
 *
 * Blocking the close DURING a signature is right; blocking it FOREVER is not.
 * After a grace period the modal offers the way out again.
 *
 * ⚠️ The escape must NOT cancel the pending signature: a slow-but-valid
 * signature that lands later still claims the gift. That is why this is an
 * escape hatch and not a timeout-to-error — flipping to "Something went wrong"
 * while the wallet sheet is still open would be a lie. */
describe("<WelcomePackageModal> — the signing phase always has an exit", () => {
  it("hides the close affordance while a signature is fresh", () => {
    render(
      <WelcomePackageModal phase="signing" onClaim={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByTestId("wp-signing-title")).toBeInTheDocument();
    expect(screen.queryByTestId("wp-signing-escape")).toBeNull();
  });

  it("offers a way out once the signature has clearly stalled", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(
        <WelcomePackageModal
          phase="signing"
          onClaim={vi.fn()}
          onDismiss={onDismiss}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      const escape = screen.getByTestId("wp-signing-escape");
      fireEvent.click(escape);
      expect(onDismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not arm the escape on any phase other than signing", () => {
    vi.useFakeTimers();
    try {
      render(<WelcomePackageModal phase="idle" onClaim={vi.fn()} onDismiss={vi.fn()} />);
      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(screen.queryByTestId("wp-signing-escape")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
