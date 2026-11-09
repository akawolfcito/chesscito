import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { routing, type Locale } from "@/i18n/routing";

type Options = Omit<RenderOptions, "wrapper"> & { locale?: Locale };

/**
 * Test helper mirroring apps/web's renderWithIntl.
 *
 * Loads the bundle that MATCHES the requested locale. It used to hand the EN
 * bundle to every render, `locale: "es"` included, which was harmless while ES
 * was a placeholder mirror and blinding once it carried real copy: a test
 * asserting Spanish output would have read English and passed on the wrong
 * evidence.
 */
const BUNDLES: Record<Locale, typeof enMessages> = {
  en: enMessages,
  es: esMessages,
};

export function renderWithIntl(ui: ReactElement, options: Options = {}): RenderResult {
  const { locale = routing.defaultLocale, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={BUNDLES[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
    ...rest,
  });
}

export { screen, fireEvent, waitFor, within } from "@testing-library/react";
