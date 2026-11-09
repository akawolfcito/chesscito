import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

type SearchParams = Record<string, string | string[] | undefined>;

function appendSearchParams(target: URLSearchParams, searchParams: SearchParams): void {
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) target.append(key, entry);
    } else if (value !== undefined) {
      target.append(key, value);
    }
  }
}

/**
 * Defensive route-level fallback for the legacy `/hub` URL.
 *
 * `next.config.js` normally redirects before this page executes. Keeping the
 * route makes the alias resilient if routing order changes, and explicitly
 * preserves repeated query parameters without relying on config behavior.
 */
export default function LegacyHubPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  const root = params.locale === routing.defaultLocale ? "/" : `/${params.locale}`;
  const query = new URLSearchParams();
  appendSearchParams(query, searchParams);
  const serialized = query.toString();

  redirect(`${root}${serialized ? `?${serialized}` : ""}`);
}
