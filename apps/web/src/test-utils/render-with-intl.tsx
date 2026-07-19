import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { routing, type Locale } from "@/i18n/routing";

const BUNDLES: Record<Locale, Record<string, unknown>> = {
  en: enMessages as Record<string, unknown>,
  es: esMessages as Record<string, unknown>,
};

type Options = Omit<RenderOptions, "wrapper"> & {
  locale?: Locale;
};

/**
 * Test helper: renders a tree wrapped with `NextIntlClientProvider`
 * loading the message bundle for the requested locale (defaults to
 * the routing default, `en`).
 *
 * Use this in place of `@testing-library/react`'s `render` for any
 * component that calls `useTranslations` (directly or via a child).
 * Components that don't touch translations still work — the
 * provider is inert.
 *
 * The provider's `onError` and `getMessageFallback` are noop'd so
 * missing keys surface as their literal path (e.g.
 * `'COACH_COPY.yourSessions'`) instead of throwing. That keeps
 * assertions stable during the surface-by-surface Stage C
 * migration when not every key may be wired yet.
 */
export function renderWithIntl(
  ui: ReactElement,
  options: Options = {},
): RenderResult {
  const { locale = routing.defaultLocale, ...rest } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
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
    ),
    ...rest,
  });
}

export { screen, fireEvent, waitFor, within, act } from "@testing-library/react";
