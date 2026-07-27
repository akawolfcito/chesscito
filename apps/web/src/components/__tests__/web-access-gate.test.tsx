/**
 * WebAccessGate — the mandatory web access gate (product decision 2026-07-24).
 *
 * The web (Privy) branch renders productive children ONLY when authenticated
 * with a ready embedded wallet. Everything else is a shell, the gate, or an
 * interstitial. There is no `Continue as Guest`. MiniPay never mounts this
 * (the branch resolver keeps it on the injected tree), so these tests exercise
 * only the web branch.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal shape of the `useLogin` callbacks the component registers. Keeps the
 *  test off Privy's `PrivyErrorCode` enum while still driving onComplete/onError. */
type LoginCallbacks = { onComplete?: () => void; onError?: (code: string) => void };

let readyMock = true;
let authenticatedMock = false;
let addressMock: string | undefined = undefined;
const loginMock = vi.fn();
let capturedLoginCallbacks: LoginCallbacks | undefined;
const trackMock = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ ready: readyMock, authenticated: authenticatedMock }),
  useLogin: (callbacks?: LoginCallbacks) => {
    capturedLoginCallbacks = callbacks;
    return { login: loginMock };
  },
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: addressMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

/** `DesktopAppFrame` reads the pathname to decide whether the route wears the
 *  bezel. `/hub` is an app route, so the frame renders. */
const usePathnameMock = vi.hoisted(() => vi.fn(() => "/en/hub"));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { WebAccessGate } from "@/components/web-access-gate";
import { WEB_ACCESS_EVENTS } from "@/lib/wallet/web-access-analytics";

const CHILD = "productive-children";

function renderGate(surface: "learn" | "play" = "learn") {
  return render(
    <WebAccessGate surface={surface}>
      <div>{CHILD}</div>
    </WebAccessGate>,
  );
}

beforeEach(() => {
  readyMock = true;
  authenticatedMock = false;
  addressMock = undefined;
  loginMock.mockClear();
  trackMock.mockClear();
  capturedLoginCallbacks = undefined;
});

describe("WebAccessGate", () => {
  it("shows the gate to a hydrated, unauthenticated web user", () => {
    const { container } = renderGate();
    expect(
      container.querySelector('[data-web-access="unauthenticated"]'),
    ).not.toBeNull();
    expect(screen.getByText("ENTER")).toBeTruthy();
  });

  it("does not render productive children while unauthenticated", () => {
    renderGate();
    expect(screen.queryByText(CHILD)).toBeNull();
  });

  it("admits children only when authenticated AND wallet ready", () => {
    authenticatedMock = true;
    addressMock = "0xabc0000000000000000000000000000000000000";
    renderGate();
    expect(screen.getByText(CHILD)).toBeTruthy();
    expect(
      screen.queryByText("ENTER"),
    ).toBeNull();
  });

  it("shows a preparation interstitial when authenticated without a wallet", () => {
    authenticatedMock = true;
    addressMock = undefined;
    const { container } = renderGate();
    expect(
      container.querySelector('[data-web-access="wallet-pending"]'),
    ).not.toBeNull();
    expect(screen.queryByText(CHILD)).toBeNull();
  });

  it("renders a shell while the environment is loading", () => {
    readyMock = false;
    const { container } = renderGate();
    expect(
      container.querySelector('[data-web-access="environment-loading"]'),
    ).not.toBeNull();
    expect(screen.queryByText(CHILD)).toBeNull();
  });

  it("opens the native Privy modal from the CTA", () => {
    renderGate();
    fireEvent.click(screen.getByText("ENTER"));
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("on error offers retry, Open in MiniPay, and Back to chesscito.com", () => {
    renderGate();
    fireEvent.click(screen.getByText("ENTER"));
    // Privy invokes onError for a failed login.
    act(() => {
      capturedLoginCallbacks?.onError?.("exited_auth_flow");
    });
    expect(screen.getByText("Try again")).toBeTruthy();
    const minipay = screen.getByText("Open in MiniPay").closest("a");
    const discovery = screen.getByText("Back to chesscito.com").closest("a");
    expect(minipay?.getAttribute("href")).toBeTruthy();
    expect(discovery?.getAttribute("href")).toContain("chesscito.com");
  });

  it("never offers a guest path", () => {
    const { container } = renderGate();
    expect(container.textContent).not.toMatch(/guest/i);
    expect(container.textContent).not.toMatch(/continue as/i);
  });

  it("uses the same component and the same copy for Learn and Play", () => {
    // 2026-07-25: the copy is identical on both surfaces; only the wallpaper
    // differs, and that is driven by `data-surface`, never by hostname.
    const learn = renderGate("learn");
    expect(screen.getByText("Unlock your Chesscito journey")).toBeTruthy();
    expect(
      learn.container.querySelector('[data-surface="learn"]'),
    ).not.toBeNull();
    learn.unmount();

    const play = renderGate("play");
    expect(screen.getByText("Unlock your Chesscito journey")).toBeTruthy();
    expect(play.container.querySelector('[data-surface="play"]')).not.toBeNull();
  });

  it("tags every gate state with its surface so the wallpaper never drops out", () => {
    // The interstitials share the wallpaper: without `data-surface` the
    // preparing/error screens would flash a bare background mid-login.
    for (const setup of [
      () => {
        readyMock = false;
      },
      () => {
        authenticatedMock = true;
        addressMock = undefined;
      },
    ]) {
      readyMock = true;
      authenticatedMock = false;
      addressMock = undefined;
      setup();
      const { container, unmount } = renderGate("play");
      expect(container.querySelector('[data-surface="play"]')).not.toBeNull();
      unmount();
    }
  });

  describe("desktop app frame", () => {
    // The gate is an app screen, not a page of its own: on web it must sit
    // inside the same phone bezel the app wears (founder, 2026-07-27). Below
    // 768px the frame is a CSS pass-through, so MiniPay is untouched.
    const FRAME = ".desktop-app-frame-shell";

    it("renders the gate inside the desktop app frame", () => {
      const { container } = renderGate();
      expect(container.querySelector(FRAME)).not.toBeNull();
      expect(
        container.querySelector(`${FRAME} [data-web-access="unauthenticated"]`),
      ).not.toBeNull();
    });

    it("frames every interstitial too, so the bezel never blinks mid-login", () => {
      for (const setup of [
        () => {
          readyMock = false;
        },
        () => {
          authenticatedMock = true;
          addressMock = undefined;
        },
      ]) {
        readyMock = true;
        authenticatedMock = false;
        addressMock = undefined;
        setup();
        const { container, unmount } = renderGate();
        expect(container.querySelector(FRAME)).not.toBeNull();
        unmount();
      }
    });

    it("frames the error screen", () => {
      const { container } = renderGate();
      fireEvent.click(screen.getByText("ENTER"));
      act(() => {
        capturedLoginCallbacks?.onError?.("exited_auth_flow");
      });
      expect(
        container.querySelector(`${FRAME} [data-web-access="error"]`),
      ).not.toBeNull();
    });

    it("adds NO frame of its own once children are admitted", () => {
      // The layout already frames the app. A frame here would nest two bezels.
      authenticatedMock = true;
      addressMock = "0xabc0000000000000000000000000000000000000";
      const { container } = renderGate();
      expect(container.querySelector(FRAME)).toBeNull();
      expect(screen.getByText(CHILD)).toBeTruthy();
    });
  });

  describe("analytics", () => {
    it("emits gate_viewed with only the surface, no PII", () => {
      renderGate("play");
      const viewed = trackMock.mock.calls.find(
        ([event]) => event === WEB_ACCESS_EVENTS.gateViewed,
      );
      expect(viewed).toBeDefined();
      expect(viewed?.[1]).toEqual({ surface: "play" });
    });

    it("emits login_started on the CTA and login_succeeded on completion", () => {
      const { rerender } = renderGate();
      fireEvent.click(screen.getByText("ENTER"));
      expect(
        trackMock.mock.calls.some(
          ([event]) => event === WEB_ACCESS_EVENTS.loginStarted,
        ),
      ).toBe(true);

      authenticatedMock = true;
      rerender(
        <WebAccessGate surface="learn">
          <div>{CHILD}</div>
        </WebAccessGate>,
      );
      expect(
        trackMock.mock.calls.some(
          ([event]) => event === WEB_ACCESS_EVENTS.loginSucceeded,
        ),
      ).toBe(true);
    });

    it("emits wallet_ready and never attaches PII keys to any event", () => {
      authenticatedMock = true;
      addressMock = "0xabc0000000000000000000000000000000000000";
      renderGate();
      expect(
        trackMock.mock.calls.some(
          ([event]) => event === WEB_ACCESS_EVENTS.walletReady,
        ),
      ).toBe(true);

      const forbidden = ["email", "address", "token", "name", "user"];
      for (const [, props] of trackMock.mock.calls) {
        for (const key of Object.keys(props ?? {})) {
          expect(forbidden).not.toContain(key.toLowerCase());
        }
      }
    });
  });
});
