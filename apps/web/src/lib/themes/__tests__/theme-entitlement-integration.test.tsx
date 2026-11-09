import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";

let accountAddress: string | undefined;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: accountAddress }),
}));

import { proStatusQueryKey } from "@/lib/pro/use-pro-status";
import { ThemeVariantProvider } from "../theme-variant-provider";
import { THEMES } from "../theme-registry";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const originalTraining = THEMES["candy-forest"].assets["hub.training"];

function RouteSurface({ name }: { name: string }) {
  const isPro = useIsProActive();
  return (
    <section data-testid={`${name}-surface`} data-pro={isPro}>
      <ThemeAssetPicture slot="hub.training" alt={`${name} Training`} />
    </section>
  );
}

function Subject({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeVariantProvider>
        <RouteSurface name="learn-hub" />
        <RouteSurface name="play-hub" />
        <RouteSurface name="coach" />
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          active: true,
          expiresAt: Date.now() + 86_400_000,
        }),
      })
      .mockRejectedValueOnce(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<Subject queryClient={queryClient} />);
    const images = view.getAllByRole("img");
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image).toHaveAttribute("src", "/art/default-training.png");
    }

    accountAddress = WALLET;
    view.rerender(<Subject queryClient={queryClient} />);
    await waitFor(() => {
      for (const image of images) {
        expect(image).toHaveAttribute("src", "/art/pro-training.png");
      }
      expect(view.getByTestId("learn-hub-surface")).toHaveAttribute("data-pro", "true");
      expect(view.getByTestId("play-hub-surface")).toHaveAttribute("data-pro", "true");
      expect(view.getByTestId("coach-surface")).toHaveAttribute("data-pro", "true");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: proStatusQueryKey(WALLET) });
    });
    await waitFor(() => {
      for (const image of images) {
        expect(image).toHaveAttribute("src", "/art/pro-training.png");
      }
      expect(view.getByTestId("learn-hub-surface")).toHaveAttribute("data-pro", "false");
      expect(view.getByTestId("play-hub-surface")).toHaveAttribute("data-pro", "false");
      expect(view.getByTestId("coach-surface")).toHaveAttribute("data-pro", "false");
    });

    act(() => {
      queryClient.setQueryData(proStatusQueryKey(WALLET), {
        active: false,
        expiresAt: null,
      });
    });
    await waitFor(() => {
      for (const image of images) {
        expect(image).toHaveAttribute("src", "/art/default-training.png");
      }
      expect(view.getByTestId("learn-hub-surface")).toHaveAttribute("data-pro", "false");
      expect(view.getByTestId("play-hub-surface")).toHaveAttribute("data-pro", "false");
      expect(view.getByTestId("coach-surface")).toHaveAttribute("data-pro", "false");
    });
  });
});
