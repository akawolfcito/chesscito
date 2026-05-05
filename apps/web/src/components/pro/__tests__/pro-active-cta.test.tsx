import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

import { ProActiveCTA } from "../pro-active-cta";
import { PRO_COPY } from "@/lib/content/editorial";

afterEach(() => {
  cleanup();
  pushMock.mockReset();
  trackMock.mockReset();
});

describe("ProActiveCTA — navigational variant (non-/arena surfaces)", () => {
  const NAV_SOURCES = ["/play-hub", "/trophies", "/leaderboard", "/about", "/why", "/", "/unknown"];

  it.each(NAV_SOURCES)("renders Play in Arena CTA for source=%s", (source) => {
    render(<ProActiveCTA source={source} onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-button")).toHaveTextContent(
      PRO_COPY.activeCtaPlay,
    );
  });

  it("renders the hub sub-line copy on navigational surfaces", () => {
    render(<ProActiveCTA source="/play-hub" onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-subline")).toHaveTextContent(
      PRO_COPY.activeSublineHub,
    );
  });

  it("on tap, navigates to /arena, calls onClose, and emits telemetry", () => {
    const onClose = vi.fn();
    render(<ProActiveCTA source="/play-hub" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pro-active-cta-button"));
    expect(pushMock).toHaveBeenCalledWith("/arena");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("pro_active_cta_tap", {
      source: "/play-hub",
    });
  });
});

describe("ProActiveCTA — close-only variant (/arena)", () => {
  it("renders Got it CTA when source === /arena", () => {
    render(<ProActiveCTA source="/arena" onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-button")).toHaveTextContent(
      PRO_COPY.activeCtaGotIt,
    );
  });

  it("renders the arena sub-line copy", () => {
    render(<ProActiveCTA source="/arena" onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-subline")).toHaveTextContent(
      PRO_COPY.activeSublineArena,
    );
  });

  it("on tap, calls onClose without navigating and still emits telemetry", () => {
    const onClose = vi.fn();
    render(<ProActiveCTA source="/arena" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pro-active-cta-button"));
    expect(pushMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("pro_active_cta_tap", {
      source: "/arena",
    });
  });
});
