import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// Async server components (WelcomeBack) call getTranslations() from
// next-intl/server, which needs a real Next.js request context we don't
// have in the unit suite. Resolve synchronously from the EN bundle instead
// — mirrors apps/web's vitest.setup.ts mock.
vi.mock("next-intl/server", async () => {
  const enModule = await import("@/lib/content/messages/en");
  const en = enModule.default as Record<string, unknown>;
  const resolve = (path: string): unknown =>
    path
      .split(".")
      .reduce<unknown>(
        (acc, segment) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[segment] : undefined,
        en,
      );
  return {
    getTranslations: async (namespace?: string) => {
      const t = ((key: string) => resolve(namespace ? `${namespace}.${key}` : key) as string) as ((
        key: string,
      ) => string) & { raw: (key: string) => unknown };
      t.raw = (key: string) => resolve(namespace ? `${namespace}.${key}` : key);
      return t;
    },
    setRequestLocale: () => {},
    getLocale: async () => "en",
    getMessages: async () => en,
  };
});
