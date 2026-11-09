import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrimitiveBoundary } from "../primitive-boundary";

function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

function HappyChild() {
  return <span data-testid="happy-child">ok</span>;
}

// React logs caught errors to console.error during test renders. Silence
// those calls so the test output stays clean while still letting the
// boundary do its job.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe("PrimitiveBoundary", () => {
  it("renders the children unchanged when no error is thrown", () => {
    render(
      <PrimitiveBoundary primitiveName="HappyPrimitive">
        <HappyChild />
      </PrimitiveBoundary>,
    );
    expect(screen.getByTestId("happy-child")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the paper-tray fallback when a child throws during render", () => {
    render(
      <PrimitiveBoundary primitiveName="ExplodingPrimitive">
        <Boom />
      </PrimitiveBoundary>,
    );
    const fallback = screen.getByRole("alert");
    expect(fallback).toBeInTheDocument();
    expect(fallback.className).toMatch(/primitive-boundary-fallback\b/);
  });

  it("invokes onError with structured context (primitiveName, surface, atmosphere, error, stack)", () => {
    const onError = vi.fn();
    render(
      <PrimitiveBoundary
        primitiveName="ExplodingPrimitive"
        surface="play-hub"
        atmosphere="adventure"
        onError={onError}
      >
        <Boom message="thrown-from-test" />
      </PrimitiveBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const ctx = onError.mock.calls[0][0];
    expect(ctx.primitiveName).toBe("ExplodingPrimitive");
    expect(ctx.surface).toBe("play-hub");
    expect(ctx.atmosphere).toBe("adventure");
    expect(ctx.error).toBeInstanceOf(Error);
    expect(ctx.error.message).toBe("thrown-from-test");
    expect(typeof ctx.stack).toBe("string");
    expect(ctx.stack.length).toBeGreaterThan(0);
  });

  it("does NOT leak arbitrary child props into the onError context (no PII channel)", () => {
    const onError = vi.fn();
    render(
      <PrimitiveBoundary primitiveName="A" onError={onError}>
        <Boom />
      </PrimitiveBoundary>,
    );
    const ctx = onError.mock.calls[0][0];
    const allowedKeys = new Set([
      "primitiveName",
      "surface",
      "atmosphere",
      "error",
      "stack",
    ]);
    Object.keys(ctx).forEach((key) => {
      expect(allowedKeys.has(key)).toBe(true);
    });
  });

  it("isolates failures: a failing boundary does not affect a sibling boundary", () => {
    render(
      <div>
        <PrimitiveBoundary primitiveName="Bad">
          <Boom />
        </PrimitiveBoundary>
        <PrimitiveBoundary primitiveName="Good">
          <HappyChild />
        </PrimitiveBoundary>
      </div>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("happy-child")).toBeInTheDocument();
  });
});
