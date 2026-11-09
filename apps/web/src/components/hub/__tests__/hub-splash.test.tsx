import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { act, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

/** <HubV2Splash> primitive (design-lock §1.1 + §2.1 + §9.2, with P0-3
 *  corrections: no auto-dismiss timer, tap-only dismiss, hint fade-in
 *  600ms after the 1200ms entrance completes (~1800ms post-mount).
 *
 *  Phase 4 commit 1 (`26fd0e8`) shipped asserts 1–6.
 *  Phase 4 commit 2 adds assert 7 (editorial integration with HUB_V2_SPLASH_COPY).
 *
 *  7 asserts:
 *    1. Mount gate (localStorage flag null → renders; flag set → null)
 *    2. Hint timing (hidden at mount; visible after advancing 1800ms)
 *    3. Tap-anywhere dismiss (unmount + flag persist + telemetry)
 *    4. Reduced-motion path (no timer; hint visible at mount; tap-only)
 *    5. ARIA + keyboard (role dialog, aria-modal, focus, Enter/Space dismiss)
 *    6. Telemetry (splash_view on mount; splash_dismiss on dismiss)
 *    7. Editorial: title, tagline, dismissHint render from HUB_V2_SPLASH_COPY
 *
 *  Real `splash-knight-hero.webp` asset (≤6 KB, design-lock §3.2) lands
 *  in commit 3 — current SVG hero is a decorative placeholder. */

const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const SPLASH_FLAG_KEY = "chesscito:hub-v2:splash:seen";

function stubMatchMedia(reducedMotion: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query.includes("prefers-reduced-motion") && reducedMotion ? true : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  trackMock.mockReset();
  localStorage.clear();
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

import { HubV2Splash } from "../hub-splash";
import { HUB_V2_SPLASH_COPY } from "@/lib/content/editorial";

describe("<HubV2Splash> — Phase 4 primitive", () => {
  it("(1) mount gate: renders when localStorage flag is null; returns null when flag is set", () => {
    const { unmount } = render(<HubV2Splash />);
    expect(screen.getByTestId("hub-v2-splash")).toBeInTheDocument();
    unmount();

    localStorage.setItem(SPLASH_FLAG_KEY, "1");
    render(<HubV2Splash />);
    expect(screen.queryByTestId("hub-v2-splash")).not.toBeInTheDocument();
  });

  it("(2) hint timing: hidden at mount; visible after 1800ms (1200ms entrance + 600ms delay)", () => {
    vi.useFakeTimers();
    render(<HubV2Splash />);

    const hint = screen.getByTestId("splash-hint");
    expect(hint.getAttribute("data-visible")).toBe("false");

    act(() => {
      vi.advanceTimersByTime(1799);
    });
    expect(hint.getAttribute("data-visible")).toBe("false");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hint.getAttribute("data-visible")).toBe("true");
  });

  it("(3) tap-anywhere dismiss: unmounts dialog, persists localStorage flag, fires splash_dismiss with elapsedMs", async () => {
    const user = userEvent.setup();
    render(<HubV2Splash />);

    const dialog = screen.getByTestId("hub-v2-splash");
    await user.click(dialog);

    expect(screen.queryByTestId("hub-v2-splash")).not.toBeInTheDocument();
    expect(localStorage.getItem(SPLASH_FLAG_KEY)).toBe("1");

    const dismissCall = trackMock.mock.calls.find(
      (call) => call[0] === "splash_dismiss",
    );
    expect(dismissCall).toBeDefined();
    expect(dismissCall?.[1]).toMatchObject({ method: "tap" });
    expect(typeof dismissCall?.[1]?.elapsedMs).toBe("number");
    expect(dismissCall?.[1]?.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("(4) reduced-motion: no timer required, hint visible at mount, data-reduced-motion=true, tap still dismisses", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(<HubV2Splash />);

    const dialog = screen.getByTestId("hub-v2-splash");
    expect(dialog.getAttribute("data-reduced-motion")).toBe("true");

    const hint = screen.getByTestId("splash-hint");
    expect(hint.getAttribute("data-visible")).toBe("true");

    await user.click(dialog);
    expect(screen.queryByTestId("hub-v2-splash")).not.toBeInTheDocument();
    expect(localStorage.getItem(SPLASH_FLAG_KEY)).toBe("1");
  });

  it("(5) ARIA + keyboard: role=dialog, aria-modal, aria-labelledby matches title id, dialog focused on mount, Enter/Space dismiss", () => {
    const { unmount } = render(<HubV2Splash />);

    const dialog = screen.getByTestId("hub-v2-splash");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("splash-title");
    expect(document.getElementById("splash-title")).toBeInTheDocument();
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(screen.queryByTestId("hub-v2-splash")).not.toBeInTheDocument();

    // Re-render and verify Space also dismisses (independent run on a clean
    // localStorage so the gate doesn't suppress the second render).
    localStorage.clear();
    unmount();
    render(<HubV2Splash />);
    const dialog2 = screen.getByTestId("hub-v2-splash");
    fireEvent.keyDown(dialog2, { key: " " });
    expect(screen.queryByTestId("hub-v2-splash")).not.toBeInTheDocument();
  });

  it("(6) telemetry: splash_view fires once on mount; splash_dismiss fires once on dismiss", async () => {
    const user = userEvent.setup();
    render(<HubV2Splash />);

    const viewCalls = trackMock.mock.calls.filter(
      (call) => call[0] === "splash_view",
    );
    expect(viewCalls).toHaveLength(1);

    await user.click(screen.getByTestId("hub-v2-splash"));

    const dismissCalls = trackMock.mock.calls.filter(
      (call) => call[0] === "splash_dismiss",
    );
    expect(dismissCalls).toHaveLength(1);
  });

  it("(7) editorial: title, tagline, dismissHint render from HUB_V2_SPLASH_COPY; aria-labelledby uses ariaTitleId", () => {
    render(<HubV2Splash />);

    const title = document.getElementById(HUB_V2_SPLASH_COPY.ariaTitleId);
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toBe(HUB_V2_SPLASH_COPY.title);

    expect(
      screen.getByText(HUB_V2_SPLASH_COPY.tagline),
    ).toBeInTheDocument();

    const hint = screen.getByTestId("splash-hint");
    expect(hint.textContent).toBe(HUB_V2_SPLASH_COPY.dismissHint);

    expect(
      screen.getByTestId("hub-v2-splash").getAttribute("aria-labelledby"),
    ).toBe(HUB_V2_SPLASH_COPY.ariaTitleId);
  });
});

// Tiny self-check: trackMock is a vitest mock fn (compile-time guard so we
// catch a bad refactor that loses the mock identity).
const _trackMockIsFn: Mock = trackMock;
void _trackMockIsFn;
