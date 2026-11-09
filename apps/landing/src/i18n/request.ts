import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const loaders = {
    en: () => import("@/lib/content/messages/en"),
    es: () => import("@/lib/content/messages/es"),
  };
  const messages = (await loaders[locale]()).default;

  return {
    locale,
    messages,
  };
});
