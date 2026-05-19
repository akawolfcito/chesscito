import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeaderboardSheet } from "../leaderboard-sheet";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

describe("LeaderboardSheet — showTrigger gate", () => {
  it("renders the dock trigger by default", () => {
    render(<LeaderboardSheet open={false} onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /leaders/i })).toBeInTheDocument();
  });

  it("omits the orphan trigger when showTrigger is false", () => {
    render(
      <LeaderboardSheet open={false} onOpenChange={() => {}} showTrigger={false} />,
    );
    expect(screen.queryByRole("button", { name: /leaders/i })).not.toBeInTheDocument();
  });
});
