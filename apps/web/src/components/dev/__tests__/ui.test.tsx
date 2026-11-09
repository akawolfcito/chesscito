/**
 * The /dev chrome primitives.
 *
 * These exist so the authoring surfaces stop each inventing their own card,
 * label and toggle. They carry NO product logic — a `Section` is a titled box —
 * so what is worth pinning is the contract the pages depend on: that the title
 * is a real heading (the builder's DOM-order test reads headings, and an
 * unlabelled <div> would make that test unwritable), that a `Field` labels its
 * control (so `getByLabelText` keeps working across a restyle), and that
 * `Segmented` reports pressed state to assistive tech rather than only through
 * a background colour.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, Legend, Mono, Section, Segmented } from "../ui";

describe("Section", () => {
  it("renders its title as a heading so pages can be read by structure", () => {
    render(
      <Section title="Existing rook exercises">
        <p>body</p>
      </Section>,
    );
    expect(
      screen.getByRole("heading", { name: "Existing rook exercises" }),
    ).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders the hint alongside the title", () => {
    render(
      <Section title="Teaching guide" hint="authoring only">
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText("authoring only")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("labels the control it wraps", async () => {
    render(
      <Field label="Piece">
        <select>
          <option value="rook">rook</option>
        </select>
      </Field>,
    );
    expect(screen.getByLabelText("Piece")).toBeInTheDocument();
  });

  it("renders the hint under the control", () => {
    render(
      <Field label="ID" hint="Leave blank to auto-generate.">
        <input />
      </Field>,
    );
    expect(screen.getByText("Leave blank to auto-generate.")).toBeInTheDocument();
  });
});

describe("Segmented", () => {
  it("marks the active option pressed, not merely coloured", () => {
    render(
      <Segmented
        ariaLabel="Content bucket"
        value="exercise"
        onChange={() => {}}
        options={[
          { value: "exercise", label: "Exercise" },
          { value: "labyrinth", label: "Labyrinth" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Exercise" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Labyrinth" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the picked value", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        ariaLabel="Content bucket"
        value="exercise"
        onChange={onChange}
        options={[
          { value: "exercise", label: "Exercise" },
          { value: "labyrinth", label: "Labyrinth" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Labyrinth" }));
    expect(onChange).toHaveBeenCalledWith("labyrinth");
  });

  it("does not report a disabled option", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        ariaLabel="Board mode"
        value="paint"
        onChange={onChange}
        options={[
          { value: "paint", label: "Paint" },
          { value: "preview", label: "Preview", disabled: true, title: "needs a valid draft" },
        ]}
      />,
    );
    const preview = screen.getByRole("button", { name: "Preview" });
    expect(preview).toBeDisabled();
    expect(preview).toHaveAttribute("title", "needs a valid draft");
    await userEvent.click(preview);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Legend", () => {
  it("lists every entry it is given", () => {
    render(
      <Legend
        items={[
          { swatch: "bg-neutral-700", label: "Wall" },
          { swatch: "bg-amber-400", label: "Star / goal" },
        ]}
      />,
    );
    expect(screen.getByText("Wall")).toBeInTheDocument();
    expect(screen.getByText("Star / goal")).toBeInTheDocument();
  });
});

describe("Mono", () => {
  it("stays selectable — the export block exists to be copied", () => {
    render(<Mono>fen=8/8/8/8/8/8/8/R7</Mono>);
    expect(screen.getByText("fen=8/8/8/8/8/8/8/R7")).toHaveAttribute(
      "data-allow-select",
      "true",
    );
  });
});
