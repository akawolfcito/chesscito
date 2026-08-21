import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";

import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import { MiniGamesLibrary } from "@/components/hub/minigames-library";
import { labyrinthBestStorageKey } from "@/lib/lite-progress-storage";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pool = resolveChallengePool(defaultMiniGamePools());

beforeEach(() => {
  localStorage.clear();
  pushMock.mockClear();
  trackMock.mockClear();
});

/** ⚠️ Nothing here pins an authored TITLE. The pool is read and the
 *  expectations are derived from it, so renaming a level in the builder cannot
 *  turn this suite red for a content reason. Ids are structural (they are what
 *  the deep link carries); titles are content. */

describe("L-1 — every healthy challenge is reachable", () => {
  it("lists all of them, exactly once", () => {
    render(<MiniGamesLibrary />);
    const rows = screen.getAllByTestId(/^library-challenge-/);
    expect(rows).toHaveLength(pool.length);
    const ids = rows.map((row) => row.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(pool.length);
  });

  it("has a row for each id the queue knows about", () => {
    render(<MiniGamesLibrary />);
    for (const entry of pool) {
      expect(
        screen.getByTestId(`library-challenge-${entry.challengeId}`),
      ).toBeInTheDocument();
    }
  });

  it("groups them by game, with no empty group", () => {
    render(<MiniGamesLibrary />);
    const groups = screen.getAllByTestId(/^library-group-/);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.querySelectorAll("[data-testid^='library-challenge-']").length)
        .toBeGreaterThan(0);
    }
  });
});

describe("L-2 — retired ids are absent", () => {
  it("lists nothing the projection dropped", () => {
    render(<MiniGamesLibrary />);
    for (const retired of ["bishop-lab-3", "knight-lab-1", "queen-lab-1", "rook-lab-1"]) {
      expect(screen.queryByTestId(`library-challenge-${retired}`)).toBeNull();
    }
  });
});

describe("L-3 — coming-soon engines are absent, never playable", () => {
  /** ⛔ ABSENT, not greyed. A row that cannot be played is a dead end dressed
   *  as content — the exact family of defect this whole pass is closing. */
  it("renders no group for a coming-soon engine", () => {
    render(<MiniGamesLibrary />);
    expect(screen.queryByTestId("library-group-knight-tour")).toBeNull();
    expect(screen.queryByTestId("library-group-promotion-run")).toBeNull();
  });

  it("renders no row for any of their challenges", () => {
    render(<MiniGamesLibrary />);
    for (const id of ["knight-tour-1", "pawn-promotion-2"]) {
      expect(screen.queryByTestId(`library-challenge-${id}`)).toBeNull();
    }
  });
});

describe("L-4 — a tap routes to the canonical board", () => {
  it("uses the SAME route boundary Featured uses, tagged as library", () => {
    render(<MiniGamesLibrary />);
    const target = pool[0]!;
    fireEvent.click(screen.getByTestId(`library-challenge-${target.challengeId}`));
    expect(pushMock).toHaveBeenCalledWith(
      `/exercises?content=${target.challengeId}&from=library`,
    );
  });

  it("routes every listed challenge, not just the first", () => {
    render(<MiniGamesLibrary />);
    for (const entry of pool) {
      pushMock.mockClear();
      fireEvent.click(screen.getByTestId(`library-challenge-${entry.challengeId}`));
      expect(pushMock).toHaveBeenCalledWith(
        `/exercises?content=${entry.challengeId}&from=library`,
      );
    }
  });

  it("reuses the existing start event with entry=library — no new event family", () => {
    render(<MiniGamesLibrary />);
    const target = pool[0]!;
    fireEvent.click(screen.getByTestId(`library-challenge-${target.challengeId}`));
    expect(trackMock).toHaveBeenCalledWith(
      "minigame_start",
      expect.objectContaining({
        challenge_id: target.challengeId,
        game_id: target.engineId,
        entry: "library",
      }),
    );
  });
});

describe("R-8 — a completed challenge stays listed and stays tappable", () => {
  function completeFirst() {
    const target = pool[0]!;
    localStorage.setItem(
      labyrinthBestStorageKey(target.piece),
      JSON.stringify({ [target.challengeId]: 7 }),
    );
    return target;
  }

  it("marks it completed without removing or disabling it", () => {
    const target = completeFirst();
    render(<MiniGamesLibrary />);
    const row = screen.getByTestId(`library-challenge-${target.challengeId}`);
    expect(row).toHaveAttribute("data-completed", "true");
    // Replay is the point of the Library: a completed row is a live control.
    expect(row).not.toBeDisabled();
  });

  it("still routes it, so a replay is one tap", () => {
    const target = completeFirst();
    render(<MiniGamesLibrary />);
    fireEvent.click(screen.getByTestId(`library-challenge-${target.challengeId}`));
    expect(pushMock).toHaveBeenCalledWith(
      `/exercises?content=${target.challengeId}&from=library`,
    );
  });

  it("counts it in the progress signal", () => {
    completeFirst();
    render(<MiniGamesLibrary />);
    expect(screen.getByTestId("minigames-library-progress")).toHaveTextContent(
      `1/${pool.length}`,
    );
  });

  it("reports zero completed on a fresh device", () => {
    render(<MiniGamesLibrary />);
    expect(screen.getByTestId("minigames-library-progress")).toHaveTextContent(
      `0/${pool.length}`,
    );
  });
});

describe("the Library is a destination, not a dead end", () => {
  it("offers a way back to the home", () => {
    render(<MiniGamesLibrary />);
    fireEvent.click(screen.getByTestId("minigames-library-back"));
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
