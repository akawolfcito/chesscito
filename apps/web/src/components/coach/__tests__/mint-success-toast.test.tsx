import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MintSuccessToast } from "../mint-success-toast";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

describe("MintSuccessToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the save confirmation with the token id", () => {
    render(<MintSuccessToast tokenId="42" onDismiss={() => {}} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/mintSavedToast/);
    expect(status).toHaveTextContent(/42/);
  });

  it("auto-dismisses after the timeout", () => {
    const onDismiss = vi.fn();
    render(<MintSuccessToast tokenId="42" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
