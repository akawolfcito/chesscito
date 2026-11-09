import { routing } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { OnboardingEntry } from "@/components/onboarding/onboarding-entry";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Cookie personalization belongs to the browser, so the localized HTML/RSC
// can be shared safely across visitors and prerendered at build time.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OnboardingEntry />;
}
