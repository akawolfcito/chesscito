import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { afterEach, vi } from "vitest";

const testRouter = {
  back: vi.fn(),
  forward: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** Default App Router contract for component tests without a Next runtime. */
vi.mock("next/navigation", () => ({
  useRouter: () => testRouter,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: (path: string) => path,
  notFound: () => undefined,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  Object.values(testRouter).forEach((mock) => mock.mockReset());
});

// `@/i18n/navigation` wraps next-intl's `createNavigation()` so internal
// `<Link>` calls are locale-aware in the live app. In the unit suite
// next-intl's deep import of `next/navigation` fails to resolve under
// pnpm's strict layout (createNavigation.js → next/navigation → ENOENT),
// so we provide a minimal stub here. The stub renders Link as a plain
// `<a>` and forwards usePathname/useRouter to the next/navigation
// mocks the individual test files already install. Behavior is good
// enough for every assertion the suite makes (text content, click
// handlers, role queries) without dragging the next-intl bundle into
// the test resolver graph.
vi.mock("@/i18n/navigation", async () => {
  const nextNav = await import("next/navigation");
  const Link = ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children);
  Link.displayName = "MockedI18nLink";
  return {
    Link,
    redirect: (path: string) => path,
    usePathname: nextNav.usePathname,
    useRouter: nextNav.useRouter,
    getPathname: ({ href }: { href: string }) => href,
  };
});

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
