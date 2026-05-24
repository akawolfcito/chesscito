import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
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
  const NAV_SOURCES = ["/exercises", "/trophies", "/leaderboard", "/about", "/why", "/", "/unknown"];

  it.each(NAV_SOURCES)("renders Play in Arena CTA for source=%s", (source) => {
    render(<ProActiveCTA source={source} onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-button")).toHaveTextContent(
      PRO_COPY.activeCtaPlay,
    );
  });

  it("renders the hub sub-line copy on navigational surfaces", () => {
    render(<ProActiveCTA source="/exercises" onClose={vi.fn()} />);
    expect(screen.getByTestId("pro-active-cta-subline")).toHaveTextContent(
      PRO_COPY.activeSublineHub,
    );
  });

  it("on tap, navigates to /arena and emits telemetry — does NOT call onClose (B2 fix 2026-05-07)", () => {
    const onClose = vi.fn();
    render(<ProActiveCTA source="/exercises" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("pro-active-cta-button"));
    expect(pushMock).toHaveBeenCalledWith("/arena");
    // onClose intentionally NOT called: when the sheet was opened from
    // a navigational surface, calling onClose can race with router.push
    // and the close handler may win, dropping the user on the parent
    // surface instead of /arena. The B2 fix keeps the sheet open
    // through navigation and lets the route change unmount it
    // naturally. (Original incident traced to the legacy
    // /hub?legacy=1&action=pro deep-link bounce; mitigation kept after
    // the surface moved.)
    expect(onClose).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith("pro_active_cta_tap", {
      source: "/exercises",
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
