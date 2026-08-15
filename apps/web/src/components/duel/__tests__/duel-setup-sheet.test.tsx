import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { DuelSetupSheet } from "@/components/duel/duel-setup-sheet";
import { readStoredSeatToken } from "@/lib/duel/seat-store";
import messages from "@/lib/content/messages/en";

const ID = "Ab3-_9xYzQwErTyUiOpAs1";

function renderSheet(onCreated = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DuelSetupSheet sessionId="s" onCreated={onCreated} onCancel={vi.fn()} />
    </NextIntlClientProvider>,
  );
  return { view, onCreated };
}

function serveCreated() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ ok: true, duel: { id: ID }, seatToken: "issued-credential" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const tap = async (label: string) => {
  await act(async () => {
    screen.getByLabelText(label).click();
  });
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the ladder is the whole validation", () => {
  it("opens on the default of ten minutes", () => {
    serveCreated();
    renderSheet();

    expect(screen.getByText("10 min")).toBeInTheDocument();
  });

  it("walks its seven rungs and no others", async () => {
    serveCreated();
    renderSheet();

    await tap("Less time");
    expect(screen.getByText("5 min")).toBeInTheDocument();
    await tap("More time");
    await tap("More time");
    expect(screen.getByText("15 min")).toBeInTheDocument();
  });

  /** ⛔ Clamps instead of wrapping. Wrapping at the top would put a thumb one
   *  extra tap away from a 30 second game it did not ask for. */
  it("stops at both ends instead of wrapping around", async () => {
    serveCreated();
    renderSheet();

    for (let i = 0; i < 10; i += 1) await tap("More time");
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByLabelText("More time")).toBeDisabled();

    for (let i = 0; i < 10; i += 1) await tap("Less time");
    expect(screen.getByText("30 sec")).toBeInTheDocument();
    expect(screen.getByLabelText("Less time")).toBeDisabled();
  });

  /** The bottom rung is half a minute, and it reads as seconds rather than as
   *  "0.5 min", which nobody says out loud. */
  it("says the bottom rung in seconds", async () => {
    serveCreated();
    renderSheet();

    for (let i = 0; i < 6; i += 1) await tap("Less time");
    expect(screen.getByText("30 sec")).toBeInTheDocument();
  });
});

describe("creating the duel", () => {
  it("sends the rung the player chose", async () => {
    const fetchMock = serveCreated();
    renderSheet();

    await tap("Less time");
    await act(async () => {
      screen.getByText("Create and share").click();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.minutes).toBe(5);
  });

  /**
   * ⛔ The credential is PARKED BEFORE the caller is told to navigate. The
   * navigation that follows must not be able to race the write: a token lost
   * to that race leaves the creator watching their own duel unable to move,
   * with no way to recover it.
   */
  it("stores the credential before handing over the duel id", async () => {
    serveCreated();
    let storedWhenCalled: string | null = null;
    const onCreated = vi.fn(() => {
      storedWhenCalled = readStoredSeatToken(ID);
    });
    renderSheet(onCreated);

    await act(async () => {
      screen.getByText("Create and share").click();
    });

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ID));
    expect(storedWhenCalled).toBe("issued-credential");
  });

  /** ⚠️ A failure keeps the sheet open with the rung intact. Closing it would
   *  make the player pick the clock again for a duel that never existed. */
  it("keeps the sheet and the chosen clock when the server refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { onCreated } = renderSheet();

    await tap("More time");
    await act(async () => {
      screen.getByText("Create and share").click();
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText("15 min")).toBeInTheDocument();
  });
});
