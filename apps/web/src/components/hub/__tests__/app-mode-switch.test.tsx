import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { AppModeSwitch } from "../app-mode-switch";
import { APP_MODE_SWITCH_COPY } from "@/lib/content/editorial";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
import { track } from "@/lib/telemetry";

vi.mock("@/components/themes/theme-asset-picture", () => ({
  ThemeAssetPicture: () => null,
}));

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "http://localhost:3002/play-hub", assign },
  });
});

const renderSwitch = (activeMode: "learn" | "play" = "play") =>
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ APP_MODE_SWITCH_COPY }}
    >
      <AppModeSwitch activeMode={activeMode} />
    </NextIntlClientProvider>,
  );

/**
 * The mode switch is the ONLY surface naming the TRAINING side once the
 * mini-tour is removed — tour step 1 was the other one. Removing the tour is
 * accepted on the reading that its apparent lift was selection rather than
 * causation, but that reading has to stay falsifiable: without a tap event
 * there is no way to tell whether TRAINING entry fell afterwards.
 *
 * ⚠️ The event must be emitted BEFORE `window.location.assign`. This is a full
 * navigation, so the queued event only survives because `track` flushes on
 * `pagehide` via `sendBeacon`.
 */
describe("AppModeSwitch telemetry", () => {
  it("reports a tap on the inactive mode, naming where it goes", () => {
    renderSwitch("play");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Training" }),
    );

    expect(track).toHaveBeenCalledWith("app_mode_switch_tap", {
      from: "play",
      to: "learn",
    });
  });

  it("navigates after reporting, never before", () => {
    renderSwitch("play");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Training" }),
    );

    expect(track).toHaveBeenCalled();
    expect(assign).toHaveBeenCalled();
    const trackOrder = vi.mocked(track).mock.invocationCallOrder[0];
    const assignOrder = assign.mock.invocationCallOrder[0];
    expect(trackOrder).toBeLessThan(assignOrder);
  });

  it("stays silent when the active mode is tapped, and does not navigate", () => {
    renderSwitch("play");

    fireEvent.click(screen.getByRole("button", { name: "Switch to Play" }));

    expect(track).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
