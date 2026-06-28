import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "../not-found";

// not-found.tsx is Full-mode only — the catch-all [...slug]/page.tsx
// handles the Lite redirect before reaching this component.
describe("[locale]/not-found", () => {
  it("renders title and Back to Hub link", () => {
    render(<NotFound />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Back to Hub" });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/");
  });
});
