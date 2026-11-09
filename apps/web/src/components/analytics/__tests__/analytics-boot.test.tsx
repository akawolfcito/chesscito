import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({ track: (...a: unknown[]) => trackMock(...a) }));

import { AnalyticsBoot } from "../analytics-boot";

afterEach(() => {
  cleanup();
  trackMock.mockClear();
  window.sessionStorage.clear();
});

describe("AnalyticsBoot", () => {
  it("fires app_opened once on first mount", () => {
    render(<AnalyticsBoot />);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("app_opened");
  });

  it("does not fire again on a second mount within the same visit", () => {
    render(<AnalyticsBoot />);
    cleanup();
    render(<AnalyticsBoot />);
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("fires only once under StrictMode double-invoke", () => {
    render(
      <StrictMode>
        <AnalyticsBoot />
      </StrictMode>,
    );
    expect(trackMock).toHaveBeenCalledTimes(1);
  });
});
