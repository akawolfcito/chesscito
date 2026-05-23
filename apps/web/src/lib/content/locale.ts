/**
 * Locale helpers for the content layer. Mirrors `@/i18n/routing` so
 * callers under `lib/content/` don't reach across into the routing
 * config (keeps the dependency direction one-way: i18n knows about
 * content, content knows about its own locale shape).
 *
 * See: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md §4.2
 */
import { routing, type Locale } from "@/i18n/routing";

export type { Locale };

export const LOCALES = routing.locales;
export const DEFAULT_LOCALE = routing.defaultLocale;
