import { describe, it, expect, vi } from "vitest";
import {
  renderWithIntl as render,
  screen,
  fireEvent,
} from "@/test-utils/render-with-intl";
import { AccountCoachRow } from "../account-coach-row";
import { ACCOUNT_SHEET_COPY } from "@/lib/content/editorial";

describe("AccountCoachRow — Mi Coach row in AccountSheet", () => {
  it("renders the row label from ACCOUNT_SHEET_COPY", () => {
    render(
      <AccountCoachRow
        isPro={false}
        credits={3}
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByText(ACCOUNT_SHEET_COPY.coachRowLabel),
    ).toBeInTheDocument();
  });

  it("shows 'Talking' status when isPro is true", () => {
    render(
      <AccountCoachRow
        isPro
        credits={0}
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByText(ACCOUNT_SHEET_COPY.coachStatusActive),
    ).toBeInTheDocument();
  });

  it("shows 'Free' status when free user has credits remaining", () => {
    render(
      <AccountCoachRow
        isPro={false}
        credits={2}
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByText(ACCOUNT_SHEET_COPY.coachStatusFree),
    ).toBeInTheDocument();
  });

  it("shows 'Out of free' status when free user has 0 credits", () => {
    render(
      <AccountCoachRow
        isPro={false}
        credits={0}
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByText(ACCOUNT_SHEET_COPY.coachStatusEmpty),
    ).toBeInTheDocument();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    render(
      <AccountCoachRow
        isPro={false}
        credits={1}
        onPress={onPress}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: ACCOUNT_SHEET_COPY.coachRowLabel,
      }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
