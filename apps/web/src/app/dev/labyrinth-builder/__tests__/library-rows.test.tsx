/**
 * What a row of the record list SAYS, through the real page.
 *
 * The three mockup items that landed here: the name leads instead of the id, a
 * TIER badge, and an active row that says "Editing" in words rather than only
 * tinting itself.
 *
 * ⛔ Synthetic records, as everywhere in this builder's tests — the catalog is
 * authored content and reading it makes a test that goes red the day someone
 * authors one more exercise (feedback_never_pin_authored_content_in_tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LabyrinthBuilderPage from "../page";

const RECORDS = [
  {
    id: "probe-named",
    piece: "rook",
    order: 0,
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    mover: "a1",
    target: "h1",
    tier: "hard",
    explanation: "Friendly blocker",
    bucket: "exercise",
  },
  {
    // No description at all — the id has to carry the row.
    id: "probe-nameless",
    piece: "rook",
    order: 1,
    fen: "8/8/8/8/8/8/8/1R6 w - - 0 1",
    mover: "b1",
    target: "b8",
    tier: "easy",
    bucket: "exercise",
  },
  {
    // No tier either — the catalog treats it as medium downstream.
    id: "probe-untiered",
    piece: "rook",
    order: 2,
    fen: "8/8/8/8/8/8/8/2R5 w - - 0 1",
    mover: "c1",
    target: "c8",
    explanation: "No tier authored",
    bucket: "exercise",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: true, records: RECORDS, canWrite: true }),
        { headers: { "content-type": "application/json" } },
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openBuilder() {
  const user = userEvent.setup();
  render(<LabyrinthBuilderPage />);
  // ⚠️ Wait for the ROWS, not the heading. The panel renders its heading whether
  // or not the record fetch has resolved — waiting on it returns while the list
  // is still "None saved for this piece yet", and every later query then races
  // the fetch. That is a real flake, and it cost one red run to find.
  await waitFor(() => expect(rows().length).toBe(RECORDS.length));
  return user;
}

/** The rows of the RECORD list, in render order.
 *
 *  ⚠️ Scoped to its own section on purpose. A bare `getAllByRole("listitem")`
 *  also sweeps in the "Generated <piece> catalog" panel, whose rows come from
 *  the real authored catalog — which would make this file's assertions depend
 *  on content nobody here wrote. */
function rows(): HTMLElement[] {
  const section = screen
    .getByRole("heading", { name: /^Existing / })
    .closest("section") as HTMLElement;
  return within(section).getAllByRole("listitem");
}

/** ⚠️ Longest alternative first: a row's textContent runs the spans together
 *  ("probe-named" + "target"), so a loose `probe-[a-z]+` swallows the next
 *  column, and "nameless" starts with "named"'s prefix. */
const rowIds = () =>
  rows().map(
    (li) => li.textContent?.match(/probe-(?:nameless|named|untiered)/)?.[0],
  );

describe("builder — what a record row says", () => {
  it("leads with the NAME, and keeps the id beside it", async () => {
    await openBuilder();
    const row = rows()[0];
    expect(within(row).getByText("Friendly blocker")).toBeInTheDocument();
    // The id is still there — it is what you type into the id field and what
    // every error message names.
    expect(within(row).getByText("probe-named")).toBeInTheDocument();
  });

  it("falls back to the id when a record has no description", async () => {
    await openBuilder();
    // Not a defensive fallback: today NOT ONE authored exercise carries a
    // description, so this is the common case, not the edge one.
    expect(rows()[1]).toHaveTextContent("probe-nameless");
  });

  it("does not print the id TWICE when it is also the name", async () => {
    await openBuilder();
    // Found by using it: with no descriptions authored anywhere, every row read
    // `rook-1 … rook-1`. The id is a SECOND label, so it earns its place only
    // when it says something the name does not.
    const nameless = rows()[1].textContent ?? "";
    expect(nameless.match(/probe-nameless/g)).toHaveLength(1);
    // …and it is still printed where it does add something.
    const named = rows()[0].textContent ?? "";
    expect(named).toContain("Friendly blocker");
    expect(named).toContain("probe-named");
  });

  it("badges the authored tier", async () => {
    await openBuilder();
    expect(within(rows()[0]).getByText("hard")).toBeInTheDocument();
    expect(within(rows()[1]).getByText("easy")).toBeInTheDocument();
  });

  it("marks an ASSUMED tier so it is not mistaken for an authored one", async () => {
    await openBuilder();
    // It sorts and plays as medium, but nobody chose that — and when the list is
    // sorted by tier, an unmarked assumption is indistinguishable from a decision.
    expect(within(rows()[2]).getByText("medium?")).toBeInTheDocument();
  });

  it("says Editing in WORDS on the row being edited, and only there", async () => {
    const user = await openBuilder();
    expect(screen.queryByText("Editing")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Edit$/ })[0]);

    await waitFor(() =>
      expect(within(rows()[0]).getByText("Editing")).toBeInTheDocument(),
    );
    expect(within(rows()[1]).queryByText("Editing")).not.toBeInTheDocument();
  });
});

describe("builder — record sort", () => {
  it("opens in the real in-game sequence", async () => {
    await openBuilder();
    expect(rowIds()).toEqual(["probe-named", "probe-nameless", "probe-untiered"]);
  });

  it("regroups by difficulty on demand, without losing the sequence inside a band", async () => {
    const user = await openBuilder();
    const sort = screen.getByRole("group", { name: "Sort records" });

    await user.click(within(sort).getByRole("button", { name: "tier" }));

    // easy → medium (the untiered one) → hard
    expect(rowIds()).toEqual([
      "probe-nameless",
      "probe-untiered",
      "probe-named",
    ]);
  });

  it("goes back to the sequence view", async () => {
    const user = await openBuilder();
    const sort = screen.getByRole("group", { name: "Sort records" });
    await user.click(within(sort).getByRole("button", { name: "tier" }));
    await user.click(within(sort).getByRole("button", { name: "order" }));
    expect(rowIds()).toEqual(["probe-named", "probe-nameless", "probe-untiered"]);
  });
});
