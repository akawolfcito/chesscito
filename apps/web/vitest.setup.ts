import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Async server components migrated to Stage C call
// `getTranslations(namespace)` from `next-intl/server`. In the unit
// suite there's no request context to drive the next-intl runtime,
// so we provide a synchronous resolver that walks the EN message
// bundle by dotted path. This keeps copy assertions stable across
// the migration without per-file mock boilerplate.
//
// Client components keep using `useTranslations`, which resolves
// through the `NextIntlClientProvider` mounted by `renderWithIntl`
// (see src/test-utils/render-with-intl.tsx).
vi.mock("next-intl/server", async () => {
  const enModule = await import("@/lib/content/messages/en");
  const en = enModule.default as Record<string, unknown>;
  const resolve = (path: string): unknown =>
    path
      .split(".")
      .reduce<unknown>((acc, segment) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[segment]
          : undefined,
      en);
  return {
    getTranslations: async (namespace?: string) => {
      const t = ((key: string) =>
        resolve(namespace ? `${namespace}.${key}` : key) as string) as ((
        key: string,
      ) => string) & {
        raw: (key: string) => unknown;
      };
      t.raw = (key: string) =>
        resolve(namespace ? `${namespace}.${key}` : key);
      return t;
    },
    setRequestLocale: () => {},
    getLocale: async () => "en",
    getMessages: async () => en,
  };
});
