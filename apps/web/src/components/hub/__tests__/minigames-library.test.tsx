import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";

import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import { MiniGamesLibrary } from "@/components/hub/minigames-library";
import { labyrinthBestStorageKey } from "@/lib/lite-progress-storage";
import type { PieceId } from "@/lib/game/types";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import {
  currentWindowId,
  MINIGAME_WINDOW_STORAGE_KEY,
} from "@/lib/minigames/daily-window";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pool = resolveChallengePool(defaultMiniGamePools());

beforeEach(() => {
  localStorage.clear();
  pushMock.mockClear();
  trackMock.mockClear();
});

/** Seed the window the way the Home writes it. */
function assign(challengeIds: readonly string[]) {
  localStorage.setItem(
    MINIGAME_WINDOW_STORAGE_KEY,
    JSON.stringify({ windowId: currentWindowId(), assigned: [...challengeIds] }),
  );
}

/** Mark challenges completed the way the game does: a recorded best. */
function complete(challengeIds: readonly string[]) {
  const byPiece: Record<string, Record<string, number>> = {};
  for (const id of challengeIds) {
    const entry = pool.find((candidate) => candidate.challengeId === id)!;
    byPiece[entry.piece] = { ...(byPiece[entry.piece] ?? {}), [id]: 6 };
  }
  for (const [piece, bests] of Object.entries(byPiece)) {
    localStorage.setItem(
      labyrinthBestStorageKey(piece as PieceId),
      JSON.stringify(bests),
    );
  }
}

/* ⚠️ No authored title is pinned as an expected value. The pool is read and
 * expectations are derived from it. */

describe("L-1 — today's assigned challenges are playable", () => {
  it("lists exactly what the window assigned", () => {
    const today = pool.slice(0, 3).map((entry) => entry.challengeId);
    assign(today);
    render(<MiniGamesLibrary />);

    expect(screen.getByTestId("library-section-today")).toBeInTheDocument();
    for (const id of today) {
      expect(screen.getByTestId(`library-challenge-${id}`)).toBeInTheDocument();
    }
  });

  it("routes them through the same boundary Featured uses", () => {
    const target = pool[0]!.challengeId;
    assign([target]);
    render(<MiniGamesLibrary />);

    fireEvent.click(screen.getByTestId(`library-challenge-${target}`));
    expect(pushMock).toHaveBeenCalledWith(`/exercises?content=${target}&from=library`);
  });
});

describe("L-2 — completed challenges stay replayable", () => {
  it("lists them under their own section, tappable", () => {
    const done = pool[0]!.challengeId;
    complete([done]);
    assign([pool[1]!.challengeId]);
    render(<MiniGamesLibrary />);

    const row = screen.getByTestId(`library-challenge-${done}`);
    expect(row).toHaveAttribute("data-completed", "true");
    expect(row).not.toBeDisabled();
    expect(screen.getByTestId("library-section-completed")).toContainElement(row);
  });

  it("tells a replay apart from a first start, without a new event", () => {
    const done = pool[0]!.challengeId;
    complete([done]);
    render(<MiniGamesLibrary />);

    fireEvent.click(screen.getByTestId(`library-challenge-${done}`));
    expect(trackMock).toHaveBeenCalledWith(
      "minigame_start",
      expect.objectContaining({ challenge_id: done, entry: "library_replay" }),
    );
  });
});

describe("L-3 / D-9 — future unseen challenges are NOT playable", () => {
  /** ⛔ THIS IS THE GATE. Before the daily allowance the Library listed all 13
   *  as playable, so a player could walk straight past the window and burn the
   *  catalogue from here instead of the Home. */
  it("renders no row for a challenge that is neither assigned nor completed", () => {
    const today = pool.slice(0, 2).map((entry) => entry.challengeId);
    assign(today);
    render(<MiniGamesLibrary />);

    for (const entry of pool) {
      const listed = screen.queryByTestId(`library-challenge-${entry.challengeId}`);
      if (today.includes(entry.challengeId)) {
        expect(listed).toBeInTheDocument();
      } else {
        expect(listed).toBeNull();
      }
    }
  });

  it("shows one quiet line instead of a wall of locks", () => {
    assign(pool.slice(0, 3).map((entry) => entry.challengeId));
    render(<MiniGamesLibrary />);

    const upcoming = screen.getByTestId("library-upcoming");
    // ⛔ Not a button: there is nothing to do with it today, and a
    // disabled-looking control invites taps that go nowhere.
    expect(upcoming.tagName).toBe("P");
    // ⛔ And no number: naming it re-introduces the catalogue size the Home
    // just stopped showing.
    expect(upcoming.textContent ?? "").not.toMatch(/\d/);
  });

  it("drops the upcoming line once nothing is left unseen", () => {
    complete(pool.map((entry) => entry.challengeId));
    render(<MiniGamesLibrary />);
    expect(screen.queryByTestId("library-upcoming")).toBeNull();
  });
});

describe("L-4 — a replenished challenge becomes playable", () => {
  it("plays once the window assigns it, and not before", () => {
    const future = pool[5]!.challengeId;

    assign([pool[0]!.challengeId]);
    const first = render(<MiniGamesLibrary />);
    expect(screen.queryByTestId(`library-challenge-${future}`)).toBeNull();
    first.unmount();

    assign([pool[0]!.challengeId, future]);
    render(<MiniGamesLibrary />);
    fireEvent.click(screen.getByTestId(`library-challenge-${future}`));
    expect(pushMock).toHaveBeenCalledWith(`/exercises?content=${future}&from=library`);
  });
});

describe("L-5 — nothing is orphaned", () => {
  it("every listed row belongs to the healthy pool", () => {
    assign(pool.slice(0, 3).map((entry) => entry.challengeId));
    complete([pool[7]!.challengeId]);
    render(<MiniGamesLibrary />);

    const ids = new Set(pool.map((entry) => entry.challengeId));
    for (const row of screen.getAllByTestId(/^library-challenge-/)) {
      const id = (row.getAttribute("data-testid") ?? "").replace(
        "library-challenge-",
        "",
      );
      expect(ids.has(id)).toBe(true);
    }
  });

  it("lists no coming-soon or retired content, ever", () => {
    assign(pool.slice(0, 3).map((entry) => entry.challengeId));
    render(<MiniGamesLibrary />);
    for (const id of ["knight-tour-1", "pawn-promotion-2", "bishop-lab-3", "rook-lab-1"]) {
      expect(screen.queryByTestId(`library-challenge-${id}`)).toBeNull();
    }
  });
});

describe("the Library reads the window but never writes it", () => {
  /** ⛔ The Home's `MiniGamesSlot` is the single writer. Two writers would race
   *  across a midnight boundary and hand the player two different assignments. */
  it("leaves stored state untouched on a fresh device", () => {
    render(<MiniGamesLibrary />);
    expect(localStorage.getItem(MINIGAME_WINDOW_STORAGE_KEY)).toBeNull();
  });

  it("does not rewrite an existing assignment", () => {
    assign([pool[0]!.challengeId]);
    const before = localStorage.getItem(MINIGAME_WINDOW_STORAGE_KEY);
    render(<MiniGamesLibrary />);
    expect(localStorage.getItem(MINIGAME_WINDOW_STORAGE_KEY)).toBe(before);
  });

  it("offers a way back to the home", () => {
    render(<MiniGamesLibrary />);
    fireEvent.click(screen.getByTestId("minigames-library-back"));
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows no catalogue count anywhere", () => {
    assign(pool.slice(0, 3).map((entry) => entry.challengeId));
    render(<MiniGamesLibrary />);
    expect(screen.queryByTestId("minigames-library-progress")).toBeNull();
  });
});
