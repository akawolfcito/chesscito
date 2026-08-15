/**
 * The duel Arena, rendered for real.
 *
 * ⚠️ The hook, the state machine and the reaction rules run unmocked here —
 * only `fetch` is stubbed. Mocking `useDuel` would leave this file asserting
 * that a component renders the props it was handed, which is the shape of a
 * test that passes while the screen is broken.
 *
 * ⛔ And this still does NOT count as verified: a new surface is not verified
 * until somebody opens it. What this buys is that it MOUNTS, that the board is
 * locked in every state but one, and that the share link is clean.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { DuelArena } from "@/components/duel/duel-arena";
import { toPublic } from "@/lib/duel/lifecycle";
import { createDuel, joinDuel, resignDuel } from "@/lib/duel/operations";
import { hashSeatToken } from "@/lib/duel/seat-token";
import messages from "@/lib/content/messages/en";
import type { DuelColor, DuelPublic } from "@/lib/duel/types";

const ID = "Ab3-_9xYzQwErTyUiOpAs1";
const NOW = Date.now();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function invitation() {
  return createDuel({
    id: ID,
    seat: "w",
    tokenHash: hashSeatToken("white"),
    minutes: 10,
    displayName: "Ana",
    invitedBy: null,
    now: NOW,
  });
}

function game() {
  const joined = joinDuel({
    duel: invitation(),
    tokenHash: hashSeatToken("black"),
    displayName: "Beto",
    presentedToken: null,
    now: NOW,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

function serve(duel: DuelPublic) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, duel }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

function renderArena() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DuelArena duelId={ID} locale="en" sessionId="s" onExit={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "location", {
    value: new URL(
      `https://play.chesscito.com/en/arena?duel=${ID}&privy_oauth_code=leaked`,
    ),
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the states a player actually sees", () => {
  it("offers the free seat to somebody with no credential", async () => {
    serve(toPublic(invitation(), null));
    renderArena();

    expect(await screen.findByText("Join the game")).toBeInTheDocument();
    expect(screen.getByText("Ana wants to play")).toBeInTheDocument();
  });

  it("offers the link, not a seat, to whoever opened the duel", async () => {
    serve(toPublic(invitation(), "w"));
    renderArena();

    expect(await screen.findByText("Share link")).toBeInTheDocument();
    expect(screen.queryByText("Join the game")).not.toBeInTheDocument();
  });

  it("names the move as yours when it is", async () => {
    serve(toPublic(game(), "w"));
    renderArena();

    expect(await screen.findByText("Your move")).toBeInTheDocument();
  });

  it("names the wait when it is theirs", async () => {
    serve(toPublic(game(), "b"));
    renderArena();

    expect(await screen.findByText("Waiting for your rival")).toBeInTheDocument();
  });

  /** The forwarded link mid-game: the board, and nothing to press. */
  it("lets a stranger watch without offering an action", async () => {
    serve(toPublic(game(), null));
    renderArena();

    expect(await screen.findByText("You are watching this game")).toBeInTheDocument();
    expect(screen.queryByText("Resign")).not.toBeInTheDocument();
    expect(screen.queryByText("Join the game")).not.toBeInTheDocument();
  });

  /**
   * ⛔ Reading the SAME ending from both sides. Telling the loser they won is
   * the failure this pair exists to catch.
   */
  it("tells each side the truth about the same ending", async () => {
    const finished = resignDuel({ duel: game(), token: "white", version: 2, now: NOW });
    if (!finished.ok) throw new Error("fixture");

    for (const [seat, line] of [
      ["w", "You resigned."],
      ["b", "Your rival resigned. You win."],
      [null, "The game is over."],
    ] as Array<[DuelColor | null, string]>) {
      serve(toPublic(finished.duel, seat));
      const view = renderArena();
      expect(await screen.findAllByText(line)).not.toHaveLength(0);
      view.unmount();
    }
  });

  it("says nobody answered when the invitation ran out", async () => {
    serve(toPublic({ ...invitation(), status: "expired" }, "w"));
    renderArena();

    expect(await screen.findByText("Nobody answered")).toBeInTheDocument();
  });

  it("says so plainly when the duel is not there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: "not_found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderArena();

    expect(await screen.findByText("This duel does not exist")).toBeInTheDocument();
  });
});

describe("the board is playable in exactly one state", () => {
  /**
   * ⛔ Asserted by PLAYING, not by reading a prop.
   *
   * ⚠️ And the first version of this test asserted on `button[disabled]`,
   * which does not exist: `ArenaBoard` never disables its cells, it just
   * ignores the click when locked. That is worth knowing for two reasons — the
   * test would have passed for the wrong reason, and a locked board carries NO
   * signal a screen reader can read. The second one is a pre-existing gap of
   * the AI arena too, and is reported rather than quietly patched here.
   *
   * So: tap the piece, tap its destination, and see whether a move was sent.
   */
  it("sends a move only on your turn", async () => {
    const cases: Array<[string, DuelPublic, boolean]> = [
      ["your turn", toPublic(game(), "w"), true],
      ["their turn", toPublic(game(), "b"), false],
      ["watching", toPublic(game(), null), false],
      ["inviting", toPublic(invitation(), "w"), false],
      ["invited", toPublic(invitation(), null), false],
    ];

    for (const [label, duel, expectSent] of cases) {
      serve(duel);
      const view = renderArena();
      await waitFor(() =>
        expect(view.container.querySelector('[data-square="e2"]')).toBeTruthy(),
      );

      // ⚠️ One `act` per tap. Firing both in the same tick would leave the
      // second click reading the legal moves from BEFORE the piece was
      // selected, so it would find none and send nothing — a green "no move
      // was sent" for entirely the wrong reason.
      await act(async () => {
        view.container.querySelector<HTMLElement>('[data-square="e2"]')?.click();
      });
      await act(async () => {
        view.container.querySelector<HTMLElement>('[data-square="e4"]')?.click();
      });

      await waitFor(() => {
        const posted = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/move") && (init as RequestInit)?.method === "POST",
        );
        expect({ label, posted }).toEqual({ label, posted: expectSent });
      });
      view.unmount();
      vi.clearAllMocks();
    }
  });
});

describe("the share link", () => {
  /**
   * ⛔ THE MEASURED RULE, checked where it actually ships. The address bar in
   * this test carries `privy_oauth_code` on purpose: that is what it looks like
   * right after the login round trip, and a share button built from
   * `window.location.href` would put the inviter's OAuth code in their friend's
   * hands.
   */
  it("is built from the duel id, never from the address bar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    serve(toPublic(invitation(), "w"));
    renderArena();

    (await screen.findByText("Share link")).click();

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = writeText.mock.calls[0][0] as string;
    expect(link).toBe(`https://play.chesscito.com/en/arena?duel=${ID}`);
    expect(link).not.toContain("privy");
  });
});
