import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { preconnectProductOrigins } from "@/lib/connection-hints";

/**
 * No <html>/<body> here — the root `app/layout.tsx` already renders those
 * for every route (locale and non-locale alike). This layout only scopes
 * next-intl to the onboarding subtree.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  // This layout contains the Learn/Play selector. Warm exactly its two exits,
  // not the unrelated classic, pricing, or stats routes under the landing.
  preconnectProductOrigins();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
