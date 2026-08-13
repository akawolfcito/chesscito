/**
 * The unsaved-work guard, end to end through the real page.
 *
 * ⚠️ The bug: opening another record on top of an in-progress edit replaced the
 * draft immediately and the edit was GONE — no prompt, no undo, and nothing on
 * screen had ever said work was pending, so there was not even a moment where
 * the author could have noticed. `New` and the bucket toggle did the same.
 *
 * ⛔ What this file must prove is INTERCEPTION, not decoration. A test that only
 * asserts the banner appears would pass on a build that still throws the edit
 * away behind it. So every case checks the draft SURVIVED: the edited value is
 * still in its field and the record identity has not moved.
 *
 * Records here are synthetic on purpose — the catalog is authored content and a
 * test that reads it breaks the day someone authors one more exercise
 * (feedback_never_pin_authored_content_in_tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  {
    id: "probe-second",
    piece: "rook",
    order: 1,
    fen: "8/8/8/8/8/8/8/1R6 w - - 0 1",
    mover: "b1",
    target: "b8",
    tier: "medium",
    explanation: "Second probe record",
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

const unsaved = () => screen.queryByTestId("lb-unsaved");
const description = () =>
  screen.getByRole("textbox", { name: /^description/i });
const editButtons = () => screen.getAllByRole("button", { name: /Edit$/ });

async function openBuilder() {
  const user = userEvent.setup();
  render(<LabyrinthBuilderPage />);
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /^Existing / }),
    ).toBeInTheDocument(),
  );
  return user;
}

/** Load the first record and type into it, so there IS work to lose. */
async function openFirstAndEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(editButtons()[0]);
  await waitFor(() => expect(description()).toHaveValue("First probe record"));
  expect(unsaved()).not.toBeInTheDocument();

  await user.type(description(), " — edited");
  await waitFor(() => expect(unsaved()).toBeInTheDocument());
}

describe("builder — unsaved changes", () => {
  it("stays quiet on a freshly loaded record", async () => {
    const user = await openBuilder();
    await user.click(editButtons()[0]);
    await waitFor(() => expect(description()).toHaveValue("First probe record"));
    expect(unsaved()).not.toBeInTheDocument();
  });

  it("names the record that has the unsaved work", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);
    expect(unsaved()).toHaveTextContent(/Unsaved changes in\s*probe-first/);
  });

  it("REFUSES to open another record, and keeps the edit intact", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);

    await user.click(editButtons()[1]);

    // The question is asked...
    expect(unsaved()).toHaveTextContent(/Discard unsaved changes in/);
    expect(unsaved()).toHaveTextContent(/probe-second/);
    // ...and — the part that matters — the draft was NOT replaced.
    expect(description()).toHaveValue("First probe record — edited");
  });

  it("lets you back out and keep editing", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);
    await user.click(editButtons()[1]);

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(unsaved()).toHaveTextContent(/Unsaved changes in/);
    expect(description()).toHaveValue("First probe record — edited");
  });

  it("opens the other record once you confirm", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);
    await user.click(editButtons()[1]);

    await user.click(
      screen.getByRole("button", { name: "Discard and continue" }),
    );

    await waitFor(() =>
      expect(description()).toHaveValue("Second probe record"),
    );
    // Landing on a record straight off disk is clean again.
    expect(unsaved()).not.toBeInTheDocument();
  });

  it("Discard restores the draft to what disk has", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);

    await user.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(description()).toHaveValue("First probe record"));
    expect(unsaved()).not.toBeInTheDocument();
  });

  it("guards New and the bucket toggle too", async () => {
    const user = await openBuilder();
    await openFirstAndEdit(user);

    await user.click(screen.getByRole("button", { name: /^New$/ }));
    expect(unsaved()).toHaveTextContent(/start a new exercise\?/);
    expect(description()).toHaveValue("First probe record — edited");

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    await user.click(screen.getByRole("button", { name: "Labyrinth" }));
    expect(unsaved()).toHaveTextContent(/switch to labyrinth\?/);
    expect(description()).toHaveValue("First probe record — edited");
  });

  it("does NOT cry wolf when you browse to another piece", async () => {
    // ⚠️ The piece picker is also the record list's filter. If picking a piece
    // counted as an edit, every browse would raise a false alarm and the guard
    // would be trained away within a day.
    const user = await openBuilder();
    expect(unsaved()).not.toBeInTheDocument();

    const picker = screen.getByRole("group", { name: "Piece" });
    await user.click(within(picker).getByRole("button", { name: "bishop" }));
    await user.click(within(picker).getByRole("button", { name: "knight" }));

    expect(unsaved()).not.toBeInTheDocument();
  });

  it("DOES count a piece swap on a record that is already being edited", async () => {
    // Same click, opposite meaning: here it rewrites the record's own piece.
    const user = await openBuilder();
    await openFirstAndEdit(user);

    const picker = screen.getByRole("group", { name: "Piece" });
    await user.click(within(picker).getByRole("button", { name: "bishop" }));

    expect(unsaved()).toBeInTheDocument();
    expect(unsaved()).toHaveTextContent(/Unsaved changes in\s*probe-first/);
  });
});
