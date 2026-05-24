import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation primitives.
 *
 * Use these instead of the raw `next/link` + `next/navigation` exports
 * whenever the target is an in-app route. They auto-prepend the active
 * locale segment so `<Link href="/hub">` resolves to `/en/hub` for an
 * EN session and `/es/hub` for an ES one — no manual locale threading
 * at every call site.
 *
 * When to keep raw next/navigation:
 *   - External anchors (`<a href="https://...">`) — already locale-free.
 *   - `/api/*`, `/dev/*` — locale-agnostic on purpose (excluded from
 *     middleware in `src/middleware.ts`).
 *   - Cases where the caller must explicitly switch locales — use
 *     `router.replace(path, { locale: 'es' })` from THIS module, not
 *     a manual regex swap.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
