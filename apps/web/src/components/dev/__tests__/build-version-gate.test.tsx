import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  BuildVersionGate,
  shouldShowVersionPill,
} from "../build-version-gate";

const usePathnameMock = vi.hoisted(() => vi.fn(() => "/hub"));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("shouldShowVersionPill", () => {
  it("returns true for /hub exactly", () => {
    expect(shouldShowVersionPill("/hub")).toBe(true);
  });

  it("returns true for /dev and any /dev/* subpath", () => {
    expect(shouldShowVersionPill("/dev")).toBe(true);
    expect(shouldShowVersionPill("/dev/persist-overlay")).toBe(true);
    expect(shouldShowVersionPill("/dev/tx-progress")).toBe(true);
    expect(shouldShowVersionPill("/dev/coach-history")).toBe(true);
  });

  it("returns false for gameplay and content routes", () => {
    expect(shouldShowVersionPill("/")).toBe(false);
    expect(shouldShowVersionPill("/exercises")).toBe(false);
    expect(shouldShowVersionPill("/exercises/rook")).toBe(false);
    expect(shouldShowVersionPill("/arena")).toBe(false);
    expect(shouldShowVersionPill("/coach")).toBe(false);
    expect(shouldShowVersionPill("/coach/history")).toBe(false);
    expect(shouldShowVersionPill("/trophies")).toBe(false);
    expect(shouldShowVersionPill("/victory")).toBe(false);
    expect(shouldShowVersionPill("/victory/0x123")).toBe(false);
  });

  it("returns false for informational + share routes", () => {
    expect(shouldShowVersionPill("/about")).toBe(false);
    expect(shouldShowVersionPill("/support")).toBe(false);
    expect(shouldShowVersionPill("/terms")).toBe(false);
    expect(shouldShowVersionPill("/privacy")).toBe(false);
    expect(shouldShowVersionPill("/why")).toBe(false);
    expect(shouldShowVersionPill("/share/score")).toBe(false);
    expect(shouldShowVersionPill("/share/badge")).toBe(false);
    expect(shouldShowVersionPill("/share/daily")).toBe(false);
    expect(shouldShowVersionPill("/share/endgame")).toBe(false);
  });

  it("does not match prefix-collisions like /hubcap or /developer", () => {
    expect(shouldShowVersionPill("/hubcap")).toBe(false);
    expect(shouldShowVersionPill("/hub/anything-not-a-real-subroute")).toBe(
      false,
    );
    expect(shouldShowVersionPill("/developer")).toBe(false);
  });
});

describe("BuildVersionGate", () => {
  afterEach(() => cleanup());

  it("renders the build pill when usePathname returns /hub", () => {
    usePathnameMock.mockReturnValueOnce("/hub");

    render(<BuildVersionGate />);

    expect(screen.getByTestId("build-version")).toBeInTheDocument();
  });

  it("renders null on gameplay routes", () => {
    usePathnameMock.mockReturnValueOnce("/exercises");

    const { container } = render(<BuildVersionGate />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("build-version")).not.toBeInTheDocument();
  });

  it("renders the build pill on /dev fixture routes", () => {
    usePathnameMock.mockReturnValueOnce("/dev/persist-overlay");

    render(<BuildVersionGate />);

    expect(screen.getByTestId("build-version")).toBeInTheDocument();
  });
});

