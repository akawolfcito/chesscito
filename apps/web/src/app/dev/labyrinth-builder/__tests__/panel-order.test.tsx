/**
 * The builder's panel ORDER.
 *
 * ⚠️ This is not decoration. The founder's authoring loop starts by PICKING A
 * PIECE and then opening one of that piece's existing records — that pair is the
 * only thing touched on every single edit. Everything else (the FEN importer,
 * the export block, the stage control, the generated-catalog reference) is used
 * a handful of times a month. For most of this builder's life the record list
 * sat at the BOTTOM of a long scrolling column, so the most frequent action in
 * the tool was also its longest scroll.
 *
 * Nothing observable protects a panel order — it has no behaviour, `tsc` cannot
 * see it, and the /dev routes are outside the VR suite. A well-meaning restyle
 * that moves a card is invisible until the founder feels it. So the order is
 * asserted here, by HEADING, which survives any amount of restyling.
 *
 * ⛔ Deliberately reads no authored content: no exercise ids, no counts, no
 * catalog rows (feedback_never_pin_authored_content_in_tests). The fetch is
 * stubbed with an EMPTY record set precisely so this test cannot start failing
 * because someone authored a rook exercise.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LabyrinthBuilderPage from "../page";

/** The two panels the authoring loop actually runs on, in the order it runs
 *  them. Both must precede every rarely-used panel. */
const PICK_A_PIECE = /^Piece$/;
const THE_RECORD_LIST = /^Existing /;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, records: [], canWrite: true }), {
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderBuilder() {
  render(<LabyrinthBuilderPage />);
  // The record fetch resolves after mount; wait for the list panel so the
  // assertions run against a settled tree.
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: THE_RECORD_LIST }),
    ).toBeInTheDocument(),
  );
}

function panelTitles(): string[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent ?? "");
}

describe("labyrinth builder — panel order", () => {
  it("opens with the piece picker, then that piece's records", async () => {
    await renderBuilder();
    const titles = panelTitles();
    const piece = titles.findIndex((t) => PICK_A_PIECE.test(t));
    const records = titles.findIndex((t) => THE_RECORD_LIST.test(t));

    expect(piece).toBeGreaterThanOrEqual(0);
    expect(records).toBe(piece + 1);
  });

  it("keeps every rarely-used panel BELOW the record list", async () => {
    await renderBuilder();
    const titles = panelTitles();
    const records = titles.findIndex((t) => THE_RECORD_LIST.test(t));

    for (const rare of [
      "Identity",
      "Teaching guide",
      "Stage",
      "Export",
      "Load from FEN",
    ]) {
      const at = titles.findIndex((t) => t.startsWith(rare));
      expect(at, `${rare} should exist as a panel`).toBeGreaterThanOrEqual(0);
      expect(at, `${rare} should sit below the record list`).toBeGreaterThan(
        records,
      );
    }
  });

  it("names the record list after the piece in play, so the pair reads as one step", async () => {
    await renderBuilder();
    const heading = screen.getByRole("heading", { name: THE_RECORD_LIST });
    // The DEFAULT piece, not an authored value — emptyState() opens on the rook.
    expect(heading).toHaveTextContent(/rook/i);
  });
});
