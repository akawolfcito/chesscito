import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { WagmiProvider } from "wagmi";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { routing, type Locale } from "@/i18n/routing";
import { wagmiConfig } from "@/components/wallet-provider";

const BUNDLES: Record<Locale, Record<string, unknown>> = {
  en: enMessages as Record<string, unknown>,
  es: esMessages as Record<string, unknown>,
};

type Options = Omit<RenderOptions, "wrapper"> & { locale?: Locale };

/**
 * Opt-in renderer for wallet-backed UI. A fresh QueryClient per render avoids
 * query-cache leakage while leaving tests that mock wagmi import-free.
 */
export function renderWithAppProviders(
  ui: ReactElement,
  options: Options = {},
): RenderResult {
  const { locale = routing.defaultLocale, ...rest } = options;
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider
            locale={locale}
            messages={BUNDLES[locale]}
            onError={() => {}}
            getMessageFallback={({ key, namespace }) =>
              namespace ? `${namespace}.${key}` : key
            }
          >
            {children}
          </NextIntlClientProvider>
        </QueryClientProvider>
      </WagmiProvider>
    ),
    ...rest,
  });
}
