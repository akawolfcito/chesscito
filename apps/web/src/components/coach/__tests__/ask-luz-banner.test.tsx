import { describe, it, expect, vi } from "vitest";
import {
  renderWithIntl as render,
  screen,
  fireEvent,
} from "@/test-utils/render-with-intl";
import { AskLuzBanner } from "../ask-luz-banner";
import { COACH_COPY } from "@/lib/content/editorial";

describe("AskLuzBanner — /coach/history CTA when free user has 0 calls", () => {
  it("renders Luz voice title + subtitle from COACH_COPY", () => {
    render(<AskLuzBanner onPress={() => {}} />);
    expect(
      screen.getByText(COACH_COPY.historyAskNextTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(COACH_COPY.historyAskNextSub),
    ).toBeInTheDocument();
  });

  it("is a button labelled by the title for AT users", () => {
    render(<AskLuzBanner onPress={() => {}} />);
    const btn = screen.getByRole("button", {
      name: COACH_COPY.historyAskNextTitle,
    });
    expect(btn).toBeInTheDocument();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    render(<AskLuzBanner onPress={onPress} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: COACH_COPY.historyAskNextTitle,
      }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
