import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";

import {
  DesktopAppFrame,
  isAppRoute,
  useDesktopAppFrameContainer,
} from "../desktop-app-frame";

const usePathnameMock = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("isAppRoute", () => {
  it("matches the canonical root and app-route prefixes exactly", () => {
    expect(isAppRoute("/")).toBe(true);
    expect(isAppRoute("/hub")).toBe(true);
    expect(isAppRoute("/exercises")).toBe(true);
    expect(isAppRoute("/arena")).toBe(true);
    expect(isAppRoute("/coach")).toBe(true);
    expect(isAppRoute("/trophies")).toBe(true);
    expect(isAppRoute("/victory")).toBe(true);
  });

  it("matches deep subpaths under app prefixes", () => {
    expect(isAppRoute("/coach/history")).toBe(true);
    expect(isAppRoute("/victory/0x123abc")).toBe(true);
    expect(isAppRoute("/exercises/rook")).toBe(true);
  });

  it("matches locale-prefixed canonical roots", () => {
    expect(isAppRoute("/en")).toBe(true);
    expect(isAppRoute("/es")).toBe(true);
  });

  it("does NOT match the share landing pages", () => {
    expect(isAppRoute("/share")).toBe(false);
    expect(isAppRoute("/share/score")).toBe(false);
    expect(isAppRoute("/share/badge")).toBe(false);
    expect(isAppRoute("/share/daily")).toBe(false);
    expect(isAppRoute("/share/endgame")).toBe(false);
  });

  it("matches informational pages (framed for landing → hub continuity)", () => {
    expect(isAppRoute("/about")).toBe(true);
    expect(isAppRoute("/support")).toBe(true);
    expect(isAppRoute("/terms")).toBe(true);
    expect(isAppRoute("/privacy")).toBe(true);
    expect(isAppRoute("/why")).toBe(true);
  });

  it("does NOT match dev fixture routes", () => {
    expect(isAppRoute("/dev")).toBe(false);
    expect(isAppRoute("/dev/persist-overlay")).toBe(false);
    expect(isAppRoute("/dev/tx-progress")).toBe(false);
  });

  it("does NOT match prefix-collisions (e.g. /hubcap, /arenas-extended)", () => {
    expect(isAppRoute("/hubcap")).toBe(false);
    expect(isAppRoute("/arenas-extended")).toBe(false);
    expect(isAppRoute("/exercise")).toBe(false);
    expect(isAppRoute("/victorious")).toBe(false);
    // Informational route prefix-collisions
    expect(isAppRoute("/aboutme")).toBe(false);
    expect(isAppRoute("/supporter")).toBe(false);
    expect(isAppRoute("/whymyword")).toBe(false);
    expect(isAppRoute("/termsheet")).toBe(false);
    expect(isAppRoute("/privacypolicy")).toBe(false);
  });

  /**
   * Regression guard for the i18n `[locale]` migration — every app
   * surface now lives under `/en` or `/es`, so the matcher must strip
   * the locale segment before checking against the prefix table.
   * Without the strip, the desktop phone-bezel chrome silently
   * disappeared on every URL because nothing matched.
   */
  it("matches /en/<route> and /es/<route> (post-i18n live shape)", () => {
    expect(isAppRoute("/en/hub")).toBe(true);
    expect(isAppRoute("/es/hub")).toBe(true);
    expect(isAppRoute("/en/exercises")).toBe(true);
    expect(isAppRoute("/es/exercises")).toBe(true);
    expect(isAppRoute("/en/arena")).toBe(true);
    expect(isAppRoute("/es/coach/history")).toBe(true);
    expect(isAppRoute("/en/trophies")).toBe(true);
    expect(isAppRoute("/es/victory/0xabc")).toBe(true);
    expect(isAppRoute("/en/about")).toBe(true);
    expect(isAppRoute("/es/support")).toBe(true);
    expect(isAppRoute("/en/why")).toBe(true);
  });

  it("does NOT match locale-prefixed non-app routes", () => {
    expect(isAppRoute("/en/share/daily")).toBe(false);
    expect(isAppRoute("/es/share/badge")).toBe(false);
  });

  it("does NOT mistake an unknown locale segment for a known one", () => {
    // /fr is not in routing.locales — strip must leave it alone so the
    // prefix table doesn't accidentally match the second segment.
    expect(isAppRoute("/fr/hub")).toBe(false);
  });
});

describe("DesktopAppFrame — portal container context", () => {
  afterEach(() => cleanup());

  function ContainerProbe({
    onValue,
  }: {
    onValue: (el: HTMLDivElement | null) => void;
  }) {
    const container = useDesktopAppFrameContainer();
    useEffect(() => {
      onValue(container);
    }, [container, onValue]);
    return null;
  }

  it("exposes the frame inner element to descendants on an app route", () => {
    usePathnameMock.mockReturnValueOnce("/");
    const seen: Array<HTMLDivElement | null> = [];

    const { container } = render(
      <DesktopAppFrame>
        <ContainerProbe onValue={(el) => seen.push(el)} />
      </DesktopAppFrame>,
    );

    const inner = container.querySelector(
      ".desktop-app-frame-inner",
    ) as HTMLDivElement;
    expect(inner).not.toBeNull();
    // After the ref callback fires, the context should resolve to the
    // .desktop-app-frame-inner DOM node so sheets/dialogs can portal
    // their content inside the bezel on desktop.
    expect(seen.at(-1)).toBe(inner);
  });

  it("returns null on non-app routes (sheets fall back to body portal)", () => {
    usePathnameMock.mockReturnValueOnce("/share/score");
    const seen: Array<HTMLDivElement | null> = [];

    render(
      <DesktopAppFrame>
        <ContainerProbe onValue={(el) => seen.push(el)} />
      </DesktopAppFrame>,
    );

    // No frame mounted → no provider → context default value (null).
    // Radix sees `container={undefined}` and portals to document.body.
    expect(seen.at(-1)).toBeNull();
  });
});
