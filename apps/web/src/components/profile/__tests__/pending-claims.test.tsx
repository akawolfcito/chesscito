import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, fireEvent } from "@testing-library/react";
import { PendingClaims } from "@/components/profile/pending-claims";
import type { Claim } from "@/lib/claims/queue";

const sampleClaims: Claim[] = [
  { id: "badge-1", kind: "badge", badgeId: 1n, costGasOnly: true },
  { id: "score-rook-l3", kind: "score", scoreKey: "rook-l3", points: 540, costGasOnly: true },
];

describe("<PendingClaims>", () => {
  it("does not render the section at all when claims is empty", () => {
    const { container } = render(
      <PendingClaims claims={[]} inFlight={new Set()} onClaim={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per claim (no Claim All in v1)", () => {
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getAllByRole("button", { name: /^claim$/i })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /claim all/i })).not.toBeInTheDocument();
  });

  it("fires onClaim with claim object when row CTA tapped", () => {
    const onClaim = vi.fn();
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={onClaim} onRefresh={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^claim$/i })[0]);
    expect(onClaim).toHaveBeenCalledWith(sampleClaims[0]);
  });

  it("shows in-flight label when claim id is in inFlight set", () => {
    render(
      <PendingClaims
        claims={sampleClaims}
        inFlight={new Set([sampleClaims[0].id])}
        onClaim={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/in flight/i)).toBeInTheDocument();
  });

  it("fires onRefresh when refresh button tapped", () => {
    const onRefresh = vi.fn();
    render(
      <PendingClaims claims={sampleClaims} inFlight={new Set()} onClaim={vi.fn()} onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalled();
  });
});
