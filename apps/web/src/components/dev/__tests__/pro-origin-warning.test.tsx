import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { ProOriginWarning } from "../pro-origin-warning";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ProOriginWarning", () => {
  it("stays hidden when the current host is accepted", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", window.location.origin);
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_URL", window.location.origin);

    render(<ProOriginWarning />);

    await waitFor(() => {
      expect(screen.queryByTestId("pro-origin-warning")).not.toBeInTheDocument();
    });
  });

  it("shows a non-destructive warning for a mismatched host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://different.ngrok-free.app");
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_URL", "https://different.ngrok-free.app");

    render(<ProOriginWarning />);

    const warning = await screen.findByTestId("pro-origin-warning");
    expect(warning).toHaveTextContent("PRO origin mismatch");
    expect(warning).toHaveTextContent("PRO status is unknown");
    expect(warning).toHaveTextContent("different.ngrok-free.app");
  });

  it("never renders outside local development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://different.ngrok-free.app");

    render(<ProOriginWarning />);

    expect(screen.queryByTestId("pro-origin-warning")).not.toBeInTheDocument();
  });
});
