import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/content/messages/en";
import { routing, type Locale } from "@/i18n/routing";

type Options = Omit<RenderOptions, "wrapper"> & { locale?: Locale };

/** Test helper mirroring apps/web's renderWithIntl — wraps a tree with
 * NextIntlClientProvider loading the EN bundle (the only real content
 * today; ES is a placeholder mirror). */
export function renderWithIntl(ui: ReactElement, options: Options = {}): RenderResult {
  const { locale = routing.defaultLocale, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...rest,
  });
}

export { screen, fireEvent, waitFor, within } from "@testing-library/react";
