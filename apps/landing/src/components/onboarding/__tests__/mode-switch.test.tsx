import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { ModeSwitch } from "@/components/onboarding/mode-switch";

type FrameCallback = FrameRequestCallback;

function renderSwitch(lastUsedMode: "learn" | "play" | null = null) {
  const callbacks: FrameCallback[] = [];
  const requestAnimationFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

  const view = renderWithIntl(<ModeSwitch lastUsedMode={lastUsedMode} />);
  return { ...view, callbacks, requestAnimationFrame };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ModeSwitch navigation feedback", () => {
  it("keeps the native destinations on both links", () => {
    renderSwitch();

    expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(screen.getByRole("link", { name: /^play$/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=play",
    );
  });

  // The gold half is a product recommendation, not a reading of the
  // visitor's history. Pending feedback must not change that contract.
  it("recommends Learn regardless of what the visitor last chose", () => {
    for (const mode of [null, "learn", "play"] as const) {
      const { unmount } = renderSwitch(mode);
      expect(screen.getByRole("link", { name: /training/i })).toHaveAttribute(
        "data-recommended",
        "true",
      );
      expect(screen.getByRole("link", { name: /^play$/i })).not.toHaveAttribute(
        "data-recommended",
      );
      unmount();
    }
  });

  it("never uses aria-pressed on the links", () => {
    renderSwitch();
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-pressed");
    }
  });

  it("keeps the Last used association accessible", () => {
    renderWithIntl(<ModeSwitch lastUsedMode="play" />);
    const label = screen.getByText(/last used/i);
    const play = screen.getByRole("link", { name: /^play$/i });

    expect(play).toHaveAttribute("aria-describedby", label.id);
    expect(screen.getByRole("link", { name: /training/i })).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("translates labels and the Last used badge", () => {
    renderWithIntl(<ModeSwitch lastUsedMode="learn" />, { locale: "es" });

    expect(screen.getByRole("link", { name: /entrenar/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(screen.getByText("Última vez")).toBeInTheDocument();
  });

  it("starts Learn navigation, paints persistent feedback, and blocks both CTAs", () => {
    const { callbacks, requestAnimationFrame } = renderSwitch();
    const learn = screen.getByRole("link", { name: /training/i });
    const play = screen.getByRole("link", { name: /^play$/i });
    expect(fireEvent.click(learn)).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Opening Learn…");
    expect(screen.getByRole("group", { name: /choose your path/i })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(learn).toHaveAttribute("aria-disabled", "true");
    expect(play).toHaveAttribute("aria-disabled", "true");
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
  });

  it("shows the Play-specific pending state", () => {
    renderSwitch();

    fireEvent.click(screen.getByRole("link", { name: /^play$/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Opening Play…");
    expect(screen.getByRole("group", { name: /choose your path/i })).toHaveAttribute(
      "data-pending",
      "play",
    );
  });

  it("does not schedule a second navigation after a repeated tap", () => {
    const { callbacks, requestAnimationFrame } = renderSwitch();
    const learn = screen.getByRole("link", { name: /training/i });
    const play = screen.getByRole("link", { name: /^play$/i });

    fireEvent.click(learn);
    fireEvent.click(play);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Opening Learn…");
  });

  it("emits the tap and first-feedback timing events without identifier data", () => {
    const { callbacks } = renderSwitch();
    const tap = vi.fn();
    const painted = vi.fn();
    window.addEventListener("chesscito:selection_tap", tap);
    window.addEventListener("chesscito:selection_feedback_painted", painted);

    fireEvent.click(screen.getByRole("link", { name: /training/i }));
    callbacks[0](performance.now());

    expect(tap).toHaveBeenCalledTimes(1);
    expect(painted).toHaveBeenCalledTimes(1);
    expect(tap.mock.calls[0][0].detail).toMatchObject({ mode: "learn", elapsedMs: 0 });
    expect(painted.mock.calls[0][0].detail).toMatchObject({ mode: "learn" });

    window.removeEventListener("chesscito:selection_tap", tap);
    window.removeEventListener("chesscito:selection_feedback_painted", painted);
  });
});
