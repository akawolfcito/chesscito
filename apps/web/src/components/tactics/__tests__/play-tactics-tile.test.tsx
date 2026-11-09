import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAY_TACTICS_STORAGE_KEY } from "@/lib/tactics/progress";

const openedMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tactics/telemetry", () => ({ emitPlayTacticsOpened: openedMock }));
vi.mock("@/components/tactics/play-tactics-sheet", () => ({
  PlayTacticsSheet: ({ open }: { open: boolean }) =>
    open ? <div>play-tactics-sheet-open</div> : null,
}));
vi.mock("@/components/hub/hub-action-tile", () => ({
  HubActionTile: (props: {
    label: string;
    ariaLabel: string;
    disabled?: boolean;
    onClick: () => void;
    badge?: React.ReactNode;
    iconSlot?: string;
  }) => (
    <button
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      data-icon-slot={props.iconSlot}
      onClick={props.onClick}
    >
      {props.label}{props.badge}
    </button>
  ),
}));

import { PlayTacticsTile } from "../play-tactics-tile";

describe("PlayTacticsTile", () => {
  beforeEach(() => {
    localStorage.clear();
    openedMock.mockReset();
  });

  it("opens the competitive warm-up and emits Play telemetry", async () => {
    render(<PlayTacticsTile />);
    const trigger = screen.getByRole("button", { name: "Open Arena warm-up" });
    expect(trigger).toHaveTextContent("Warm-up");
    expect(trigger).toHaveAttribute("data-icon-slot", "hub.arena-warmup");
    await userEvent.click(trigger);

    expect(screen.getByText("play-tactics-sheet-open")).toBeInTheDocument();
    expect(openedMock).toHaveBeenCalledWith(
      expect.objectContaining({ completedToday: false }),
    );
  });

  it("blocks replay after today's completion", async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      PLAY_TACTICS_STORAGE_KEY,
      JSON.stringify({ lastCompletedDate: today, totalCompleted: 2 }),
    );
    render(<PlayTacticsTile />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Arena warm-up complete for today" }),
      ).toBeDisabled(),
    );
    expect(openedMock).not.toHaveBeenCalled();
  });
});
