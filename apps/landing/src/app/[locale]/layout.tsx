import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { preconnectProductOrigins } from "@/lib/connection-hints";

import { LandingDocument } from "@/components/landing/landing-document";
export { metadata, viewport } from "@/components/landing/landing-document";

// Locale root owns the document, so raw server HTML receives the segment locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  // This layout contains the Learn/Play selector. Warm exactly its two exits,
  // not the unrelated classic, pricing, or stats routes under the landing.
  preconnectProductOrigins();

  return (
    <LandingDocument locale={locale}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC" formats={{}} now={new Date(0)}>
        {children}
      </NextIntlClientProvider>
    </LandingDocument>
  );
}
