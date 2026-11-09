import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LottieAnimation } from "../lottie-animation";

/** Both renderer libraries (~109KB gz combined) must stay OUT of the
 *  synchronous module graph — they load via dynamic import() on first
 *  mount. These mocks stand in for the lazy-loaded modules. */
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: ({ className, src }: { className?: string; src: string }) => (
    <div data-testid="dotlottie-renderer" data-src={src} className={className} />
  ),
}));

vi.mock("lottie-react", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="lottie-json-renderer" className={className} />
  ),
}));

describe("LottieAnimation lazy renderers", () => {
  it("reserves the box with a placeholder before the .lottie renderer resolves", async () => {
    const { container } = render(
      <LottieAnimation src="/animations/sandy-loading.lottie" className="size-box" />,
    );

    // Synchronous first paint: the renderer must NOT be there yet (it loads
    // via import()), but a placeholder div carries the className so the
    // layout box is reserved (CLS guard) while the import is in flight.
    expect(screen.queryByTestId("dotlottie-renderer")).toBeNull();
    const placeholder = container.querySelector("div.size-box");
    expect(placeholder).not.toBeNull();

    expect(await screen.findByTestId("dotlottie-renderer")).toHaveClass("size-box");
  });

  it("forwards src to the dotlottie renderer after lazy load", async () => {
    render(<LottieAnimation src="/animations/sandy-loading.lottie" />);

    const renderer = await screen.findByTestId("dotlottie-renderer");
    expect(renderer.getAttribute("data-src")).toBe("/animations/sandy-loading.lottie");
  });

  it("lazy-loads the JSON renderer for animationData input", async () => {
    render(<LottieAnimation animationData={{ v: "5.0" }} className="json-box" />);

    expect(await screen.findByTestId("lottie-json-renderer")).toHaveClass("json-box");
  });
});
