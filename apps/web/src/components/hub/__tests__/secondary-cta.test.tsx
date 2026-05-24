import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { SecondaryCta } from "@/components/hub/secondary-cta";

describe("<SecondaryCta>", () => {
  it("renders with the Arena label by default", () => {
    render(<SecondaryCta onPress={() => {}} />);
    expect(screen.getByRole("button", { name: /enter arena/i })).toBeInTheDocument();
  });

  it("fires onPress on tap", () => {
    const onPress = vi.fn();
    render(<SecondaryCta onPress={onPress} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalled();
  });
});
