import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ChesitoCard } from "../chesito-card";
import { CHESITO_CARD_COPY } from "@/lib/content/editorial";

const usePeonesBalanceMock = vi.fn();
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: () => usePeonesBalanceMock(),
}));

// Stub the rail so the card test stays isolated from the payment flow.
vi.mock("@/components/payments/get-peones-sheet", () => ({
  GetPeonesSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="get-peones-sheet-stub">rail</div> : null,
}));

function mockBalance(state: unknown) {
  usePeonesBalanceMock.mockReturnValue({ state, refetch: vi.fn() });
}

beforeEach(() => {
  usePeonesBalanceMock.mockReset();
});

describe("ChesitoCard", () => {
  it("renders the card title and the balance number on success", () => {
    mockBalance({ kind: "success", balance: 69, dailyEarnedCapped: 0, dailyCap: 10, lastEventAt: null });
    render(<ChesitoCard />);
    expect(screen.getByText(CHESITO_CARD_COPY.title)).toBeInTheDocument();
    expect(screen.getByText("69")).toBeInTheDocument();
  });

  it("shows the loading placeholder while the balance resolves", () => {
    mockBalance({ kind: "loading" });
    render(<ChesitoCard />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("falls back to -- for guest / error (never an aggressive error)", () => {
    mockBalance({ kind: "error" });
    render(<ChesitoCard />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("Top up opens the Get Peones rail and not before", () => {
    mockBalance({ kind: "success", balance: 5, dailyEarnedCapped: 0, dailyCap: 10, lastEventAt: null });
    render(<ChesitoCard />);
    expect(screen.queryByTestId("get-peones-sheet-stub")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: CHESITO_CARD_COPY.topUpAria }));
    expect(screen.getByTestId("get-peones-sheet-stub")).toBeInTheDocument();
  });
});
