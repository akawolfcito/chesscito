import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

let accountAddress: string | undefined;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: accountAddress }),
}));

import { proStatusQueryKey } from "@/lib/pro/use-pro-status";
import { ThemeVariantProvider } from "../theme-variant-provider";
import { THEMES } from "../theme-registry";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const originalTraining = THEMES["candy-forest"].assets["hub.training"];

function Subject({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeVariantProvider>
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  accountAddress = undefined;
  THEMES["candy-forest"].assets["hub.training"] = {
    default: "/art/default-training",
    pro: "/art/pro-training",
  };
});

afterEach(() => {
  THEMES["candy-forest"].assets["hub.training"] = originalTraining;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PRO entitlement to runtime theme integration", () => {
  it("updates every observer after late MiniPay hydration and shared status changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        expiresAt: Date.now() + 86_400_000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<Subject queryClient={queryClient} />);
    const image = view.getByRole("img");
    expect(image).toHaveAttribute("src", "/art/default-training.png");

    accountAddress = WALLET;
    view.rerender(<Subject queryClient={queryClient} />);
    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/art/pro-training.png");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      queryClient.setQueryData(proStatusQueryKey(WALLET), {
        active: false,
        expiresAt: null,
      });
    });
    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/art/default-training.png");
    });
  });
});
