import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAY_TACTICS_STORAGE_KEY } from "@/lib/tactics/progress";

const trackMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));
vi.mock("@/components/daily/daily-tactic-sheet", () => ({
  DailyTacticSheet: (props: {
    onSolve: (moves: number) => void;
    onFail?: (moves: number) => void;
    experience?: string;
  }) => (
    <div data-experience={props.experience}>
      <button onClick={() => props.onSolve(1)}>solve-play-tactic</button>
      <button onClick={() => props.onFail?.(1)}>fail-play-tactic</button>
    </div>
  ),
}));

import { PlayTacticsSheet } from "../play-tactics-sheet";

const LEARN_STATE = {
  "chesscito:daily-progress": JSON.stringify({ streak: 7, totalCompleted: 9 }),
  "chesscito:daily-session": JSON.stringify({ consumed: 2 }),
  "chesscito:welcome-package": JSON.stringify({ unlocked: false }),
  "chesscito:learn:challenge": JSON.stringify({ day: 3 }),
};

describe("PlayTacticsSheet isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const [key, value] of Object.entries(LEARN_STATE)) localStorage.setItem(key, value);
    trackMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("completes using only Play storage and Play telemetry", async () => {
    render(<PlayTacticsSheet open onOpenChange={vi.fn()} onCompleted={vi.fn()} />);
    await userEvent.click(screen.getByText("solve-play-tactic"));

    for (const [key, value] of Object.entries(LEARN_STATE)) {
      expect(localStorage.getItem(key)).toBe(value);
    }
    expect(localStorage.getItem(PLAY_TACTICS_STORAGE_KEY)).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith(
      "play_tactics_completed",
      expect.objectContaining({ movesUsed: 1 }),
    );
    expect(trackMock.mock.calls.flat().join(" ")).not.toMatch(/daily|focus|challenge|passport|peones/i);
  });

  it("emits Play failure telemetry without changing any storage", async () => {
    render(<PlayTacticsSheet open onOpenChange={vi.fn()} onCompleted={vi.fn()} />);
    await userEvent.click(screen.getByText("fail-play-tactic"));
    expect(localStorage.getItem(PLAY_TACTICS_STORAGE_KEY)).toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "play_tactics_failed",
      expect.objectContaining({ movesUsed: 1 }),
    );
  });
});
