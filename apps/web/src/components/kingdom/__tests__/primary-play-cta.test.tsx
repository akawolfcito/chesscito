import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrimaryPlayCta } from "../primary-play-cta";

const hapticTap = vi.fn();

vi.mock("@/lib/haptics", () => ({
  hapticTap: () => hapticTap(),
}));

beforeEach(() => {
  hapticTap.mockClear();
});

describe("PrimaryPlayCta", () => {
  it("renders the playhub surface with the stone backplate and the battle icon", () => {
    const { container } = render(
      <PrimaryPlayCta surface="playhub" label="PLAY" ariaLabel="Play" />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.textContent).toContain("PLAY");
    expect(cta.className).toMatch(/primary-play-cta\b/);
    expect(cta.className).toMatch(/primary-play-cta--playhub\b/);

    const sources = Array.from(container.querySelectorAll("source"));
    const srcsets = sources.map((s) => s.getAttribute("srcset"));
    expect(srcsets).toContain("/art/redesign/banners/btn-stone-bg.avif");
    expect(srcsets).toContain("/art/redesign/banners/btn-battle.avif");
  });

  it("renders a <button type='button'> with the aria-label from the prop", () => {
    render(
      <PrimaryPlayCta surface="playhub" label="PLAY" ariaLabel="Start training mission" />,
    );
    const cta = screen.getByRole("button", { name: "Start training mission" });
    expect(cta.tagName.toLowerCase()).toBe("button");
    expect(cta).toHaveAttribute("type", "button");
  });

  it("fires onPress + hapticTap when the user taps the CTA", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <PrimaryPlayCta
        surface="playhub"
        label="PLAY"
        ariaLabel="Play"
        onPress={onPress}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onPress or hapticTap when loading", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <PrimaryPlayCta
        surface="playhub"
        label="PLAY"
        ariaLabel="Play"
        onPress={onPress}
        loading
      />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.className).toMatch(/is-loading\b/);
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
  });

  it("does NOT fire onPress or hapticTap when disabled", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <PrimaryPlayCta
        surface="playhub"
        label="PLAY"
        ariaLabel="Play"
        onPress={onPress}
        disabled
      />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.className).toMatch(/is-disabled\b/);
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(onPress).not.toHaveBeenCalled();
    expect(hapticTap).not.toHaveBeenCalled();
  });

  it("renders the btn-play icon for the arena surface", () => {
    const { container } = render(
      <PrimaryPlayCta surface="arena" label="START" ariaLabel="Start arena match" />,
    );
    const cta = screen.getByRole("button", { name: "Start arena match" });
    expect(cta.className).toMatch(/primary-play-cta--arena\b/);
    const srcsets = Array.from(container.querySelectorAll("source")).map((s) =>
      s.getAttribute("srcset"),
    );
    expect(srcsets).toContain("/art/redesign/banners/btn-play.avif");
  });

  it("renders the btn-play icon for the landing-hero surface", () => {
    const { container } = render(
      <PrimaryPlayCta
        surface="landing-hero"
        label="PLAY"
        ariaLabel="Play from hero"
      />,
    );
    const cta = screen.getByRole("button", { name: "Play from hero" });
    expect(cta.className).toMatch(/primary-play-cta--landing-hero\b/);
    const srcsets = Array.from(container.querySelectorAll("source")).map((s) =>
      s.getAttribute("srcset"),
    );
    expect(srcsets).toContain("/art/redesign/banners/btn-play.avif");
  });

  it("renders the btn-play icon for the landing-final-cta surface", () => {
    const { container } = render(
      <PrimaryPlayCta
        surface="landing-final-cta"
        label="PLAY"
        ariaLabel="Play from final cta"
      />,
    );
    const cta = screen.getByRole("button", { name: "Play from final cta" });
    expect(cta.className).toMatch(/primary-play-cta--landing-final-cta\b/);
    const srcsets = Array.from(container.querySelectorAll("source")).map((s) =>
      s.getAttribute("srcset"),
    );
    expect(srcsets).toContain("/art/redesign/banners/btn-play.avif");
  });

  it("merges a custom className alongside the base classes", () => {
    render(
      <PrimaryPlayCta
        surface="playhub"
        label="PLAY"
        ariaLabel="Play"
        className="extra-test-class"
      />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.className).toMatch(/primary-play-cta\b/);
    expect(cta.className).toMatch(/extra-test-class/);
  });

  it("applies the adventure atmosphere by default", () => {
    render(
      <PrimaryPlayCta surface="playhub" label="PLAY" ariaLabel="Play" />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.className).toMatch(/is-atmosphere-adventure\b/);
    expect(cta.className).not.toMatch(/is-atmosphere-scholarly\b/);
  });

  it("applies the scholarly atmosphere when atmosphere='scholarly'", () => {
    render(
      <PrimaryPlayCta
        surface="playhub"
        label="PLAY"
        ariaLabel="Play"
        atmosphere="scholarly"
      />,
    );
    const cta = screen.getByRole("button", { name: "Play" });
    expect(cta.className).toMatch(/is-atmosphere-scholarly\b/);
    expect(cta.className).not.toMatch(/is-atmosphere-adventure\b/);
  });

  it("hides the inner banner <img> elements from assistive tech (button name owns the label)", () => {
    const { container } = render(
      <PrimaryPlayCta surface="playhub" label="PLAY" ariaLabel="Play" />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => {
      expect(img).toHaveAttribute("aria-hidden", "true");
      expect(img).toHaveAttribute("alt", "");
    });
  });
});
