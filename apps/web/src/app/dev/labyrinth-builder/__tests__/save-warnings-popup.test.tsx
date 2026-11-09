/**
 * The last save's advice, behind a button.
 *
 * ⚠️ Why it moved: as an inline panel it shoved a stable layout around on every
 * save, to say something that is advisory in two kinds out of three — and the
 * founder had stopped reading it ("si todo sale en warning ya sabemos que eso se
 * obvia; no sé qué trato debo darle"). It now costs one chip in the header until
 * asked for.
 *
 * ⛔ The filter is by KIND, not severity. This channel carries no errors at all
 * — they block the save and never arrive — so a severity filter would sort one
 * bucket into itself. What these cases therefore check is that each group
 * carries its TREATMENT, which is the thing that was actually missing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LabyrinthBuilderPage from "../page";

/** One valid record, so Save is reachable at all. */
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

/** Two kinds plus one the classifier has never seen — the shapes are the real
 *  linter's, pinned in lib/labyrinth-builder/__tests__/warnings.test.ts against
 *  the linter itself, so this file does not have to re-prove them. */
const SAVE_WARNINGS = [
  "rook: the curve jumps 9 moves at step 2 — a needs 1 and b needs 10.",
  "rook-9: 9/10 obstacles are decorative — 1 preserve the decision " +
    "(optimal 4, 2 optimal routes, 3 first moves). Droppable: c3 d4",
  "rook: a shape nobody has taught this panel yet",
];

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        typeof url === "string" && url.includes("/api/dev/publish")
          ? {
              ok: true,
              baseline: { ok: true, warnings: SAVE_WARNINGS },
              overlay: { ok: true },
            }
          : { ok: true, records: RECORDS, canWrite: true };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

/* ⚠️ Do NOT hand-stub `navigator.clipboard` here. `userEvent.setup()` installs
   its own clipboard stub and overwrites any mock defined before it — and because
   the component wraps the copy in a try/catch (a blocked clipboard is not worth
   an error in a dev tool), the mismatch fails SILENTLY and reads as "copy does
   nothing". Reading the value back off user-event's clipboard is both simpler
   and a stronger assertion: it checks what actually landed there. */

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const warningsButton = () => screen.queryByTestId("lb-warnings-button");
const popup = () => screen.getByTestId("lb-warnings-popup");

/** Open the builder, load the record (so the draft is valid), and save it. */
async function saveOnce() {
  const user = userEvent.setup();
  render(<LabyrinthBuilderPage />);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /Edit$/ })).toHaveLength(1),
  );
  await user.click(screen.getByRole("button", { name: /Edit$/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Save draft/ })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: /Save draft/ }));
  await waitFor(() => expect(warningsButton()).toBeInTheDocument());
  return user;
}

describe("save advice — the button", () => {
  it("is absent until a save produces something to say", async () => {
    render(<LabyrinthBuilderPage />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Edit$/ })).toHaveLength(1),
    );
    expect(warningsButton()).not.toBeInTheDocument();
  });

  it("appears after a save, carrying the count", async () => {
    await saveOnce();
    expect(warningsButton()).toHaveTextContent(String(SAVE_WARNINGS.length));
  });

  it("does NOT steal column space — nothing opens until it is clicked", async () => {
    // The whole reason it moved. The advice must be invisible until asked for.
    await saveOnce();
    expect(screen.queryByTestId("lb-warnings-popup")).not.toBeInTheDocument();
  });
});

describe("save advice — the popup", () => {
  it("opens as a real modal", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);
    // `aria-modal`, not `role="dialog"`: this codebase already has an overlay
    // using role="alert", so counting roles is not a reliable modal check.
    expect(popup()).toHaveAttribute("aria-modal", "true");
  });

  it("says what treatment each kind deserves — the thing that was missing", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);

    expect(popup()).toHaveTextContent(/Advice, never a blocker/i);
    expect(popup()).toHaveTextContent(/do not reorder content/i);
  });

  it("warns that the decorative audit is unreliable on a sweep", async () => {
    // It once called 9 of 10 walls decorative on walls that quadrupled the
    // route. Showing the verdict without its limit launders a known-bad answer.
    const user = await saveOnce();
    await user.click(warningsButton()!);
    expect(popup()).toHaveTextContent(/Unreliable on a Star Sweep/i);
  });

  it("filters by kind, and the filter never loses one", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);
    const filters = within(popup()).getByRole("group", { name: "Filter notes" });

    expect(within(popup()).getAllByRole("listitem")).toHaveLength(3);

    await user.click(within(filters).getByRole("button", { name: /^Difficulty curve/ }));
    expect(within(popup()).getAllByRole("listitem")).toHaveLength(1);

    await user.click(within(filters).getByRole("button", { name: /^All/ }));
    expect(within(popup()).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows an unrecognised warning rather than hiding it", async () => {
    // A new linter message must surface UNCLASSIFIED, never be swallowed.
    const user = await saveOnce();
    await user.click(warningsButton()!);
    expect(popup()).toHaveTextContent("a shape nobody has taught this panel yet");
    expect(popup()).toHaveTextContent(/Unclassified/i);
  });

  it("copies what is on screen", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);
    await user.click(within(popup()).getByRole("button", { name: /Copy/ }));

    const written = await navigator.clipboard.readText();
    // Grouped and self-explanatory, not a wall of orphan sentences.
    expect(written).toContain("## Difficulty curve");
    expect(written).toContain("Advice, never a blocker");
    expect(written).toContain(SAVE_WARNINGS[0]);
  });

  it("closes without dismissing, so the advice can be reopened", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);
    await user.click(within(popup()).getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("lb-warnings-popup")).not.toBeInTheDocument();
    expect(warningsButton()).toBeInTheDocument();
  });

  it("Dismiss all retires the button until the next save", async () => {
    const user = await saveOnce();
    await user.click(warningsButton()!);
    await user.click(within(popup()).getByRole("button", { name: "Dismiss all" }));

    await waitFor(() => expect(warningsButton()).not.toBeInTheDocument());
  });
});
