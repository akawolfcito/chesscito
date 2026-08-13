/**
 * The board must still be there after a save.
 *
 * ⚠️ Founder, while authoring: change a board → Save draft → "me puso en un
 * tablero completamente en blanco… si quiero actualizar otra vez el mismo
 * tablero tengo que ir a buscar la pieza y volver a editar". On the single most
 * repeated action in the tool.
 *
 * A save writes `content/*.json` and the generated catalog, both inside the tree
 * Next dev watches, so Fast Refresh REMOUNTS the page and every useState resets.
 * These cases reproduce that by unmounting and rendering again — which is what
 * the reload does — and nothing else here would catch it, because within a
 * single mount the state never goes anywhere.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LabyrinthBuilderPage from "../page";

const RECORDS = [
  {
    id: "probe-first",
    piece: "rook",
    order: 0,
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    mover: "a1",
    target: "h1",
    tier: "easy",
    explanation: "First probe record",
    bucket: "exercise",
  },
];

/** @param saveLands whether the baseline write succeeds */
function stubFetch(saveLands: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        typeof url === "string" && url.includes("/api/dev/publish")
          ? {
              ok: saveLands,
              baseline: saveLands
                ? { ok: true, warnings: [] }
                : { ok: false, errors: ["nope"], warnings: [] },
              overlay: { ok: saveLands },
            }
          : { ok: true, records: RECORDS, canWrite: true };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const description = () =>
  screen.getByRole("textbox", { name: /^description/i });
const unsaved = () => screen.queryByTestId("lb-unsaved");

/** Load the record, edit it, save it — then do what Fast Refresh does. */
async function editSaveAndReload(saveLands: boolean) {
  stubFetch(saveLands);
  const user = userEvent.setup();
  const view = render(<LabyrinthBuilderPage />);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /Edit$/ })).toHaveLength(1),
  );
  await user.click(screen.getByRole("button", { name: /Edit$/ }));
  await waitFor(() => expect(description()).toHaveValue("First probe record"));

  await user.clear(description());
  await user.type(description(), "Changed while authoring");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Save draft/ })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: /Save draft/ }));
  await waitFor(() => expect(screen.getByText(/Saved as draft|Save failed/)).toBeInTheDocument());

  // ── what the save's own file writes do to this page ──
  view.unmount();
  render(<LabyrinthBuilderPage />);
  return user;
}

describe("the draft is parked BEFORE the request goes out", () => {
  it("is already in storage while the save is still in flight", async () => {
    /* ⛔ The race, and the reason the first attempt at this feature did not work
       for the founder. The server writes content/*.json DURING the fetch, so
       Next's watcher can fire Fast Refresh before the response is ever read —
       every statement after `await` may simply never run. Parking the draft
       there loses it. (The toast was parked one statement earlier, which is
       exactly why the message kept coming back and the board did not.) */
    let release!: () => void;
    const inFlight = new Promise<void>((r) => (release = r));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (typeof url === "string" && url.includes("/api/dev/publish")) {
          await inFlight; // the save hangs — as if the reload beat the response
          return new Response(
            JSON.stringify({
              ok: true,
              baseline: { ok: true, warnings: [] },
              overlay: { ok: true },
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, records: RECORDS, canWrite: true }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );

    const user = userEvent.setup();
    render(<LabyrinthBuilderPage />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Edit$/ })).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: /Edit$/ }));
    await waitFor(() => expect(description()).toHaveValue("First probe record"));
    await user.click(screen.getByRole("button", { name: /Save draft/ }));

    // The response has NOT arrived, and the draft is already safe.
    const parked = window.sessionStorage.getItem("chesscito:builder-draft");
    expect(parked).toBeTruthy();
    expect(JSON.parse(parked!).state.id).toBe("probe-first");
    // …and marked unsaved, because at this instant nothing has landed on disk.
    expect(JSON.parse(parked!).savedOk).toBe(false);

    release();
  });
});

describe("the draft survives the reload a save causes", () => {
  it("comes back on the SAME record, not a blank board", async () => {
    await editSaveAndReload(true);

    await waitFor(() =>
      expect(description()).toHaveValue("Changed while authoring"),
    );
    // And still identifiably ON it — no hunting through the piece picker.
    expect(screen.getByRole("textbox", { name: /^id/i })).toHaveValue(
      "probe-first",
    );
  });

  it("comes back CLEAN when the save landed", async () => {
    await editSaveAndReload(true);
    await waitFor(() =>
      expect(description()).toHaveValue("Changed while authoring"),
    );
    // Disk has it, so there is nothing to warn about.
    expect(unsaved()).not.toBeInTheDocument();
  });

  it("comes back DIRTY when the save did NOT land", async () => {
    // ⛔ The dangerous direction. A failed save left nothing on disk; restoring
    // the work as "clean" would tell the unsaved-changes guard there is nothing
    // to lose, and the next click would destroy it silently.
    await editSaveAndReload(false);
    await waitFor(() =>
      expect(description()).toHaveValue("Changed while authoring"),
    );
    expect(unsaved()).toBeInTheDocument();
  });

  it("restores ONCE — a later reload starts fresh", async () => {
    await editSaveAndReload(true);
    await waitFor(() =>
      expect(description()).toHaveValue("Changed while authoring"),
    );

    // A THIRD mount, with nothing newly parked. A restore that repeated would
    // resurrect an old draft over whatever you had moved on to.
    cleanup();
    render(<LabyrinthBuilderPage />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Edit$/ })).toHaveLength(1),
    );
    expect(description()).toHaveValue("");
  });
});
